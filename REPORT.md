# REPORT — ระบบรันคิวหมอ GTA V RP

> **สำหรับ AI Agent / Developer ที่เข้ามาร่วมพัฒนา**: อ่านไฟล์นี้ก่อนแตะโค้ดใดๆ  
> ไฟล์นี้อธิบายโครงสร้าง, สถาปัตยกรรม, การตัดสินใจออกแบบ และสถานะปัจจุบันทั้งหมดของโปรเจกต์

---

## 1. ภาพรวมโปรเจกต์

| ข้อมูล | รายละเอียด |
|---|---|
| ชื่อแอป | ระบบรันคิวหมอ GTA V Discord |
| ประเภท | Web Application (React + TypeScript + Vite) |
| UI Library | shadcn/ui + Tailwind CSS |
| Storage | **localStorage only** — ไม่มี database server |
| Auth | Username/password + SHA-256 hash (Web Crypto API) |
| Realtime Sync | BroadcastChannel API (cross-tab) |
| Version ปัจจุบัน | v6 |

**วัตถุประสงค์**: จัดการคิวหมอสำหรับ GTA V RP Server — ติดตามสถานะหมอ (OP/กิจกรรม/AFK/ออกเวร/Story), ระบบ OP Runner, และการจัดการสมาชิกทีม

---

## 2. โครงสร้างไฟล์

```
src/
├── contexts/
│   └── AuthContext.tsx          ← Auth state (login/logout/session)
├── data/
│   └── seed.ts                  ← ข้อมูลตั้งต้น (roles, users, doctors)
├── hooks/
│   └── use-permissions.ts       ← ตรวจสิทธิ์ (รองรับหลายยศ)
├── pages/
│   ├── LoginPage.tsx            ← หน้า login
│   ├── QueuePage.tsx            ← หน้าคิวหลัก (OP runner + doctor list)
│   ├── AccountsPage.tsx         ← จัดการบัญชีผู้ใช้ (multi-role)
│   ├── RolesPage.tsx            ← จัดการยศ (CRUD)
│   ├── DashboardPage.tsx        ← Dashboard ส่วนตัว (ชั่วโมงของตัวเอง)
│   ├── OverviewDashboard.tsx    ← Dashboard ภาพรวม (admin only)
│   ├── WarningsPage.tsx         ← ระบบใบเตือน (yellow/orange/red)
│   ├── SettingsPage.tsx         ← ตั้งค่าระบบ (ชั่วโมง, server URL)
│   └── PromotionPage.tsx        ← คุณสมบัติเลื่อนยศ (ชั่วโมง deficit)
├── services/
│   └── api.ts                   ← API layer (wraps store functions)
├── store/
│   └── store.ts                 ← localStorage CRUD + BroadcastChannel
├── types/
│   └── index.ts                 ← TypeScript interfaces ทั้งหมด
├── components/
│   └── layouts/
│       └── AppLayout.tsx        ← Layout หลัก (sidebar + mobile hamburger)
├── routes.tsx                   ← Route definitions ทั้งหมด
└── App.tsx                      ← Root + ProtectedRoute
```

---

## 3. สถาปัตยกรรมหลัก (Architecture Decisions)

### 3.1 ไม่ใช้ Supabase Database
ระบบใช้ **localStorage เป็น "database"** ทั้งหมด เพื่อให้ deploy ได้แบบ static site ไม่ต้องพึ่ง backend

- **ไม่มี** Supabase DB queries
- **ไม่มี** Supabase Realtime subscriptions
- Cross-tab sync ใช้ `BroadcastChannel('gtav_queue_sync')`
- `src/store/store.ts` คือ single source of truth

### 3.2 localStorage Keys

```typescript
const K = {
  ROLES:      'gtav_roles',
  USERS:      'gtav_users',
  DOCTORS:    'gtav_doctors',
  OPERATOR:   'gtav_operator',
  QUEUE_STATE:'gtav_queue_state',
  SETTINGS:   'gtav_settings',
  SESSIONS:   'gtav_sessions',
  OP_SESSIONS:'gtav_op_sessions',
  WARNINGS:   'gtav_warnings',
  SEEDED:     'gtav_seeded_v3',
}
```

### 3.3 initStore() — Additive Migration

`initStore()` เช็คว่ามี roles อยู่แล้วไหม (ไม่ใช่เช็ค seed-version key)  
- ถ้า roles ยังไม่มี → seed ทุกอย่าง (fresh install)  
- ถ้า roles มีอยู่แล้ว → เพิ่มเฉพาะ key ที่ขาด (additive, ไม่ลบของเดิม)

