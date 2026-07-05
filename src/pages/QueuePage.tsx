// หน้าหลัก: ระบบจัดคิวหมอ GTA V RP (พร้อมระบบสิทธิ์)
import { useState, useEffect, useCallback } from 'react';
import { subscribeStore } from '@/store/store';
import {
  fetchDoctors, fetchOperator, fetchQueueState,
  updateDoctorStatus, returnDoctorToOp,
  setOperator, clearOperator, updatePointerIndex,
} from '@/services/api';
import type { Doctor, DoctorStatus, Operator, QueueState } from '@/types/index';
import { STATUS_LABELS } from '@/types/index';
import { toast } from 'sonner';
import { ChevronRight, UserMinus, UserCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import AppLayout from '@/components/layouts/AppLayout';

const NON_OP_STATUSES: DoctorStatus[] = ['activity', 'afk', 'off_duty', 'story'];

// ─── DoctorRow ────────────────────────────────────────────────────────────────
interface DoctorRowProps {
  doctor: Doctor;
  isPointed: boolean;
  currentStatus: DoctorStatus;
  canControl: boolean; // กดเมนูได้ไหม (ตัวเอง หรือมีสิทธิ์)
  onChangeStatus: (id: string, status: DoctorStatus) => void;
  onReturnToOp: (id: string) => void;
}

function DoctorRow({ doctor, isPointed, currentStatus, canControl, onChangeStatus, onReturnToOp }: DoctorRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const dotClass =
    currentStatus === 'op' ? 'status-dot-op' :
    currentStatus === 'activity' ? 'status-dot-activity' :
    currentStatus === 'afk' ? 'status-dot-afk' :
    currentStatus === 'story' ? 'status-dot-story' : 'status-dot-off';

  const menuItems: { label: string; action: () => void; className?: string }[] = [];
  if (currentStatus === 'op') {
    menuItems.push(
      { label: 'ไปกิจกรรม', action: () => onChangeStatus(doctor.id, 'activity') },
      { label: 'เหม่อ', action: () => onChangeStatus(doctor.id, 'afk') },
      { label: 'ออกเวร', action: () => onChangeStatus(doctor.id, 'off_duty'), className: 'text-destructive' },
      { label: 'ไป Story', action: () => onChangeStatus(doctor.id, 'story') },
    );
  } else {
    menuItems.push({ label: 'ขึ้น OP', action: () => onReturnToOp(doctor.id), className: 'text-primary font-semibold' });
    if (currentStatus !== 'activity') menuItems.push({ label: 'ไปกิจกรรม', action: () => onChangeStatus(doctor.id, 'activity') });
    if (currentStatus !== 'afk') menuItems.push({ label: 'เหม่อ', action: () => onChangeStatus(doctor.id, 'afk') });
    if (currentStatus !== 'off_duty') menuItems.push({ label: 'ออกเวร', action: () => onChangeStatus(doctor.id, 'off_duty'), className: 'text-destructive' });
    if (currentStatus !== 'story') menuItems.push({ label: 'ไป Story', action: () => onChangeStatus(doctor.id, 'story') });
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors animate-fade-in-up ${isPointed ? 'queue-item-active' : 'hover:bg-muted/30'}`}>
      <span className={`text-base w-5 shrink-0 text-center ${isPointed ? 'pointer-bounce' : 'opacity-0'}`}>👉</span>
      <span className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />
      <span className="flex-1 min-w-0 text-sm md:text-base text-foreground font-medium truncate">{doctor.name}</span>
      <span className={`text-base w-5 shrink-0 text-center ${isPointed ? 'pointer-bounce' : 'opacity-0'}`}>👈</span>

      {canControl ? (
        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-0.5 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            เมนู <ChevronRight className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-90' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
              {menuItems.map(item => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors ${item.className ?? 'text-foreground'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="w-14 shrink-0" /> // placeholder เพื่อ alignment
      )}
    </div>
  );
}

// ─── SectionBlock ─────────────────────────────────────────────────────────────
function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <hr className="dashed-divider mb-3" />
      <p className="text-center text-sm font-semibold text-muted-foreground tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

// ─── QueuePage ────────────────────────────────────────────────────────────────
export default function QueuePage() {
  const { user, profile } = useAuth();
  const { can } = usePermissions();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [operator, setOperatorState] = useState<Operator | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [opNameInput, setOpNameInput] = useState('');
  const [showOpInput, setShowOpInput] = useState(false);
  const [settingOp, setSettingOp] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [docs, op, qs] = await Promise.all([fetchDoctors(), fetchOperator(), fetchQueueState()]);
      setDoctors(docs);
      setOperatorState(op);
      setQueueState(qs);
    } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // sync real-time ผ่าน BroadcastChannel (cross-tab)
  useEffect(() => subscribeStore(loadAll), [loadAll]);

  const opDoctors = doctors.filter(d => d.status === 'op').sort((a, b) => a.queue_order - b.queue_order);
  const byStatus = (s: DoctorStatus) => doctors.filter(d => d.status === s);
  const safePointer = opDoctors.length === 0 ? -1 : Math.min(queueState?.pointer_index ?? 0, opDoctors.length - 1);

  // ตรวจว่าสามารถกดเมนูของ doctor คนนี้ได้ไหม
  const canControlDoctor = (doc: Doctor): boolean => {
    if (!user) return false;
    // ตรวจว่า doctor linked กับ user profile นี้ไหม
    const isOwn = profile?.doctor_id === doc.id;
    const hasOtherControl = can('can_change_others_status');
    return isOwn || hasOtherControl;
  };

  const handleNext = async () => {
    if (!queueState || opDoctors.length === 0) return;
    const next = (safePointer + 1) % opDoctors.length;
    try {
      await updatePointerIndex(queueState.id, next);
      setQueueState(prev => prev ? { ...prev, pointer_index: next } : prev);
    } catch { toast.error('เลื่อนคิวล้มเหลว'); }
  };

  const handleChangeStatus = async (id: string, status: DoctorStatus) => {
    try {
      await updateDoctorStatus(id, status);
      toast.success(`ย้ายไป "${STATUS_LABELS[status]}" แล้ว`);
    } catch { toast.error('เปลี่ยนสถานะล้มเหลว'); }
  };

  const handleReturnToOp = async (id: string) => {
    try {
      await returnDoctorToOp(id);
      toast.success('กลับเข้าคิว OP แล้ว');
    } catch { toast.error('กลับเข้าคิวล้มเหลว'); }
  };

  const handleSetOp = async () => {
    if (!opNameInput.trim()) return;
    setSettingOp(true);
    try {
      await setOperator(opNameInput.trim());
      setShowOpInput(false);
      setOpNameInput('');
      toast.success(`ตั้ง "${opNameInput.trim()}" เป็นคนรัน OP`);
    } catch { toast.error('ตั้งค่า OP ล้มเหลว'); }
    finally { setSettingOp(false); }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">หน้าคิว OP</h2>
          {can('can_next_queue') && (
            <button
              onClick={handleNext}
              disabled={opDoctors.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" /> ถัดไป
            </button>
          )}
        </div>

        {/* คนรัน OP */}
        <div className="text-center py-2 space-y-1 mb-2">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">คนรัน op</p>
          {operator ? (
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full status-dot-op shrink-0" />
              <span className="text-base font-bold text-foreground">{operator.name}</span>
              {can('can_set_operator') && (
                <button onClick={() => clearOperator().then(() => toast.success('เคลียร์ OP แล้ว'))}
                  className="ml-1 p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-muted-foreground text-sm">— ยังไม่มีคนรัน OP —</span>
              {can('can_set_operator') && !showOpInput && (
                <button onClick={() => setShowOpInput(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <UserCheck className="w-3.5 h-3.5" /> ตั้งคนรัน OP
                </button>
              )}
            </div>
          )}
          {showOpInput && can('can_set_operator') && (
            <div className="flex gap-2 mt-2 max-w-xs mx-auto">
              <input type="text" value={opNameInput} onChange={e => setOpNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetOp()} placeholder="ชื่อคนรัน OP" autoFocus
                className="flex-1 min-w-0 px-2 py-1.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button onClick={handleSetOp} disabled={settingOp}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0">
                {settingOp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'ยืนยัน'}
              </button>
              <button onClick={() => setShowOpInput(false)}
                className="px-2 py-1.5 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted shrink-0">ยกเลิก</button>
            </div>
          )}
        </div>

        <hr className="dashed-divider" />

        {/* คิว OP list */}
        {opDoctors.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">ยังไม่มีหมอในคิว OP</p>
        ) : (
          <div className="space-y-0.5 mb-2">
            {opDoctors.map((doc, idx) => (
              <DoctorRow key={doc.id} doctor={doc} isPointed={idx === safePointer}
                currentStatus="op" canControl={canControlDoctor(doc)}
                onChangeStatus={handleChangeStatus} onReturnToOp={handleReturnToOp} />
            ))}
          </div>
        )}

        {/* ห้องสถานะอื่นๆ */}
        {NON_OP_STATUSES.map(status => {
          const group = byStatus(status);
          return (
            <SectionBlock key={status} title={STATUS_LABELS[status]}>
              {group.length === 0
                ? <p className="text-center text-muted-foreground text-xs py-1 mb-2">— ว่าง —</p>
                : <div className="space-y-0.5 mb-2">
                    {group.map(doc => (
                      <DoctorRow key={doc.id} doctor={doc} isPointed={false}
                        currentStatus={status} canControl={canControlDoctor(doc)}
                        onChangeStatus={handleChangeStatus} onReturnToOp={handleReturnToOp} />
                    ))}
                  </div>
              }
            </SectionBlock>
          );
        })}

        <hr className="dashed-divider mt-4" />
        <div className="flex items-center justify-center gap-1.5 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Real-time sync</span>
        </div>
      </div>
    </AppLayout>
  );
}
