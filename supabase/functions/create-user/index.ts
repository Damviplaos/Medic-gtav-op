import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password, username, displayName, roleId, doctorId, createdBy } = await req.json();

    if (!email || !password || !username || !displayName || !roleId) {
      return new Response(JSON.stringify({ error: 'ข้อมูลไม่ครบถ้วน' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ตรวจสอบ username ซ้ำ
    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // สร้าง auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw authError;

    // สร้าง profile
    const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
      id: authData.user.id,
      username: username.toLowerCase().trim(),
      display_name: displayName,
      role_id: roleId,
      doctor_id: doctorId ?? null,
      created_by: createdBy,
    });
    if (profileError) {
      // rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw profileError;
    }

    return new Response(JSON.stringify({ success: true, userId: authData.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
