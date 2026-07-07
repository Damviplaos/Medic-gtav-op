import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'ไม่ได้รับอนุญาต' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'ไม่ได้รับอนุญาต' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper: get ic_name for Google Sheets clock-in/out
    const getProfile = async () => {
      const { data } = await supabaseAdmin.from('profiles').select('ic_name, username').eq('id', user.id).maybeSingle();
      return data;
    };

    // Helper: trigger attendance sync (fire-and-forget)
    const syncAttendance = async (action: 'clock_in' | 'clock_out') => {
      const profile = await getProfile();
      const ic_name = profile?.ic_name || profile?.username || '';
      // Run RPC
      if (action === 'clock_in') {
        await supabaseAdmin.rpc('clock_in_attendance', { p_user_id: user.id });
      } else {
        await supabaseAdmin.rpc('clock_out_attendance', { p_user_id: user.id });
      }
      // Get sheets settings
      const { data: sheetSettings } = await supabaseAdmin
        .from('system_settings')
        .select('key, value')
        .in('key', ['sheets_credentials_json', 'sheets_spreadsheet_id']);
      const sm = Object.fromEntries((sheetSettings ?? []).map((s: { key: string; value: string }) => [s.key, s.value ?? '']));
      if (sm['sheets_credentials_json'] && sm['sheets_spreadsheet_id']) {
        // Call google-sheets-sync edge function
        const baseUrl = Deno.env.get('SUPABASE_URL')!.replace('/rest/v1', '');
        await fetch(`${baseUrl}/functions/v1/google-sheets-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ action, user_id: user.id, ic_name }),
        }).catch(console.error);
      }
    };

    const body = await req.json();
    const { action, channel_id, is_op } = body;

    if (action === 'join') {
      let targetChannelId = channel_id;
      if (!targetChannelId) {
        const { data: readyCh } = await supabaseAdmin
          .from('channels').select('id').eq('name', 'ready').maybeSingle();
        targetChannelId = readyCh?.id;
      }

      const { data: existingPresence } = await supabaseAdmin
        .from('user_presence').select('channel_id, is_op').eq('user_id', user.id).maybeSingle();

      if (existingPresence) {
        await supabaseAdmin.from('time_logs')
          .update({ ended_at: new Date().toISOString() })
          .eq('user_id', user.id).is('ended_at', null);
        await supabaseAdmin.from('user_presence').delete().eq('user_id', user.id);
      }

      const { data: newPresence, error: presenceError } = await supabaseAdmin
        .from('user_presence')
        .insert({
          user_id: user.id,
          channel_id: targetChannelId,
          joined_channel_at: new Date().toISOString(),
          session_started_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
        })
        .select().maybeSingle();

      if (presenceError) {
        return new Response(JSON.stringify({ error: presenceError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: ch } = await supabaseAdmin.from('channels')
        .select('track_time, name').eq('id', targetChannelId).maybeSingle();

      if (ch?.track_time) {
        await supabaseAdmin.from('time_logs').insert({
          user_id: user.id, channel_id: targetChannelId,
          started_at: new Date().toISOString(), is_op_time: false,
        });
      }

      // Clock-in: trigger when joining a time-tracked channel from no previous presence
      if (!existingPresence && ch?.track_time) {
        syncAttendance('clock_in').catch(console.error);
      }
      // Clock-out: if switching FROM tracked to non-tracked (off_duty)
      if (existingPresence && !ch?.track_time) {
        syncAttendance('clock_out').catch(console.error);
      }
      // Clock-in: if switching FROM non-tracked to tracked
      if (existingPresence && ch?.track_time) {
        const { data: prevCh } = await supabaseAdmin.from('channels')
          .select('track_time').eq('id', existingPresence.channel_id).maybeSingle();
        if (!prevCh?.track_time) {
          syncAttendance('clock_in').catch(console.error);
        }
      }

      return new Response(JSON.stringify({ success: true, presence: newPresence }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'leave') {
      // Get current presence to check if in tracked channel before leaving
      const { data: curPresence } = await supabaseAdmin
        .from('user_presence').select('channel_id').eq('user_id', user.id).maybeSingle();

      await supabaseAdmin.from('time_logs')
        .update({ ended_at: new Date().toISOString() })
        .eq('user_id', user.id).is('ended_at', null);

      const { data: pointer } = await supabaseAdmin.from('queue_pointer')
        .select('pointed_user_id').eq('id', '00000000-0000-0000-0000-000000000001').maybeSingle();

      await supabaseAdmin.from('user_presence').delete().eq('user_id', user.id);

      if (pointer?.pointed_user_id === user.id) {
        const { data: readyCh } = await supabaseAdmin
          .from('channels').select('id').eq('name', 'ready').maybeSingle();
        if (readyCh) {
          const { data: queue } = await supabaseAdmin
            .from('user_presence').select('user_id, joined_channel_at')
            .eq('channel_id', readyCh.id).neq('user_id', user.id)
            .order('joined_channel_at', { ascending: true });
          const nextUser = queue && queue.length > 0 ? queue[0].user_id : null;
          await supabaseAdmin.from('queue_pointer')
            .update({ pointed_user_id: nextUser, updated_at: new Date().toISOString() })
            .eq('id', '00000000-0000-0000-0000-000000000001');
        }
      }

      // Clock-out if was in tracked channel
      if (curPresence?.channel_id) {
        const { data: ch } = await supabaseAdmin.from('channels')
          .select('track_time').eq('id', curPresence.channel_id).maybeSingle();
        if (ch?.track_time) {
          syncAttendance('clock_out').catch(console.error);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'heartbeat') {
      await supabaseAdmin.from('user_presence')
        .update({ last_heartbeat: new Date().toISOString() }).eq('user_id', user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_op') {
      const { data: presence } = await supabaseAdmin
        .from('user_presence').select('channel_id, is_op').eq('user_id', user.id).maybeSingle();
      if (!presence) {
        return new Response(JSON.stringify({ error: 'ไม่พบสถานะออนไลน์' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await supabaseAdmin.from('time_logs')
        .update({ ended_at: new Date().toISOString() }).eq('user_id', user.id).is('ended_at', null);
      await supabaseAdmin.from('user_presence').update({ is_op }).eq('user_id', user.id);
      const { data: ch } = await supabaseAdmin.from('channels')
        .select('track_time').eq('id', presence.channel_id).maybeSingle();
      if (ch?.track_time) {
        await supabaseAdmin.from('time_logs').insert({
          user_id: user.id, channel_id: presence.channel_id,
          started_at: new Date().toISOString(), is_op_time: is_op,
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'ไม่รู้จัก action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
