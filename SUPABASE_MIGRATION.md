# Supabase Migration Guide

## Overview
This guide explains the refactoring from localStorage to Supabase PostgreSQL database.

## Database Schema

### Tables Required

```sql
-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  color VARCHAR NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  can_create_account BOOLEAN NOT NULL DEFAULT false,
  can_manage_roles BOOLEAN NOT NULL DEFAULT false,
  can_change_others_status BOOLEAN NOT NULL DEFAULT false,
  can_view_overview_dashboard BOOLEAN NOT NULL DEFAULT false,
  can_issue_warnings BOOLEAN NOT NULL DEFAULT false,
  can_access_settings BOOLEAN NOT NULL DEFAULT false,
  can_manage_doctors BOOLEAN NOT NULL DEFAULT false,
  can_next_queue BOOLEAN NOT NULL DEFAULT false,
  can_set_operator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL
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
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Doctors table
CREATE TABLE doctors (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  queue_order INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Operator table
CREATE TABLE operator (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  user_id UUID,
  created_at TIMESTAMP NOT NULL
);

-- Queue state table
CREATE TABLE queue_state (
  id UUID PRIMARY KEY,
  pointer_index INTEGER NOT NULL,
  updated_at TIMESTAMP NOT NULL
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
  created_at TIMESTAMP NOT NULL
);

-- OP sessions table
CREATE TABLE op_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP,
  duration_minutes INTEGER,
  created_at TIMESTAMP NOT NULL
);

-- Warnings table
CREATE TABLE warnings (
  id UUID PRIMARY KEY,
  issued_to UUID NOT NULL,
  issued_by UUID NOT NULL,
  reason VARCHAR NOT NULL,
  severity VARCHAR NOT NULL DEFAULT 'yellow',
  created_at TIMESTAMP NOT NULL
);
```

## Files Changed

### New Files
- `src/services/supabase.ts` - Supabase client initialization
- `src/store/store-supabase.ts` - Refactored store with Supabase backend

### Migration Steps

1. **Create Supabase tables** - Use the SQL schema above in Supabase console
2. **Update environment variables** - Add Supabase URL and key to `.env`
3. **Replace imports** - Change from `store.ts` to `store-supabase.ts`
4. **Update API layer** - Modify `src/services/api.ts` to use async functions
5. **Update components** - Handle async operations in React components

### Key Differences

#### Synchronous → Asynchronous
```typescript
// Old (localStorage)
const roles = storeGetRoles();

// New (Supabase)
const roles = await storeGetRoles();
```

#### BroadcastChannel still supported
Cross-tab sync still uses BroadcastChannel API for real-time updates across tabs.

### Environment Setup

Add to `.env`:
```
VITE_SUPABASE_URL=https://nwzftffksbutfqrevzup.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_oQygMcS8xTbIV9x2SDoqCw_g-BgX8Qu
```

## Rollback Plan

If issues occur:
1. Keep `src/store/store.ts` (original localStorage version)
2. Revert imports to use original store
3. Data remains in localStorage

## Testing Checklist

- [ ] Database tables created in Supabase
- [ ] All CRUD operations work
- [ ] BroadcastChannel sync works across tabs
- [ ] Authentication still works
- [ ] Session management works
- [ ] OP session tracking works
- [ ] Warning system works
- [ ] Role-based access control works

## Performance Considerations

1. **Caching** - Consider adding client-side caching to reduce API calls
2. **Real-time subscriptions** - Can be added using Supabase Realtime
3. **Batch operations** - Use bulk insert/update for large datasets
4. **Indexes** - Add database indexes on frequently queried columns

## Notes

- All functions are now async (return Promise)
- Error handling improved with try-catch blocks
- Maintains same API interface for easier migration
- BroadcastChannel provides cross-tab sync
