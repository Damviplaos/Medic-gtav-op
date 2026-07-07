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
import { CheckCircle, XCircle, Clock, Star, AlertTriangle, Search, RefreshCw, User, Plus } from 'lucide-react';
import {
  getAllProfiles, getAllWeeklyStats, getUserRoles, getWeekStart,
  getRoleCriteria, refreshWeeklyStats,
} from '@/services/adminService';
import {
  getUserDetailStats, getUserWarnings, issueWarning, deactivateWarning,
} from '@/services/settingsService';
import type { Profile, Role, WeeklyStats, Warning } from '@/types/types';
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
// Filter types
// =============================================
type FilterType = 'all' | 'online' | 'eligible' | 'has_warnings';

// =============================================
// Admin Dashboard v2
// =============================================
interface UserRow { profile: Profile; roles: Role[]; stats: WeeklyStats | null; eligible: boolean; activeWarnings: number; }

export default function AdminDashboardPage() {
  const { profile: myProfile } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
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
      filter === 'all' ? true :
      filter === 'eligible' ? r.eligible :
      filter === 'has_warnings' ? r.activeWarnings > 0 : true;
    return matchSearch && matchFilter;
  });

  const filterButtons: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'ทั้งหมด', count: rows.length },
    { key: 'eligible', label: '✓ ผ่านเกณฑ์', count: rows.filter(r => r.eligible).length },
    { key: 'has_warnings', label: '⚠ มีใบเตือน', count: rows.filter(r => r.activeWarnings > 0).length },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold">ภาพรวมหน่วยงาน</h1>
          <p className="text-xs text-muted-foreground">สัปดาห์เริ่ม {weekStart}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="h-8">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> รีเฟรช
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterButtons.map(fb => (
          <button key={fb.key} onClick={() => setFilter(fb.key)}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${
              filter === fb.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
            }`}>
            {fb.label} {fb.count !== undefined && `(${fb.count})`}
          </button>
        ))}
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
