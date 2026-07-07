import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { RefreshCw, AlertTriangle, Clock, User, Search } from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { InactiveUser } from '@/types/types';
import { toast } from 'sonner';

export default function InactivityPage() {
  const [users, setUsers] = useState<InactiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(24);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_inactive_users', { p_threshold_hours: threshold });
      if (error) throw error;
      setUsers((data ?? []) as InactiveUser[]);
    } catch (err) {
      console.error(err);
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.username.toLowerCase().includes(q) ||
      (u.nickname?.toLowerCase() ?? '').includes(q) ||
      (u.ic_name?.toLowerCase() ?? '').includes(q);
  });

  const getAbsentColor = (hours: number) => {
    if (hours >= 72) return 'text-destructive';
    if (hours >= 48) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getAbsentBadge = (hours: number) => {
    if (hours >= 72) return { label: 'ขาดนาน', variant: 'destructive' as const };
    if (hours >= 48) return { label: '2+ วัน', variant: 'outline' as const };
    return { label: '24h+', variant: 'outline' as const };
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" /> ไม่มาทำงาน
          </h1>
          <p className="text-xs text-muted-foreground">สมาชิกที่ไม่มีความเคลื่อนไหวเกินกว่าเกณฑ์ที่กำหนด</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="h-8">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> รีเฟรช
        </Button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-muted rounded-sm px-3 py-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">เกณฑ์:</span>
          <Input
            type="number" min={1} max={168} value={threshold}
            onChange={e => setThreshold(parseInt(e.target.value) || 24)}
            className="h-6 w-14 text-xs bg-transparent border-none p-0 text-center focus-visible:ring-0"
          />
          <span className="text-xs text-muted-foreground">ชม.</span>
        </div>
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-7 h-8 text-sm w-44 bg-muted border-border" />
        </div>
      </div>

      {/* Summary card */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'ขาดงานทั้งหมด', value: users.length, color: 'text-warning' },
            { label: 'ขาด 48h+', value: users.filter(u => u.hours_absent >= 48).length, color: 'text-destructive/80' },
            { label: 'ขาด 72h+', value: users.filter(u => u.hours_absent >= 72).length, color: 'text-destructive' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* User list */}
      <Card className="border-border min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">รายชื่อสมาชิกขาดงาน ({filtered.length} คน)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ชื่อ</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ชื่อในเกม (IC)</th>
                  <th className="text-right px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">ขาดงาน</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">เข้าล่าสุด</th>
                  <th className="text-center px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>
                  ))}</tr>
                )) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="w-8 h-8 text-success opacity-50" />
                        <p>ไม่พบสมาชิกขาดงาน — ทุกคนออนไลน์ครบ!</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(u => {
                  const badge = getAbsentBadge(u.hours_absent);
                  return (
                    <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium">{u.nickname || u.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
                        {u.ic_name || '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${getAbsentColor(u.hours_absent)}`}>
                        {u.hours_absent.toFixed(1)} ชม.
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {u.last_seen
                          ? new Date(u.last_seen).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' })
                          : 'ไม่เคยเข้าใช้'}
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
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
