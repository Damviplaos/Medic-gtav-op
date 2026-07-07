import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get threshold from settings
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'inactivity_threshold_hours')
      .maybeSingle();

    const threshold = parseInt(setting?.value ?? '24', 10);

    const { data: inactiveUsers, error } = await supabase
      .rpc('get_inactive_users', { p_threshold_hours: threshold });

    if (error) throw error;

    // Optionally send Discord notification
    const { data: discordSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'discord_notify_inactivity')
      .maybeSingle();

    const { data: webhookSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'discord_webhook_url')
      .maybeSingle();

    const shouldNotify = discordSetting?.value === 'true';
    const webhookUrl = webhookSetting?.value;

    if (shouldNotify && webhookUrl && inactiveUsers && inactiveUsers.length > 0) {
      const names = inactiveUsers.slice(0, 10).map((u: { nickname?: string; username: string; hours_absent: number }) =>
        `• ${u.nickname || u.username} — ขาดงาน ${u.hours_absent} ชม.`
      ).join('\n');
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **สมาชิกขาดงานเกิน ${threshold} ชม.** (${inactiveUsers.length} คน)\n${names}`,
        }),
      });
    }

    return new Response(JSON.stringify({ inactive_count: inactiveUsers?.length ?? 0, users: inactiveUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('inactivity-check error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
