# Supabase Implementation Guide

## วัตถุประสงค์
แก้ไข 2 ปัญหาหลัก:
1. ✅ **Data Sync** - ข้อมูลซิงค์ระหว่างเครื่อง/tab
2. ✅ **Doctor Auto-Join** - Doctor โผล่ในคิวอัตโนมัติเมื่อ login

## ปัญหา vs แก้ไข

### ปัญหา 1: localStorage ไม่ซิงค์ข้อมูล
**สาเหตุ:**
- localStorage เก็บเฉพาะในเครื่องนั้น
- login จากเครื่องอื่น ข้อมูลไม่เหมือนกัน

**แก้ไข:**
```
localstorage → Supabase PostgreSQL
```
- ✅ ทุกเครื่องดูข้อมูลเดียวกัน
- ✅ Real-time sync ผ่าน BroadcastChannel
- ✅ ทะเบียนกลาง centralized database

### ปัญหา 2: Doctor ไม่โผล่ในคิว
**สาเหตุ:**
- `storeUpdateDoctorStatus()` ไม่ broadcast ทันที
- Component ยังไม่ re-render

**แก้ไข:**
```typescript
// ✅ เพิ่ม verification + broadcast
await storeUpdateDoctorStatus(stored.doctor_id, 'op');
await new Promise(resolve => setTimeout(resolve, 100));
const doctors = await storeGetDoctors();
if (!doctor || doctor.status !== 'op') {
  await storeUpdateDoctorStatus(stored.doctor_id, 'op'); // Retry
}
// Broadcast to all tabs
bc.postMessage({ type: 'doctor_joined', doctorId });
```

## ไฟล์ที่สร้าง

### 1️⃣ `src/services/supabase.ts` ✅
Supabase client initialization
```typescript
export const supabase = createClient(URL, ANON_KEY);
```

### 2️⃣ `src/store/store-supabase.ts` ✅
Refactored store (async functions)
```typescript
export async function storeGetDoctors(): Promise<Doctor[]> {
  const { data } = await supabase.from('doctors').select('*');
  return data || [];
}
```

### 3️⃣ `src/contexts/AuthContext-supabase.tsx` ✅
**Real-time Auth Context**
```typescript
// ✅ Auto-join queue with verification
if (stored.doctor_id) {
  await storeUpdateDoctorStatus(stored.doctor_id, 'op');
  // Verify & retry if failed
  const doctors = await storeGetDoctors();
  if (!doctor?.status === 'op') {
    await storeUpdateDoctorStatus(stored.doctor_id, 'op');
  }
}
```

### 4️⃣ `src/services/api-supabase.ts` ✅
API layer (all async)
```typescript
export async function fetchDoctors(): Promise<Doctor[]> {
  return await storeGetDoctors();
}
```

## Supabase Database Setup

รัน SQL นี้ใน Supabase Console:

```sql
-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  color VARCHAR NOT NULL,
  is_system BOOLEAN DEFAULT false,
  can_create_account BOOLEAN DEFAULT false,
  can_manage_roles BOOLEAN DEFAULT false,
  can_change_others_status BOOLEAN DEFAULT false,
  can_view_overview_dashboard BOOLEAN DEFAULT false,
  can_issue_warnings BOOLEAN DEFAULT false,
  can_access_settings BOOLEAN DEFAULT false,
  can_manage_doctors BOOLEAN DEFAULT false,
  can_next_queue BOOLEAN DEFAULT false,
  can_set_operator BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR NOT NULL UNIQUE,
  display_name VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  role_id UUID,
  role_ids UUID[] DEFAULT '{}',
  doctor_id UUID,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Doctors table
CREATE TABLE doctors (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  status VARCHAR NOT NULL DEFAULT 'off_duty',
  queue_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Operator table
CREATE TABLE operator (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  user_id UUID,
  created_at TIMESTAMP DEFAULT now()
);

-- Queue state table
CREATE TABLE queue_state (
  id UUID PRIMARY KEY,
  pointer_index INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now()
);

-- Settings table
CREATE TABLE settings (
  key VARCHAR PRIMARY KEY,
  value VARCHAR NOT NULL
);

-- Work sessions table
CREATE TABLE work_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  login_at TIMESTAMP NOT NULL,
  logout_at TIMESTAMP,
  duration_minutes INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- OP sessions table
CREATE TABLE op_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP,
  duration_minutes INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- Warnings table
CREATE TABLE warnings (
  id UUID PRIMARY KEY,
  issued_to UUID NOT NULL,
  issued_by UUID NOT NULL,
  reason VARCHAR NOT NULL,
  severity VARCHAR DEFAULT 'yellow',
  created_at TIMESTAMP DEFAULT now()
);
```

## Migration Steps

### Step 1: Setup Supabase
1. ไป https://app.supabase.com
2. สร้าง project ใหม่ (หรือใช้เดิม)
3. Copy URL + Anon Key ไป `.env`

### Step 2: Create Database Tables
1. ไป Supabase Console → SQL Editor
2. Copy-paste SQL schema ด้านบน
3. Run

### Step 3: Update `.env`
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Step 4: Switch Context
**ตัวเลือก A: ใช้ Supabase ใหม่**
```tsx
// src/main.tsx
- import { AuthProvider } from '@/contexts/AuthContext';
+ import { AuthProvider } from '@/contexts/AuthContext-supabase';

- import * as api from '@/services/api';
+ import * as api from '@/services/api-supabase';
```

**ตัวเลือก B: ยังใช้ localStorage เดิม**
```tsx
// ไม่ต้องแก้อะไร ใช้ original AuthContext + api.ts
```

### Step 5: Test
1. Login จากเครื่อง A → ดู queue
2. Login จากเครื่อง B → ควรเห็น doctor เดียวกัน
3. ตรวจสอบ doctor status เปลี่ยนเป็น 'op'

## Real-time Features

### Cross-Tab Sync
```typescript
// Tab A: Update doctor status
storeUpdateDoctorStatus(id, 'op')

// Tab B: Auto-refresh (via BroadcastChannel)
subscribeStore(() => {
  // Re-fetch doctors
})
```

### Multi-Device Sync
```typescript
// Device A: Login
await signInWithUsername('doctor1', 'password')
// ✅ Doctor 1 โผล่ในคิว

// Device B: Visit dashboard
fetchDoctors() // ✅ เห็น Doctor 1 ในคิว (real-time)
```

## Rollback Plan

ถ้ามีปัญหา:
```tsx
// เปลี่ยนกลับไปใช้ localStorage
- import { AuthProvider } from '@/contexts/AuthContext-supabase';
+ import { AuthProvider } from '@/contexts/AuthContext';
```

ข้อมูลใน localStorage ยังอยู่ ปลอดภัย

## ข้อสังเกต

⚠️ **Session Management**
- localStorage session มี expiry 24 ชั่วโมง
- Token refresh ใน Supabase (ถ้าใช้ Auth)

⚠️ **Error Handling**
- Network error → show toast
- Database error → fallback to cache
- Doctor update fail → retry mechanism

✅ **Performance**
- Query optimization ด้วย indexes
- Client-side caching ด้วย BroadcastChannel
- Real-time listeners (optional)

## Support

📖 ดู SUPABASE_MIGRATION.md สำหรับ schema details
📖 ดู store-supabase.ts สำหรับ API reference
