// บริการ API สำหรับระบบจัดคิวหมอ
import { supabase } from '@/db/supabase';
import type { Doctor, DoctorStatus, Operator, QueueState } from '@/types/index';

// ─── Doctors ────────────────────────────────────────────────────────────────

export async function fetchDoctors(): Promise<Doctor[]> {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .order('queue_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addDoctor(name: string): Promise<void> {
  const { data: existing } = await supabase
    .from('doctors')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existing) throw new Error('ชื่อนี้มีอยู่ในระบบแล้ว');

  const { data: maxData } = await supabase
    .from('doctors')
    .select('queue_order')
    .order('queue_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = maxData ? (maxData.queue_order + 1) : 0;

  const { error } = await supabase
    .from('doctors')
    .insert({ name, status: 'op', queue_order: nextOrder });
  if (error) throw error;
}

export async function removeDoctor(id: string): Promise<void> {
  const { error } = await supabase.from('doctors').delete().eq('id', id);
  if (error) throw error;
}

export async function updateDoctorStatus(id: string, status: DoctorStatus): Promise<void> {
  const { error } = await supabase
    .from('doctors')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

export async function returnDoctorToOp(id: string): Promise<void> {
  // เพิ่มกลับท้ายสุดของ OP queue
  const { data: maxData } = await supabase
    .from('doctors')
    .select('queue_order')
    .eq('status', 'op')
    .order('queue_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = maxData ? (maxData.queue_order + 1) : 0;
  const { error } = await supabase
    .from('doctors')
    .update({ status: 'op', queue_order: nextOrder })
    .eq('id', id);
  if (error) throw error;
}

// ─── Operator ───────────────────────────────────────────────────────────────

export async function fetchOperator(): Promise<Operator | null> {
  const { data, error } = await supabase
    .from('operator')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setOperator(name: string): Promise<void> {
  // ลบ operator เดิมออกก่อน
  await supabase.from('operator').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('operator').insert({ name });
  if (error) throw error;
}

export async function clearOperator(): Promise<void> {
  await supabase.from('operator').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// ─── Queue State ─────────────────────────────────────────────────────────────

export async function fetchQueueState(): Promise<QueueState | null> {
  const { data, error } = await supabase
    .from('queue_state')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePointerIndex(id: string, pointer_index: number): Promise<void> {
  const { error } = await supabase
    .from('queue_state')
    .update({ pointer_index })
    .eq('id', id);
  if (error) throw error;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function fetchSetting(key: string): Promise<string> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? '';
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .update({ value })
    .eq('key', key);
  if (error) throw error;
}
