// =============================================
// Database Types
// =============================================

export type SystemRole = 'super_admin' | 'admin' | 'user';

export interface Profile {
  id: string;
  username: string;
  nickname: string | null;
  ic_name: string | null;
  system_role: SystemRole;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  name: string;
  display_name: string;
  sort_order: number;
  track_time: boolean;
  created_at: string;
}

export interface UserPresence {
  id: string;
  user_id: string;
  channel_id: string;
  joined_channel_at: string;
  is_op: boolean;
  queue_position: number | null;
  session_started_at: string;
  last_heartbeat: string;
  created_at: string;
  // joined from profiles
  profile?: Profile;
  // joined from channels
  channel?: Channel;
}

export interface QueuePointer {
  id: string;
  pointed_user_id: string | null;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface RoleCriteria {
  id: string;
  role_id: string;
  next_role_id: string | null;
  min_work_hours_per_week: number | null;
  min_op_hours_per_week: number | null;
  work_hours_enabled: boolean;
  op_hours_enabled: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by: string | null;
  // joined
  role?: Role;
  profile?: Profile;
}

export interface TimeLog {
  id: string;
  user_id: string;
  channel_id: string;
  started_at: string;
  ended_at: string | null;
  is_op_time: boolean;
  duration_seconds: number | null;
  created_at: string;
}

export interface WeeklyStats {
  id: string;
  user_id: string;
  week_start: string;
  total_work_seconds: number;
  total_op_seconds: number;
  updated_at: string;
  // joined
  profile?: Profile;
}

// =============================================
// App State Types
// =============================================

export interface PresenceWithProfile extends UserPresence {
  profile: Profile;
  channel: Channel;
}

export interface UserWithStats {
  profile: Profile;
  roles: Role[];
  weekly_work_seconds: number;
  weekly_op_seconds: number;
  today_work_seconds: number;
  today_op_seconds: number;
  promotion_eligible: boolean;
  current_role?: Role;
  next_role?: Role;
}

export interface DailyStats {
  date: string;
  total_work_seconds: number;
  total_op_seconds: number;
}

export interface Warning {
  id: string;
  user_id: string;
  issued_by: string;
  reason: string;
  severity: 'minor' | 'major' | 'critical';
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  issuer?: Profile;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission: string;
  enabled: boolean;
}

export interface AttendanceLog {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  session_date: string;
  synced_to_sheets: boolean;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
}

export const ALL_PERMISSIONS = [
  { key: 'view_queue', label: 'ดูหน้าคิวงาน', group: 'ทั่วไป' },
  { key: 'view_own_dashboard', label: 'ดู Dashboard ส่วนตัว', group: 'ทั่วไป' },
  { key: 'toggle_op', label: 'ขึ้น/ลง OP', group: 'ทั่วไป' },
  { key: 'view_admin_dashboard', label: 'ดูภาพรวมหน่วยงาน', group: 'แอดมิน' },
  { key: 'view_inactivity', label: 'ดูรายชื่อขาดงาน', group: 'แอดมิน' },
  { key: 'manage_users', label: 'จัดการผู้ใช้งาน', group: 'แอดมิน' },
  { key: 'manage_roles', label: 'จัดการยศ', group: 'แอดมิน' },
  { key: 'issue_warnings', label: 'ออกใบเตือน', group: 'แอดมิน' },
  { key: 'manage_settings', label: 'ตั้งค่าระบบ', group: 'แอดมิน' },
  { key: 'reset_queue', label: 'รีเซ็ตคิว', group: 'แอดมิน' },
] as const;

export type PermissionKey = typeof ALL_PERMISSIONS[number]['key'];

export type InactiveUser = {
  user_id: string;
  username: string;
  nickname: string | null;
  ic_name: string | null;
  last_seen: string | null;
  hours_absent: number;
};
