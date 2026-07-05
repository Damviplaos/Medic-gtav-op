// Dashboard ภาพรวม (Admin / ผอ)
import { useState, useEffect } from 'react';
import { fetchAllSessions, fetchAllProfiles, fetchSetting, calcMinutes, issueWarning } from '@/services/api';
import type { WorkSession, UserProfile } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import AppLayout from '@/components/layouts/AppLayout';
import { toast } from 'sonner';
import { BarChart2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}ชม.${m}น.`;
}

type FilterStatus = 'all' | 'under' | 'met' | 'over';

export default function OverviewDashboard() {
  const { user } = useAuth();
  const { can, isDirector } = usePermissions();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [requiredHours, setRequiredHours] = useState(20);
  const [loading, setLoading] = useState(true);

  // Filter
  const [dateMode, setDateMode] = useState<'today' | 'week' | 'range'>('week');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Warning modal
  const [warnTarget, setWarnTarget] = useState<UserProfile | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [savingWarn, setSavingWarn] = useState(false);

  const canIssue = can('can_issue_warnings') || isDirector;
  const canView = can('can_view_overview_dashboard') || isDirector;

  const now = new Date();

  const getDateRange = () => {
    if (dateMode === 'today') return {
      from: startOfDay(now).toISOString(),
      to: endOfDay(now).toISOString(),
    };
    if (dateMode === 'week') return {
      from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
    };
    return { from: fromDate ? `${fromDate}T00:00:00` : undefined, to: toDate ? `${toDate}T23:59:59` : undefined };
  };

  const load = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange();
      const [p, s, h] = await Promise.all([
        fetchAllProfiles(),
        fetchAllSessions(from, to),
        fetchSetting('required_hours_per_week'),
      ]);
      setProfiles(p);
      setSessions(s);
      setRequiredHours(Number(h) || 20);
    } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (canView) load(); else setLoading(false); }, [dateMode, fromDate, toDate]);

  // คำนวณชั่วโมงต่อคน
  const minutesByUser = (userId: string) =>
    calcMinutes(sessions.filter(s => s.user_id === userId));

  const requiredMin = requiredHours * 60;

  const filteredProfiles = profiles.filter(p => {
    const m = minutesByUser(p.id);
    if (filterStatus === 'under') return m < requiredMin;
    if (filterStatus === 'met') return m >= requiredMin && m < requiredMin * 1.1;
    if (filterStatus === 'over') return m >= requiredMin * 1.1;
    return true;
  });

  const handleIssueWarning = async () => {
    if (!warnTarget || !warnReason.trim()) { toast.error('กรุณากรอกเหตุผล'); return; }
    setSavingWarn(true);
    try {
      await issueWarning(warnTarget.id, user!.id, warnReason.trim());
      toast.success(`ออกใบเตือนให้ "${warnTarget.display_name}" แล้ว`);
      setWarnTarget(null);
      setWarnReason('');
    } catch (err) { toast.error((err as Error).message); }
    finally { setSavingWarn(false); }
  };

  if (!canView) return (
    <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground">ไม่มีสิทธิ์เข้าถึง</div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground flex-1">ภาพรวมการทำงาน</h1>
          <button onClick={load} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 mb-4">
          {/* Date mode */}
          <div className="flex gap-2 flex-wrap">
            {(['today', 'week', 'range'] as const).map(m => (
              <button key={m} onClick={() => setDateMode(m)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${dateMode === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {m === 'today' ? 'วันนี้' : m === 'week' ? 'อาทิตย์นี้' : 'กำหนดเอง'}
              </button>
            ))}
          </div>
          {dateMode === 'range' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-2 py-1.5 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <span className="text-muted-foreground text-sm">ถึง</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-2 py-1.5 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={load} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90">ดู</button>
            </div>
          )}
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {([
              { v: 'all', l: 'ทั้งหมด' },
              { v: 'under', l: '❌ ไม่ถึงเวลา' },
              { v: 'met', l: '✅ ครบเวลา' },
              { v: 'over', l: '⭐ เกินเวลา' },
            ] as { v: FilterStatus; l: string }[]).map(({ v, l }) => (
              <button key={v} onClick={() => setFilterStatus(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterStatus === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          เกณฑ์: {requiredHours} ชม./อาทิตย์ · แสดง {filteredProfiles.length} คน
        </p>

        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-primary animate-spin" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium whitespace-nowrap pr-3">ชื่อ</th>
                  <th className="pb-2 font-medium whitespace-nowrap pr-3">ยศ</th>
                  <th className="pb-2 font-medium whitespace-nowrap pr-3">ชั่วโมง</th>
                  <th className="pb-2 font-medium whitespace-nowrap pr-3">สถานะ</th>
                  {canIssue && <th className="pb-2 font-medium whitespace-nowrap">ใบเตือน</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map(p => {
                  const m = minutesByUser(p.id);
                  const pct = requiredMin > 0 ? Math.min(100, (m / requiredMin) * 100) : 100;
                  const label = m < requiredMin ? '❌ ไม่ถึง' : m >= requiredMin * 1.1 ? '⭐ เกิน' : '✅ ครบ';
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 pr-3 font-medium text-foreground whitespace-nowrap">{p.display_name}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${p.role?.color}20`, color: p.role?.color }}>
                          {p.role?.name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <div>
                          <span className="font-semibold text-foreground">{fmtHM(m)}</span>
                          <div className="w-20 h-1.5 bg-muted rounded-full mt-1">
                            <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-xs whitespace-nowrap">{label}</td>
                      {canIssue && (
                        <td className="py-2.5 whitespace-nowrap">
                          <button onClick={() => setWarnTarget(p)}
                            className="flex items-center gap-1 text-xs px-2 py-1 border border-border rounded text-muted-foreground hover:text-amber-400 hover:border-amber-400 transition-colors">
                            <AlertTriangle className="w-3 h-3" /> ออกใบเตือน
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal ออกใบเตือน */}
        {warnTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-card border border-border rounded-lg w-full max-w-[calc(100%-2rem)] md:max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-foreground">ออกใบเตือน: {warnTarget.display_name}</h2>
                <button onClick={() => { setWarnTarget(null); setWarnReason(''); }}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">เหตุผล</label>
                  <textarea value={warnReason} onChange={e => setWarnReason(e.target.value)} rows={3}
                    placeholder="ระบุเหตุผลในการออกใบเตือน..."
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setWarnTarget(null); setWarnReason(''); }} className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted">ยกเลิก</button>
                  <button onClick={handleIssueWarning} disabled={savingWarn}
                    className="px-4 py-2 bg-amber-500 text-white rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                    {savingWarn ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'ออกใบเตือน'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
