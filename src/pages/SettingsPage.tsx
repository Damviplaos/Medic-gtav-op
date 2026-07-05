// หน้าตั้งค่า: Server URL + จัดการรายชื่อหมอ
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchDoctors, addDoctor, removeDoctor,
  fetchSetting, updateSetting,
} from '@/services/api';
import type { Doctor } from '@/types/index';
import { toast } from 'sonner';
import { Settings, ArrowLeft, Plus, Trash2, Link, Save, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newName, setNewName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    fetchDoctors().then(setDoctors).catch(() => toast.error('โหลดข้อมูลล้มเหลว'));
    fetchSetting('server_url').then(setServerUrl).catch(() => {});
  }, []);

  const handleAddDoctor = async () => {
    if (!newName.trim()) return;
    setAddingDoctor(true);
    try {
      await addDoctor(newName.trim());
      toast.success(`เพิ่มหมอ "${newName.trim()}" สำเร็จ`);
      setNewName('');
      const updated = await fetchDoctors();
      setDoctors(updated);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'เพิ่มหมอล้มเหลว');
    } finally {
      setAddingDoctor(false);
    }
  };

  const handleRemoveDoctor = async (doc: Doctor) => {
    try {
      await removeDoctor(doc.id);
      toast.success(`ลบหมอ "${doc.name}" แล้ว`);
      setDoctors(prev => prev.filter(d => d.id !== doc.id));
    } catch {
      toast.error('ลบหมอล้มเหลว');
    }
  };

  const handleSaveUrl = async () => {
    setSavingUrl(true);
    try {
      await updateSetting('server_url', serverUrl.trim());
      toast.success('บันทึก Server URL แล้ว');
    } catch {
      toast.error('บันทึกล้มเหลว');
    } finally {
      setSavingUrl(false);
    }
  };

  const handleTestConnection = async () => {
    if (!serverUrl.trim()) {
      toast.error('กรุณากรอก Server URL ก่อน');
      return;
    }
    setTestResult('loading');
    try {
      // FiveM server info endpoint
      const url = serverUrl.trim().replace(/\/$/, '');
      const res = await fetch(`${url}/info.json`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setTestResult('ok');
        toast.success('เชื่อมต่อ Server สำเร็จ!');
      } else {
        setTestResult('fail');
        toast.error(`เชื่อมต่อล้มเหลว: HTTP ${res.status}`);
      }
    } catch {
      setTestResult('fail');
      toast.error('ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบ URL');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-base font-bold text-foreground flex-1 min-w-0">ตั้งค่าระบบ</h1>
        {user && (
          <button
            onClick={() => { signOut(); navigate('/login'); }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
          >
            ออกจากระบบ
          </button>
        )}
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Server URL */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Link className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">FiveM Server URL</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            ใส่ URL ของ server เช่น <span className="text-primary font-mono">http://1.2.3.4:30120</span>
          </p>
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => { setServerUrl(e.target.value); setTestResult('idle'); }}
            placeholder="http://server-ip:30120"
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveUrl}
              disabled={savingUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {savingUrl ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              บันทึก
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testResult === 'loading'}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground rounded-md text-sm font-medium hover:bg-muted disabled:opacity-60 transition-colors"
            >
              {testResult === 'loading'
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />
              }
              ทดสอบ
            </button>
            {testResult === 'ok' && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium ml-1">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                เชื่อมต่อได้
              </span>
            )}
            {testResult === 'fail' && (
              <span className="flex items-center gap-1 text-xs text-destructive font-medium ml-1">
                <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
                เชื่อมต่อไม่ได้
              </span>
            )}
          </div>
        </section>

        {/* จัดการรายชื่อหมอ */}
        <section className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">จัดการรายชื่อหมอ</h2>

          {/* เพิ่มหมอ */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDoctor()}
              placeholder="ชื่อหมอ (ตัวละครในเกม)"
              className="flex-1 min-w-0 px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
            <button
              onClick={handleAddDoctor}
              disabled={addingDoctor || !newName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
            >
              {addingDoctor
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />
              }
              เพิ่ม
            </button>
          </div>

          {/* รายชื่อหมอ */}
          {doctors.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-4">ยังไม่มีหมอในระบบ</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      doc.status === 'op' ? 'status-dot-op' :
                      doc.status === 'activity' ? 'status-dot-activity' :
                      doc.status === 'afk' ? 'status-dot-afk' :
                      doc.status === 'story' ? 'status-dot-story' :
                      'status-dot-off'
                    }`}
                  />
                  <span className="flex-1 min-w-0 text-sm text-foreground truncate">{doc.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {doc.status === 'op' ? 'คิว OP' :
                     doc.status === 'activity' ? 'กิจกรรม' :
                     doc.status === 'afk' ? 'เหม่อ' :
                     doc.status === 'story' ? 'ไป Story' : 'ออกเวร'}
                  </span>
                  <button
                    onClick={() => handleRemoveDoctor(doc)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">รวม {doctors.length} คน</p>
        </section>

        {/* ข้อมูล user */}
        {user && (
          <section className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">
              เข้าสู่ระบบในฐานะ{' '}
              <span className="text-foreground font-medium">
                {user.email?.replace('@gtav-queue.app', '')}
              </span>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
