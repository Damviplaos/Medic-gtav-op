// ข้อมูลตั้งต้นสำหรับระบบ (seed data)
// Super Admin: username=superadmin / password=Admin1234!
// Bots: bot_ไนท์, bot_ซุปเปอร์, bot_โค้ก

import type { Role, Doctor, WorkSession, Warning } from '@/types/index';

// ─── Stored User (มี password hash) ──────────────────────────────────────────
export interface StoredUser {
  id: string;
  username: string;
  display_name: string;
  password_hash: string; // SHA-256 hex
  role_id: string;
  doctor_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Static IDs (ทำให้ seed ซ้ำกันได้) ─────────────────────────────────────
export const SEED_IDS = {
  // Roles
  ROLE_ADMIN: 'role-admin-0000-0000-000000000001',
  ROLE_PHO: 'role-pho-00000-0000-000000000002',
  ROLE_OP: 'role-op-000000-0000-000000000003',
  ROLE_DOCTOR: 'role-doctor-000-0000-000000000004',

  // Users
  USER_SUPERADMIN: 'user-superadm-0000-0000-000000000001',
  USER_BOT1: 'user-bot1-00000-0000-000000000002',
  USER_BOT2: 'user-bot2-00000-0000-000000000003',
  USER_BOT3: 'user-bot3-00000-0000-000000000004',

  // Doctors (linked to bots)
  DOC_BOT1: 'doc-bot1-000000-0000-000000000002',
  DOC_BOT2: 'doc-bot2-000000-0000-000000000003',
  DOC_BOT3: 'doc-bot3-000000-0000-000000000004',
} as const;

// ─── Seed Roles ───────────────────────────────────────────────────────────────
export const SEED_ROLES: Role[] = [
  {
    id: SEED_IDS.ROLE_ADMIN,
    name: 'admin',
    is_system: true,
    color: '#EF4444',
    can_create_account: true,
    can_manage_roles: true,
    can_change_others_status: true,
    can_view_overview_dashboard: true,
    can_issue_warnings: true,
    can_access_settings: true,
    can_manage_doctors: true,
    can_next_queue: true,
    can_set_operator: true,
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: SEED_IDS.ROLE_PHO,
    name: 'ผอ',
    is_system: true,
    color: '#F59E0B',
    can_create_account: true,
    can_manage_roles: false,
    can_change_others_status: true,
    can_view_overview_dashboard: true,
    can_issue_warnings: true,
    can_access_settings: true,
    can_manage_doctors: true,
    can_next_queue: true,
    can_set_operator: true,
    created_at: '2025-01-01T00:00:01.000Z',
  },
  {
    id: SEED_IDS.ROLE_OP,
    name: 'OP',
    is_system: true,
    color: '#22C55E',
    can_create_account: false,
    can_manage_roles: false,
    can_change_others_status: false,
    can_view_overview_dashboard: false,
    can_issue_warnings: false,
    can_access_settings: false,
    can_manage_doctors: false,
    can_next_queue: true,
    can_set_operator: true,
    created_at: '2025-01-01T00:00:02.000Z',
  },
  {
    id: SEED_IDS.ROLE_DOCTOR,
    name: 'หมอ',
    is_system: true,
    color: '#3B82F6',
    can_create_account: false,
    can_manage_roles: false,
    can_change_others_status: false,
    can_view_overview_dashboard: false,
    can_issue_warnings: false,
    can_access_settings: false,
    can_manage_doctors: false,
    can_next_queue: false,
    can_set_operator: false,
    created_at: '2025-01-01T00:00:03.000Z',
  },
];

// ─── Seed Doctors (linked to bots) ───────────────────────────────────────────
export const SEED_DOCTORS: Doctor[] = [
  {
    id: SEED_IDS.DOC_BOT1,
    name: 'หมอไนท์',
    status: 'op',
    queue_order: 0,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: SEED_IDS.DOC_BOT2,
    name: 'หมอซุปเปอร์',
    status: 'op',
    queue_order: 1,
    created_at: '2025-01-01T00:00:01.000Z',
    updated_at: '2025-01-01T00:00:01.000Z',
  },
  {
    id: SEED_IDS.DOC_BOT3,
    name: 'หมอโค้ก',
    status: 'afk',
    queue_order: 2,
    created_at: '2025-01-01T00:00:02.000Z',
    updated_at: '2025-01-01T00:00:02.000Z',
  },
];

// ─── Seed Users (password pre-hashed ด้วย sha256Hex) ─────────────────────────
// superadmin → Admin1234!
// bots → Bot1234!
export const SEED_USERS: StoredUser[] = [
  {
    id: SEED_IDS.USER_SUPERADMIN,
    username: 'superadmin',
    display_name: 'Super Admin',
    // SHA-256("Admin1234!") computed at build time
    password_hash: '__HASH_superadmin__',
    role_id: SEED_IDS.ROLE_ADMIN,
    doctor_id: null,
    created_by: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: SEED_IDS.USER_BOT1,
    username: 'bot_ไนท์',
    display_name: 'บอท หมอไนท์',
    password_hash: '__HASH_bot__',
    role_id: SEED_IDS.ROLE_DOCTOR,
    doctor_id: SEED_IDS.DOC_BOT1,
    created_by: SEED_IDS.USER_SUPERADMIN,
    created_at: '2025-01-01T00:01:00.000Z',
    updated_at: '2025-01-01T00:01:00.000Z',
  },
  {
    id: SEED_IDS.USER_BOT2,
    username: 'bot_ซุปเปอร์',
    display_name: 'บอท หมอซุปเปอร์',
    password_hash: '__HASH_bot__',
    role_id: SEED_IDS.ROLE_DOCTOR,
    doctor_id: SEED_IDS.DOC_BOT2,
    created_by: SEED_IDS.USER_SUPERADMIN,
    created_at: '2025-01-01T00:02:00.000Z',
    updated_at: '2025-01-01T00:02:00.000Z',
  },
  {
    id: SEED_IDS.USER_BOT3,
    username: 'bot_โค้ก',
    display_name: 'บอท หมอโค้ก',
    password_hash: '__HASH_bot__',
    role_id: SEED_IDS.ROLE_DOCTOR,
    doctor_id: SEED_IDS.DOC_BOT3,
    created_by: SEED_IDS.USER_SUPERADMIN,
    created_at: '2025-01-01T00:03:00.000Z',
    updated_at: '2025-01-01T00:03:00.000Z',
  },
];

export const SEED_SETTINGS: Record<string, string> = {
  server_url: '',
  required_hours_per_week: '20',
  required_op_hours_per_week: '5',
};

export const SEED_QUEUE_STATE = {
  id: 'queue-state-0000-0000-000000000001',
  pointer_index: 0,
  updated_at: '2025-01-01T00:00:00.000Z',
};

export const EMPTY_SESSIONS: WorkSession[] = [];
export const EMPTY_WARNINGS: Warning[] = [];
