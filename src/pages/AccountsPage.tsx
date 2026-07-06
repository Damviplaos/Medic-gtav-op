// หน้าจัดการบัญชี (Account Management) — รองรับหลายยศแบบ Discord
import { useState, useEffect } from 'react';
import {
  fetchAllProfiles, fetchRoles, createUserAccount,
  updateProfileDisplayName, updateProfileRoles,
  updateProfilePassword, deleteUserAccount,
} from '@/services/api';
import type { UserProfile, Role } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import AppLayout from '@/components/layouts/AppLayout';
import { toast } from 'sonner';
import { Users, Plus, Pencil, Trash2, KeyRound, RefreshCw, X, ShieldCheck } from 'lucide-react';

export default function AccountsPage() {
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const { can } = usePermissions();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [pwdTarget, setPwdTarget] = useState<UserProfile | null>(null);

  const [createForm, setCreateForm] = useState({ username: '', password: '', displayName: '', roleIds: [] as string[] });
  const [editForm, setEditForm] = useState({ displayName: '', roleIds: [] as string[] });
  const [newPwd, setNewPwd] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [p, r] = await Promise.all([fetchAllProfiles(), fetchRoles()]);
      setProfiles(p);
      setRoles(r);
    } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleRole = (id: string, current: string[], setter: (ids: string[]) => void) => {
    setter(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  const handleCreate = async () => {
    if (!createForm.username.trim() || !createForm.password || !createForm.displayName.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบ'); return;
    }
    if (createForm.roleIds.length === 0) { toast.error('กรุณาเลือกอย่างน้อย 1 ยศ'); return; }
    if (createForm.password.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setSaving(true);
    try {
      await createUserAccount({ ...createForm, createdBy: user!.id });
      toast.success(`สร้างบัญชี "${createForm.username}" สำเร็จ`);
      setShowCreate(false);
      setCreateForm({ username: '', password: '', displayName: '', roleIds: [] });
      load();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  const openEdit = (p: UserProfile) => {
    if (p.is_superadmin && !myProfile?.is_superadmin) {
      toast.error('ไม่สามารถแก้ไขบัญชี Super Admin ได้'); return;
    }
    setEditTarget(p);
    setEditForm({ displayName: p.display_name, roleIds: p.role_ids?.length ? p.role_ids : (p.role_id ? [p.role_id] : []) });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (editTarget.is_superadmin && !myProfile?.is_superadmin) {
      toast.error('ไม่สามารถแก้ไขบัญชี Super Admin ได้'); return;
    }
    setSaving(true);
    try {
      await updateProfileDisplayName(editTarget.id, editForm.displayName);
      if (can('can_manage_roles') && editForm.roleIds.length > 0) {
        await updateProfileRoles(editTarget.id, editForm.roleIds);
      }
      toast.success('อัปเดตบัญชีสำเร็จ');
      setEditTarget(null);
      if (editTarget.id === user?.id) await refreshProfile();
      load();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleChangePwd = async () => {
    if (!pwdTarget || pwdTarget.id !== user?.id) { toast.error('เปลี่ยนรหัสผ่านได้เฉพาะของตัวเองเท่านั้น'); return; }
    if (newPwd.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setSaving(true);
    try {
      await updateProfilePassword(user?.id ?? '', newPwd);
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setPwdTarget(null);
      setNewPwd('');
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p: UserProfile) => {
    if (p.is_superadmin) { toast.error('ไม่สามารถลบบัญชี Super Admin ได้'); return; }
    if (!confirm(`ลบบัญชี "${p.username}" ใช่ไหม?`)) return;
    try { await deleteUserAccount(p.id); toast.success('ลบบัญชีแล้ว'); load(); }
    catch (err) { toast.error((err as Error).message); }
  };

  // แสดงยศทั้งหมดของ user เป็น badge
  const RoleBadges = ({ p }: { p: UserProfile }) => {
    const displayRoles = p.roles?.length ? p.roles : (p.role ? [p.role] : []);
    return (
      <div className="flex flex-wrap gap-1">
        {displayRoles.map(r => (
          <span key={r.id} className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: `${r.color}22`, color: r.color, border: `1px solid ${r.color}44` }}>
            {r.name}
          </span>
        ))}
      </div>
    );
  };

  // Checkbox multi-select สำหรับยศ
  const RoleCheckboxes = ({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) => (
    <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
      {roles.map(r => (
        <label key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:bg-muted cursor-pointer select-none">
          <input type="checkbox" className="accent-primary w-3.5 h-3.5"
            checked={selected.includes(r.id)}
            onChange={() => toggleRole(r.id, selected, onChange)} />
          <span className="text-xs font-medium truncate" style={{ color: r.color }}>{r.name}</span>
        </label>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground flex-1">จัดการบัญชี</h1>
          {can('can_create_account') && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> สร้างบัญชีใหม่
            </button>
          )}
        </div>

        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-primary animate-spin" /></div> : (
          <div className="space-y-2">
            {profiles.map(p => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 bg-card border rounded-lg ${p.is_superadmin ? 'border-primary/40' : 'border-border'}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                  style={{ backgroundColor: p.role?.color ?? '#6B7280' }}>
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-sm text-foreground truncate">{p.display_name}</p>
                    {p.is_superadmin && <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">@{p.username}</p>
                  <RoleBadges p={p} />
                </div>
                {p.id === user?.id && <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded shrink-0">ฉัน</span>}
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="แก้ไข">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {p.id === user?.id && (
                    <button onClick={() => setPwdTarget(p)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="เปลี่ยนรหัสผ่าน">
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {can('can_create_account') && p.id !== user?.id && !p.is_superadmin && (
                    <button onClick={() => handleDelete(p)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors" title="ลบ">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal สร้างบัญชี */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-card border border-border rounded-lg w-full max-w-[calc(100%-2rem)] md:max-w-md max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-foreground">สร้างบัญชีใหม่</h2>
                <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'ชื่อผู้ใช้ (username)', key: 'username', type: 'text', placeholder: 'ตัวพิมพ์เล็ก ไม่มีช่องว่าง' },
                  { label: 'รหัสผ่านเริ่มต้น', key: 'password', type: 'password', placeholder: 'อย่างน้อย 6 ตัวอักษร' },
                  { label: 'ชื่อแสดง (display name)', key: 'displayName', type: 'text', placeholder: 'ชื่อตัวละคร' },
                ].map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-sm font-medium text-foreground">{f.label}</label>
                    <input type={f.type} value={(createForm as unknown as Record<string, string>)[f.key]}
                      onChange={e => setCreateForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">ยศ <span className="text-muted-foreground font-normal">(เลือกได้หลายยศ)</span></label>
                  <RoleCheckboxes selected={createForm.roleIds}
                    onChange={ids => setCreateForm(prev => ({ ...prev, roleIds: ids }))} />
                  {createForm.roleIds.length === 0 && <p className="text-xs text-destructive">กรุณาเลือกอย่างน้อย 1 ยศ</p>}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted">ยกเลิก</button>
                  <button onClick={handleCreate} disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'สร้างบัญชี'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal แก้ไขบัญชี */}
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-card border border-border rounded-lg w-full max-w-[calc(100%-2rem)] md:max-w-md max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-foreground">แก้ไข: @{editTarget.username}</h2>
                <button onClick={() => setEditTarget(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">ชื่อแสดง</label>
                  <input value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                {can('can_manage_roles') && !editTarget.is_superadmin && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">ยศ <span className="text-muted-foreground font-normal">(เลือกได้หลายยศ)</span></label>
                    <RoleCheckboxes selected={editForm.roleIds}
                      onChange={ids => setEditForm(f => ({ ...f, roleIds: ids }))} />
                  </div>
                )}
                {editTarget.is_superadmin && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">Super Admin — ยศถูกล็อก ไม่สามารถเปลี่ยนได้</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditTarget(null)} className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted">ยกเลิก</button>
                  <button onClick={handleEdit} disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'บันทึก'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal เปลี่ยนรหัสผ่าน */}
        {pwdTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-card border border-border rounded-lg w-full max-w-[calc(100%-2rem)] md:max-w-sm">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-foreground">เปลี่ยนรหัสผ่าน</h2>
                <button onClick={() => setPwdTarget(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">รหัสผ่านใหม่</label>
                  <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPwdTarget(null)} className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted">ยกเลิก</button>
                  <button onClick={handleChangePwd} disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'เปลี่ยนรหัสผ่าน'}
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
