// หน้าตั้งค่า
import { useState, useEffect } from 'react';
import {
  fetchSetting, updateSetting,
  fetchDoctors, addDoctor, removeDoctor,
} from '@/services/api';
import type { Doctor } from '@/types/index';
import { usePermissions } from '@/hooks/use-permissions';
import AppLayout from '@/components/layouts/AppLayout';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react';

// ฟิลด์ชั่วโมงแบบ decimal (เช่น 1.5 = 1 ชั่วโมง 30 นาที)
function HoursInput({
  label, description, value, onChange, saving, onSave, saveKey,
}: {
  label: string; description: string; value: string;
  onChange: (v: string) => void; saving: string | null; onSave: () => void; saveKey: string;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={value} onChange={e => onChange(e.target.value)} min={0} step={0.5}
          className="w-28 px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <span className="text-sm text-muted-foreground">ชั่วโมง / อาทิตย์</span>
        <button onClick={onSave} disabled={saving === saveKey}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 ml-auto shrink-0">
          {saving === saveKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'บันทึก'}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { can } = usePermissions();
  const canAccess = can('can_access_settings');

  const [serverUrl, setServerUrl] = useState('');
  const [requiredHours, setRequiredHours] = useState('');
  const [requiredOpHours, setRequiredOpHours] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [testingConn, setTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const [url, hrs, opHrs, docs] = await Promise.all([
        fetchSetting('server_url'),
        fetchSetting('required_hours_per_week'),
        fetchSetting('required_op_hours_per_week'),
        fetchDoctors(),
      ]);
      setServerUrl(url);
      setRequiredHours(hrs || '20');
      setRequiredOpHours(opHrs || '5');
      setDoctors(docs);
    } catch { toast.error('โหลดการตั้งค่าล้มเหลว'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveSetting = async (key: string, value: string, label: string, saveKey: string) => {
    const n = Number(value);
    if (isNaN(n) || n < 0) { toast.error('กรุณากรอกตัวเลขที่ถูกต้อง'); return; }
    setSaving(saveKey);
    try { await updateSetting(key, String(n)); toast.success(`บันทึก${label}แล้ว`); }
    catch { toast.error('บันทึกล้มเหลว'); }
    finally { setSaving(null); }
  };

  const saveUrl = async () => {
    setSaving('url');
    try { await updateSetting('server_url', serverUrl); toast.success('บันทึก Server URL แล้ว'); }
    catch { toast.error('บันทึกล้มเหลว'); }
    finally { setSaving(null); }
  };

  const testConn = async () => {
    if (!serverUrl.trim()) { toast.error('กรุณากรอก Server URL ก่อน'); return; }
    setTestingConn(true); setConnStatus('idle');
    try {
      const res = await fetch(`${serverUrl.trim()}/players.json`, { signal: AbortSignal.timeout(5000) });
      setConnStatus(res.ok ? 'ok' : 'fail');
      if (res.ok) toast.success('เชื่อมต่อสำเร็จ');
      else toast.error('เซิร์ฟเวอร์ตอบกลับผิดปกติ');
    } catch { setConnStatus('fail'); toast.error('ไม่สามารถเชื่อมต่อได้'); }
    finally { setTestingConn(false); }
  };

  const handleAddDoctor = async () => {
    if (!newName.trim()) return;
    try { await addDoctor(newName.trim()); setNewName(''); toast.success('เพิ่มหมอสำเร็จ'); load(); }
    catch (err) { toast.error((err as Error).message); }
  };

  const handleRemoveDoctor = async (doc: Doctor) => {
    if (!confirm(`ลบ "${doc.name}" ออกจากระบบ?`)) return;
    try { await removeDoctor(doc.id); toast.success('ลบหมอแล้ว'); load(); }
    catch (err) { toast.error((err as Error).message); }
  };

  if (!canAccess) return (
    <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">ไม่มีสิทธิ์เข้าถึง</div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">ตั้งค่าระบบ</h1>
        </div>

        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-primary animate-spin" /></div> : (
          <>
            {/* Server URL */}
            <section className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-foreground text-sm">🌐 Server URL (FiveM)</h2>
              <div className="flex gap-2">
                <input value={serverUrl} onChange={e => setServerUrl(e.target.value)}
                  placeholder="http://your-server-ip:port"
                  className="flex-1 min-w-0 px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <button onClick={saveUrl} disabled={saving === 'url'}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0">
                  {saving === 'url' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'บันทึก'}
                </button>
              </div>
              <button onClick={testConn} disabled={testingConn}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  connStatus === 'ok' ? 'border-primary text-primary' :
                  connStatus === 'fail' ? 'border-destructive text-destructive' :
                  'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}>
                {testingConn ? <RefreshCw className="w-3 h-3 animate-spin" /> :
                  connStatus === 'ok' ? <Wifi className="w-3 h-3" /> :
                  <WifiOff className="w-3 h-3" />}
                {testingConn ? 'กำลังทดสอบ...' :
                  connStatus === 'ok' ? 'เชื่อมต่อสำเร็จ' :
                  connStatus === 'fail' ? 'เชื่อมต่อล้มเหลว' : 'ทดสอบการเชื่อมต่อ'}
              </button>
            </section>

            {/* เกณฑ์ชั่วโมง */}
            <section className="bg-card border border-border rounded-lg p-4 space-y-4">
              <div>
                <h2 className="font-semibold text-foreground text-sm">⏱ เกณฑ์ชั่วโมงสำหรับสอบเลื่อนยศ</h2>
                <p className="text-xs text-muted-foreground mt-1">ใช้เป็นเกณฑ์แสดงในหน้า "คุณสมบัติสอบเลื่อนยศ" — รองรับทศนิยม เช่น 1.5 = 1 ชม. 30 นาที</p>
              </div>
              <HoursInput
                label="ออนไลน์ขั้นต่ำ / อาทิตย์"
                description="จำนวนชั่วโมง login ทั้งหมด ไม่นับ OP"
                value={requiredHours}
                onChange={setRequiredHours}
                saving={saving}
                saveKey="hrs"
                onSave={() => saveSetting('required_hours_per_week', requiredHours, 'ชั่วโมงออนไลน์', 'hrs')}
              />
              <div className="border-t border-border pt-4">
                <HoursInput
                  label="ทำหน้าที่ OP ขั้นต่ำ / อาทิตย์"
                  description="จำนวนชั่วโมงที่ขึ้นเป็นคนรัน OP"
                  value={requiredOpHours}
                  onChange={setRequiredOpHours}
                  saving={saving}
                  saveKey="opHrs"
                  onSave={() => saveSetting('required_op_hours_per_week', requiredOpHours, 'ชั่วโมง OP', 'opHrs')}
                />
              </div>
            </section>

            {/* จัดการหมอ */}
            {can('can_manage_doctors') && (
              <section className="bg-card border border-border rounded-lg p-4 space-y-3">
                <h2 className="font-semibold text-foreground text-sm">👨‍⚕️ จัดการรายชื่อหมอ (โหมด Manual)</h2>
                <div className="flex gap-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddDoctor()} placeholder="ชื่อหมอใหม่"
                    className="flex-1 min-w-0 px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  <button onClick={handleAddDoctor}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {doctors.length === 0
                    ? <p className="text-center text-xs text-muted-foreground py-3">ยังไม่มีหมอในระบบ</p>
                    : doctors.map(d => (
                      <div key={d.id} className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md">
                        <span className="flex-1 text-sm text-foreground min-w-0 truncate">{d.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{d.status}</span>
                        <button onClick={() => handleRemoveDoctor(d)}
                          className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  }
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
