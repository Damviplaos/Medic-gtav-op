import { supabase } from '@/db/supabase';
import type { Warning, RolePermission, SystemSetting, InactiveUser } from '@/types/types';

// =============================================
// System Settings
// =============================================
export async function getAllSettings(): Promise<SystemSetting[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key');
  if (error) throw error;
  return (data ?? []) as SystemSetting[];
}

export async function upsertSetting(key: string, value: string) {
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

// =============================================
// Warnings
// =============================================
export async function getUserWarnings(userId: string): Promise<Warning[]> {
  const { data, error } = await supabase
    .from('warnings')
    .select('*, issuer:profiles!warnings_issued_by_fkey(username, nickname)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Warning[];
}

export async function issueWarning(payload: { user_id: string; issued_by: string; reason: string; severity: 'minor' | 'major' | 'critical'; expires_at?: string | null }) {
  const { error } = await supabase.from('warnings').insert(payload);
  if (error) throw error;
}

export async function deactivateWarning(id: string) {
  const { error } = await supabase.from('warnings').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

// =============================================
// Role Permissions
// =============================================
export async function getRolePermissions(roleId: string): Promise<RolePermission[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('*')
    .eq('role_id', roleId);
  if (error) throw error;
  return (data ?? []) as RolePermission[];
}

export async function setRolePermission(roleId: string, permission: string, enabled: boolean) {
  const { error } = await supabase
    .from('role_permissions')
    .upsert({ role_id: roleId, permission, enabled }, { onConflict: 'role_id,permission' });
  if (error) throw error;
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_user_permissions', { p_user_id: userId });
  if (error) return [];
  return (data ?? []).map((r: { permission: string }) => r.permission);
}

// =============================================
// Attendance / Clock-in/out
// =============================================
export async function clockIn(userId: string, icName: string) {
  // 1. DB record
  await supabase.rpc('clock_in_attendance', { p_user_id: userId });
  // 2. Sheets sync (fire-and-forget)
  supabase.functions.invoke('google-sheets-sync', {
    body: { action: 'clock_in', user_id: userId, ic_name: icName || '' },
    method: 'POST',
  }).catch(console.error);
}

export async function clockOut(userId: string, icName: string) {
  await supabase.rpc('clock_out_attendance', { p_user_id: userId });
  supabase.functions.invoke('google-sheets-sync', {
    body: { action: 'clock_out', user_id: userId, ic_name: icName || '' },
    method: 'POST',
  }).catch(console.error);
}

// =============================================
// Inactivity Check
// =============================================
export async function getInactiveUsers(): Promise<InactiveUser[]> {
  const { data, error } = await supabase.functions.invoke('inactivity-check', { method: 'POST' });
  if (error) throw error;
  return (data?.users ?? []) as InactiveUser[];
}

export async function getUserDetailStats(userId: string, weekStart: string) {
  const { data, error } = await supabase.rpc('get_user_detail_stats', {
    p_user_id: userId,
    p_week_start: weekStart,
  });
  if (error) throw error;
  return data?.[0] ?? { total_work_seconds: 0, total_op_seconds: 0, warning_count: 0, active_warning_count: 0 };
}

// =============================================
// Queue Reset
// =============================================
export async function resetQueue() {
  const { error } = await supabase.from('user_presence').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
  await supabase.from('queue_pointer')
    .update({ pointed_user_id: null })
    .eq('id', '00000000-0000-0000-0000-000000000001');
}

// =============================================
// Weekly Stats History
// =============================================
export async function getWeeklyHistory() {
  const { data, error } = await supabase
    .from('weekly_stats_history')
    .select('*, profile:profiles(username, nickname, ic_name)')
    .order('week_start', { ascending: false })
    .order('archived_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; user_id: string; week_start: string;
    total_work_seconds: number; total_op_seconds: number; archived_at: string;
    profile?: { username: string; nickname: string | null; ic_name: string | null };
  }>;
}

export async function archiveAndResetWeeklyStats() {
  const { error } = await supabase.rpc('archive_and_reset_weekly_stats');
  if (error) throw error;
}

// =============================================
// Matchmaking
// =============================================
export async function getMatchmakingPairs() {
  const { data, error } = await supabase
    .from('matchmaking_pairs')
    .select('*, user_a:profiles!matchmaking_pairs_user_a_id_fkey(id, username, nickname, ic_name), user_b:profiles!matchmaking_pairs_user_b_id_fkey(id, username, nickname, ic_name)')
    .order('matched_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; user_a_id: string; user_b_id: string; matched_at: string; notes: string | null;
    user_a?: { id: string; username: string; nickname: string | null; ic_name: string | null };
    user_b?: { id: string; username: string; nickname: string | null; ic_name: string | null };
  }>;
}

export async function createMatchmakingPair(userAId: string, userBId: string, notes?: string) {
  const { error } = await supabase.from('matchmaking_pairs').insert({ user_a_id: userAId, user_b_id: userBId, notes: notes ?? null });
  if (error) throw error;
}

export async function deleteMatchmakingPair(id: string) {
  const { error } = await supabase.from('matchmaking_pairs').delete().eq('id', id);
  if (error) throw error;
}

// =============================================
// Update player profile (admin)
// =============================================
export async function updatePlayerProfile(userId: string, payload: { nickname?: string; ic_name?: string }) {
  const { error } = await supabase
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

export async function adminChangePassword(userId: string, newPassword: string) {
  const { error } = await supabase.functions.invoke('create-user', {
    body: { action: 'change_password', user_id: userId, password: newPassword },
    method: 'POST',
  });
  if (error) throw error;
}
