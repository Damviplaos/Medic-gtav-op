// หน้าคุณสมบัติสอบเลื่อนยศ — ทุกคนดูได้
import { useState, useEffect, useCallback } from 'react';
import { fetchAllProfiles, fetchSetting } from '@/services/api';
import {
  storeGetUserSessions, storeGetUserOpSessions,
  calcMinutes, calcOpMinutes,
} from '@/store/store';
import type { UserProfile } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layouts/AppLayout';
import { TrendingUp, Clock, Star, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

// ช่วงอาทิตย์ปัจจุบัน (จันทร์ – อาทิตย์)
function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay(); // 0=อาทิตย์
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} นาที`;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface UserStat {
  profile: UserProfile;
  onlineMins: number;
  opMins: number;
  reqOnline: number;
  reqOp: number;
  passOnline: boolean;
  passOp: boolean;
  pass: boolean;
}

export default function PromotionPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekLabel, setWeekLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getWeekRange();
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const label = `${fromDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – ${toDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      setWeekLabel(label);

      const [profiles, reqOnlineStr, reqOpStr] = await Promise.all([
        fetchAllProfiles(),
        fetchSetting('required_hours_per_week'),
        fetchSetting('required_op_hours_per_week'),
      ]);

      const reqOnlineHrs = parseFloat(reqOnlineStr) || 20;
      const reqOpHrs = parseFloat(reqOpStr) || 5;
      const reqOnlineMins = reqOnlineHrs * 60;
      const reqOpMins = reqOpHrs * 60;

      const result: UserStat[] = profiles.map(p => {
        const sessions = storeGetUserSessions(p.id, from, to);
        const opSessions = storeGetUserOpSessions(p.id, from, to);
        const onlineMins = calcMinutes(sessions);
        const opMins = calcOpMinutes(opSessions);
        const passOnline = onlineMins >= reqOnlineMins;
        const passOp = opMins >= reqOpMins;
        return {
          profile: p, onlineMins, opMins,
          reqOnline: reqOnlineMins, reqOp: reqOpMins,
          passOnline, passOp, pass: passOnline && passOp,
        };
      });

      // เรียงลำดับ: ผ่านก่อน, แล้ว % ชั่วโมงรวม
      result.sort((a, b) => {
        if (a.pass !== b.pass) return a.pass ? -1 : 1;
        const pctA = (a.onlineMins / a.reqOnline) + (a.opMins / a.reqOp);
        const pctB = (b.onlineMins / b.reqOnline) + (b.opMins / b.reqOp);
        return pctB - pctA;
      });

      setStats(result);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const myStats = stats.find(s => s.profile.id === user?.id);

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">คุณสมบัติสอบเลื่อนยศ</h1>
          </div>
          <button onClick={load} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground -mt-4">สัปดาห์นี้: {weekLabel}</p>

        {/* การ์ดของตัวเอง */}
        {myStats && (
          <div className={`bg-card border-2 rounded-lg p-4 space-y-3 ${myStats.pass ? 'border-primary/60' : 'border-border'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">ของคุณ</p>
                <p className="font-bold text-foreground">{myStats.profile.display_name}</p>
                {myStats.profile.role && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: myStats.profile.role.color + '33', color: myStats.profile.role.color }}>
                    {myStats.profile.role.name}
                  </span>
                )}
              </div>
              {myStats.pass
                ? <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary rounded-full text-sm font-semibold"><CheckCircle className="w-4 h-4" />ผ่านเกณฑ์</div>
                : <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-sm font-medium"><XCircle className="w-4 h-4" />ยังไม่ผ่าน</div>
              }
            </div>
            <StatRow icon={<Clock className="w-3.5 h-3.5" />} label="ออนไลน์" mins={myStats.onlineMins} req={myStats.reqOnline} pass={myStats.passOnline} />
            <StatRow icon={<Star className="w-3.5 h-3.5" />} label="รัน OP" mins={myStats.opMins} req={myStats.reqOp} pass={myStats.passOp} />
          </div>
        )}

        {/* ตารางทุกคน */}
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-primary animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">สถานะทุกคน</p>
            {stats.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">ไม่มีข้อมูล</p>
            ) : stats.map(s => (
              <div key={s.profile.id} className={`bg-card border rounded-lg p-3 space-y-2 ${s.profile.id === user?.id ? 'border-primary/40' : 'border-border'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.pass ? 'bg-primary' : 'bg-muted-foreground'}`} />
                    <span className="font-medium text-foreground text-sm truncate">{s.profile.display_name}</span>
                    {s.profile.id === user?.id && <span className="text-xs text-primary shrink-0">(คุณ)</span>}
                    {s.profile.role && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium" style={{ backgroundColor: s.profile.role.color + '33', color: s.profile.role.color }}>
                        {s.profile.role.name}
                      </span>
                    )}
                  </div>
                  {s.pass
                    ? <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    : <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  }
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="ออนไลน์" mins={s.onlineMins} req={s.reqOnline} pass={s.passOnline} />
                  <MiniStat label="รัน OP" mins={s.opMins} req={s.reqOp} pass={s.passOp} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatRow({ icon, label, mins, req, pass }: { icon: React.ReactNode; label: string; mins: number; req: number; pass: boolean }) {
  const deficit = Math.max(0, req - mins);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">{icon}{label}</span>
        <span className={pass ? 'text-primary font-semibold' : 'text-muted-foreground'}>
          {fmtHours(mins)} / {fmtHours(req)}
          {!pass && <span className="text-destructive ml-1">(ขาด {fmtHours(deficit)})</span>}
        </span>
      </div>
      <ProgressBar value={mins} max={req} color={pass ? 'bg-primary' : 'bg-muted-foreground/50'} />
    </div>
  );
}

function MiniStat({ label, mins, req, pass }: { label: string; mins: number; req: number; pass: boolean }) {
  const deficit = Math.max(0, req - mins);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-medium ${pass ? 'text-primary' : 'text-muted-foreground'}`}>{fmtHours(mins)}</span>
      </div>
      <ProgressBar value={mins} max={req} color={pass ? 'bg-primary' : 'bg-amber-500/70'} />
      {!pass && <p className="text-xs text-destructive">ขาด {fmtHours(deficit)}</p>}
    </div>
  );
}
