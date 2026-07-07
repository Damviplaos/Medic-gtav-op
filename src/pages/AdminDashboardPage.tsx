import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  CheckCircle, XCircle, Clock, Star, AlertTriangle, Search, RefreshCw, User, Plus,
  UserX, ChevronDown,
} from 'lucide-react';
import {
  getAllProfiles, getAllWeeklyStats, getUserRoles, getWeekStart,
  getRoleCriteria, refreshWeeklyStats,
} from '@/services/adminService';
import {
  getUserDetailStats, getUserWarnings, issueWarning, deactivateWarning,
} from '@/services/settingsService';
import { supabase } from '@/db/supabase';
import type { Profile, Role, WeeklyStats, Warning, InactiveUser, WeeklyStatsHistory } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function fmtTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function severityLabel(s: Warning['severity']) {
  return s === 'critical' ? 'ร้ายแรง' : s === 'major' ? 'หนัก' : 'เบา';
}
function severityColor(s: Warning['severity']) {
  return s === 'critical' ? 'text-destructive' : s === 'major' ? 'text-warning' : 'text-muted-foreground';
}

// =============================================
// Issue Warning Dialog
// =============================================
function IssueWarningDialog({ targetUser, issuerId, onDone }: { targetUser: Profile; issuerId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState<'minor' | 'major' | 'critical'>('minor');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error('กรุณากรอกเหตุผล'); return; }
    setLoading(true);
    try {
      await issueWarning({ user_id: targetUser.id, issued_by: issuerId, reason: reason.trim(), severity });
      toast.success('ออกใบเตือนสำเร็จ');
      setOpen(false); setReason(''); setSeverity('minor');
      onDone();
    } catch { toast.error('ออกใบเตือนไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs border-warning/50 text-warning hover:bg-warning/10"
        onClick={() => setOpen(true)}>
        <AlertTriangle className="w-3 h-3 mr-1" /> ออกใบเตือน
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader><DialogTitle>ออกใบเตือน — {targetUser.nickname || targetUser.username}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">ระดับความรุนแรง</Label>
              <Select value={severity} onValueChange={v => setSeverity(v as typeof severity)}>
                <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">เบา (Minor)</SelectItem>
                  <SelectItem value="major">หนัก (Major)</SelectItem>
                  <SelectItem value="critical">ร้ายแรง (Critical)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">เหตุผล</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder="ระบุเหตุผลการออกใบเตือน..." className="bg-muted border-border min-h-20" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button size="sm" onClick={handleSubmit} disabled={loading}
                className="bg-warning text-warning-foreground hover:opacity-90">
                {loading ? 'กำลังส่ง...' : 'ออกใบเตือน'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================
// User Detail Popup
// =============================================
function UserDetailDialog({ user, roles, weekStats, onClose, issuerId }: {
  user: Profile; roles: Role[]; weekStats: WeeklyStats | null;
  onClose: () => void; issuerId: string;
}) {
  const weekStart = getWeekStart();
  const [detail, setDetail] = useState<{ total_work_seconds: number; total_op_seconds: number; warning_count: number; active_warning_count: number } | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [criteria, setCriteria] = useState<{ min_work?: number; min_op?: number; work_enabled?: boolean; op_enabled?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [det, warns] = await Promise.all([
      getUserDetailStats(user.id, weekStart),
      getUserWarnings(user.id),
    ]);
    setDetail(det);
    setWarnings(warns);
    if (roles.length > 0) {
      const topRole = roles[roles.length - 1];
      const c = await getRoleCriteria(topRole.id);
      if (c) setCriteria({ min_work: c.min_work_hours_per_week ?? 0, min_op: c.min_op_hours_per_week ?? 0, work_enabled: c.work_hours_enabled, op_enabled: c.op_hours_enabled });
    }
    setLoading(false);
  }, [user.id, weekStart, roles]);

  useEffect(() => { load(); }, [load]);

  const workH = (detail?.total_work_seconds ?? 0) / 3600;
  const opH = (detail?.total_op_seconds ?? 0) / 3600;
  const workGap = criteria?.work_enabled ? Math.max(0, (criteria.min_work ?? 0) - workH) : 0;
  const opGap = criteria?.op_enabled ? Math.max(0, (criteria.min_op ?? 0) - opH) : 0;
  const eligible = (!criteria?.work_enabled || workGap === 0) && (!criteria?.op_enabled || opGap === 0) && (criteria?.work_enabled || criteria?.op_enabled);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary">{(user.nickname || user.username)[0].toUpperCase()}</span>
            </div>
            <span>{user.nickname || user.username}</span>
            {user.ic_name && <span className="text-sm text-muted-foreground font-normal">[{user.ic_name}]</span>}
          </DialogTitle>
        </DialogHeader>

        {loading ? <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div> : (
          <div className="space-y-4">
            {/* Roles */}
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {roles.map(r => (
                  <span key={r.id} className="role-badge" style={{ color: r.color, borderColor: r.color + '55' }}>{r.name}</span>
                ))}
              </div>
            )}

            {/* Weekly stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-sm bg-muted">
                <div className="flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5 text-primary" /><span className="text-xs text-muted-foreground">งานสัปดาห์นี้</span></div>
                <p className="text-lg font-bold">{fmtTime(detail?.total_work_seconds ?? 0)}</p>
                {criteria?.work_enabled && (
                  <p className="text-xs text-muted-foreground mt-0.5">เป้า {criteria.min_work} ชม.</p>
                )}
              </div>
              <div className="p-3 rounded-sm bg-muted">
                <div className="flex items-center gap-1.5 mb-1"><Star className="w-3.5 h-3.5 text-warning" /><span className="text-xs text-muted-foreground">OP สัปดาห์นี้</span></div>
                <p className="text-lg font-bold">{fmtTime(detail?.total_op_seconds ?? 0)}</p>
                {criteria?.op_enabled && (
                  <p className="text-xs text-muted-foreground mt-0.5">เป้า {criteria.min_op} ชม.</p>
                )}
              </div>
            </div>

            {/* Promotion eligibility */}
            {(criteria?.work_enabled || criteria?.op_enabled) && (
              <div className={`flex items-start gap-3 p-3 rounded-sm border ${eligible ? 'border-success/40 bg-success/10' : 'border-destructive/30 bg-destructive/5'}`}>
                {eligible
                  ? <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  : <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />}
                <div>
                  {eligible ? (
                    <p className="text-sm font-semibold text-success">ผ่านเกณฑ์เลื่อนยศแล้ว ✓</p>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-destructive">ยังไม่ผ่านเกณฑ์</p>
                      {workGap > 0 && <p className="text-xs text-muted-foreground">ขาดชั่วโมงทำงานอีก <span className="text-foreground font-semibold">{workGap.toFixed(1)} ชม.</span></p>}
                      {opGap > 0 && <p className="text-xs text-muted-foreground">ขาดชั่วโมง OP อีก <span className="text-foreground font-semibold">{opGap.toFixed(1)} ชม.</span></p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                  ใบเตือน ({detail?.active_warning_count ?? 0} ใบที่ยังมีผล)
                </p>
                <IssueWarningDialog targetUser={user} issuerId={issuerId} onDone={load} />
              </div>
              {warnings.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">ไม่มีประวัติใบเตือน</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {warnings.map(w => (
                    <div key={w.id} className={`flex items-start justify-between gap-2 p-2 rounded-sm border ${w.is_active ? 'border-warning/30 bg-warning/5' : 'border-border opacity-50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-semibold ${severityColor(w.severity)}`}>[{severityLabel(w.severity)}]</span>
                          <span className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString('th-TH')}</span>
                          {!w.is_active && <Badge variant="outline" className="text-[10px] px-1">ยกเลิกแล้ว</Badge>}
                        </div>
                        <p className="text-sm text-foreground">{w.reason}</p>
                      </div>
                      {w.is_active && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground shrink-0"
                          onClick={() => deactivateWarning(w.id).then(load)}>
                          ยกเลิก
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// Filter / Tab types
// =============================================
type FilterType = 'all' | 'eligible' | 'has_warnings';
type TabType = 'overview' | 'inactivity' | 'history';

interface UserRow { profile: Profile; roles: Role[]; stats: WeeklyStats | null; eligible: boolean; activeWarnings: number; }

// =============================================
// Inactivity tab (inline from InactivityPage)
// =============================================
function InactivityTab() {
  const [users, setUsers] = useState<InactiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(24);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_inactive_users', { p_threshold_hours: threshold });
      if (error) throw error;
      setUsers((data ?? []) as InactiveUser[]);
    } catch { toast.error('โหลดข้อมูลไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, [threshold]);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.username.toLowerCase().includes(q) ||
      (u.nickname?.toLowerCase() ?? '').includes(q) ||
      (u.ic_name?.toLowerCase() ?? '').includes(q);
  });

  const getBadge = (h: number) => h >= 72 ? { label: 'ขาดนาน', cls: 'bg-destructive/20 text-destructive border-destructive/30' }
    : h >= 48 ? { label: '2+ วัน', cls: 'bg-warning/20 text-warning border-warning/30' }
    : { label: '24h+', cls: 'border-border text-muted-foreground' };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">เกณฑ์ขาดงาน</span>
          <Select value={String(threshold)} onValueChange={v => setThreshold(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-xs bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 ชม.</SelectItem>
              <SelectItem value="24">24 ชม.</SelectItem>
              <SelectItem value="48">48 ชม.</SelectItem>
              <SelectItem value="72">72 ชม.</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-7 h-8 text-sm w-40 bg-muted border-border" />
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> รีเฟรช
        </Button>
      </div>
      <Card className="border-border min-w-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ชื่อ</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ขาดงาน</th>
                  <th className="text-center px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ระดับ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>{[1,2,3].map(j => <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>)}</tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-8 text-muted-foreground text-sm">ไม่พบสมาชิกที่ขาดงาน</td></tr>
                ) : filtered.map(u => {
                  const b = getBadge(u.hours_absent);
                  return (
                    <tr key={u.user_id} className="border-b border-border/50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <UserX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{u.nickname || u.username}</span>
                          {u.ic_name && <span className="text-xs text-muted-foreground hidden md:block">[{u.ic_name}]</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                        {u.hours_absent.toFixed(1)} ชม.
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <Badge variant="outline" className={`text-xs ${b.cls}`}>{b.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// History tab
// =============================================
function HistoryTab() {
  const [history, setHistory] = useState<Array<{
    id: string; user_id: string; week_start: string;
    total_work_seconds: number; total_op_seconds: number; archived_at: string;
    profile?: { username: string; nickname: string | null; ic_name: string | null };
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [weekFilter, setWeekFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { getWeeklyHistory } = await import('@/services/settingsService');
      setHistory(await getWeeklyHistory());
    } catch { toast.error('โหลดประวัติไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const { archiveAndResetWeeklyStats } = await import('@/services/settingsService');
      await archiveAndResetWeeklyStats();
      toast.success('อาร์ไคฟ์สถิติสัปดาห์นี้สำเร็จ');
      load();
    } catch { toast.error('อาร์ไคฟ์ไม่สำเร็จ'); }
    finally { setArchiving(false); }
  };

  const weekOptions = ['all', ...Array.from(new Set(history.map(h => h.week_start))).sort().reverse()];
  const filtered = weekFilter === 'all' ? history : history.filter(h => h.week_start === weekFilter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="h-8 w-40 text-xs bg-muted border-border"><SelectValue placeholder="เลือกสัปดาห์" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสัปดาห์</SelectItem>
            {weekOptions.filter(w => w !== 'all').map(w => (
              <SelectItem key={w} value={w}>สัปดาห์ {w}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> รีเฟรช
        </Button>
        <Button size="sm" className="h-8 ml-auto bg-primary text-primary-foreground hover:opacity-90"
          onClick={handleArchive} disabled={archiving}>
          {archiving ? 'กำลังอาร์ไคฟ์...' : 'อาร์ไคฟ์สัปดาห์นี้'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">ระบบจะรีเซ็ตสถิติทุกวันจันทร์ 00:00 น. (ICT) อัตโนมัติ และเก็บประวัติไว้ 14 วัน</p>
      <Card className="border-border min-w-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ชื่อ</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">สัปดาห์</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">งาน</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">OP</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>{[1,2,3,4].map(j => <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>)}</tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีประวัติสถิติ</td></tr>
                ) : filtered.map(h => (
                  <tr key={h.id} className="border-b border-border/50">
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                      {h.profile?.nickname || h.profile?.username || '?'}
                      {h.profile?.ic_name && <span className="text-xs text-muted-foreground ml-1.5 hidden md:inline">[{h.profile.ic_name}]</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{h.week_start}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap">{fmtTime(h.total_work_seconds)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-warning whitespace-nowrap">{fmtTime(h.total_op_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// Admin Dashboard v3
// =============================================
export default function AdminDashboardPage() {
  const { profile: myProfile } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const weekStart = getWeekStart();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profiles, statsArr] = await Promise.all([getAllProfiles(), getAllWeeklyStats(weekStart)]);
      const statsMap = Object.fromEntries((statsArr as WeeklyStats[]).map(s => [s.user_id, s]));
      const rowData: UserRow[] = await Promise.all((profiles as Profile[]).map(async p => {
        const userRoles = await getUserRoles(p.id);
        const roles = userRoles.map(ur => ur.role!).filter(Boolean) as Role[];
        const stats = statsMap[p.id] ?? null;
        let eligible = false;
        if (roles.length > 0) {
          const c = await getRoleCriteria(roles[roles.length - 1].id);
          if (c && stats && (c.work_hours_enabled || c.op_hours_enabled)) {
            const wOk = !c.work_hours_enabled || (stats.total_work_seconds / 3600) >= (c.min_work_hours_per_week ?? 0);
            const oOk = !c.op_hours_enabled || (stats.total_op_seconds / 3600) >= (c.min_op_hours_per_week ?? 0);
            eligible = wOk && oOk;
          }
        }
        const warnData = await getUserDetailStats(p.id, weekStart);
        return { profile: p, roles, stats, eligible, activeWarnings: warnData.active_warning_count ?? 0 };
      }));
      setRows(rowData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.profile.username.toLowerCase().includes(q) ||
      (r.profile.nickname?.toLowerCase() ?? '').includes(q) ||
      (r.profile.ic_name?.toLowerCase() ?? '').includes(q);
    const matchFilter =
      filter === 'eligible' ? r.eligible :
      filter === 'has_warnings' ? r.activeWarnings > 0 : true;
    return matchSearch && matchFilter;
  });

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: 'overview', label: 'ภาพรวมสมาชิก', badge: rows.length },
    { key: 'inactivity', label: 'ไม่มาทำงาน' },
    { key: 'history', label: 'ประวัติสถิติ' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold">ภาพรวมหน่วยงาน</h1>
          <p className="text-xs text-muted-foreground">สัปดาห์เริ่ม {weekStart}</p>
        </div>
        {activeTab === 'overview' && (
          <Button variant="outline" size="sm" onClick={loadData} className="h-8">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> รีเฟรช
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
            {t.badge !== undefined && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <>
          {/* Dropdown filters + search */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filter} onValueChange={v => setFilter(v as FilterType)}>
              <SelectTrigger className="h-8 w-40 text-xs bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด ({rows.length})</SelectItem>
                <SelectItem value="eligible">✓ ผ่านเกณฑ์ ({rows.filter(r => r.eligible).length})</SelectItem>
                <SelectItem value="has_warnings">⚠ มีใบเตือน ({rows.filter(r => r.activeWarnings > 0).length})</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-7 h-8 text-sm w-44 bg-muted border-border" />
            </div>
          </div>

          {/* Table */}
          <Card className="border-border min-w-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-max text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ชื่อ</th>
                      <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ยศ</th>
                      <th className="text-right px-4 py-2 text-xs text-muted-foreground whitespace-nowrap"><Clock className="w-3 h-3 inline mr-1" />งาน</th>
                      <th className="text-right px-4 py-2 text-xs text-muted-foreground whitespace-nowrap"><Star className="w-3 h-3 inline mr-1" />OP</th>
                      <th className="text-center px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">เกณฑ์</th>
                      <th className="text-center px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ใบเตือน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>
                      ))}</tr>
                    )) : filtered.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">ไม่พบข้อมูล</td></tr>
                    ) : filtered.map(row => (
                      <tr key={row.profile.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedUser(row)}>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">{row.profile.nickname || row.profile.username}</span>
                            {row.profile.ic_name && <span className="text-xs text-muted-foreground hidden md:block">[{row.profile.ic_name}]</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {row.roles.slice(0, 2).map(r => (
                              <span key={r.id} className="role-badge" style={{ color: r.color, borderColor: r.color + '44' }}>{r.name}</span>
                            ))}
                            {!row.roles.length && <span className="text-xs text-muted-foreground">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs whitespace-nowrap">{fmtTime(row.stats?.total_work_seconds ?? 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-warning whitespace-nowrap">{fmtTime(row.stats?.total_op_seconds ?? 0)}</td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {row.eligible
                            ? <Badge className="bg-success/20 text-success border-success/30 text-xs">✓</Badge>
                            : <Badge variant="outline" className="text-muted-foreground text-xs">-</Badge>}
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {row.activeWarnings > 0
                            ? <span className="text-xs font-bold text-warning">{row.activeWarnings}</span>
                            : <span className="text-xs text-muted-foreground">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Tab: Inactivity */}
      {activeTab === 'inactivity' && <InactivityTab />}

      {/* Tab: History */}
      {activeTab === 'history' && <HistoryTab />}

      {/* User detail popup */}
      {selectedUser && (
        <UserDetailDialog
          user={selectedUser.profile}
          roles={selectedUser.roles}
          weekStats={selectedUser.stats}
          issuerId={myProfile?.id ?? ''}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
