export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

// ─── ระบบยศ ──────────────────────────────────────────────────────────────────
export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  can_create_account: boolean;
  can_manage_roles: boolean;
  can_change_others_status: boolean;
  can_view_overview_dashboard: boolean;
  can_issue_warnings: boolean;
  can_access_settings: boolean;
  can_manage_doctors: boolean;
  can_next_queue: boolean;
  can_set_operator: boolean;
  color: string;
  created_at: string;
}

// ─── User Profile ─────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  role_id: string;
  doctor_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  role?: Role;
  doctor?: Doctor | null;
}

// ─── Work Session ─────────────────────────────────────────────────────────────
export interface WorkSession {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  duration_minutes: number | null;
  created_at: string;
  // joined
  user_profile?: UserProfile;
}

// ─── Warning ──────────────────────────────────────────────────────────────────
export interface Warning {
  id: string;
  issued_to: string;
  issued_by: string;
  reason: string;
  created_at: string;
  // joined
  issued_to_profile?: UserProfile;
  issued_by_profile?: UserProfile;
}

// ─── Queue/Doctor ─────────────────────────────────────────────────────────────
export type DoctorStatus = 'op' | 'activity' | 'afk' | 'off_duty' | 'story';

export interface Doctor {
  id: string;
  name: string;
  status: DoctorStatus;
  queue_order: number;
  created_at: string;
  updated_at: string;
}

export interface Operator {
  id: string;
  name: string;
  created_at: string;
}

export interface QueueState {
  id: string;
  pointer_index: number;
  updated_at: string;
}

export interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export const STATUS_LABELS: Record<DoctorStatus, string> = {
  op: 'คิว OP',
  activity: 'กิจกรรม',
  afk: 'เหม่อ',
  off_duty: 'ออกเวร',
  story: 'ไป Story',
};

export const STATUS_DOT_CLASS: Record<DoctorStatus, string> = {
  op: 'status-dot-op',
  activity: 'status-dot-activity',
  afk: 'status-dot-afk',
  off_duty: 'status-dot-off',
  story: 'status-dot-story',
};

// สิทธิ์ทั้งหมดในระบบ
export type Permission =
  | 'can_create_account'
  | 'can_manage_roles'
  | 'can_change_others_status'
  | 'can_view_overview_dashboard'
  | 'can_issue_warnings'
  | 'can_access_settings'
  | 'can_manage_doctors'
  | 'can_next_queue'
  | 'can_set_operator';

export const PERMISSION_LABELS: Record<Permission, string> = {
  can_create_account: 'สร้างบัญชีให้คนอื่น',
  can_manage_roles: 'จัดการยศ (สร้าง/แก้ไข/ลบ)',
  can_change_others_status: 'กดเมนูสถานะของคนอื่น',
  can_view_overview_dashboard: 'ดู Dashboard ภาพรวม',
  can_issue_warnings: 'ออกใบเตือน',
  can_access_settings: 'เข้าหน้าตั้งค่าระบบ',
  can_manage_doctors: 'เพิ่ม/ลบหมอในระบบ',
  can_next_queue: 'กดปุ่มถัดไป (เลื่อนคิว)',
  can_set_operator: 'ตั้งคนรัน OP',
};
