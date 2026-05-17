import { createClient } from '@supabase/supabase-js';
import { Student, Session, Payment, ClassType, Teacher, AttendanceStatus } from '../types';
import { ENV } from '../lib/env';

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

type StudentRow = {
  id: string;
  name: string;
  class_types: string[];
  email: string | null;
  parent_name: string | null;
  notes: string;
  balance: number;
  joined_date: string;
  status: 'Active' | 'Archived';
  packages: Student['packages'];
  progress_history: Student['progressHistory'];
};

type SessionRow = {
  id: string;
  student_ids: string[];
  date: string;
  duration_minutes: number;
  status: Session['status'];
  student_statuses: Session['studentStatuses'];
  type: string;
  topic: string;
  notes: string;
  price: number;
  is_trial: boolean;
  teacher_id: string | null;
};

type TeacherRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string;
  joined_date: string;
  status: 'Active' | 'Archived';
};

type PaymentRow = {
  id: string;
  student_id: string;
  amount: number;
  date: string;
  method: string;
  class_count?: number | null;
  class_type?: string | null;
};

// Enum guards so an unexpected DB value can't bypass typing. Falls back to a
// safe default rather than throwing — bad data shouldn't take down the UI.
const VALID_CLASS_TYPES: readonly string[] = Object.values(ClassType);
const toClassType = (v: unknown): ClassType => {
  if (typeof v === 'string' && VALID_CLASS_TYPES.includes(v)) return v as ClassType;
  return ClassType.OneOnOne;
};

const VALID_STATUSES: readonly string[] = Object.values(AttendanceStatus);
const toAttendanceStatus = (v: unknown): AttendanceStatus => {
  if (typeof v === 'string' && VALID_STATUSES.includes(v)) return v as AttendanceStatus;
  return AttendanceStatus.Present;
};

const toStudent = (r: StudentRow): Student => ({
  id: r.id,
  name: r.name,
  classTypes: ((r.class_types || []) as unknown[]).map(toClassType),
  email: r.email ?? undefined,
  parentName: r.parent_name ?? undefined,
  notes: r.notes ?? '',
  balance: Number(r.balance) || 0,
  joinedDate: r.joined_date,
  status: r.status,
  packages: (r.packages || []).map(p => ({ ...p, type: toClassType(p.type) })),
  progressHistory: r.progress_history || []
});

const fromStudent = (s: Student) => ({
  id: s.id,
  name: s.name,
  class_types: s.classTypes,
  email: s.email ?? null,
  parent_name: s.parentName ?? null,
  notes: s.notes,
  balance: s.balance,
  joined_date: s.joinedDate,
  status: s.status,
  packages: s.packages,
  progress_history: s.progressHistory
});

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  studentIds: r.student_ids || [],
  date: r.date,
  durationMinutes: r.duration_minutes,
  status: toAttendanceStatus(r.status),
  studentStatuses: (r.student_statuses || []).map(s => ({
    ...s,
    status: toAttendanceStatus(s.status)
  })),
  type: toClassType(r.type),
  topic: r.topic,
  notes: r.notes,
  price: Number(r.price) || 0,
  isTrial: r.is_trial || false,
  teacherId: r.teacher_id ?? undefined
});

const fromSession = (s: Session) => ({
  id: s.id,
  student_ids: s.studentIds,
  date: s.date,
  duration_minutes: s.durationMinutes,
  status: s.status,
  student_statuses: s.studentStatuses,
  type: s.type,
  topic: s.topic,
  notes: s.notes,
  price: s.price,
  is_trial: !!s.isTrial,
  teacher_id: s.teacherId ?? null
});

const toTeacher = (r: TeacherRow): Teacher => ({
  id: r.id,
  name: r.name,
  email: r.email ?? undefined,
  phone: r.phone ?? undefined,
  notes: r.notes ?? '',
  joinedDate: r.joined_date,
  status: r.status
});

const fromTeacher = (t: Teacher) => ({
  id: t.id,
  name: t.name,
  email: t.email ?? null,
  phone: t.phone ?? null,
  notes: t.notes,
  joined_date: t.joinedDate,
  status: t.status
});

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  studentId: r.student_id,
  amount: Number(r.amount) || 0,
  date: r.date,
  method: r.method,
  classCount: r.class_count == null ? undefined : Number(r.class_count),
  classType: r.class_type ? toClassType(r.class_type) : undefined
});

const fromPayment = (p: Payment) => ({
  id: p.id,
  student_id: p.studentId,
  amount: p.amount,
  date: p.date,
  method: p.method,
  class_count: p.classCount == null ? null : p.classCount,
  class_type: p.classType ?? null
});

