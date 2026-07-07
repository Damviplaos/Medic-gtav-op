import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ClockEvent {
  action: 'clock_in' | 'clock_out';
  user_id: string;
  ic_name: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: ClockEvent = await req.json();
    const { action, user_id, ic_name } = body;

    // Get Google Sheets settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['sheets_credentials_json', 'sheets_spreadsheet_id', 'sheets_sheet_name']);

    const settingsMap = Object.fromEntries((settings ?? []).map((s: { key: string; value: string | null }) => [s.key, s.value ?? '']));
    const credentialsJson = settingsMap['sheets_credentials_json'];
    const spreadsheetId = settingsMap['sheets_spreadsheet_id'];
    const sheetName = settingsMap['sheets_sheet_name'] || 'Attendance';

    if (action === 'clock_in') {
      await supabase.rpc('clock_in_attendance', { p_user_id: user_id });
    } else if (action === 'clock_out') {
      await supabase.rpc('clock_out_attendance', { p_user_id: user_id });
    }

    // Sync to Google Sheets only if configured
    if (credentialsJson && spreadsheetId) {
      await syncToSheets({ credentialsJson, spreadsheetId, sheetName, ic_name, action, user_id, supabase });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('google-sheets-sync error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getAccessToken(credentials: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = btoa(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const privateKey = credentials.private_key.replace(/\\n/g, '\n');
  const pemBody = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signingInput = `${header}.${claim}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

async function syncToSheets({ credentialsJson, spreadsheetId, sheetName, ic_name, action, user_id, supabase }: {
  credentialsJson: string; spreadsheetId: string; sheetName: string;
  ic_name: string; action: string; user_id: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const credentials = JSON.parse(credentialsJson);
  const accessToken = await getAccessToken(credentials);
  const today = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  const timeStr = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) + ' น.';

  // Read all rows to find matching date+ic_name
  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const readData = await readRes.json() as { values?: string[][] };
  const rows: string[][] = readData.values ?? [];

  let targetRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === today && rows[i][1] === ic_name) {
      targetRowIndex = i;
      break;
    }
  }

  if (action === 'clock_in') {
    if (targetRowIndex === -1) {
      // Append new row: [date, ic_name, clock_in]
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[today, ic_name, timeStr]] }),
        }
      );
    } else {
      // Find next empty clock_in slot (cols 2,4,6,8... = odd indices starting at 2)
      const row = rows[targetRowIndex];
      let clockInCol = 2;
      while (clockInCol < row.length && row[clockInCol]) clockInCol += 2;
      const colLetter = columnLetter(clockInCol);
      const cellRange = `${sheetName}!${colLetter}${targetRowIndex + 1}`;
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [[timeStr]] }),
        }
      );
    }
  } else if (action === 'clock_out' && targetRowIndex !== -1) {
    // Find latest clock_in with no clock_out
    const row = rows[targetRowIndex];
    let clockOutCol = 3;
    while (clockOutCol < row.length + 2) {
      const clockInVal = row[clockOutCol - 1];
      const clockOutVal = row[clockOutCol];
      if (clockInVal && !clockOutVal) break;
      clockOutCol += 2;
    }
    const colLetter = columnLetter(clockOutCol);
    const cellRange = `${sheetName}!${colLetter}${targetRowIndex + 1}`;
    // Also compute total hours for the day from DB
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('clock_in, clock_out')
      .eq('user_id', user_id)
      .eq('session_date', new Date().toISOString().split('T')[0]);

    let totalSecs = 0;
    for (const log of (logs ?? [])) {
      if (log.clock_in && log.clock_out) {
        totalSecs += (new Date(log.clock_out).getTime() - new Date(log.clock_in).getTime()) / 1000;
      }
    }
    const totalH = Math.floor(totalSecs / 3600);
    const totalM = Math.floor((totalSecs % 3600) / 60);
    const totalStr = `${totalH} ชม. ${totalM} น.`;

    // Write clock_out + update total in last column
    const totalColLetter = columnLetter(clockOutCol + 1);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: [[timeStr]],
          range: `${sheetName}!${colLetter}${targetRowIndex + 1}`,
        }),
      }
    );
    // Write running total
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!${totalColLetter}${targetRowIndex + 1}`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[totalStr]] }),
      }
    );
    // Mark synced
    await supabase
      .from('attendance_logs')
      .update({ synced_to_sheets: true })
      .eq('user_id', user_id)
      .eq('session_date', new Date().toISOString().split('T')[0]);
  }
}

function columnLetter(n: number): string {
  let result = '';
  n = n + 1; // 0-indexed to 1-indexed
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
