// Dashboard ส่วนตัว
import { useState, useEffect } from 'react';
import { fetchUserSessions, calcMinutes } from '@/services/api';
import type { WorkSession } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layouts/AppLayout';
import { BarChart2, Clock, Calendar, RefreshCw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { th } from 'date-fns/locale';

function fmtHM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h} ชม. ${m} นาที`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchUserSessions(user.id).then(s => { setSessions(s); setLoading(false); });
  }, [user]);

  const now = new Date();
  const todaySessions = sessions.filter(s => {
    const d = new Date(s.login_at);
    return d >= startOfDay(now) && d <= endOfDay(now);
  });
  const weekSessions = sessions.filter(s => {
    const d = new Date(s.login_at);
    return d >= startOfWeek(now, { weekStartsOn: 1 }) && d <= endOfWeek(now, { weekStartsOn: 1 });
  });

  const todayMin = calcMinutes(todaySessions);
  const weekMin = calcMinutes(weekSessions);

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Dashboard ของฉัน</h1>
        </div>

        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-primary animate-spin" /></div> : (
          <>
            {/* สรุปสั้น */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">วันนี้</span>
                </div>
                <p className="text-lg font-bold text-foreground">{fmtHM(todayMin)}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">อาทิตย์นี้</span>
                </div>
                <p className="text-lg font-bold text-foreground">{fmtHM(weekMin)}</p>
              </div>
            </div>

            {/* ประวัติ Session */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">ประวัติการเข้างาน</h2>
            {sessions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">ยังไม่มีประวัติ</p>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 30).map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-card border border-border rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">
                        {format(new Date(s.login_at), 'dd MMM yyyy', { locale: th })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.login_at), 'HH:mm')} — {s.logout_at ? format(new Date(s.logout_at), 'HH:mm') : 'ยังออนไลน์'}
                      </p>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${s.logout_at ? 'text-foreground' : 'text-primary'}`}>
                      {s.logout_at ? fmtHM(s.duration_minutes ?? 0) : '● Active'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
