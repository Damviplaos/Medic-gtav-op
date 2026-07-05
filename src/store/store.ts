/**
 * store.ts – localStorage-based data store
 * แทนที่ Supabase database ทั้งหมด
 * ใช้ BroadcastChannel เพื่อ sync ระหว่าง tabs
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

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const K = {
  ROLES: 'gtav_roles',
  USERS: 'gtav_users',
  DOCTORS: 'gtav_doctors',
  OPERATOR: 'gtav_operator',
  QUEUE_STATE: 'gtav_queue_state',
  SETTINGS: 'gtav_settings',
  SESSIONS: 'gtav_sessions',
  OP_SESSIONS: 'gtav_op_sessions',
  WARNINGS: 'gtav_warnings',
  SEEDED: 'gtav_seeded_v3',
} as const;

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

// ─── SHA-256 helper ───────────────────────────────────────────────────────────
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Generic read/write ───────────────────────────────────────────────────────
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Seed (ถ้ายังไม่เคย init) ────────────────────────────────────────────────
export async function initStore(): Promise<void> {
  if (localStorage.getItem(K.SEEDED)) return;

  // hash passwords
  const adminHash = await sha256Hex('Admin1234!');
  const botHash = await sha256Hex('Bot1234!');

  const users: StoredUser[] = SEED_USERS.map(u => ({
    ...u,
    password_hash: u.password_hash === '__HASH_superadmin__' ? adminHash
      : u.password_hash === '__HASH_bot__' ? botHash
      : u.password_hash,
  }));

  write(K.ROLES, SEED_ROLES);
  write(K.USERS, users);
  write(K.DOCTORS, SEED_DOCTORS);
  write(K.OPERATOR, null);
  write(K.QUEUE_STATE, SEED_QUEUE_STATE);
  write(K.SETTINGS, SEED_SETTINGS);
  write(K.SESSIONS, EMPTY_SESSIONS);
  write(K.OP_SESSIONS, []);
  write(K.WARNINGS, EMPTY_WARNINGS);
  localStorage.setItem(K.SEEDED, '1');
}

export function resetStore(): void {
  Object.values(K).forEach(k => localStorage.removeItem(k));
}

// ─── Roles ────────────────────────────────────────────────────────────────────
export function storeGetRoles(): Role[] {
  return (read<Role[]>(K.ROLES) ?? []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function storeCreateRole(params: {
  name: string; color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): void {
  const roles = storeGetRoles();
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
  write(K.ROLES, [...roles, newRole]);
  broadcast();
}

export function storeUpdateRole(id: string, params: {
  name: string; color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): void {
  const roles = storeGetRoles().map(r =>
    r.id === id ? { ...r, name: params.name, color: params.color, ...params.permissions } : r
  );
  write(K.ROLES, roles);
  broadcast();
}

export function storeDeleteRole(id: string): void {
  const users = storeGetUsers();
  if (users.find(u => u.role_id === id)) throw new Error('ไม่สามารถลบยศที่มีผู้ใช้งานอยู่ได้');
  write(K.ROLES, storeGetRoles().filter(r => r.id !== id));
  broadcast();
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function storeGetUsers(): StoredUser[] {
  return (read<StoredUser[]>(K.USERS) ?? []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function storeGetUserById(id: string): StoredUser | null {
  return storeGetUsers().find(u => u.id === id) ?? null;
}

export function storeGetUserByUsername(username: string): StoredUser | null {
  return storeGetUsers().find(u => u.username.toLowerCase() === username.toLowerCase()) ?? null;
}

export async function storeCreateUser(params: {
  username: string; password: string; displayName: string;
  roleId: string; doctorId?: string | null; createdBy: string;
}): Promise<void> {
  if (storeGetUserByUsername(params.username)) throw new Error('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
  const hash = await sha256Hex(params.password);
  const now = new Date().toISOString();
  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    username: params.username.trim(),
    display_name: params.displayName.trim(),
    password_hash: hash,
    role_id: params.roleId,
    doctor_id: params.doctorId ?? null,
    created_by: params.createdBy,
    created_at: now,
    updated_at: now,
  };
  write(K.USERS, [...storeGetUsers(), newUser]);
  broadcast();
}

export function storeUpdateUserDisplayName(userId: string, displayName: string): void {
  write(K.USERS, storeGetUsers().map(u =>
    u.id === userId ? { ...u, display_name: displayName, updated_at: new Date().toISOString() } : u
  ));
  broadcast();
}

export function storeUpdateUserRole(userId: string, roleId: string): void {
  write(K.USERS, storeGetUsers().map(u =>
    u.id === userId ? { ...u, role_id: roleId, updated_at: new Date().toISOString() } : u
  ));
  broadcast();
}

export async function storeUpdateUserPassword(userId: string, newPassword: string): Promise<void> {
  const hash = await sha256Hex(newPassword);
  write(K.USERS, storeGetUsers().map(u =>
    u.id === userId ? { ...u, password_hash: hash, updated_at: new Date().toISOString() } : u
  ));
  broadcast();
}

export function storeDeleteUser(userId: string): void {
  write(K.USERS, storeGetUsers().filter(u => u.id !== userId));
  broadcast();
}

/** รวม role ลงใน UserProfile object */
export function hydrateUser(u: StoredUser): import('@/types/index').UserProfile {
  const roles = storeGetRoles();
  const role = roles.find(r => r.id === u.role_id);
  const docs = storeGetDoctors();
  const doctor = u.doctor_id ? docs.find(d => d.id === u.doctor_id) ?? null : null;
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    role_id: u.role_id,
    doctor_id: u.doctor_id,
    created_by: u.created_by,
    created_at: u.created_at,
    updated_at: u.updated_at,
    role,
    doctor,
  };
}

