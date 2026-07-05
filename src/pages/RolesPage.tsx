// หน้าจัดการยศ (Role Management)
import { useState, useEffect } from 'react';
import { fetchRoles, createRole, updateRole, deleteRole } from '@/services/api';
import type { Role, Permission } from '@/types/index';
import { PERMISSION_LABELS } from '@/types/index';
import { usePermissions } from '@/hooks/use-permissions';
import AppLayout from '@/components/layouts/AppLayout';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Shield, X, RefreshCw } from 'lucide-react';

const ALL_PERMISSIONS: Permission[] = [
  'can_create_account', 'can_manage_roles', 'can_change_others_status',
  'can_view_overview_dashboard', 'can_issue_warnings', 'can_access_settings',
  'can_manage_doctors', 'can_next_queue', 'can_set_operator',
];

type FormState = { name: string; color: string; permissions: Record<Permission, boolean> };
const emptyForm = (): FormState => ({
  name: '',
  color: '#6B7280',
  permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p, false])) as Record<Permission, boolean>,
});

export default function RolesPage() {
  const { isAdmin } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setRoles(await fetchRoles()); }
    catch { toast.error('โหลดยศล้มเหลว'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditRole(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (r: Role) => {
    setEditRole(r);
    setForm({
      name: r.name,
      color: r.color,
      permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p, r[p]])) as Record<Permission, boolean>,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('กรุณากรอกชื่อยศ'); return; }
    setSaving(true);
    try {
      if (editRole) {
        await updateRole(editRole.id, { name: form.name, color: form.color, permissions: form.permissions });
        toast.success('อัปเดตยศสำเร็จ');
      } else {
        await createRole({ name: form.name, color: form.color, permissions: form.permissions });
        toast.success('สร้างยศสำเร็จ');
      }
      setShowForm(false);
      load();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (r: Role) => {
    if (!confirm(`ลบยศ "${r.name}" ใช่ไหม?`)) return;
    try { await deleteRole(r.id); toast.success('ลบยศแล้ว'); load(); }
    catch (err) { toast.error((err as Error).message); }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground flex-1">จัดการยศ</h1>
          {isAdmin && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> สร้างยศใหม่
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-primary animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {roles.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{r.name}</span>
                    {r.is_system && <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">ระบบ</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ALL_PERMISSIONS.filter(p => r[p]).map(p => (
                      <span key={p} className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                        {PERMISSION_LABELS[p]}
                      </span>
                    ))}
                  </div>
                </div>
                {isAdmin && !r.is_system && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(r)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(r)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal สร้าง/แก้ไขยศ */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-card border border-border rounded-lg w-full max-w-[calc(100%-2rem)] md:max-w-lg max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-foreground">{editRole ? 'แก้ไขยศ' : 'สร้างยศใหม่'}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">ชื่อยศ</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="เช่น หัวหน้าเวร, ผู้ช่วย"
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">สีของยศ</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      className="w-10 h-8 rounded cursor-pointer border border-border bg-transparent" />
                    <span className="text-sm text-muted-foreground font-mono">{form.color}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">สิทธิ์</label>
                  <div className="space-y-2">
                    {ALL_PERMISSIONS.map(p => (
                      <label key={p} className="flex items-center gap-3 cursor-pointer min-h-12">
                        <input type="checkbox" checked={form.permissions[p]}
                          onChange={e => setForm(f => ({ ...f, permissions: { ...f.permissions, [p]: e.target.checked } }))}
                          className="w-4 h-4 rounded accent-primary" />
                        <span className="text-sm text-foreground">{PERMISSION_LABELS[p]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">ยกเลิก</button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'บันทึก'}
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
