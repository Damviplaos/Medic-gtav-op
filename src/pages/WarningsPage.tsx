// หน้าใบเตือน (Warning System) — รองรับสีเหลือง/ส้ม/แดง + แสดงผู้ออกพร้อมยศ
import { useState, useEffect } from 'react';
import { fetchAllWarnings, fetchMyWarnings, issueWarning, fetchAllProfiles } from '@/services/api';
import type { Warning, UserProfile, WarningSeverity } from '@/types/index';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import AppLayout from '@/components/layouts/AppLayout';
import { toast } from 'sonner';
import { AlertTriangle, Plus, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const SEVERITY_CONFIG: Record<WarningSeverity, { label: string; color: string; border: string; bg: string; icon: string }> = {
  yellow: { label: 'เหลือง (เตือน)', color: '#EAB308', border: 'border-yellow-400/40', bg: 'bg-yellow-400/8', icon: '⚠️' },
  orange: { label: 'ส้ม (หนัก)', color: '#F97316', border: 'border-orange-400/40', bg: 'bg-orange-400/8', icon: '🔶' },
  red: { label: 'แดง (ร้ายแรง)', color: '#EF4444', border: 'border-red-500/40', bg: 'bg-red-500/8', icon: '🚨' },
};

export default function WarningsPage() {
  const { user } = useAuth();
  const { can, isDirector } = usePermissions();
  const canIssue = can('can_issue_warnings') || isDirector;

  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ issuedTo: string; reason: string; severity: WarningSeverity }>({
    issuedTo: '', reason: '', severity: 'yellow',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const [w, p] = await Promise.all([
        canIssue ? fetchAllWarnings() : fetchMyWarnings(user.id),
        canIssue ? fetchAllProfiles() : Promise.resolve([]),
      ]);
      setWarnings(w);
      setProfiles(p);
    } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [canIssue]);

  const handleCreate = async () => {
    if (!form.issuedTo || !form.reason.trim()) { toast.error('กรุณาเลือกผู้รับและกรอกเหตุผล'); return; }
    setSaving(true);
    try {
      await issueWarning(form.issuedTo, user!.id, form.reason.trim(), form.severity);
      toast.success('ออกใบเตือนสำเร็จ');
      setShowCreate(false);
      setForm({ issuedTo: '', reason: '', severity: 'yellow' });
      load();
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-bold text-foreground flex-1">ใบเตือน</h1>
          {canIssue && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-md text-sm font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> ออกใบเตือนใหม่
            </button>
          )}
        </div>

        {loading ? <div className="flex justify-center py-12"><RefreshCw className="w-7 h-7 text-primary animate-spin" /></div> : (
          <>
            {!canIssue && <p className="text-sm text-muted-foreground mb-3">แสดงใบเตือนที่คุณได้รับ</p>}
            {warnings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">ไม่มีใบเตือน</div>
            ) : (
              <div className="space-y-2">
                {warnings.map(w => {
                  const sev = SEVERITY_CONFIG[w.severity ?? 'yellow'];
                  const issuer = w.issued_by_profile;
                  const issuerRoles = issuer?.roles?.length ? issuer.roles : (issuer?.role ? [issuer.role] : []);
                  return (
                    <div key={w.id} className={`border rounded-lg p-4 ${sev.border}`}
                      style={{ backgroundColor: `${sev.color}10` }}>
                      <div className="flex items-start gap-3">
                        <span className="text-base shrink-0 mt-0.5">{sev.icon}</span>
                        <div className="flex-1 min-w-0">
                          {/* ผู้รับ + ผู้ออก */}
                          <div className="flex flex-col md:flex-row md:items-center gap-1 mb-2 flex-wrap">
                            {canIssue && (
                              <span className="text-sm font-semibold text-foreground">
                                {w.issued_to_profile?.display_name ?? '—'}
                              </span>
                            )}
                            <span className="hidden md:inline text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                              ออกโดย{' '}
                              <span className="font-medium text-foreground">{issuer?.display_name ?? '—'}</span>
                              {issuerRoles.length > 0 && (
                                <span className="flex gap-0.5 flex-wrap">
                                  {issuerRoles.map(r => (
                                    <span key={r.id} className="px-1 py-0.5 rounded text-[10px] font-medium"
                                      style={{ color: r.color, backgroundColor: `${r.color}22` }}>
                                      {r.name}
                                    </span>
                                  ))}
                                </span>
                              )}
                              {' · '}{format(new Date(w.created_at), 'dd MMM yyyy HH:mm', { locale: th })}
                            </span>
                            {/* Badge สี */}
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold ml-auto shrink-0"
                              style={{ color: sev.color, backgroundColor: `${sev.color}22` }}>
                              {sev.label}
                            </span>
                          </div>
                          <p className="text-sm text-foreground bg-muted/40 rounded px-3 py-2">{w.reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Modal ออกใบเตือน */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-card border border-border rounded-lg w-full max-w-[calc(100%-2rem)] md:max-w-md max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-foreground">ออกใบเตือนใหม่</h2>
                <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">ผู้รับใบเตือน</label>
                  <select value={form.issuedTo} onChange={e => setForm(f => ({ ...f, issuedTo: e.target.value }))}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— เลือกสมาชิก —</option>
                    {profiles.filter(p => p.id !== user?.id).map(p => (
                      <option key={p.id} value={p.id}>{p.display_name} (@{p.username})</option>
                    ))}
                  </select>
                </div>
                {/* เลือกสีใบเตือน */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">ระดับความรุนแรง</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(SEVERITY_CONFIG) as [WarningSeverity, typeof SEVERITY_CONFIG.yellow][]).map(([key, cfg]) => (
                      <button key={key} type="button"
                        onClick={() => setForm(f => ({ ...f, severity: key }))}
                        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border-2 text-center transition-all text-xs font-medium ${
                          form.severity === key ? 'border-current scale-105' : 'border-border opacity-60 hover:opacity-90'
                        }`}
                        style={{ color: cfg.color }}>
                        <span className="text-lg">{cfg.icon}</span>
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">เหตุผล</label>
                  <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3}
                    placeholder="ระบุเหตุผล..."
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted">ยกเลิก</button>
                  <button onClick={handleCreate} disabled={saving}
                    className="px-4 py-2 text-white rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                    style={{ backgroundColor: SEVERITY_CONFIG[form.severity].color }}>
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'ออกใบเตือน'}
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
