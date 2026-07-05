// บริการ API สำหรับระบบจัดคิวหมอ — ใช้ localStorage store แทน Supabase
import type { Doctor, DoctorStatus, Operator, QueueState, Role, UserProfile, WorkSession, Warning, Permission } from '@/types/index';
import {
  storeGetRoles, storeCreateRole, storeUpdateRole, storeDeleteRole,
  storeGetUsers, storeCreateUser, storeUpdateUserDisplayName,
  storeUpdateUserRole, storeUpdateUserPassword, storeDeleteUser, hydrateUser,
  storeGetDoctors, storeAddDoctor, storeRemoveDoctor,
  storeUpdateDoctorStatus, storeReturnDoctorToOp,
  storeGetOperator, storeSetOperator, storeClearOperator,
  storeGetQueueState, storeUpdatePointerIndex,
  storeGetSetting, storeUpdateSetting,
  storeGetUserSessions, storeGetAllSessions, calcMinutes,
  storeGetUserOpSessions, calcOpMinutes,
  storeGetWarningsWithProfiles, storeGetMyWarnings, storeIssueWarning,
} from '@/store/store';

// ─── Roles ────────────────────────────────────────────────────────────────────
export async function fetchRoles(): Promise<Role[]> {
  return storeGetRoles();
}

export async function createRole(params: {
  name: string; color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): Promise<void> {
  storeCreateRole(params);
}

export async function updateRole(id: string, params: {
  name: string; color: string;
  permissions: Partial<Record<Permission, boolean>>;
}): Promise<void> {
  storeUpdateRole(id, params);
}

export async function deleteRole(id: string): Promise<void> {
  storeDeleteRole(id);
}

// ─── User Profiles ────────────────────────────────────────────────────────────
export async function fetchAllProfiles(): Promise<UserProfile[]> {
  return storeGetUsers().map(hydrateUser);
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const u = storeGetUsers().find(x => x.id === userId);
  return u ? hydrateUser(u) : null;
}

export async function createUserAccount(params: {
  username: string; password: string; displayName: string;
  roleId: string; doctorId?: string | null; createdBy: string;
}): Promise<void> {
  await storeCreateUser(params);
}

export async function updateProfileDisplayName(userId: string, displayName: string): Promise<void> {
  storeUpdateUserDisplayName(userId, displayName);
}

export async function updateProfileRole(userId: string, roleId: string): Promise<void> {
  storeUpdateUserRole(userId, roleId);
}

export async function updateProfilePassword(_currentUserId: string, newPassword: string): Promise<void> {
  const raw = localStorage.getItem('gtav_current_session');
  if (!raw) throw new Error('ไม่ได้เข้าสู่ระบบ');
  const { userId } = JSON.parse(raw) as { userId: string };
  await storeUpdateUserPassword(userId, newPassword);
}

export async function deleteUserAccount(userId: string): Promise<void> {
  storeDeleteUser(userId);
}

// ─── Doctors ──────────────────────────────────────────────────────────────────
export async function fetchDoctors(): Promise<Doctor[]> {
  return storeGetDoctors();
}

export async function addDoctor(name: string): Promise<void> {
  storeAddDoctor(name);
}

export async function removeDoctor(id: string): Promise<void> {
  storeRemoveDoctor(id);
}

export async function updateDoctorStatus(id: string, status: DoctorStatus): Promise<void> {
  storeUpdateDoctorStatus(id, status);
}

export async function returnDoctorToOp(id: string): Promise<void> {
  storeReturnDoctorToOp(id);
}

// ─── Operator ─────────────────────────────────────────────────────────────────
export async function fetchOperator(): Promise<Operator | null> {
  return storeGetOperator();
}

/** ขึ้นเป็นคนรัน OP (ใส่ชื่อ + user_id) */
export async function setOperator(name: string, userId: string | null = null): Promise<void> {
  storeSetOperator(name, userId);
}

export async function clearOperator(): Promise<void> {
  storeClearOperator();
}

// ─── Queue State ──────────────────────────────────────────────────────────────
export async function fetchQueueState(): Promise<QueueState> {
  return storeGetQueueState();
}

export async function updatePointerIndex(_id: string, pointer_index: number): Promise<void> {
  storeUpdatePointerIndex(pointer_index);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function fetchSetting(key: string): Promise<string> {
  return storeGetSetting(key);
}

export async function updateSetting(key: string, value: string): Promise<void> {
  storeUpdateSetting(key, value);
}

// ─── Work Sessions ────────────────────────────────────────────────────────────
export async function fetchUserSessions(userId: string, fromDate?: string, toDate?: string): Promise<WorkSession[]> {
  return storeGetUserSessions(userId, fromDate, toDate);
}

export async function fetchAllSessions(fromDate?: string, toDate?: string): Promise<WorkSession[]> {
  const sessions = storeGetAllSessions(fromDate, toDate);
  const users = storeGetUsers();
  return sessions.map(s => ({
    ...s,
    user_profile: (() => {
      const u = users.find(x => x.id === s.user_id);
      return u ? hydrateUser(u) : undefined;
    })(),
  }));
}

export { calcMinutes };

// ─── OP Sessions ──────────────────────────────────────────────────────────────
export async function fetchUserOpSessions(userId: string, fromDate?: string, toDate?: string) {
  return storeGetUserOpSessions(userId, fromDate, toDate);
}

export { calcOpMinutes };

// ─── Warnings ─────────────────────────────────────────────────────────────────
export async function fetchAllWarnings(): Promise<Warning[]> {
  return storeGetWarningsWithProfiles();
}

export async function fetchMyWarnings(userId: string): Promise<Warning[]> {
  return storeGetMyWarnings(userId);
}

export async function issueWarning(issuedTo: string, issuedBy: string, reason: string): Promise<void> {
  storeIssueWarning(issuedTo, issuedBy, reason);
}
