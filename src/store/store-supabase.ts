/**
 * store-supabase.ts – Supabase-based data store
 * Refactored from localStorage to use Supabase PostgreSQL
 * Maintains the same API interface for backward compatibility
 */

import type {
  Role, Doctor, DoctorStatus, Operator, QueueState,
  WorkSession, Warning, Permission, OpSession,
} from '@/types/index';
import type { StoredUser } from '@/data/seed';
import {
  SEED_ROLES, SEED_DOCTORS, SEED_USERS, SEED_SETTINGS,
  SEED_QUEUE_STATE, EMPTY_SESSIONS, EMPTY_WARNINGS,
} from '@/data/seed';
import { supabase } from './supabase';

// ─── BroadcastChannel (sync ระหว่าง tabs) ────────────────────────────────────
let _bc: BroadcastChannel | null = null;
const getBC = (): BroadcastChannel | null => {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!_bc) _bc = new BroadcastChannel('gtav_queue_sync');
  return _bc;
};

type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();

export function subscribeStore(fn: ChangeListener): () => void {
  listeners.add(fn);
  const bc = getBC();
  const handler = () => listeners.forEach(f => f());
  bc?.addEventListener('message', handler);
  return () => {
    listeners.delete(fn);
    bc?.removeEventListener('message', handler);
  };
}

function broadcast() {
  getBC()?.postMessage('change');
  listeners.forEach(f => f());
}

// ─── SHA-256 helper ────────────────────────────────────────────────────────
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Seed (ถ้ายังไม่เคย init) ────────────────────────────────────────────
export async function initStore(): Promise<void> {
  try {
    // Check if roles table has data
    const { data: existingRoles, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .limit(1);

    if (rolesError) throw rolesError;

    const isFirstTime = !existingRoles || existingRoles.length === 0;

    if (isFirstTime) {
      // First time setup - seed all data
      const adminHash = await sha256Hex('Admin1234!');
      const botHash = await sha256Hex('Bot1234!');

      const users: StoredUser[] = SEED_USERS.map(u => ({
        ...u,
        password_hash: u.password_hash === '__HASH_superadmin__' ? adminHash
          : u.password_hash === '__HASH_bot__' ? botHash
          : u.password_hash,
      }));

      // Insert roles
      const { error: rolesInsertError } = await supabase
        .from('roles')
        .insert(SEED_ROLES);
      if (rolesInsertError) throw rolesInsertError;

      // Insert users
      const { error: usersInsertError } = await supabase
        .from('users')
        .insert(users);
      if (usersInsertError) throw usersInsertError;

      // Insert doctors
      const { error: doctorsInsertError } = await supabase
        .from('doctors')
        .insert(SEED_DOCTORS);
      if (doctorsInsertError) throw doctorsInsertError;

      // Insert settings
      const settingsArray = Object.entries(SEED_SETTINGS).map(([key, value]) => ({
        key,
        value,
      }));
      const { error: settingsInsertError } = await supabase
        .from('settings')
        .insert(settingsArray);
      if (settingsInsertError) throw settingsInsertError;

      // Insert queue state
      const { error: queueInsertError } = await supabase
        .from('queue_state')
        .insert([SEED_QUEUE_STATE]);
      if (queueInsertError) throw queueInsertError;

      // Insert empty sessions
      const { error: sessionsInsertError } = await supabase
        .from('work_sessions')
        .insert(EMPTY_SESSIONS);
      if (sessionsInsertError) throw sessionsInsertError;

      // Insert empty warnings
      const { error: warningsInsertError } = await supabase
        .from('warnings')
        .insert(EMPTY_WARNINGS);
      if (warningsInsertError) throw warningsInsertError;
    } else {
      // Additive migration - add missing columns/tables
      // This is handled by database migrations
      console.log('Database already seeded, skipping initialization');
    }
  } catch (error) {
    console.error('Error initializing store:', error);
    throw error;
  }
}

export async function resetStore(): Promise<void> {
  try {
    // Delete all data from tables
    await supabase.from('roles').delete().neq('id', '');
    await supabase.from('users').delete().neq('id', '');
    await supabase.from('doctors').delete().neq('id', '');
    await supabase.from('work_sessions').delete().neq('id', '');
    await supabase.from('op_sessions').delete().neq('id', '');
    await supabase.from('warnings').delete().neq('id', '');
    await supabase.from('operator').delete().neq('id', '');
    await supabase.from('queue_state').delete().neq('id', '');
    await supabase.from('settings').delete().neq('key', '');
  } catch (error) {
    console.error('Error resetting store:', error);
    throw error;
  }
}

// ─── Roles ──────────────────────────────────────────────────────────
export async function storeGetRoles(): Promise<Role[]> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching roles:', error);
    return [];
  }
}

