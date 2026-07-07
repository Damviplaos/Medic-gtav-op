/**
 * api-supabase.ts – Supabase-based API layer
 * Real-time data sync across all clients
 * ✅ FIX: Proper multi-device sync
 */
import type {
  Doctor,
  DoctorStatus,
  Operator,
  QueueState,
  Role,
  UserProfile,
  WorkSession,
  Warning,
  Permission,
  WarningSeverity,
} from '@/types/index';
import {
  storeGetRoles,
  storeCreateRole,
  storeUpdateRole,
  storeDeleteRole,
  storeGetUsers,
  storeCreateUser,
  storeUpdateUserDisplayName,
  storeUpdateUserRoles,
  storeUpdateUserRole,
  storeUpdateUserPassword,
  storeDeleteUser,
  hydrateUser,
  storeGetDoctors,
  storeAddDoctor,
  storeRemoveDoctor,
  storeUpdateDoctorStatus,
  storeReturnDoctorToOp,
  storeGetOperator,
  storeSetOperator,
  storeClearOperator,
  storeGetQueueState,
  storeUpdatePointerIndex,
  storeGetSetting,
  storeUpdateSetting,
  storeGetUserSessions,
  storeGetAllSessions,
  calcMinutes,
  storeGetUserOpSessions,
  calcOpMinutes,
  storeGetWarningsWithProfiles,
  storeGetMyWarnings,
  storeIssueWarning,
} from '@/store/store-supabase';

// ─── Roles ───────────────────────────────────────────────────────────
export async function fetchRoles(): Promise<Role[]> {
  return await storeGetRoles();
}

export async function createRole(params: {
  name: string;
  color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): Promise<void> {
  await storeCreateRole(params);
}

export async function updateRole(
  id: string,
  params: {
    name: string;
    color: string;
    permissions: Partial<Record<Permission, boolean>>;
  }
): Promise<void> {
  await storeUpdateRole(id, params);
}

export async function deleteRole(id: string): Promise<void> {
  await storeDeleteRole(id);
}

// ─── User Profiles ────────────────────────────────────────────────────────
export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const users = await storeGetUsers();
  return Promise.all(users.map(u => hydrateUser(u)));
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const users = await storeGetUsers();
  const u = users.find(x => x.id === userId);
  return u ? await hydrateUser(u) : null;
}

export async function createUserAccount(params: {
  username: string;
  password: string;
  displayName: string;
  roleIds: string[];
  doctorId?: string | null;
  createdBy: string;
}): Promise<void> {
  await storeCreateUser(params);
}

export async function updateProfileDisplayName(userId: string, displayName: string): Promise<void> {
  await storeUpdateUserDisplayName(userId, displayName);
}

export async function updateProfileRoles(userId: string, roleIds: string[]): Promise<void> {
  await storeUpdateUserRoles(userId, roleIds);
}

/** @deprecated ใช้ updateProfileRoles แทน */
export async function updateProfileRole(userId: string, roleId: string): Promise<void> {
  await storeUpdateUserRole(userId, roleId);
}

export async function updateProfilePassword(_currentUserId: string, newPassword: string): Promise<void> {
  const raw = localStorage.getItem('gtav_current_session_supabase');
  if (!raw) throw new Error('ไม่ได้เข้าสู่ระบบ');
  const { userId } = JSON.parse(raw) as { userId: string };
  await storeUpdateUserPassword(userId, newPassword);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await storeDeleteUser(userId);
}

// ─── Doctors ──────────────────────────────────────────────────────────
export async function fetchDoctors(): Promise<Doctor[]> {
  return await storeGetDoctors();
}

export async function addDoctor(name: string): Promise<void> {
  await storeAddDoctor(name);
}

export async function removeDoctor(id: string): Promise<void> {
  await storeRemoveDoctor(id);
}

export async function updateDoctorStatus(id: string, status: DoctorStatus): Promise<void> {
  await storeUpdateDoctorStatus(id, status);
}

export async function returnDoctorToOp(id: string): Promise<void> {
  await storeReturnDoctorToOp(id);
}

// ─── Operator ─────────────────────────────────────────────────────────
export async function fetchOperator(): Promise<Operator | null> {
  return await storeGetOperator();
}

/** ขึ้นเป็นคนรัน OP (ใส่ชื่อ + user_id) */
export async function setOperator(name: string, userId: string | null = null): Promise<void> {
  await storeSetOperator(name, userId);
}

export async function clearOperator(): Promise<void> {
  await storeClearOperator();
}

// ─── Queue State ────────────────────────────────────────────────────────
export async function fetchQueueState(): Promise<QueueState> {
  return await storeGetQueueState();
}

export async function updatePointerIndex(_id: string, pointer_index: number): Promise<void> {
  await storeUpdatePointerIndex(pointer_index);
}

// ─── Settings ─────────────────────────────────────────────────────────
export async function fetchSetting(key: string): Promise<string> {
  return await storeGetSetting(key);
}

export async function updateSetting(key: string, value: string): Promise<void> {
  await storeUpdateSetting(key, value);
}

// ─── Work Sessions ────────────────────────────────────────────────────────
export async function fetchUserSessions(
  userId: string,
  fromDate?: string,
  toDate?: string
): Promise<WorkSession[]> {
  return await storeGetUserSessions(userId, fromDate, toDate);
}

export async function fetchAllSessions(
  fromDate?: string,
  toDate?: string
): Promise<WorkSession[]> {
  const sessions = await storeGetAllSessions(fromDate, toDate);
  const users = await storeGetUsers();
  return sessions.map(s => ({
    ...s,
    user_profile: (() => {
      const u = users.find(x => x.id === s.user_id);
      return u ? hydrateUser(u) : undefined;
    })(),
  })) as any[];
}

export { calcMinutes };

// ─── OP Sessions ────────────────────────────────────────────────────────
export async function fetchUserOpSessions(
  userId: string,
  fromDate?: string,
  toDate?: string
) {
  return await storeGetUserOpSessions(userId, fromDate, toDate);
}

export { calcOpMinutes };

// ─── Warnings ─────────────────────────────────────────────────────────
export async function fetchAllWarnings(): Promise<Warning[]> {
  return await storeGetWarningsWithProfiles();
}

export async function fetchMyWarnings(userId: string): Promise<Warning[]> {
  return await storeGetMyWarnings(userId);
}

export async function issueWarning(
  issuedTo: string,
  issuedBy: string,
  reason: string,
  severity: WarningSeverity = 'yellow'
): Promise<void> {
  await storeIssueWarning(issuedTo, issuedBy, reason, severity);
}