// ─── Doctors ──────────────────────────────────────────────────────────────────
export function storeGetDoctors(): Doctor[] {
  return (read<Doctor[]>(K.DOCTORS) ?? []).sort((a, b) => a.queue_order - b.queue_order);
}

export function storeAddDoctor(name: string): void {
  const docs = storeGetDoctors();
  if (docs.find(d => d.name === name)) throw new Error('ชื่อนี้มีอยู่ในระบบแล้ว');
  const maxOrder = docs.reduce((m, d) => Math.max(m, d.queue_order), -1);
  const now = new Date().toISOString();
  write(K.DOCTORS, [...docs, {
    id: crypto.randomUUID(), name, status: 'op' as DoctorStatus,
    queue_order: maxOrder + 1, created_at: now, updated_at: now,
  }]);
  broadcast();
}

export function storeRemoveDoctor(id: string): void {
  write(K.DOCTORS, storeGetDoctors().filter(d => d.id !== id));
  broadcast();
}

export function storeUpdateDoctorStatus(id: string, status: DoctorStatus): void {
  write(K.DOCTORS, storeGetDoctors().map(d =>
    d.id === id ? { ...d, status, updated_at: new Date().toISOString() } : d
  ));
  broadcast();
}

export function storeReturnDoctorToOp(id: string): void {
  const docs = storeGetDoctors();
  const opDocs = docs.filter(d => d.status === 'op');
  const maxOrder = opDocs.reduce((m, d) => Math.max(m, d.queue_order), -1);
  write(K.DOCTORS, docs.map(d =>
    d.id === id ? { ...d, status: 'op' as DoctorStatus, queue_order: maxOrder + 1, updated_at: new Date().toISOString() } : d
  ));
  broadcast();
}

// ─── Operator ─────────────────────────────────────────────────────────────────
export function storeGetOperator(): Operator | null {
  return read<Operator | null>(K.OPERATOR);
}

export function storeSetOperator(name: string, userId: string | null): void {
  // ถ้ามี op เก่าอยู่ ให้จบ op session ก่อน
  const prev = storeGetOperator();
  if (prev?.user_id) storeEndOpSession(prev.user_id);
  write(K.OPERATOR, { id: crypto.randomUUID(), name, user_id: userId, created_at: new Date().toISOString() });
  // เริ่ม op session ใหม่
  if (userId) storeStartOpSession(userId);
  broadcast();
}

export function storeClearOperator(): void {
  const prev = storeGetOperator();
  if (prev?.user_id) storeEndOpSession(prev.user_id);
  write(K.OPERATOR, null);
  broadcast();
}

// ─── Queue State ──────────────────────────────────────────────────────────────
export function storeGetQueueState(): QueueState {
  return read<QueueState>(K.QUEUE_STATE) ?? SEED_QUEUE_STATE;
}

