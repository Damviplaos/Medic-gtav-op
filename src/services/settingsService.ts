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