export async function fetchAll() {
  const [s, ss, p, t] = await Promise.all([
    supabase.from('students').select('*').order('joined_date', { ascending: false }),
    supabase.from('sessions').select('*').order('date', { ascending: false }),
    supabase.from('payments').select('*').order('date', { ascending: false }),
    supabase.from('teachers').select('*').order('joined_date', { ascending: false })
  ]);
  if (s.error) throw s.error;
  if (ss.error) throw ss.error;
  if (p.error) throw p.error;
  if (t.error) throw t.error;
  return {
    students: (s.data as StudentRow[]).map(toStudent),
    sessions: (ss.data as SessionRow[]).map(toSession),
    payments: (p.data as PaymentRow[]).map(toPayment),
    teachers: (t.data as TeacherRow[]).map(toTeacher)
  };
}

export const upsertStudent = (s: Student) =>
  supabase.from('students').upsert(fromStudent(s)).then(r => { if (r.error) throw r.error; });

export const deleteStudent = (id: string) =>
  supabase.from('students').delete().eq('id', id).then(r => { if (r.error) throw r.error; });

export const upsertSession = (s: Session) =>
  supabase.from('sessions').upsert(fromSession(s)).then(r => { if (r.error) throw r.error; });

export const deleteSession = (id: string) =>
  supabase.from('sessions').delete().eq('id', id).then(r => { if (r.error) throw r.error; });

export const insertPayment = (p: Payment) =>
  supabase.from('payments').insert(fromPayment(p)).then(r => { if (r.error) throw r.error; });

export const updatePayment = (p: Payment) =>
  supabase.from('payments').update(fromPayment(p)).eq('id', p.id).then(r => { if (r.error) throw r.error; });

export const deletePayment = (id: string) =>
  supabase.from('payments').delete().eq('id', id).then(r => { if (r.error) throw r.error; });

export const upsertTeacher = (t: Teacher) =>
  supabase.from('teachers').upsert(fromTeacher(t)).then(r => { if (r.error) throw r.error; });

export const deleteTeacher = (id: string) =>
  supabase.from('teachers').delete().eq('id', id).then(r => { if (r.error) throw r.error; });

// ── Atomic RPC wrappers ─────────────────────────────────────────────────────
// These call Postgres functions defined in supabase/migrations/0001_rpc.sql.
// They guarantee that session + balance / payment + balance changes happen in
// a single transaction; partial failures roll back instead of corrupting state.

export type RpcSessionResult = {
  session: Session;
  students: Student[];
};

const parseSessionResult = (data: unknown): RpcSessionResult => {
  const raw = data as { session?: SessionRow; students?: StudentRow[] } | null;
  if (!raw || !raw.session) throw new Error('RPC returned no session');
  return {
    session: toSession(raw.session),
    students: (raw.students ?? []).map(toStudent)
  };
};

export const rpcSaveSession = async (session: Session): Promise<RpcSessionResult> => {
  const { data, error } = await supabase.rpc('save_session', { p_session: fromSession(session) });
  if (error) throw error;
  return parseSessionResult(data);
};

export const rpcDeleteSession = async (sessionId: string): Promise<{ students: Student[] }> => {
  const { data, error } = await supabase.rpc('delete_session', { p_session_id: sessionId });
  if (error) throw error;
  const raw = data as { students?: StudentRow[] } | null;
  return { students: (raw?.students ?? []).map(toStudent) };
};

export type RpcPaymentResult = {
  payment: Payment;
  student: Student;
};

const parsePaymentResult = (data: unknown): RpcPaymentResult => {
  const raw = data as { payment?: PaymentRow; student?: StudentRow } | null;
  if (!raw || !raw.payment || !raw.student) throw new Error('RPC returned incomplete payment');
  return {
    payment: toPayment(raw.payment),
    student: toStudent(raw.student)
  };
};

export const rpcRecordPayment = async (payment: Payment): Promise<RpcPaymentResult> => {
  const { data, error } = await supabase.rpc('record_payment', { p_payment: fromPayment(payment) });
  if (error) throw error;
  return parsePaymentResult(data);
};

export const rpcUpdatePayment = async (payment: Payment): Promise<RpcPaymentResult> => {
  const { data, error } = await supabase.rpc('update_payment', { p_payment: fromPayment(payment) });
  if (error) throw error;
  return parsePaymentResult(data);
};

export const rpcDeletePayment = async (paymentId: string): Promise<{ student: Student | null }> => {
  const { data, error } = await supabase.rpc('delete_payment', { p_payment_id: paymentId });
  if (error) throw error;
  const raw = data as { student?: StudentRow } | null;
  return { student: raw?.student ? toStudent(raw.student) : null };
};

export const rpcDeleteTeacher = async (teacherId: string): Promise<{ sessions: Session[] }> => {
  const { data, error } = await supabase.rpc('delete_teacher', { p_teacher_id: teacherId });
  if (error) throw error;
  const raw = data as { sessions?: SessionRow[] } | null;
  return { sessions: (raw?.sessions ?? []).map(toSession) };
};
