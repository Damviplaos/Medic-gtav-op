/**
 * supabase.ts – Supabase client initialization
 * Replaces localStorage with Supabase PostgreSQL database
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nwzftffksbutfqrevzup.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_oQygMcS8xTbIV9x2SDoqCw_g-BgX8Qu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export types from Supabase for convenience
export type { User as SupabaseUser } from '@supabase/supabase-js';
