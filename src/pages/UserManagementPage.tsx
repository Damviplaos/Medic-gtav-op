import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { UserPlus, Shield, User, Trash2, Plus, ChevronDown, Pencil, Link2, Link2Off, Search } from 'lucide-react';
import {
  getAllProfiles, getUserRoles, assignRole, removeRole, createUserByAdmin, getRoles,
} from '@/services/adminService';
import {
  updatePlayerProfile, adminChangePassword, getMatchmakingPairs,
  createMatchmakingPair, deleteMatchmakingPair,
} from '@/services/settingsService';
import type { Profile, UserRole, Role } from '@/types/types';

// =============================================
// Create User Dialog
// =============================================
function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sysRole, setSysRole] = useState('user');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) { toast.error('กรุณากรอก Username และ Password'); return; }
    setLoading(true);
    try {
      await createUserByAdmin(username.trim(), password, sysRole);
      toast.success('สร้างบัญชีสำเร็จ');
      setOpen(false); setUsername(''); setPassword(''); setSysRole('user');
      onCreated();
    } catch (err: any) { toast.error(err.message || 'สร้างบัญชีไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
          <UserPlus className="w-4 h-4 mr-1" /> สร้างผู้ใช้ใหม่
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader><DialogTitle>สร้างบัญชีผู้ใช้ใหม่</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="กรอก Username" className="bg-muted border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="กรอก Password" className="bg-muted border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">ระดับสิทธิ์</Label>
            <Select value={sysRole} onValueChange={setSysRole}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                {profile?.system_role === 'super_admin' && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button size="sm" onClick={handleCreate} disabled={loading} className="bg-primary text-primary-foreground hover:opacity-90">
              {loading ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// Edit Profile Dialog
// =============================================
function EditProfileDialog({ user, onDone }: { user: Profile; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [icName, setIcName] = useState(user.ic_name ?? '');
  const [newPass, setNewPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updatePlayerProfile(user.id, { nickname: nickname.trim() || undefined, ic_name: icName.trim() || undefined });
      if (newPass.trim()) {
        await adminChangePassword(user.id, newPass.trim());
      }
      toast.success('บันทึกโปรไฟล์สำเร็จ');
      setOpen(false); setNewPass('');
      onDone();
    } catch { toast.error('บันทึกไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={e => { e.preventDefault(); setOpen(true); }}>
          <Pencil className="w-3.5 h-3.5 mr-2" /> แก้ไขโปรไฟล์
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader><DialogTitle>แก้ไขโปรไฟล์ — {user.username}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">ชื่อเล่น (Nickname)</Label>
            <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="ชื่อเล่น" className="bg-muted border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">ชื่อในเกม (IC Name)</Label>
            <Input value={icName} onChange={e => setIcName(e.target.value)} placeholder="ชื่อตัวละคร" className="bg-muted border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</Label>
            <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="รหัสผ่านใหม่" className="bg-muted border-border" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button size="sm" onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground hover:opacity-90">
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================
// User Role Panel (expanded)
// =============================================
function UserRolePanel({ user, allRoles, callerProfile }: { user: Profile; allRoles: Role[]; callerProfile: Profile | null }) {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRoles = useCallback(async () => {
    const ur = await getUserRoles(user.id);
    setUserRoles(ur);
  }, [user.id]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const handleAssign = async (roleId: string) => {
    if (!callerProfile) return;
    setLoading(true);
    try { await assignRole(user.id, roleId, callerProfile.id); await loadRoles(); toast.success('มอบยศสำเร็จ'); }
    catch { toast.error('มอบยศไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const handleRemove = async (roleId: string) => {
    setLoading(true);
    try { await removeRole(user.id, roleId); await loadRoles(); toast.success('ถอดยศสำเร็จ'); }
    catch { toast.error('ถอดยศไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const assignedIds = new Set(userRoles.map(ur => ur.role_id));
  const unassigned = allRoles.filter(r => !assignedIds.has(r.id));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-2">ยศปัจจุบัน</p>
        <div className="flex flex-wrap gap-2">
          {userRoles.length === 0 && <span className="text-xs text-muted-foreground">ยังไม่มียศ</span>}
          {userRoles.map(ur => ur.role && (
            <div key={ur.id} className="flex items-center gap-1.5 px-2 py-1 rounded-sm border" style={{ borderColor: ur.role.color + '55' }}>
              <span className="text-xs font-semibold" style={{ color: ur.role.color }}>{ur.role.name}</span>
              <button onClick={() => handleRemove(ur.role_id)} className="text-muted-foreground hover:text-destructive ml-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
      {unassigned.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">มอบยศเพิ่มเติม</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(r => (
              <button key={r.id} onClick={() => handleAssign(r.id)} disabled={loading}
                className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-dashed hover:border-solid transition-colors"
                style={{ borderColor: r.color + '55', color: r.color }}>
                <Plus className="w-3 h-3" />
                <span className="text-xs font-semibold">{r.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// Matchmaking Tab
// =============================================
function MatchmakingTab({ users }: { users: Profile[] }) {
  const [pairs, setPairs] = useState<Array<{
    id: string; user_a_id: string; user_b_id: string; matched_at: string; notes: string | null;
    user_a?: { id: string; username: string; nickname: string | null; ic_name: string | null };
    user_b?: { id: string; username: string; nickname: string | null; ic_name: string | null };
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [userA, setUserA] = useState('');
  const [userB, setUserB] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPairs(await getMatchmakingPairs()); }
    catch { toast.error('โหลดข้อมูลจับคู่ไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!userA || !userB || userA === userB) { toast.error('กรุณาเลือกผู้เล่น 2 คนที่แตกต่างกัน'); return; }
    setSaving(true);
    try {
      await createMatchmakingPair(userA, userB, notes.trim() || undefined);
      toast.success('จับคู่สำเร็จ');
      setOpen(false); setUserA(''); setUserB(''); setNotes('');
      load();
    } catch { toast.error('จับคู่ไม่สำเร็จ (อาจมีคู่นี้อยู่แล้ว)'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMatchmakingPair(id); toast.success('ลบคู่สำเร็จ'); load(); }
    catch { toast.error('ลบคู่ไม่สำเร็จ'); }
  };

  const nameOf = (p?: { username: string; nickname: string | null; ic_name: string | null }) =>
    p ? (p.nickname || p.ic_name || p.username) : '?';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">คู่จับคู่ทั้งหมด {pairs.length} คู่</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
              <Link2 className="w-3.5 h-3.5 mr-1" /> จับคู่ใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
            <DialogHeader><DialogTitle>สร้างคู่ใหม่</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">ผู้เล่นคนที่ 1</Label>
                <Select value={userA} onValueChange={setUserA}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="เลือกผู้เล่น" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nickname || u.username}{u.ic_name ? ` [${u.ic_name}]` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">ผู้เล่นคนที่ 2</Label>
                <Select value={userB} onValueChange={setUserB}>
                  <SelectTrigger className="bg-muted border-border"><SelectValue placeholder="เลือกผู้เล่น" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.id !== userA).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nickname || u.username}{u.ic_name ? ` [${u.ic_name}]` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">หมายเหตุ (ไม่บังคับ)</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="เช่น กะเช้า, ทีม A" className="bg-muted border-border" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>ยกเลิก</Button>
                <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
                  {saving ? 'กำลังบันทึก...' : 'จับคู่'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : pairs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">ยังไม่มีคู่จับคู่ กดปุ่ม "จับคู่ใหม่" เพื่อเริ่มต้น</div>
      ) : (
        <div className="space-y-2">
          {pairs.map(pair => (
            <div key={pair.id} className="flex items-center gap-3 p-3 rounded-sm border border-border bg-card">
              <Link2 className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {nameOf(pair.user_a)} <span className="text-muted-foreground mx-1">↔</span> {nameOf(pair.user_b)}
                </p>
                {pair.notes && <p className="text-xs text-muted-foreground">{pair.notes}</p>}
                <p className="text-xs text-muted-foreground/60">{new Date(pair.matched_at).toLocaleDateString('th-TH')}</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => handleDelete(pair.id)}>
                <Link2Off className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// Main User Management Page
// =============================================
type PageTab = 'members' | 'matchmaking';

export default function UserManagementPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageTab, setPageTab] = useState<PageTab>('members');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([getAllProfiles(), getRoles()]);
      setUsers(p as Profile[]);
      setAllRoles(r);
    } catch { toast.error('โหลดข้อมูลไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const sysRoleLabel = (r: string) =>
    r === 'super_admin' ? 'Super Admin' : r === 'admin' ? 'Admin' : 'User';

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.username.toLowerCase().includes(q) ||
      (u.nickname?.toLowerCase() ?? '').includes(q) ||
      (u.ic_name?.toLowerCase() ?? '').includes(q);
  });

  const tabs: { key: PageTab; label: string }[] = [
    { key: 'members', label: 'รายชื่อสมาชิก' },
    { key: 'matchmaking', label: 'ระบบจับคู่' },
  ];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">จัดการผู้ใช้งาน</h1>
          <p className="text-xs text-muted-foreground">{users.length} บัญชี</p>
        </div>
        {pageTab === 'members' && <CreateUserDialog onCreated={loadData} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setPageTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              pageTab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {pageTab === 'members' && (
        <>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="ค้นหาชื่อ / ชื่อในเกม..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-7 h-8 text-sm bg-muted border-border w-full md:w-60" />
          </div>

          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(u => (
                <Card key={u.id} className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-muted-foreground">{(u.nickname || u.username)[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">{u.username}</p>
                            {u.nickname && <span className="text-xs text-muted-foreground">({u.nickname})</span>}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{sysRoleLabel(u.system_role)}</Badge>
                          </div>
                          {u.ic_name && <p className="text-xs text-muted-foreground">IC: {u.ic_name}</p>}
                        </div>
                      </div>

                      {/* Dropdown actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="shrink-0 h-7 text-xs px-2">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <EditProfileDialog user={u} onDone={loadData} />
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setExpandedUser(expandedUser === u.id ? null : u.id)}>
                            <Shield className="w-3.5 h-3.5 mr-2" />
                            {expandedUser === u.id ? 'ซ่อนยศ' : 'จัดการยศ'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {expandedUser === u.id && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <UserRolePanel user={u} allRoles={allRoles} callerProfile={profile} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Matchmaking tab */}
      {pageTab === 'matchmaking' && <MatchmakingTab users={users} />}
    </div>
  );
}
