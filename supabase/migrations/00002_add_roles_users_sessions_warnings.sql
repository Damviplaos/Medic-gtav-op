
-- ─── ยศ (Roles) ──────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_system boolean NOT NULL DEFAULT false,
  -- สิทธิ์ต่างๆ
  can_create_account boolean NOT NULL DEFAULT false,
  can_manage_roles boolean NOT NULL DEFAULT false,
  can_change_others_status boolean NOT NULL DEFAULT false,
  can_view_overview_dashboard boolean NOT NULL DEFAULT false,
  can_issue_warnings boolean NOT NULL DEFAULT false,
  can_access_settings boolean NOT NULL DEFAULT false,
  can_manage_doctors boolean NOT NULL DEFAULT false,
  can_next_queue boolean NOT NULL DEFAULT false,
  can_set_operator boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT '#6B7280',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ยศพิเศษที่มีอยู่เสมอ
INSERT INTO roles (name, is_system, can_create_account, can_manage_roles, can_change_others_status, can_view_overview_dashboard, can_issue_warnings, can_access_settings, can_manage_doctors, can_next_queue, can_set_operator, color) VALUES
  ('admin', true, true, true, true, true, true, true, true, true, true, '#EF4444'),
  ('ผอ', true, true, false, true, true, true, true, true, true, true, '#F59E0B'),
  ('OP', false, false, false, true, false, false, false, false, true, true, '#22C55E'),
  ('หมอ', false, false, false, false, false, false, false, false, false, false, '#3B82F6');

-- ─── โปรไฟล์ผู้ใช้ (User Profiles) ─────────────────────────────────────────
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Work Sessions (บันทึก login/logout) ─────────────────────────────────────
CREATE TABLE work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_at timestamptz NOT NULL DEFAULT now(),
  logout_at timestamptz,
  duration_minutes integer GENERATED ALWAYS AS (
    CASE
      WHEN logout_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (logout_at - login_at))::integer / 60
      ELSE NULL
    END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── ใบเตือน (Warnings) ──────────────────────────────────────────────────────
CREATE TABLE warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issued_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Settings เพิ่ม required_hours_per_week ──────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('required_hours_per_week', '20')
ON CONFLICT (key) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

-- Roles: อ่านได้ทุกคน, จัดการได้เฉพาะ authenticated
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read roles" ON roles FOR SELECT TO anon USING (true);
CREATE POLICY "anon no insert roles" ON roles FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon no update roles" ON roles FOR UPDATE TO anon USING (false);
CREATE POLICY "anon no delete roles" ON roles FOR DELETE TO anon USING (false);
CREATE POLICY "auth read roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert roles" ON roles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update roles" ON roles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete roles" ON roles FOR DELETE TO authenticated USING (true);

-- User profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon no read profiles" ON user_profiles FOR SELECT TO anon USING (false);
CREATE POLICY "anon no insert profiles" ON user_profiles FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon no update profiles" ON user_profiles FOR UPDATE TO anon USING (false);
CREATE POLICY "anon no delete profiles" ON user_profiles FOR DELETE TO anon USING (false);
CREATE POLICY "auth read profiles" ON user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert profiles" ON user_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update own profile" ON user_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete profiles" ON user_profiles FOR DELETE TO authenticated USING (true);

-- Work sessions
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon no read sessions" ON work_sessions FOR SELECT TO anon USING (false);
CREATE POLICY "anon no insert sessions" ON work_sessions FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon no update sessions" ON work_sessions FOR UPDATE TO anon USING (false);
CREATE POLICY "anon no delete sessions" ON work_sessions FOR DELETE TO anon USING (false);
CREATE POLICY "auth read all sessions" ON work_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own session" ON work_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update own session" ON work_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete own session" ON work_sessions FOR DELETE TO authenticated USING (true);

-- Warnings
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon no read warnings" ON warnings FOR SELECT TO anon USING (false);
CREATE POLICY "anon no insert warnings" ON warnings FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "anon no update warnings" ON warnings FOR UPDATE TO anon USING (false);
CREATE POLICY "anon no delete warnings" ON warnings FOR DELETE TO anon USING (false);
CREATE POLICY "auth read warnings" ON warnings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert warnings" ON warnings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update warnings" ON warnings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete warnings" ON warnings FOR DELETE TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE work_sessions;
