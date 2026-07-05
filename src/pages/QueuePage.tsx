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
import { ChevronRight, UserMinus, RefreshCw, Shuffle, Star, StarOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import AppLayout from '@/components/layouts/AppLayout';

const NON_OP_STATUSES: DoctorStatus[] = ['activity', 'afk', 'off_duty', 'story'];

// ─── DoctorRow ────────────────────────────────────────────────────────────────
interface DoctorRowProps {
  doctor: Doctor;
  isPointed: boolean;
  currentStatus: DoctorStatus;
  canControl: boolean;
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
          <button onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-0.5 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            เมนู <ChevronRight className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-90' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
              {menuItems.map(item => (
                <button key={item.label} onClick={() => { item.action(); setMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors ${item.className ?? 'text-foreground'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="w-14 shrink-0" />
      )}
    </div>
  );
}

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
  const [busy, setBusy] = useState(false);

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
  useEffect(() => subscribeStore(loadAll), [loadAll]);

  const opDoctors = doctors.filter(d => d.status === 'op').sort((a, b) => a.queue_order - b.queue_order);
  const byStatus = (s: DoctorStatus) => doctors.filter(d => d.status === s);
  const safePointer = opDoctors.length === 0 ? -1 : Math.min(queueState?.pointer_index ?? 0, opDoctors.length - 1);

  // ตรวจว่าผู้ใช้ปัจจุบันเป็นคนรัน OP อยู่ไหม
  const isCurrentOp = !!(operator && operator.user_id && operator.user_id === user?.id);
  // ตรวจสิทธิ์กดถัดไป: ต้องเป็นคนรัน OP อยู่ หรือมีสิทธิ์พิเศษ
  const canNext = isCurrentOp || (can('can_next_queue') && !operator);

  const canControlDoctor = (doc: Doctor): boolean => {
    if (!user) return false;
    const isOwn = profile?.doctor_id === doc.id;
    return isOwn || can('can_change_others_status');
  };

  // ขึ้นเป็นคนรัน OP (ตัวเอง)
  const handleBecomeOp = async () => {
    if (!user || !profile) { toast.error('กรุณาเข้าสู่ระบบก่อน'); return; }
    setBusy(true);
    try {
      await setOperator(profile.display_name, user.id);
      toast.success(`${profile.display_name} ขึ้นเป็นคนรัน OP แล้ว`);
    } catch { toast.error('เกิดข้อผิดพลาด'); }
    finally { setBusy(false); }
  };

  // เลิกเป็นคนรัน OP
  const handleLeaveOp = async () => {
    setBusy(true);
    try {
      await clearOperator();
      toast.success('เลิกเป็นคนรัน OP แล้ว');
    } catch { toast.error('เกิดข้อผิดพลาด'); }
    finally { setBusy(false); }
  };

  // สุ่มคนรัน OP จากคิว OP
  const handleRandomOp = async () => {
    if (opDoctors.length === 0) { toast.error('ไม่มีหมอในคิว OP'); return; }
    setBusy(true);
    try {
      const pick = opDoctors[Math.floor(Math.random() * opDoctors.length)];
      await setOperator(pick.name, null);
      toast.success(`สุ่มได้ "${pick.name}" เป็นคนรัน OP`);
    } catch { toast.error('เกิดข้อผิดพลาด'); }
    finally { setBusy(false); }
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

  // admin/ผู้มีสิทธิ์สามารถเคลียร์ OP ของคนอื่นได้
  const canClearOthersOp = can('can_set_operator');

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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-foreground">หน้าคิว OP</h2>
          {canNext && (
            <button onClick={handleNext} disabled={opDoctors.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity">
              <ChevronRight className="w-4 h-4" /> ถัดไป
            </button>
          )}
        </div>

        {/* ส่วนคนรัน OP */}
        <div className="bg-card border border-border rounded-lg p-4 mb-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase text-center">คนรัน OP</p>

          {operator ? (
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full status-dot-op shrink-0" />
              <span className="text-base font-bold text-foreground">{operator.name}</span>
              {isCurrentOp && (
                <span className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">คุณ</span>
              )}
              {/* เลิกเป็น OP ถ้าเป็นตัวเอง หรือมีสิทธิ์เคลียร์คนอื่น */}
              {(isCurrentOp || canClearOthersOp) && (
                <button onClick={handleLeaveOp} disabled={busy}
                  className="ml-1 p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm">— ยังไม่มีคนรัน OP —</p>
          )}

          {/* ปุ่ม 3 ตัว */}
          <div className="flex gap-2 justify-center flex-wrap">
            {!isCurrentOp && (
              <button onClick={handleBecomeOp} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity">
                <Star className="w-3.5 h-3.5" />
                ขึ้นเป็น OP
              </button>
            )}
            {isCurrentOp && (
              <button onClick={handleLeaveOp} disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/80 text-white rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity">
                <StarOff className="w-3.5 h-3.5" />
                เลิกเป็น OP
              </button>
            )}
            <button onClick={handleRandomOp} disabled={busy || opDoctors.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground rounded-md text-sm font-medium hover:bg-muted disabled:opacity-60 transition-colors">
              <Shuffle className="w-3.5 h-3.5" />
              สุ่ม
            </button>
          </div>

          {!canNext && operator && !isCurrentOp && (
            <p className="text-center text-xs text-muted-foreground">เฉพาะคนรัน OP เท่านั้นที่กดถัดไปได้</p>
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

