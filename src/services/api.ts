// บริการ API สำหรับระบบจัดคิวหมอ
import { supabase } from '@/db/supabase';
import type { Doctor, DoctorStatus, Operator, QueueState, Role, UserProfile, WorkSession, Warning, Permission } from '@/types/index';

// ─── Roles ────────────────────────────────────────────────────────────────────
export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createRole(params: {
  name: string;
  color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): Promise<void> {
  const { error } = await supabase.from('roles').insert({
    name: params.name,
    color: params.color,
    ...params.permissions,
  });
  if (error) throw error;
}

export async function updateRole(id: string, params: {
  name: string;
  color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): Promise<void> {
  const { error } = await supabase.from('roles').update({
    name: params.name,
    color: params.color,
    ...params.permissions,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteRole(id: string): Promise<void> {
  // ตรวจสอบว่ามีผู้ใช้อยู่ในยศนี้ไหม
  const { data } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('role_id', id)
    .limit(1)
    .maybeSingle();
  if (data) throw new Error('ไม่สามารถลบยศที่มีผู้ใช้งานอยู่ได้');
  const { error } = await supabase.from('roles').delete().eq('id', id);
  if (error) throw error;
}

// ─── User Profiles ────────────────────────────────────────────────────────────
export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, role:roles(*), doctor:doctors(*)')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? (data as UserProfile[]) : [];
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*, role:roles(*), doctor:doctors(*)')
    .eq('id', userId)
    .maybeSingle();
  return data as UserProfile | null;
}

/** admin/ผู้มีสิทธิ์สร้างบัญชีใหม่ โดยใช้ service role ผ่าน Supabase Auth API */
export async function createUserAccount(params: {
  username: string;
  password: string;
  displayName: string;
  roleId: string;
  doctorId?: string | null;
  createdBy: string;
}): Promise<void> {
  const email = `${params.username.toLowerCase().trim()}@gtav-queue.app`;

  // สร้าง auth user ก่อน (ต้องการ service role — ทำผ่าน Edge Function)
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      email,
      password: params.password,
      username: params.username.trim(),
      displayName: params.displayName.trim(),
      roleId: params.roleId,
      doctorId: params.doctorId ?? null,
      createdBy: params.createdBy,
    },
  });
  if (error) {
    const msg = await error?.context?.text?.();
    throw new Error(msg || error.message);
  }
  if (data?.error) throw new Error(data.error);
}

export async function updateProfileDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ display_name: displayName })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateProfileRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ role_id: roleId })
    .eq('id', userId);
  if (error) throw error;
}

export async function updateProfilePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-user', {
    body: { userId },
  });
  if (error) {
    const msg = await error?.context?.text?.();
    throw new Error(msg || error.message);
  }
}

// ─── Doctors ────────────────────────────────────────────────────────────────
export async function fetchDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .order('queue_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addDoctor(name: string): Promise<void> {
  const { data: existing } = await supabase
    .from('doctors')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existing) throw new Error('ชื่อนี้มีอยู่ในระบบแล้ว');

  const { data: maxData } = await supabase
    .from('doctors')
    .select('queue_order')
    .order('queue_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = maxData ? (maxData.queue_order + 1) : 0;
  const { error } = await supabase.from('doctors').insert({ name, status: 'op', queue_order: nextOrder });
  if (error) throw error;
}

export async function removeDoctor(id: string): Promise<void> {
  const { error } = await supabase.from('doctors').delete().eq('id', id);
  if (error) throw error;
}

export async function updateDoctorStatus(id: string, status: DoctorStatus): Promise<void> {
  const { error } = await supabase.from('doctors').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function returnDoctorToOp(id: string): Promise<void> {
  const { data: maxData } = await supabase
    .from('doctors')
    .select('queue_order')
    .eq('status', 'op')
    .order('queue_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = maxData ? (maxData.queue_order + 1) : 0;
  const { error } = await supabase
    .from('doctors')
    .update({ status: 'op', queue_order: nextOrder })
    .eq('id', id);
  if (error) throw error;
}

// ─── Operator ───────────────────────────────────────────────────────────────
export async function fetchOperator(): Promise<Operator | null> {
  const { data } = await supabase
    .from('operator')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function setOperator(name: string): Promise<void> {
  await supabase.from('operator').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('operator').insert({ name });
  if (error) throw error;
}

export async function clearOperator(): Promise<void> {
  await supabase.from('operator').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// ─── Queue State ─────────────────────────────────────────────────────────────
export async function fetchQueueState(): Promise<QueueState | null> {
  const { data } = await supabase.from('queue_state').select('*').limit(1).maybeSingle();
  return data;
}

export async function updatePointerIndex(id: string, pointer_index: number): Promise<void> {
  const { error } = await supabase
    .from('queue_state')
    .update({ pointer_index })
    .eq('id', id);
  if (error) throw error;
}

// ─── Settings ────────────────────────────────────────────────────────────────
export async function fetchSetting(key: string): Promise<string> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? '';
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase.from('settings').update({ value }).eq('key', key);
  if (error) throw error;
}

// ─── Work Sessions ────────────────────────────────────────────────────────────
export async function fetchUserSessions(userId: string, fromDate?: string, toDate?: string): Promise<WorkSession[]> {
  let query = supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('login_at', { ascending: false })
    .limit(200);

  if (fromDate) query = query.gte('login_at', fromDate);
  if (toDate) query = query.lte('login_at', toDate);

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchAllSessions(fromDate?: string, toDate?: string): Promise<WorkSession[]> {
  let query = supabase
    .from('work_sessions')
    .select('*, user_profile:user_profiles!work_sessions_user_id_fkey(*, role:roles(*))')
    .order('login_at', { ascending: false })
    .limit(500);

  if (fromDate) query = query.gte('login_at', fromDate);
  if (toDate) query = query.lte('login_at', toDate);

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? (data as WorkSession[]) : [];
}

export function calcMinutes(sessions: WorkSession[]): number {
  return sessions.reduce((acc, s) => {
    if (s.duration_minutes != null) return acc + s.duration_minutes;
    // session ที่ยังไม่ logout (active)
    if (!s.logout_at) {
      const diff = (Date.now() - new Date(s.login_at).getTime()) / 60000;
      return acc + diff;
    }
    return acc;
  }, 0);
}

// ─── Warnings ─────────────────────────────────────────────────────────────────
export async function fetchAllWarnings(): Promise<Warning[]> {
  const { data, error } = await supabase
    .from('warnings')
    .select(`
      *,
      issued_to_profile:user_profiles!warnings_issued_to_fkey(id, username, display_name),
      issued_by_profile:user_profiles!warnings_issued_by_fkey(id, username, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return Array.isArray(data) ? (data as Warning[]) : [];
}

export async function fetchMyWarnings(userId: string): Promise<Warning[]> {
  const { data, error } = await supabase
    .from('warnings')
    .select(`
      *,
      issued_to_profile:user_profiles!warnings_issued_to_fkey(id, username, display_name),
      issued_by_profile:user_profiles!warnings_issued_by_fkey(id, username, display_name)
    `)
    .eq('issued_to', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return Array.isArray(data) ? (data as Warning[]) : [];
}

export async function issueWarning(issuedTo: string, issuedBy: string, reason: string): Promise<void> {
  const { error } = await supabase.from('warnings').insert({
    issued_to: issuedTo,
    issued_by: issuedBy,
    reason,
  });
  if (error) throw error;
}
