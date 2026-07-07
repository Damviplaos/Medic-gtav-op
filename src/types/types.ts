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
