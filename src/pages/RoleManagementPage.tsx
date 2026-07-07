import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronDown, ChevronUp, Settings, ShieldCheck } from 'lucide-react';
import {
  getRoles, createRole, updateRole, deleteRole, reorderRoles,
  upsertRoleCriteria, getRoleCriteria,
} from '@/services/adminService';
import { getRolePermissions, setRolePermission } from '@/services/settingsService';
import { getChannels, updateChannelTrackTime } from '@/services/presenceService';
import type { Role, RoleCriteria, Channel, RolePermission } from '@/types/types';
import { ALL_PERMISSIONS } from '@/types/types';

// =============================================
// Role Criteria Editor
// =============================================
function RoleCriteriaEditor({ role }: { role: Role }) {
  const [criteria, setCriteria] = useState<Partial<RoleCriteria>>({
    role_id: role.id,
    work_hours_enabled: false,
    op_hours_enabled: false,
    min_work_hours_per_week: 0,
    min_op_hours_per_week: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRoleCriteria(role.id).then(c => {
      if (c) setCriteria(c);
    });
  }, [role.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertRoleCriteria({
        role_id: role.id,
        next_role_id: criteria.next_role_id ?? null,
        work_hours_enabled: criteria.work_hours_enabled ?? false,
        op_hours_enabled: criteria.op_hours_enabled ?? false,
        min_work_hours_per_week: criteria.work_hours_enabled ? (criteria.min_work_hours_per_week ?? 0) : null,
        min_op_hours_per_week: criteria.op_hours_enabled ? (criteria.min_op_hours_per_week ?? 0) : null,
      });
      toast.success('บันทึกเกณฑ์สำเร็จ');
    } catch (err) {
      toast.error('บันทึกเกณฑ์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        เกณฑ์เลื่อนยศต่อสัปดาห์
      </p>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Switch
              checked={criteria.work_hours_enabled ?? false}
              onCheckedChange={v => setCriteria(c => ({ ...c, work_hours_enabled: v }))}
            />
            <Label className="text-sm cursor-pointer">ชั่วโมงทำงานขั้นต่ำ</Label>
          </div>
          {criteria.work_hours_enabled && (
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number" min={0} step={0.5}
                value={criteria.min_work_hours_per_week ?? 0}
                onChange={e => setCriteria(c => ({ ...c, min_work_hours_per_week: parseFloat(e.target.value) || 0 }))}
                className="w-20 h-7 text-sm bg-muted border-border text-right px-2"
              />
              <span className="text-xs text-muted-foreground">ชม.</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Switch
              checked={criteria.op_hours_enabled ?? false}
              onCheckedChange={v => setCriteria(c => ({ ...c, op_hours_enabled: v }))}
            />
            <Label className="text-sm cursor-pointer">ชั่วโมง OP ขั้นต่ำ</Label>
          </div>
          {criteria.op_hours_enabled && (
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number" min={0} step={0.5}
                value={criteria.min_op_hours_per_week ?? 0}
                onChange={e => setCriteria(c => ({ ...c, min_op_hours_per_week: parseFloat(e.target.value) || 0 }))}
                className="w-20 h-7 text-sm bg-muted border-border text-right px-2"
              />
              <span className="text-xs text-muted-foreground">ชม.</span>
            </div>
          )}
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}
        className="bg-primary text-primary-foreground hover:opacity-90 text-xs h-7">
        {saving ? 'กำลังบันทึก...' : 'บันทึกเกณฑ์'}
      </Button>
    </div>
  );
}

// =============================================
// Permission Editor — Discord-style per role
// =============================================
function RolePermissionEditor({ role }: { role: Role }) {
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    getRolePermissions(role.id).then(list => {
      const map: Record<string, boolean> = {};
      list.forEach((p: RolePermission) => { map[p.permission] = p.enabled; });
      setPerms(map);
      setLoading(false);
    });
  }, [role.id]);

  const handleToggle = async (permKey: string, enabled: boolean) => {
    setSaving(permKey);
    try {
      await setRolePermission(role.id, permKey, enabled);
      setPerms(prev => ({ ...prev, [permKey]: enabled }));
    } catch { toast.error('บันทึกสิทธิ์ไม่สำเร็จ'); }
    finally { setSaving(null); }
  };

  // Group permissions
  const groups = Array.from(new Set(ALL_PERMISSIONS.map(p => p.group)));

  if (loading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-accent" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">สิทธิ์การใช้งาน (Discord-style)</p>
      </div>
      {groups.map(group => (
        <div key={group} className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-bold px-1">{group}</p>
          <div className="rounded-sm border border-border overflow-hidden divide-y divide-border">
            {ALL_PERMISSIONS.filter(p => p.group === group).map(p => (
              <div key={p.key} className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{p.label}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{p.key}</p>
                </div>
                <Switch
                  checked={perms[p.key] ?? false}
                  disabled={saving === p.key}
                  onCheckedChange={v => handleToggle(p.key, v)}
                  className="shrink-0"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================
// Role Card (draggable row)
// =============================================
type TabType = 'settings' | 'criteria' | 'permissions';

interface RoleCardProps {
  role: Role;
  index: number;
  total: number;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  onUpdate: (id: string, updates: Partial<Role>) => void;
}

function RoleCard({ role, index, total, onDelete, onMove, onUpdate }: RoleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [editName, setEditName] = useState(role.name);
  const [editColor, setEditColor] = useState(role.color);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateRole(role.id, { name: editName.trim(), color: editColor });
      onUpdate(role.id, { name: editName.trim(), color: editColor });
      toast.success('อัปเดตยศสำเร็จ');
    } catch {
      toast.error('อัปเดตยศไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'settings', label: 'ทั่วไป' },
    { key: 'criteria', label: 'เกณฑ์เลื่อนยศ' },
    { key: 'permissions', label: 'สิทธิ์' },
  ];

  return (
    <>
      <div className="rounded-sm border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="flex flex-col gap-0.5 shrink-0">
            <button onClick={() => onMove(role.id, 'up')} disabled={index === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronUp className="w-3 h-3" />
            </button>
            <button onClick={() => onMove(role.id, 'down')} disabled={index === total - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <div className="w-3 h-3 rounded-full shrink-0 border"
            style={{ backgroundColor: editColor, borderColor: editColor + '88' }} />
          <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: editColor }}>
            {role.name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setExpanded(v => !v)}>
              <Settings className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive"
              onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-border">
            {/* Tab bar */}
            <div className="flex border-b border-border bg-muted/30">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${activeTab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="px-3 pb-3 pt-3">
              {activeTab === 'settings' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-32 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">ชื่อยศ</Label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)}
                      className="h-7 text-sm bg-muted border-border" />
                  </div>
                  <div className="space-y-1.5 shrink-0">
                    <Label className="text-xs text-muted-foreground">สี</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={editColor}
                        onChange={e => setEditColor(e.target.value)}
                        className="w-8 h-7 rounded border border-border cursor-pointer bg-transparent" />
                      <Input value={editColor} onChange={e => setEditColor(e.target.value)}
                        className="h-7 text-xs bg-muted border-border w-24" />
                    </div>
                  </div>
                  <Button size="sm" onClick={handleSaveName} disabled={saving}
                    className="self-end h-7 text-xs bg-primary text-primary-foreground hover:opacity-90">
                    {saving ? '...' : 'บันทึก'}
                  </Button>
                </div>
              )}
              {activeTab === 'criteria' && (
                <RoleCriteriaEditor role={{ ...role, name: editName, color: editColor }} />
              )}
              {activeTab === 'permissions' && (
                <RolePermissionEditor role={role} />
              )}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>ลบยศ "{role.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบยศจะถอดยศนี้ออกจากทุกคนที่ถืออยู่ ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(role.id)}
              className="bg-destructive text-destructive-foreground hover:opacity-90">
              ลบยศ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =============================================
// Main Role Management Page
// =============================================
export default function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#22c55e');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, ch] = await Promise.all([getRoles(), getChannels()]);
      setRoles(r);
      setChannels(ch);
    } catch { toast.error('โหลดข้อมูลไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!newRoleName.trim()) { toast.error('กรุณากรอกชื่อยศ'); return; }
    setCreating(true);
    try {
      const r = await createRole(newRoleName.trim(), newRoleColor);
      setRoles(prev => [...prev, r]);
      setNewRoleName(''); setNewRoleColor('#22c55e');
      toast.success('สร้างยศสำเร็จ');
    } catch { toast.error('สร้างยศไม่สำเร็จ'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRole(id);
      setRoles(prev => prev.filter(r => r.id !== id));
      toast.success('ลบยศสำเร็จ');
    } catch { toast.error('ลบยศไม่สำเร็จ'); }
  };

  const handleMove = async (id: string, dir: 'up' | 'down') => {
    const idx = roles.findIndex(r => r.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === roles.length - 1) return;
    const newRoles = [...roles];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [newRoles[idx], newRoles[swapIdx]] = [newRoles[swapIdx], newRoles[idx]];
    setRoles(newRoles);
    await reorderRoles(newRoles.map(r => r.id));
  };

  const handleUpdateLocal = (id: string, updates: Partial<Role>) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleChannelTrackTime = async (channelId: string, track: boolean) => {
    try {
      await updateChannelTrackTime(channelId, track);
      setChannels(prev => prev.map(c => c.id === channelId ? { ...c, track_time: track } : c));
      toast.success('อัปเดตการตั้งค่าห้องสำเร็จ');
    } catch { toast.error('อัปเดตการตั้งค่าห้องไม่สำเร็จ'); }
  };

  return (
    <div className="p-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-foreground">จัดการยศ</h1>
        <p className="text-xs text-muted-foreground">สร้างและกำหนดเกณฑ์เลื่อนยศ</p>
      </div>

      {/* Channel time settings */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> ตั้งค่าห้อง — การนับเวลา
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            channels.map(ch => (
              <div key={ch.id} className="flex items-center justify-between gap-3 py-1">
                <div>
                  <p className="text-sm font-medium text-foreground">{ch.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ch.track_time ? 'นับเวลาทำงาน' : 'ไม่นับเวลา'}
                  </p>
                </div>
                <Switch
                  checked={ch.track_time}
                  onCheckedChange={v => handleChannelTrackTime(ch.id, v)}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create new role */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">สร้างยศใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-32 space-y-1.5">
              <Label className="text-xs text-muted-foreground">ชื่อยศ</Label>
              <Input
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="เช่น เลขา, หัวหน้า..."
                className="bg-muted border-border h-8"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-1.5 shrink-0">
              <Label className="text-xs text-muted-foreground">สีประจำยศ</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={newRoleColor}
                  onChange={e => setNewRoleColor(e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent" />
                <Input value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)}
                  className="h-8 text-xs bg-muted border-border w-24" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating}
              size="sm" className="h-8 bg-primary text-primary-foreground hover:opacity-90 shrink-0">
              <Plus className="w-4 h-4 mr-1" />
              {creating ? 'กำลังสร้าง...' : 'สร้างยศ'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">ลำดับยศ (สูง → ต่ำ)</p>
          <span className="text-xs text-muted-foreground">{roles.length} ยศ</span>
        </div>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : roles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            ยังไม่มียศ กรุณาสร้างยศใหม่
          </div>
        ) : (
          roles.map((role, idx) => (
            <RoleCard
              key={role.id}
              role={role}
              index={idx}
              total={roles.length}
              onDelete={handleDelete}
              onMove={handleMove}
              onUpdate={handleUpdateLocal}
            />
          ))
        )}
      </div>
    </div>
  );
}