export function storeUpdatePointerIndex(pointer_index: number): void {
  write(K.QUEUE_STATE, { ...storeGetQueueState(), pointer_index, updated_at: new Date().toISOString() });
  broadcast();
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function storeGetSetting(key: string): string {
  const s = read<Record<string, string>>(K.SETTINGS) ?? {};
  return s[key] ?? '';
}

export function storeUpdateSetting(key: string, value: string): void {
  const s = read<Record<string, string>>(K.SETTINGS) ?? {};
  write(K.SETTINGS, { ...s, [key]: value });
  broadcast();
}

// ─── Work Sessions ────────────────────────────────────────────────────────────
export function storeGetSessions(): WorkSession[] {
  return read<WorkSession[]>(K.SESSIONS) ?? [];
}

export function storeStartSession(userId: string): string {
  const id = crypto.randomUUID();
  const sessions = storeGetSessions();
  write(K.SESSIONS, [...sessions, {
    id, user_id: userId, login_at: new Date().toISOString(),
    logout_at: null, duration_minutes: null, created_at: new Date().toISOString(),
  }]);
  broadcast();
  return id;
}

export function storeEndSession(sessionId: string): void {
  const sessions = storeGetSessions();
  const now = new Date().toISOString();
  write(K.SESSIONS, sessions.map(s => {
    if (s.id !== sessionId) return s;
    const mins = (Date.now() - new Date(s.login_at).getTime()) / 60000;
    return { ...s, logout_at: now, duration_minutes: Math.round(mins) };
  }));
  broadcast();
}

export function storeGetUserSessions(userId: string, fromDate?: string, toDate?: string): WorkSession[] {
  return storeGetSessions()
    .filter(s => {
      if (s.user_id !== userId) return false;
      if (fromDate && s.login_at < fromDate) return false;
      if (toDate && s.login_at > toDate) return false;
      return true;
    })
    .sort((a, b) => b.login_at.localeCompare(a.login_at))
    .slice(0, 200);
}

export function storeGetAllSessions(fromDate?: string, toDate?: string): WorkSession[] {
  return storeGetSessions()
    .filter(s => {
      if (fromDate && s.login_at < fromDate) return false;
      if (toDate && s.login_at > toDate) return false;
      return true;
    })
    .sort((a, b) => b.login_at.localeCompare(a.login_at))
    .slice(0, 500);
}

export function calcMinutes(sessions: WorkSession[]): number {
  return sessions.reduce((acc, s) => {
    if (s.duration_minutes != null) return acc + s.duration_minutes;
    if (!s.logout_at) return acc + (Date.now() - new Date(s.login_at).getTime()) / 60000;
    return acc;
  }, 0);
}

// ─── OP Sessions ──────────────────────────────────────────────────────────────
export function storeGetOpSessions(): OpSession[] {
  return read<OpSession[]>(K.OP_SESSIONS) ?? [];
}

export function storeStartOpSession(userId: string): string {
  // จบ session เก่าของ user นี้ก่อน (ถ้ามี)
  storeEndOpSession(userId);
  const id = crypto.randomUUID();
  const sessions = storeGetOpSessions();
  write(K.OP_SESSIONS, [...sessions, {
    id, user_id: userId, start_at: new Date().toISOString(),
    end_at: null, duration_minutes: null, created_at: new Date().toISOString(),
  }]);
  return id;
}

export function storeEndOpSession(userId: string): void {
  const sessions = storeGetOpSessions();
  const now = new Date().toISOString();
  write(K.OP_SESSIONS, sessions.map(s => {
    if (s.user_id !== userId || s.end_at !== null) return s;
    const mins = (Date.now() - new Date(s.start_at).getTime()) / 60000;
    return { ...s, end_at: now, duration_minutes: Math.round(mins) };
  }));
}

export function storeGetUserOpSessions(userId: string, fromDate?: string, toDate?: string): OpSession[] {
  return storeGetOpSessions()
    .filter(s => {
      if (s.user_id !== userId) return false;
      if (fromDate && s.start_at < fromDate) return false;
      if (toDate && s.start_at > toDate) return false;
      return true;
    })
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
}

export function calcOpMinutes(sessions: OpSession[]): number {
  return sessions.reduce((acc, s) => {
    if (s.duration_minutes != null) return acc + s.duration_minutes;
    if (!s.end_at) return acc + (Date.now() - new Date(s.start_at).getTime()) / 60000;
    return acc;
  }, 0);
}

// ─── Warnings ─────────────────────────────────────────────────────────────────
export function storeGetWarnings(): Warning[] {
  return (read<Warning[]>(K.WARNINGS) ?? [])
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function storeIssueWarning(issuedTo: string, issuedBy: string, reason: string): void {
  const warnings = storeGetWarnings();
  write(K.WARNINGS, [{
    id: crypto.randomUUID(),
    issued_to: issuedTo,
    issued_by: issuedBy,
    reason,
    created_at: new Date().toISOString(),
  }, ...warnings]);
  broadcast();
}

export function storeGetWarningsWithProfiles(): Warning[] {
  const warnings = storeGetWarnings();
  const users = storeGetUsers();
  return warnings.map(w => ({
    ...w,
    issued_to_profile: users.find(u => u.id === w.issued_to),
    issued_by_profile: users.find(u => u.id === w.issued_by),
  }));
}

export function storeGetMyWarnings(userId: string): Warning[] {
  const users = storeGetUsers();
  return storeGetWarnings()
    .filter(w => w.issued_to === userId)
    .map(w => ({
      ...w,
      issued_to_profile: users.find(u => u.id === w.issued_to),
      issued_by_profile: users.find(u => u.id === w.issued_by),
    }))
    .slice(0, 100);
}
