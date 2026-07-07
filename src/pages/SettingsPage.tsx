import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Settings, Sheet, Bell, Database, Save, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { getAllSettings, upsertSetting } from '@/services/settingsService';
import { resetQueue } from '@/services/settingsService';
import type { SystemSetting } from '@/types/types';

type TabKey = 'general' | 'sheets' | 'notifications' | 'data';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'ทั่วไป', icon: <Settings className="w-4 h-4" /> },
  { key: 'sheets', label: 'Google Sheets', icon: <Sheet className="w-4 h-4" /> },
  { key: 'notifications', label: 'การแจ้งเตือน', icon: <Bell className="w-4 h-4" /> },
  { key: 'data', label: 'จัดการข้อมูล', icon: <Database className="w-4 h-4" /> },
];

function SettingRow({
  keyName, label, description, value, onChange, type = 'text', isPassword = false
}: {
  keyName: string; label: string; description?: string;
  value: string; onChange: (v: string) => void; type?: string; isPassword?: boolean;
}) {
  const [show, setShow] = useState(false);
  const inputType = isPassword ? (show ? 'text' : 'password') : type;
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="md:w-64 shrink-0 relative">
        {type === 'textarea' ? (
          <Textarea value={value} onChange={e => onChange(e.target.value)}
            rows={3} className="bg-muted border-border text-xs font-mono resize-none" />
        ) : (
          <div className="relative">
            <Input type={inputType} value={value} onChange={e => onChange(e.target.value)}
              className="bg-muted border-border text-sm pr-8" />
            {isPassword && (
              <button onClick={() => setShow(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetWeeklyConfirm, setResetWeeklyConfirm] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data: SystemSetting[] = await getAllSettings();
      const map: Record<string, string> = {};
      data.forEach(s => { map[s.key] = s.value ?? ''; });
      setSettings(map);
    } catch { toast.error('โหลดการตั้งค่าไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const set = (key: string) => (val: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: String(val) }));
  };

  const boolVal = (key: string) => settings[key] === 'true';

  const handleSave = async (keys: string[]) => {
    setSaving(true);
    try {
      await Promise.all(keys.map(k => upsertSetting(k, settings[k] ?? '')));
      toast.success('บันทึกการตั้งค่าสำเร็จ');
    } catch { toast.error('บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const handleResetQueue = async () => {
    try {
      await resetQueue();
      toast.success('รีเซ็ตคิวสำเร็จ');
    } catch { toast.error('รีเซ็ตคิวไม่สำเร็จ'); }
    setResetConfirm(false);
  };

  const generalKeys = ['project_name', 'project_logo', 'system_enabled'];
  const sheetsKeys = ['sheets_credentials_json', 'sheets_spreadsheet_id', 'sheets_sheet_name'];
  const notifKeys = ['discord_webhook_url', 'discord_notify_op_change', 'discord_notify_inactivity', 'inactivity_threshold_hours'];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-bold">ตั้งค่าระบบ</h1>
        <p className="text-xs text-muted-foreground">จัดการการตั้งค่าสำหรับผู้ดูแลระบบ</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === t.key ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <>
          {/* General Settings */}
          {activeTab === 'general' && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />ตั้งค่าทั่วไป</CardTitle></CardHeader>
              <CardContent className="divide-y divide-border">
                <SettingRow keyName="project_name" label="ชื่อโปรเจกต์" description="ชื่อที่แสดงในเว็บไซต์"
                  value={settings['project_name'] ?? ''} onChange={set('project_name')} />
                <SettingRow keyName="project_logo" label="URL โลโก้" description="ลิงก์รูปโลโก้ระบบ"
                  value={settings['project_logo'] ?? ''} onChange={set('project_logo')} />
                <ToggleRow label="เปิดใช้งานระบบ" description="เปิด/ปิดระบบหลักทั้งหมด"
                  value={boolVal('system_enabled')} onChange={v => set('system_enabled')(v)} />
                <div className="pt-3 flex justify-end">
                  <Button size="sm" onClick={() => handleSave(generalKeys)} disabled={saving}
                    className="bg-primary text-primary-foreground hover:opacity-90 text-xs">
                    <Save className="w-3.5 h-3.5 mr-1" />{saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Google Sheets Integration */}
          {activeTab === 'sheets' && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Sheet className="w-4 h-4 text-primary" />Google Sheets Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 p-3 rounded-sm bg-accent/10 border border-accent/30 text-xs text-accent">
                  ⚡ ระบบจะใช้ข้อมูลเหล่านี้ในการบันทึกตอกบัตรโดยอัตโนมัติ ไม่จำเป็นต้องแก้ไข Source Code
                </div>
                <div className="divide-y divide-border">
                  <SettingRow keyName="sheets_credentials_json" label="Service Account JSON"
                    description="JSON credentials ของ Google Service Account ที่มีสิทธิ์ใน Spreadsheet"
                    value={settings['sheets_credentials_json'] ?? ''} onChange={set('sheets_credentials_json')}
                    type="textarea" />
                  <SettingRow keyName="sheets_spreadsheet_id" label="Spreadsheet ID"
                    description="ID ของ Google Spreadsheet (จาก URL ระหว่าง /d/ และ /edit)"
                    value={settings['sheets_spreadsheet_id'] ?? ''} onChange={set('sheets_spreadsheet_id')} />
                  <SettingRow keyName="sheets_sheet_name" label="ชื่อชีท (Sheet Name)"
                    description="ชื่อแท็บชีทที่ใช้บันทึก เช่น Attendance"
                    value={settings['sheets_sheet_name'] ?? 'Attendance'} onChange={set('sheets_sheet_name')} />
                </div>
                <div className="pt-3 flex justify-end">
                  <Button size="sm" onClick={() => handleSave(sheetsKeys)} disabled={saving}
                    className="bg-primary text-primary-foreground hover:opacity-90 text-xs">
                    <Save className="w-3.5 h-3.5 mr-1" />{saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />การแจ้งเตือน</CardTitle></CardHeader>
              <CardContent className="divide-y divide-border">
                <SettingRow keyName="discord_webhook_url" label="Discord Webhook URL"
                  description="URL สำหรับส่งการแจ้งเตือนไปยัง Discord Channel"
                  value={settings['discord_webhook_url'] ?? ''} onChange={set('discord_webhook_url')}
                  isPassword />
                <ToggleRow label="แจ้งเตือนเมื่อเปลี่ยน OP"
                  description="ส่งข้อความไป Discord เมื่อมีการเปลี่ยน OP ในคิว"
                  value={boolVal('discord_notify_op_change')} onChange={v => set('discord_notify_op_change')(v)} />
                <ToggleRow label="แจ้งเตือนสมาชิกขาดงาน"
                  description="ส่งรายชื่อสมาชิกที่ขาดงานไป Discord"
                  value={boolVal('discord_notify_inactivity')} onChange={v => set('discord_notify_inactivity')(v)} />
                <SettingRow keyName="inactivity_threshold_hours" label="เกณฑ์ขาดงาน (ชั่วโมง)"
                  description="จำนวนชั่วโมงที่ถือว่าขาดงาน (ค่าเริ่มต้น 24)"
                  value={settings['inactivity_threshold_hours'] ?? '24'} onChange={set('inactivity_threshold_hours')} type="number" />
                <div className="pt-3 flex justify-end">
                  <Button size="sm" onClick={() => handleSave(notifKeys)} disabled={saving}
                    className="bg-primary text-primary-foreground hover:opacity-90 text-xs">
                    <Save className="w-3.5 h-3.5 mr-1" />{saving ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Management */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <Card className="border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="w-4 h-4 text-primary" />จัดการข้อมูล</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
                    <div>
                      <p className="text-sm font-medium">รีเซ็ตคิวงานประจำวัน</p>
                      <p className="text-xs text-muted-foreground">ล้างรายชื่อทุกคนออกจากห้องและรีเซ็ตลูกศร</p>
                    </div>
                    <Button size="sm" variant="outline" className="border-warning/50 text-warning hover:bg-warning/10 shrink-0"
                      onClick={() => setResetConfirm(true)}>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> รีเซ็ตคิว
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">รีเซ็ตสถิติรายสัปดาห์</p>
                      <p className="text-xs text-muted-foreground">ล้างข้อมูล weekly_stats ของสัปดาห์นี้ทั้งหมด (ใช้ต้นสัปดาห์)</p>
                    </div>
                    <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => setResetWeeklyConfirm(true)}>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" /> รีเซ็ตสถิติ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Confirm reset queue */}
      <AlertDialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันรีเซ็ตคิว?</AlertDialogTitle>
            <AlertDialogDescription>สมาชิกทุกคนจะถูกเอาออกจากห้องและลูกศรคิวจะถูกรีเซ็ต ไม่สามารถย้อนกลับได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetQueue} className="bg-warning text-warning-foreground hover:opacity-90">ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm reset weekly stats */}
      <AlertDialog open={resetWeeklyConfirm} onOpenChange={setResetWeeklyConfirm}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันรีเซ็ตสถิติรายสัปดาห์?</AlertDialogTitle>
            <AlertDialogDescription>ข้อมูลชั่วโมงทำงานและ OP ของสัปดาห์นี้ทั้งหมดจะถูกล้าง</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={async () => {
                try {
                  const { getWeekStart } = await import('@/services/adminService');
                  const { supabase } = await import('@/db/supabase');
                  await supabase.from('weekly_stats').delete().eq('week_start', getWeekStart());
                  toast.success('รีเซ็ตสถิติสำเร็จ');
                } catch { toast.error('รีเซ็ตไม่สำเร็จ'); }
                setResetWeeklyConfirm(false);
              }}>ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