### 3.4 ระบบยศแบบ Discord (Multi-Role)

```typescript
StoredUser.role_ids: string[]   // รายการยศทั้งหมด
StoredUser.role_id: string      // ยศหลัก (role_ids[0]) — backward compat
```

- User 1 คนมีได้หลายยศ
- `usePermissions().can(permission)` → คืน `true` ถ้ายศใดยศหนึ่งมีสิทธิ์นั้น
- **Super Admin** (username = `superadmin`) ถูกล็อก ไม่มีใครเปลี่ยนยศได้

---

## 4. ระบบ Auth

```
LoginPage → signInWithUsername() → SHA-256 password check
         → storeStartSession() → localStorage session
         → storeUpdateDoctorStatus(doctor_id, 'op')  ← auto-join queue
         → navigate('/')
```

- Session เก็บใน `localStorage['gtav_current_session']` = `{ userId, sessionId }`
- Logout: ออกจากคิว (`off_duty`) + clear session
- `AuthContext` expose: `{ user, profile, loading, signInWithUsername, signOut, refreshProfile, activeSessionId }`

---

## 5. บัญชีตั้งต้น (Seed Accounts)

| Username | Password | Role | หมอที่ผูก |
|---|---|---|---|
| `superadmin` | `Admin1234!` | admin | — |
| `bot_ไนท์` | `Bot1234!` | หมอ | หมอไนท์ (status: op) |
| `bot_ซุปเปอร์` | `Bot1234!` | หมอ | หมอซุปเปอร์ (status: op) |
| `bot_โค้ก` | `Bot1234!` | หมอ | หมอโค้ก (status: afk) |

---

## 6. ระบบสิทธิ์ (Permissions)

```typescript
type Permission =
  | 'can_create_account'        // สร้างบัญชีผู้ใช้
  | 'can_manage_roles'          // จัดการยศ
  | 'can_change_others_status'  // เปลี่ยนสถานะหมอคนอื่น
  | 'can_view_overview_dashboard'
  | 'can_issue_warnings'        // ออกใบเตือน
  | 'can_access_settings'       // เข้าหน้าตั้งค่า
  | 'can_manage_doctors'        // เพิ่ม/ลบหมอ
  | 'can_next_queue'            // กดถัดไปในคิว
  | 'can_set_operator';         // ตั้ง/เคลียร์ OP runner
```

ทุกคนสามารถ:
- กด "ขึ้นเป็น OP" ตัวเอง
- ย้ายชื่อตัวเองไปห้องอื่น (status ของ doctor ตัวเอง)
- ดูหน้าคิว, dashboard ส่วนตัว, ใบเตือนของตัวเอง, คุณสมบัติเลื่อนยศ

---

## 7. Doctor Status Flow

```
login → 'op' (รอรับงาน)
     ↓ กดเมนูตัวเอง
  'activity' | 'afk' | 'story' | 'off_duty'
     ↓ กด "ขึ้น OP"
  'op' อีกครั้ง
     ↓ logout
  'off_duty' (ออกจากระบบ)
```

---

## 8. OP Runner System

- ทุกคนกด **"ขึ้นเป็น OP"** ได้ → ตัวเองเป็นคนรัน OP
- ปุ่ม **"เลิกเป็น OP"** → ออกจากตำแหน่ง
- ปุ่ม **"สุ่ม"** → สุ่มจาก doctor ที่อยู่ใน 'op' queue
- เฉพาะ **คนที่เป็น OP runner เท่านั้น** กด **"ถัดไป"** ได้
- `Operator` object เก็บ `{ id, name, user_id, created_at }`

---

## 9. Warning System

```typescript
Warning.severity: 'yellow' | 'orange' | 'red'
```

- เหลือง = เตือน, ส้ม = หนัก, แดง = ร้ายแรง
- แสดงผู้ออกใบเตือนพร้อมยศ
- Admin/ผู้มีสิทธิ์เห็นทุกใบเตือน, user ทั่วไปเห็นเฉพาะของตัวเอง

---

## 10. Routes

