
-- system_settings
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_all_settings" ON system_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')));
INSERT INTO system_settings (key, value, description) VALUES
  ('project_name', 'MEDIC Queue System', 'ชื่อโปรเจกต์/เว็บไซต์'),
  ('project_logo', '', 'URL โลโก้ระบบ'),
  ('system_enabled', 'true', 'เปิด/ปิดระบบหลัก'),
  ('sheets_credentials_json', '', 'Google Service Account JSON credentials'),
  ('sheets_spreadsheet_id', '', 'Spreadsheet ID สำหรับตอกบัตร'),
  ('sheets_sheet_name', 'Attendance', 'ชื่อชีทที่ใช้บันทึก'),
  ('discord_webhook_url', '', 'Discord Webhook URL สำหรับแจ้งเตือน'),
  ('discord_notify_op_change', 'false', 'แจ้งเตือนเมื่อมีการเปลี่ยน OP'),
  ('discord_notify_inactivity', 'false', 'แจ้งเตือนสมาชิกขาดงาน'),
  ('inactivity_threshold_hours', '24', 'จำนวนชั่วโมงที่ถือว่าขาดงาน'),
  ('queue_auto_reset_enabled', 'false', 'รีเซ็ตคิวอัตโนมัติทุกวัน');

-- warnings
CREATE TABLE warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ
);
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_all_warnings" ON warnings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')));
CREATE POLICY "users_read_own_warnings" ON warnings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- role_permissions
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, permission)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_all_role_permissions" ON role_permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')));
CREATE POLICY "authenticated_read_role_permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (true);

-- attendance_logs
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  session_date DATE NOT NULL,
  synced_to_sheets BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_all_attendance" ON attendance_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role IN ('admin','super_admin')));
CREATE POLICY "users_read_own_attendance" ON attendance_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "users_insert_own_attendance" ON attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_own_attendance" ON attendance_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- RPCs
CREATE OR REPLACE FUNCTION get_user_detail_stats(p_user_id UUID, p_week_start DATE)
RETURNS TABLE(total_work_seconds BIGINT, total_op_seconds BIGINT, warning_count BIGINT, active_warning_count BIGINT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COALESCE(ws.total_work_seconds, 0)::BIGINT,
    COALESCE(ws.total_op_seconds, 0)::BIGINT,
    (SELECT COUNT(*) FROM warnings w WHERE w.user_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM warnings w WHERE w.user_id = p_user_id AND w.is_active = true)::BIGINT
  FROM (SELECT 1) dummy
  LEFT JOIN weekly_stats ws ON ws.user_id = p_user_id AND ws.week_start = p_week_start;
$$;

CREATE OR REPLACE FUNCTION get_inactive_users(p_threshold_hours INT DEFAULT 24)
RETURNS TABLE(user_id UUID, username TEXT, nickname TEXT, ic_name TEXT, last_seen TIMESTAMPTZ, hours_absent NUMERIC)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, p.username, p.nickname, p.ic_name,
    up.last_heartbeat,
    ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(up.last_heartbeat, p.created_at))) / 3600, 1)
  FROM profiles p
  LEFT JOIN user_presence up ON up.user_id = p.id
  WHERE up.last_heartbeat IS NULL
     OR EXTRACT(EPOCH FROM (now() - up.last_heartbeat)) / 3600 > p_threshold_hours
  ORDER BY up.last_heartbeat ASC NULLS FIRST;
$$;

CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(permission TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT DISTINCT rp.permission
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id AND rp.enabled = true
  WHERE ur.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION clock_in_attendance(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO attendance_logs (user_id, clock_in, session_date)
  VALUES (p_user_id, now(), CURRENT_DATE)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION clock_out_attendance(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_log_id UUID;
BEGIN
  SELECT id INTO v_log_id
  FROM attendance_logs
  WHERE user_id = p_user_id AND session_date = CURRENT_DATE AND clock_out IS NULL
  ORDER BY clock_in DESC
  LIMIT 1;
  IF v_log_id IS NOT NULL THEN
    UPDATE attendance_logs SET clock_out = now() WHERE id = v_log_id;
  END IF;
END;
$$;
