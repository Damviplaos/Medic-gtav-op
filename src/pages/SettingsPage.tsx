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

export default function SettingsPage() {
  const { can } = usePermissions();
  const canAccess = can('can_access_settings');

  const [serverUrl, setServerUrl] = useState('');
  const [requiredHours, setRequiredHours] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [testingConn, setTestingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const [url, hrs, docs] = await Promise.all([
        fetchSetting('server_url'),
        fetchSetting('required_hours_per_week'),
        fetchDoctors(),
      ]);
      setServerUrl(url);
      setRequiredHours(hrs);
      setDoctors(docs);
    } catch { toast.error('โหลดการตั้งค่าล้มเหลว'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

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

  const saveHours = async () => {
    const n = Number(requiredHours);
    if (isNaN(n) || n < 0) { toast.error('กรุณากรอกตัวเลขที่ถูกต้อง'); return; }
    setSaving('hrs');
    try { await updateSetting('required_hours_per_week', String(n)); toast.success('บันทึกเกณฑ์ชั่วโมงแล้ว'); }
    catch { toast.error('บันทึกล้มเหลว'); }
    finally { setSaving(null); }
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
                  connStatus === 'fail' ? <WifiOff className="w-3 h-3" /> :
                  <Wifi className="w-3 h-3" />}
                {testingConn ? 'กำลังทดสอบ...' : connStatus === 'ok' ? 'เชื่อมต่อสำเร็จ' : connStatus === 'fail' ? 'เชื่อมต่อล้มเหลว' : 'ทดสอบการเชื่อมต่อ'}
              </button>
            </section>

            {/* ชั่วโมงทำงาน */}
            <section className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-foreground text-sm">⏱ เกณฑ์ชั่วโมงทำงาน</h2>
              <p className="text-xs text-muted-foreground">กำหนดจำนวนชั่วโมงทำงานขั้นต่ำต่ออาทิตย์</p>
              <div className="flex items-center gap-2">
                <input type="number" value={requiredHours} onChange={e => setRequiredHours(e.target.value)} min={0}
                  className="w-24 px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <span className="text-sm text-muted-foreground">ชั่วโมง / อาทิตย์</span>
                <button onClick={saveHours} disabled={saving === 'hrs'}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 ml-auto shrink-0">
                  {saving === 'hrs' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'บันทึก'}
                </button>
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
                  <button onClick={handleAddDoctor} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {doctors.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-3">ยังไม่มีหมอในระบบ</p>
                  ) : doctors.map(d => (
                    <div key={d.id} className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md">
                      <span className="flex-1 text-sm text-foreground min-w-0 truncate">{d.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{d.status}</span>
                      <button onClick={() => handleRemoveDoctor(d)}
                        className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