| Path | Component | Auth Required | Permission |
|---|---|---|---|
| `/login` | LoginPage | ❌ | — |
| `/` | QueuePage | ✅ | ทุกคน |
| `/dashboard` | DashboardPage | ✅ | ทุกคน |
| `/overview` | OverviewDashboard | ✅ | `can_view_overview_dashboard` |
| `/accounts` | AccountsPage | ✅ | `can_create_account` |
| `/roles` | RolesPage | ✅ | `can_manage_roles` |
| `/warnings` | WarningsPage | ✅ | ทุกคน (แต่เห็นคนละส่วน) |
| `/settings` | SettingsPage | ✅ | `can_access_settings` |
| `/promotion` | PromotionPage | ✅ | ทุกคน |

---

## 11. สิ่งที่ยังไม่ได้ทำ / Backlog

- [ ] เชื่อมต่อ GTA V game server API จริง (server_url ใน Settings)
- [ ] Export ชั่วโมงเป็น CSV/Excel
- [ ] Notification เสียง/popup เมื่อหมอใหม่เข้าคิว
- [ ] ประวัติ OP session log แบบ UI
- [ ] ระบบ audit log (ใครทำอะไร เมื่อไหร่)
- [ ] Dark/Light mode toggle

---

## 12. คำแนะนำสำหรับ AI Agent ที่เข้ามาช่วยพัฒนา

### ก่อนแก้ไขโค้ด
1. อ่านไฟล์นี้ให้จบก่อน
2. ดู `src/types/index.ts` เพื่อเข้าใจ data model
3. ดู `src/store/store.ts` สำหรับ CRUD functions ทั้งหมด
4. ดู `src/services/api.ts` สำหรับ API layer (pages ใช้ layer นี้เสมอ ไม่เรียก store โดยตรง)

### กฎสำคัญ
- **ห้ามใช้ Supabase database** (Supabase client/server skill มีแต่ไม่ได้ใช้ DB)
- **ห้าม** แก้ไข `src/components/ui/` (shadcn components)
- **ต้องใช้** `api.ts` เป็น layer กลาง ไม่ call `store.ts` โดยตรงจาก pages
- Role system ใช้ `role_ids: string[]` ไม่ใช่ `role_id: string` เดี่ยว
- ทุกครั้งที่แก้ไขให้ run `npx tsc --noEmit && npm run lint` ก่อน commit

### Pattern สำหรับเพิ่ม feature ใหม่
```
1. เพิ่ม type ใน src/types/index.ts
2. เพิ่ม CRUD ใน src/store/store.ts
3. เพิ่ม API wrapper ใน src/services/api.ts
4. เพิ่ม/แก้ page ใน src/pages/
5. เพิ่ม route ใน src/routes.tsx (ถ้าเป็นหน้าใหม่)
6. run tsc + lint ตรวจสอบ
```

---

## 13. Tech Stack

| Package | Version | ใช้ทำอะไร |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Build tool |
| Tailwind CSS | 4 | Styling |
| shadcn/ui | latest | UI components |
| React Router | 7 | Client-side routing |
| sonner | latest | Toast notifications |
| lucide-react | latest | Icons |
| date-fns | latest | Date formatting |
| framer-motion | latest | Animations |

---

## 14. การ Contribute ผ่าน GitHub

### Setup
```bash
git clone <repo-url>
cd <repo-dir>
pnpm install
pnpm dev
```

### Workflow
```bash
# สร้าง branch ใหม่สำหรับ feature
git checkout -b feature/ชื่อ-feature

# หลังแก้ไข ตรวจสอบก่อนเสมอ
npx tsc --noEmit
npm run lint

# Commit พร้อม message ชัดเจน
git add .
git commit -m "feat: อธิบายสิ่งที่ทำ"
git push origin feature/ชื่อ-feature

# สร้าง Pull Request บน GitHub
```

### Commit Message Convention
- `feat:` เพิ่ม feature ใหม่
- `fix:` แก้ bug
- `refactor:` ปรับโครงสร้างโค้ด
- `docs:` แก้ documentation
- `style:` แก้ UI/CSS

### การเชื่อม AI Agent อื่น (เช่น Cursor, Copilot, Claude)
1. Clone repo นี้ลงเครื่อง
2. เปิด IDE ที่รองรับ AI (Cursor, VS Code + Copilot, etc.)
3. ให้ AI อ่านไฟล์นี้ (`REPORT.md`) ก่อนเสมอ — เป็น context หลัก
4. ถาม AI ว่า "อ่าน REPORT.md แล้วบอกว่าเข้าใจโครงสร้างอะไรบ้าง" ก่อนสั่งงาน
5. AI ควร follow pattern จากข้อ 12 ด้านบน

---

*Last updated: 2026-07-05 | Maintained by Miaoda AI Agent*
