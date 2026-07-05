// หน้าหลัก: ระบบจัดคิวหมอ GTA V RP
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/db/supabase';
import {
  fetchDoctors, fetchOperator, fetchQueueState,
  updateDoctorStatus, returnDoctorToOp,
  setOperator, clearOperator,
  updatePointerIndex,
} from '@/services/api';
import type { Doctor, DoctorStatus, Operator, QueueState } from '@/types/index';
import { STATUS_LABELS } from '@/types/index';
import { toast } from 'sonner';
import { Settings, ChevronRight, UserMinus, UserCheck, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// ──────────────────────────────────────────────────────────────────────────────
// สถานะที่แบ่งแยกออกจากคิวหลัก
const NON_OP_STATUSES: DoctorStatus[] = ['activity', 'afk', 'off_duty', 'story'];

// ──────────────────────────────────────────────────────────────────────────────
// DoctorRow: แถวแสดงรายชื่อหมอแต่ละคน
// ──────────────────────────────────────────────────────────────────────────────
interface DoctorRowProps {
  doctor: Doctor;
  isPointed: boolean;
  currentStatus: DoctorStatus;
  onChangeStatus: (id: string, status: DoctorStatus) => void;
  onReturnToOp: (id: string) => void;
}

function DoctorRow({ doctor, isPointed, currentStatus, onChangeStatus, onReturnToOp }: DoctorRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ปิดเมนูเมื่อคลิกนอก
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const dotClass =
    currentStatus === 'op' ? 'status-dot-op' :
    currentStatus === 'activity' ? 'status-dot-activity' :
    currentStatus === 'afk' ? 'status-dot-afk' :
    currentStatus === 'story' ? 'status-dot-story' :
    'status-dot-off';

  // ปุ่มเมนูแต่ละสถานะ
  const menuItems: { label: string; action: () => void }[] = [];

  if (currentStatus === 'op') {
    menuItems.push(
      { label: 'ไปกิจกรรม', action: () => onChangeStatus(doctor.id, 'activity') },
      { label: 'เหม่อ', action: () => onChangeStatus(doctor.id, 'afk') },
      { label: 'ออกเวร', action: () => onChangeStatus(doctor.id, 'off_duty') },
      { label: 'ไป Story', action: () => onChangeStatus(doctor.id, 'story') },
      { label: 'ลง OP', action: () => onChangeStatus(doctor.id, 'off_duty') },
    );
  } else {
    menuItems.push({ label: 'ขึ้น OP', action: () => onReturnToOp(doctor.id) });
    if (currentStatus !== 'activity') menuItems.push({ label: 'ไปกิจกรรม', action: () => onChangeStatus(doctor.id, 'activity') });
    if (currentStatus !== 'afk') menuItems.push({ label: 'เหม่อ', action: () => onChangeStatus(doctor.id, 'afk') });
    if (currentStatus !== 'off_duty') menuItems.push({ label: 'ออกเวร', action: () => onChangeStatus(doctor.id, 'off_duty') });
    if (currentStatus !== 'story') menuItems.push({ label: 'ไป Story', action: () => onChangeStatus(doctor.id, 'story') });
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors animate-fade-in-up ${
        isPointed ? 'queue-item-active' : 'hover:bg-muted/30'
      }`}
    >
      {/* ลูกศรซ้าย */}
      <span className={`text-base w-5 shrink-0 text-center ${isPointed ? 'pointer-bounce' : 'opacity-0'}`}>
        👉
      </span>

      {/* จุดสี */}
      <span className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />

      {/* ชื่อ */}
      <span className="flex-1 min-w-0 text-sm md:text-base text-foreground font-medium truncate">
        {doctor.name}
      </span>

      {/* ลูกศรขวา */}
      <span className={`text-base w-5 shrink-0 text-center ${isPointed ? 'pointer-bounce' : 'opacity-0'}`}>
        👈
      </span>

      {/* ปุ่มเมนู */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-0.5 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          เมนู <ChevronRight className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-90' : ''}`} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-card border border-border rounded-lg shadow-xl overflow-hidden">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.action(); setMenuOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors ${
                  item.label === 'ขึ้น OP' ? 'text-primary font-semibold' :
                  item.label === 'ออกเวร' || item.label === 'ลง OP' ? 'text-destructive' :
                  'text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SectionBlock: กล่องแต่ละหมวด
// ──────────────────────────────────────────────────────────────────────────────
interface SectionBlockProps {
  title: string;
  children: React.ReactNode;
}

function SectionBlock({ title, children }: SectionBlockProps) {
  return (
    <div>
      <hr className="dashed-divider mb-3" />
      <div className="text-center mb-2">
        <span className="text-sm font-semibold text-muted-foreground tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// QueuePage: หน้าหลัก
// ──────────────────────────────────────────────────────────────────────────────
export default function QueuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [operator, setOperatorState] = useState<Operator | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [opNameInput, setOpNameInput] = useState('');
  const [settingOp, setSettingOp] = useState(false);
  const [showOpInput, setShowOpInput] = useState(false);

  // โหลดข้อมูลเริ่มต้น
  const loadAll = useCallback(async () => {
    try {
      const [docs, op, qs] = await Promise.all([
        fetchDoctors(),
        fetchOperator(),
        fetchQueueState(),
      ]);
      setDoctors(docs);
      setOperatorState(op);
      setQueueState(qs);
    } catch {
      toast.error('โหลดข้อมูลล้มเหลว');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => {
        fetchDoctors().then(setDoctors);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operator' }, () => {
        fetchOperator().then(setOperatorState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_state' }, () => {
        fetchQueueState().then(setQueueState);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // หมอในคิว OP (เรียงตาม queue_order)
  const opDoctors = doctors
    .filter((d) => d.status === 'op')
    .sort((a, b) => a.queue_order - b.queue_order);

  // หมอในหมวดอื่นๆ
  const byStatus = (status: DoctorStatus) =>
    doctors.filter((d) => d.status === status).sort((a, b) => a.name.localeCompare(b.name));

  // ตำแหน่งนิ้วชี้ (clamp ให้อยู่ใน opDoctors)
  const safePointer =
    opDoctors.length === 0 ? -1 :
    Math.min(queueState?.pointer_index ?? 0, opDoctors.length - 1);

  // ──── Handlers ────────────────────────────────────────────────────────────

  const handleNext = async () => {
    if (!queueState || opDoctors.length === 0) return;
    const next = (safePointer + 1) % opDoctors.length;
    try {
      await updatePointerIndex(queueState.id, next);
      setQueueState(prev => prev ? { ...prev, pointer_index: next } : prev);
    } catch {
      toast.error('เลื่อนคิวล้มเหลว');
    }
  };

  const handleChangeStatus = async (id: string, status: DoctorStatus) => {
    try {
      await updateDoctorStatus(id, status);
      // ถ้าหมอที่ถูกชี้ออกจาก OP ให้ pointer ไม่เกิน length ใหม่
      const newOpDoctors = doctors.filter(d => d.status === 'op' && d.id !== id);
      if (queueState && safePointer >= newOpDoctors.length && newOpDoctors.length > 0) {
        await updatePointerIndex(queueState.id, 0);
      }
      toast.success(`เปลี่ยนสถานะเป็น "${STATUS_LABELS[status]}" แล้ว`);
    } catch {
      toast.error('เปลี่ยนสถานะล้มเหลว');
    }
  };

  const handleReturnToOp = async (id: string) => {
    try {
      await returnDoctorToOp(id);
      toast.success('กลับเข้าคิว OP แล้ว');
    } catch {
      toast.error('กลับเข้าคิวล้มเหลว');
    }
  };

  const handleSetOp = async () => {
    if (!opNameInput.trim()) return;
    setSettingOp(true);
    try {
      await setOperator(opNameInput.trim());
      setShowOpInput(false);
      setOpNameInput('');
      toast.success(`ตั้ง "${opNameInput.trim()}" เป็นคนรัน OP`);
    } catch {
      toast.error('ตั้งค่า OP ล้มเหลว');
    } finally {
      setSettingOp(false);
    }
  };

  const handleClearOp = async () => {
    try {
      await clearOperator();
      toast.success('เคลียร์คนรัน OP แล้ว');
    } catch {
      toast.error('เคลียร์ OP ล้มเหลว');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-2">
        <h1 className="flex-1 min-w-0 text-base font-bold text-foreground truncate">
          🏥 ระบบจัดคิวหมอ GTA V RP
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          {/* ปุ่มถัดไป */}
          <button
            onClick={handleNext}
            disabled={opDoctors.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 active:opacity-75 disabled:opacity-40 transition-opacity"
          >
            <ChevronRight className="w-4 h-4" />
            ถัดไป
          </button>
          {user && (
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="ตั้งค่า"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 space-y-1">

        {/* ─── ส่วนคนรัน OP ─── */}
        <div className="text-center py-2 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground tracking-widest uppercase">คนรัน op</p>
          {operator ? (
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full status-dot-op shrink-0" />
              <span className="text-base font-bold text-foreground">{operator.name}</span>
              {user && (
                <button
                  onClick={handleClearOp}
                  className="ml-1 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                  title="เคลียร์ OP"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="text-muted-foreground text-sm">— ยังไม่มีคนรัน OP —</span>
              {user && !showOpInput && (
                <button
                  onClick={() => setShowOpInput(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 border border-border rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  ตั้งคนรัน OP
                </button>
              )}
            </div>
          )}

          {/* Input ตั้ง OP */}
          {showOpInput && user && (
            <div className="flex gap-2 mt-2 max-w-xs mx-auto">
              <input
                type="text"
                value={opNameInput}
                onChange={(e) => setOpNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetOp()}
                placeholder="ชื่อคนรัน OP"
                autoFocus
                className="flex-1 min-w-0 px-2 py-1.5 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleSetOp}
                disabled={settingOp}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0"
              >
                {settingOp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'ยืนยัน'}
              </button>
              <button
                onClick={() => setShowOpInput(false)}
                className="px-2 py-1.5 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted shrink-0"
              >
                ยกเลิก
              </button>
            </div>
          )}
        </div>

        {/* ─── เส้นแบ่ง + รายชื่อ OP ─── */}
        <hr className="dashed-divider" />

        {opDoctors.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">ยังไม่มีหมอในคิว OP</p>
            {!user && <p className="text-xs text-muted-foreground mt-1">เข้าสู่ระบบเพื่อจัดการ</p>}
          </div>
        ) : (
          <div className="space-y-0.5">
            {opDoctors.map((doc, idx) => (
              <DoctorRow
                key={doc.id}
                doctor={doc}
                isPointed={idx === safePointer}
                currentStatus="op"
                onChangeStatus={handleChangeStatus}
                onReturnToOp={handleReturnToOp}
              />
            ))}
          </div>
        )}

        {/* ─── หมวดสถานะอื่นๆ ─── */}
        {NON_OP_STATUSES.map((status) => {
          const group = byStatus(status);
          return (
            <SectionBlock key={status} title={STATUS_LABELS[status]}>
              {group.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-1 mb-2">— ว่าง —</p>
              ) : (
                <div className="space-y-0.5 mb-2">
                  {group.map((doc) => (
                    <DoctorRow
                      key={doc.id}
                      doctor={doc}
                      isPointed={false}
                      currentStatus={status}
                      onChangeStatus={handleChangeStatus}
                      onReturnToOp={handleReturnToOp}
                    />
                  ))}
                </div>
              )}
            </SectionBlock>
          );
        })}

        {/* เส้นท้าย */}
        <hr className="dashed-divider mt-4" />

        {/* Realtime indicator */}
        <div className="flex items-center justify-center gap-1.5 py-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">Real-time sync</span>
        </div>
      </main>
    </div>
  );
}