export async function storeCreateRole(params: {
  name: string; color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): Promise<void> {
  try {
    const roles = await storeGetRoles();
    if (roles.find(r => r.name === params.name)) throw new Error('ชื่อยศนี้มีอยู่แล้ว');

    const newRole: Role = {
      id: crypto.randomUUID(),
      name: params.name,
      color: params.color,
      is_system: false,
      can_create_account: false,
      can_manage_roles: false,
      can_change_others_status: false,
      can_view_overview_dashboard: false,
      can_issue_warnings: false,
      can_access_settings: false,
      can_manage_doctors: false,
      can_next_queue: false,
      can_set_operator: false,
      ...params.permissions,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('roles').insert([newRole]);
    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
}

export async function storeUpdateRole(id: string, params: {
  name: string; color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('roles')
      .update({ name: params.name, color: params.color, ...params.permissions })
      .eq('id', id);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
}

export async function storeDeleteRole(id: string): Promise<void> {
  try {
    const users = await storeGetUsers();
    if (users.find(u => (u.role_ids ?? [u.role_id]).includes(id))) {
      throw new Error('ไม่สามารถลบยศที่มีผู้ใช้งานอยู่ได้');
    }

    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
}

// ─── Users ──────────────────────────────────────────────────────────
export async function storeGetUsers(): Promise<StoredUser[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function storeGetUserById(id: string): Promise<StoredUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error fetching user by id:', error);
    return null;
  }
}

export async function storeGetUserByUsername(username: string): Promise<StoredUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('username', username)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error fetching user by username:', error);
    return null;
  }
}

export async function storeCreateUser(params: {
  username: string; password: string; displayName: string;
  roleIds: string[]; doctorId?: string | null; createdBy: string;
}): Promise<void> {
  try {
    const existing = await storeGetUserByUsername(params.username);
    if (existing) throw new Error('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');

    const hash = await sha256Hex(params.password);
    const now = new Date().toISOString();
    const primaryRole = params.roleIds[0] ?? '';

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      username: params.username.trim(),
      display_name: params.displayName.trim(),
      password_hash: hash,
      role_id: primaryRole,
      role_ids: params.roleIds,
      doctor_id: params.doctorId ?? null,
      created_by: params.createdBy,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from('users').insert([newUser]);
    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function storeUpdateUserDisplayName(userId: string, displayName: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error updating user display name:', error);
    throw error;
  }
}

export async function storeUpdateUserRoles(userId: string, roleIds: string[]): Promise<void> {
  try {
    if (!roleIds.length) throw new Error('ต้องมีอย่างน้อย 1 ยศ');

    const target = await storeGetUserById(userId);
    if (target?.username === 'superadmin') throw new Error('ไม่สามารถเปลี่ยนยศ Super Admin ได้');

    const { error } = await supabase
      .from('users')
      .update({
        role_id: roleIds[0],
        role_ids: roleIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error updating user roles:', error);
    throw error;
  }
}

/** @deprecated ใช้ storeUpdateUserRoles แทน */
export async function storeUpdateUserRole(userId: string, roleId: string): Promise<void> {
  return storeUpdateUserRoles(userId, [roleId]);
}

export async function storeUpdateUserPassword(userId: string, newPassword: string): Promise<void> {
  try {
    const hash = await sha256Hex(newPassword);
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error updating user password:', error);
    throw error;
  }
}

export async function storeDeleteUser(userId: string): Promise<void> {
  try {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/** รวม roles ลงใน UserProfile object (รองรับหลายยศแบบ Discord) */
export async function hydrateUser(u: StoredUser): Promise<import('@/types/index').UserProfile> {
  const allRoles = await storeGetRoles();
  const ids: string[] = u.role_ids?.length ? u.role_ids : (u.role_id ? [u.role_id] : []);
  const roles = ids.map(id => allRoles.find(r => r.id === id)).filter(Boolean) as import('@/types/index').Role[];
  const primaryRole = roles[0];
  const docs = await storeGetDoctors();
  const doctor = u.doctor_id ? docs.find(d => d.id === u.doctor_id) ?? null : null;

  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    role_id: primaryRole?.id ?? u.role_id,
    role_ids: ids,
    doctor_id: u.doctor_id,
    created_by: u.created_by,
    created_at: u.created_at,
    updated_at: u.updated_at,
    role: primaryRole,
    roles,
    doctor,
    is_superadmin: u.username === 'superadmin',
  };
}

// ─── Doctors ──────────────────────────────────────────────────────────
export async function storeGetDoctors(): Promise<Doctor[]> {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('queue_order', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return [];
  }
}

export async function storeAddDoctor(name: string): Promise<void> {
  try {
    const docs = await storeGetDoctors();
    if (docs.find(d => d.name === name)) throw new Error('ชื่อนี้มีอยู่ในระบบแล้ว');

    const maxOrder = docs.reduce((m, d) => Math.max(m, d.queue_order), -1);
    const now = new Date().toISOString();

    const newDoctor: Doctor = {
      id: crypto.randomUUID(),
      name,
      status: 'op' as DoctorStatus,
      queue_order: maxOrder + 1,
      created_at: now,
      updated_at: now,
    };

    const { error: insertError } = await supabase.from('doctors').insert([newDoctor]);
    if (insertError) throw insertError;
    broadcast();
  } catch (error) {
    console.error('Error adding doctor:', error);
    throw error;
  }
}

export async function storeRemoveDoctor(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('doctors').delete().eq('id', id);
    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error removing doctor:', error);
    throw error;
  }
}

export async function storeUpdateDoctorStatus(id: string, status: DoctorStatus): Promise<void> {
  try {
    const { error } = await supabase
      .from('doctors')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error updating doctor status:', error);
    throw error;
  }
}

export async function storeReturnDoctorToOp(id: string): Promise<void> {
  try {
    const docs = await storeGetDoctors();
    const opDocs = docs.filter(d => d.status === 'op');
    const maxOrder = opDocs.reduce((m, d) => Math.max(m, d.queue_order), -1);

    const { error } = await supabase
      .from('doctors')
      .update({
        status: 'op' as DoctorStatus,
        queue_order: maxOrder + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error returning doctor to op:', error);
    throw error;
  }
}

// ─── Operator ─────────────────────────────────────────────────────────
export async function storeGetOperator(): Promise<Operator | null> {
  try {
    const { data, error } = await supabase
      .from('operator')
      .select('*')
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error fetching operator:', error);
    return null;
  }
}

export async function storeSetOperator(name: string, userId: string | null): Promise<void> {
  try {
    const prev = await storeGetOperator();
    if (prev?.user_id) await storeEndOpSession(prev.user_id);

    const operatorData = {
      id: crypto.randomUUID(),
      name,
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    // Delete existing and insert new
    await supabase.from('operator').delete().neq('id', '');
    const { error } = await supabase.from('operator').insert([operatorData]);

    if (error) throw error;
    if (userId) await storeStartOpSession(userId);
    broadcast();
  } catch (error) {
    console.error('Error setting operator:', error);
    throw error;
  }
}

export async function storeClearOperator(): Promise<void> {
  try {
    const prev = await storeGetOperator();
    if (prev?.user_id) await storeEndOpSession(prev.user_id);

    const { error } = await supabase.from('operator').delete().neq('id', '');
    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error clearing operator:', error);
    throw error;
  }
}

// ─── Queue State ────────────────────────────────────────────────────────
export async function storeGetQueueState(): Promise<QueueState> {
  try {
    const { data, error } = await supabase
      .from('queue_state')
      .select('*')
      .single();

    if (error && error.code === 'PGRST116') return SEED_QUEUE_STATE; // Not found
    if (error) throw error;
    return data || SEED_QUEUE_STATE;
  } catch (error) {
    console.error('Error fetching queue state:', error);
    return SEED_QUEUE_STATE;
  }
}

export async function storeUpdatePointerIndex(pointer_index: number): Promise<void> {
  try {
    const state = await storeGetQueueState();
    const { error } = await supabase
      .from('queue_state')
      .update({ pointer_index, updated_at: new Date().toISOString() })
      .eq('id', state.id);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error updating pointer index:', error);
    throw error;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────
export async function storeGetSetting(key: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error && error.code === 'PGRST116') return ''; // Not found
    if (error) throw error;
    return data?.value || '';
  } catch (error) {
    console.error('Error fetching setting:', error);
    return '';
  }
}

export async function storeUpdateSetting(key: string, value: string): Promise<void> {
  try {
    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({ key, value });

    if (upsertError) throw upsertError;
    broadcast();
  } catch (error) {
    console.error('Error updating setting:', error);
    throw error;
  }
}

// ─── Work Sessions ────────────────────────────────────────────────────────
export async function storeGetSessions(): Promise<WorkSession[]> {
  try {
    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .order('login_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

export async function storeStartSession(userId: string): Promise<string> {
  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await supabase.from('work_sessions').insert([{
      id,
      user_id: userId,
      login_at: now,
      logout_at: null,
      duration_minutes: null,
      created_at: now,
    }]);

    if (error) throw error;
    broadcast();
    return id;
  } catch (error) {
    console.error('Error starting session:', error);
    throw error;
  }
}

export async function storeEndSession(sessionId: string): Promise<void> {
  try {
    const { data, error: fetchError } = await supabase
      .from('work_sessions')
      .select('login_at')
      .eq('id', sessionId)
      .single();

    if (fetchError) throw fetchError;

    const now = new Date().toISOString();
    const mins = (Date.now() - new Date(data.login_at).getTime()) / 60000;

    const { error } = await supabase
      .from('work_sessions')
      .update({
        logout_at: now,
        duration_minutes: Math.round(mins),
      })
      .eq('id', sessionId);

    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error ending session:', error);
    throw error;
  }
}

export async function storeGetUserSessions(userId: string, fromDate?: string, toDate?: string): Promise<WorkSession[]> {
  try {
    let query = supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', userId);

    if (fromDate) query = query.gte('login_at', fromDate);
    if (toDate) query = query.lte('login_at', toDate);

    const { data, error } = await query
      .order('login_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return [];
  }
}

export async function storeGetAllSessions(fromDate?: string, toDate?: string): Promise<WorkSession[]> {
  try {
    let query = supabase.from('work_sessions').select('*');

    if (fromDate) query = query.gte('login_at', fromDate);
    if (toDate) query = query.lte('login_at', toDate);

    const { data, error } = await query
      .order('login_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching all sessions:', error);
    return [];
  }
}

export function calcMinutes(sessions: WorkSession[]): number {
  return sessions.reduce((acc, s) => {
    if (s.duration_minutes != null) return acc + s.duration_minutes;
    if (!s.logout_at) return acc + (Date.now() - new Date(s.login_at).getTime()) / 60000;
    return acc;
  }, 0);
}

// ─── OP Sessions ────────────────────────────────────────────────────────
export async function storeGetOpSessions(): Promise<OpSession[]> {
  try {
    const { data, error } = await supabase
      .from('op_sessions')
      .select('*')
      .order('start_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching op sessions:', error);
    return [];
  }
}

export async function storeStartOpSession(userId: string): Promise<string> {
  try {
    await storeEndOpSession(userId);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await supabase.from('op_sessions').insert([{
      id,
      user_id: userId,
      start_at: now,
      end_at: null,
      duration_minutes: null,
      created_at: now,
    }]);

    if (error) throw error;
    return id;
  } catch (error) {
    console.error('Error starting op session:', error);
    throw error;
  }
}

export async function storeEndOpSession(userId: string): Promise<void> {
  try {
    const { data, error: fetchError } = await supabase
      .from('op_sessions')
      .select('start_at')
      .eq('user_id', userId)
      .is('end_at', null)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
    if (!data) return; // No active session

    const now = new Date().toISOString();
    const mins = (Date.now() - new Date(data.start_at).getTime()) / 60000;

    const { error } = await supabase
      .from('op_sessions')
      .update({
        end_at: now,
        duration_minutes: Math.round(mins),
      })
      .eq('user_id', userId)
      .is('end_at', null);

    if (error) throw error;
  } catch (error) {
    console.error('Error ending op session:', error);
    throw error;
  }
}

export async function storeGetUserOpSessions(userId: string, fromDate?: string, toDate?: string): Promise<OpSession[]> {
  try {
    let query = supabase
      .from('op_sessions')
      .select('*')
      .eq('user_id', userId);

    if (fromDate) query = query.gte('start_at', fromDate);
    if (toDate) query = query.lte('start_at', toDate);

    const { data, error } = await query.order('start_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching user op sessions:', error);
    return [];
  }
}

export function calcOpMinutes(sessions: OpSession[]): number {
  return sessions.reduce((acc, s) => {
    if (s.duration_minutes != null) return acc + s.duration_minutes;
    if (!s.end_at) return acc + (Date.now() - new Date(s.start_at).getTime()) / 60000;
    return acc;
  }, 0);
}

// ─── Warnings ─────────────────────────────────────────────────────────
export async function storeGetWarnings(): Promise<Warning[]> {
  try {
    const { data, error } = await supabase
      .from('warnings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching warnings:', error);
    return [];
  }
}

export async function storeIssueWarning(
  issuedTo: string,
  issuedBy: string,
  reason: string,
  severity: import('@/types/index').WarningSeverity = 'yellow'
): Promise<void> {
  try {
    const warning: Warning = {
      id: crypto.randomUUID(),
      issued_to: issuedTo,
      issued_by: issuedBy,
      reason,
      severity,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('warnings').insert([warning]);
    if (error) throw error;
    broadcast();
  } catch (error) {
    console.error('Error issuing warning:', error);
    throw error;
  }
}

export async function storeGetWarningsWithProfiles(): Promise<any[]> {
  try {
    const warnings = await storeGetWarnings();
    const users = await storeGetUsers();

    return warnings.map(w => ({
      ...w,
      severity: w.severity ?? 'yellow',
      issued_to_profile: (() => {
        const u = users.find(x => x.id === w.issued_to);
        return u ? hydrateUser(u) : undefined;
      })(),
      issued_by_profile: (() => {
        const u = users.find(x => x.id === w.issued_by);
        return u ? hydrateUser(u) : undefined;
      })(),
    }));
  } catch (error) {
    console.error('Error fetching warnings with profiles:', error);
    return [];
  }
}

export async function storeGetMyWarnings(userId: string): Promise<any[]> {
  try {
    const warnings = await storeGetWarnings();
    const users = await storeGetUsers();

    return warnings
      .filter(w => w.issued_to === userId)
      .map(w => ({
        ...w,
        severity: w.severity ?? 'yellow',
        issued_to_profile: (() => {
          const u = users.find(x => x.id === w.issued_to);
          return u ? hydrateUser(u) : undefined;
        })(),
        issued_by_profile: (() => {
          const u = users.find(x => x.id === w.issued_by);
          return u ? hydrateUser(u) : undefined;
        })(),
      }))
      .slice(0, 100);
  } catch (error) {
    console.error('Error fetching my warnings:', error);
    return [];
  }
}
