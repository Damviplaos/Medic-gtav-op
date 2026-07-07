import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Clock, Star, Calendar, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import {
  getWeeklyStats, getDailyStats, getWeekStart,
  getUserRoles, refreshWeeklyStats,
} from '@/services/adminService';
import { getRoleCriteria } from '@/services/adminService';
import type { WeeklyStats, UserRole, RoleCriteria, Role } from '@/types/types';
import { toast } from 'sonner';

// Format seconds to HH:mm
function fmtTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

// Get dates of current week (Mon-Sun)
function getWeekDates(weekStart: string): string[] {
  const start = new Date(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [todayStats, setTodayStats] = useState<{ total_work_seconds: number; total_op_seconds: number } | null>(null);
  const [weekDayStats, setWeekDayStats] = useState<{ date: string; work: number; op: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDateStats, setSelectedDateStats] = useState<{ total_work_seconds: number; total_op_seconds: number } | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [promotionEligible, setPromotionEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const weekStart = getWeekStart();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await refreshWeeklyStats(user.id);
      const [ws, td, ur] = await Promise.all([
        getWeeklyStats(user.id, weekStart),
        getDailyStats(user.id, new Date().toISOString().split('T')[0]),
        getUserRoles(user.id),
      ]);
      setWeeklyStats(ws);
      setTodayStats(td);
      setUserRoles(ur);

      // Load each day of week
      const dates = getWeekDates(weekStart);
      const dayStats = await Promise.all(dates.map(d => getDailyStats(user.id, d)));
      setWeekDayStats(dates.map((d, i) => ({
        date: d,
        work: dayStats[i]?.total_work_seconds ?? 0,
        op: dayStats[i]?.total_op_seconds ?? 0,
      })));

      // Check promotion eligibility
      if (ur.length > 0) {
        const topRole = ur[ur.length - 1]?.role as Role | undefined;
        if (topRole) {
          const criteria = await getRoleCriteria(topRole.id);
          if (criteria && ws) {
            const workH = (ws.total_work_seconds ?? 0) / 3600;
            const opH = (ws.total_op_seconds ?? 0) / 3600;
            const workOk = !criteria.work_hours_enabled || workH >= (criteria.min_work_hours_per_week ?? 0);
            const opOk = !criteria.op_hours_enabled || opH >= (criteria.min_op_hours_per_week ?? 0);
            setPromotionEligible(workOk && opOk && (criteria.work_hours_enabled || criteria.op_hours_enabled));
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, weekStart]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!user || !selectedDate) return;
    getDailyStats(user.id, selectedDate).then(setSelectedDateStats);
  }, [user, selectedDate]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const dayNames = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  const maxDayWork = Math.max(...weekDayStats.map(d => d.work), 3600);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Dashboard ของฉัน</h1>
          <p className="text-xs text-muted-foreground">
            {profile?.nickname || profile?.ic_name || profile?.username}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
          รีเฟรช
        </Button>
      </div>

      {/* Promotion alert */}
      {promotionEligible && (
        <div className="flex items-start gap-3 p-3 rounded-sm border border-success/40 bg-success/10">
          <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-success">
            คุณผ่านเกณฑ์แล้ว กรุณาติดต่อยศสูงกว่าเพื่อสอบเลื่อนขั้น
          </p>
        </div>
      )}

      {/* Roles */}
      {userRoles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {userRoles.map(ur => ur.role && (
            <span key={ur.id} className="role-badge" style={{ color: ur.role.color, borderColor: ur.role.color + '55' }}>
              {ur.role.name}
            </span>
          ))}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">วันนี้</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(todayStats?.total_work_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมงทำงาน</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">OP วันนี้</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(todayStats?.total_op_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมง OP</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground">อาทิตย์นี้</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(weeklyStats?.total_work_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมงรวม</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-warning" />
              <span className="text-xs text-muted-foreground">OP สัปดาห์</span>
            </div>
            <p className="text-xl font-bold text-foreground">{fmtTime(weeklyStats?.total_op_seconds ?? 0)}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมง OP</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly bar chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">สรุปรายวัน (สัปดาห์นี้)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-24">
            {weekDayStats.map((d, i) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col gap-0.5 justify-end" style={{ height: '72px' }}>
                  <div
                    className="w-full rounded-sm bg-primary/70 transition-all"
                    style={{ height: `${(d.work / maxDayWork) * 64}px`, minHeight: d.work > 0 ? '4px' : '0' }}
                    title={`งาน: ${fmtTime(d.work)}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{dayNames[i]}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar picker */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" /> ดูรายละเอียดย้อนหลัง
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="date"
            value={selectedDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-muted border border-border rounded-sm px-3 py-1.5 text-sm text-foreground w-full md:w-auto"
          />
          {selectedDateStats && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-sm bg-muted">
                <p className="text-xs text-muted-foreground mb-1">ชั่วโมงทำงาน</p>
                <p className="text-lg font-bold text-foreground">{fmtTime(selectedDateStats.total_work_seconds)}</p>
              </div>
              <div className="p-3 rounded-sm bg-muted">
                <p className="text-xs text-muted-foreground mb-1">ชั่วโมง OP</p>
                <p className="text-lg font-bold text-foreground">{fmtTime(selectedDateStats.total_op_seconds)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
