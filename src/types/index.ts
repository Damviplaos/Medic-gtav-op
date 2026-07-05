export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

// ประเภทข้อมูลสำหรับระบบจัดคิวหมอ GTA V RP
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
