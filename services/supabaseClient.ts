import { createClient } from '@supabase/supabase-js';
import { Student, Session, Payment, ClassType } from '../types';

const url = process.env.SUPABASE_URL as string;
const key = process.env.SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: false }
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
};

type PaymentRow = {
  id: string;
  student_id: string;
  amount: number;
  date: string;
  method: string;
};

const toStudent = (r: StudentRow): Student => ({
  id: r.id,
  name: r.name,
  classTypes: (r.class_types || []) as ClassType[],
  email: r.email ?? undefined,
  parentName: r.parent_name ?? undefined,
  notes: r.notes ?? '',
  balance: Number(r.balance) || 0,
  joinedDate: r.joined_date,
  status: r.status,
  packages: r.packages || [],
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
  status: r.status,
  studentStatuses: r.student_statuses || [],
  type: r.type as ClassType,
  topic: r.topic,
  notes: r.notes,
  price: Number(r.price) || 0
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
  price: s.price
});

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  studentId: r.student_id,
  amount: Number(r.amount) || 0,
  date: r.date,
  method: r.method
});

const fromPayment = (p: Payment) => ({
  id: p.id,
  student_id: p.studentId,
  amount: p.amount,
  date: p.date,
  method: p.method
});

export async function fetchAll() {
  const [s, ss, p] = await Promise.all([
    supabase.from('students').select('*'),
    supabase.from('sessions').select('*'),
    supabase.from('payments').select('*')
  ]);
  if (s.error) throw s.error;
  if (ss.error) throw ss.error;
  if (p.error) throw p.error;
  return {
    students: (s.data as StudentRow[]).map(toStudent),
    sessions: (ss.data as SessionRow[]).map(toSession),
    payments: (p.data as PaymentRow[]).map(toPayment)
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
