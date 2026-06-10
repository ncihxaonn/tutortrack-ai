import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutDashboard, Users, Calendar, Menu, X, BookOpen, GraduationCap, Lock, LogOut } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Admin from './components/Admin';
import AdminGate, { isAdminAuthenticated, lockAdmin } from './components/AdminGate';
import StudentList from './components/StudentList';
import SessionLog from './components/SessionLog';
import StudentDetail from './components/StudentDetail';
import TeacherList from './components/TeacherList';
import LoginPage from './components/LoginPage';
import { TabItem, Student, Session, Payment, Teacher } from './types';
import { Currency, BASE_CURRENCY, fetchRate } from './lib/currency';
import { newId, todayLocalKey } from './lib/dateUtils';
import { AuthProvider, useAuth } from './lib/authContext';
import {
  fetchAll,
  upsertStudent as dbUpsertStudent,
  deleteStudent as dbDeleteStudent,
  upsertTeacher as dbUpsertTeacher,
  rpcSaveSession,
  rpcDeleteSession,
  rpcRecordPayment,
  rpcUpdatePayment,
  rpcDeletePayment,
  rpcDeleteTeacher
} from './services/supabaseClient';

const App: React.FC = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

const AppShell: React.FC = () => {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-stone-500">Loading…</div>;
  }
  if (!session) return <LoginPage />;
  return <AppInner />;
};

const AppInner: React.FC = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // Mirrors of state, kept in sync so event handlers don't read stale closures.
  const studentsRef = useRef<Student[]>([]);
  const sessionsRef = useRef<Session[]>([]);
  const paymentsRef = useRef<Payment[]>([]);
  const teachersRef = useRef<Teacher[]>([]);

  const commitStudents = useCallback((next: Student[]) => {
    studentsRef.current = next;
    setStudents(next);
  }, []);
  const commitSessions = useCallback((next: Session[]) => {
    sessionsRef.current = next;
    setSessions(next);
  }, []);
  const commitPayments = useCallback((next: Payment[]) => {
    paymentsRef.current = next;
    setPayments(next);
  }, []);
  const commitTeachers = useCallback((next: Teacher[]) => {
    teachersRef.current = next;
    setTeachers(next);
  }, []);

  useEffect(() => { studentsRef.current = students; }, [students]);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  useEffect(() => { paymentsRef.current = payments; }, [payments]);
  useEffect(() => { teachersRef.current = teachers; }, [teachers]);

  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(isAdminAuthenticated);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Helper: surface any async failure as a banner so silent corruption doesn't happen.
  const withSync = useCallback(async <T,>(label: string, op: () => PromiseLike<T>): Promise<T> => {
    try {
      setSyncError(null);
      return await op();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncError(`${label} failed: ${msg}`);
      throw e;
    }
  }, []);

  const [currency, setCurrency] = useState<Currency>(BASE_CURRENCY);
  const [rate, setRate] = useState<number>(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateFetchedAt, setRateFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetchAll()
      .then(({ students, sessions, payments, teachers }) => {
        commitStudents(students);
        commitSessions(sessions);
        commitPayments(payments);
        commitTeachers(teachers);
      })
      .catch(e => {
        const msg = e instanceof Error ? e.message : String(e);
        setLoadError(msg || 'Failed to load data');
      })
      .finally(() => setLoading(false));
  }, [commitStudents, commitSessions, commitPayments, commitTeachers]);

  useEffect(() => {
    if (currency === BASE_CURRENCY) {
      setRate(1);
      setRateError(null);
      return;
    }
    let cancelled = false;
    setRateLoading(true);
    setRateError(null);
    fetchRate(BASE_CURRENCY, currency)
      .then(r => {
        if (cancelled) return;
        setRate(r);
        setRateFetchedAt(new Date());
      })
      .catch(e => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setRateError(msg || 'Failed to fetch rate');
        // Invalidate the rate so formatMoney falls back to base-currency display
        // rather than mislabeling CNY amounts with a stale/1.0 rate as AUD.
        setRate(NaN);
        setRateFetchedAt(null);
      })
      .finally(() => {
        if (!cancelled) setRateLoading(false);
      });
    return () => { cancelled = true; };
  }, [currency]);

  const toggleCurrency = () => setCurrency(prev => prev === 'CNY' ? 'AUD' : 'CNY');

  const tabs: TabItem[] = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'teachers', label: 'Teachers', icon: GraduationCap },
    { id: 'sessions', label: 'Calendar', icon: Calendar },
    { id: 'admin', label: 'Admin', icon: Lock }
  ], []);

  // ── Helpers ────────────────────────────────────────────────────────────
  // Apply a list of (possibly partial) student rows returned by an RPC into
  // local state — keeping the ref in sync so subsequent calls compose.
  const mergeStudents = (incoming: Student[]) => {
    if (incoming.length === 0) return;
    const incomingMap = new Map<string, Student>();
    incoming.forEach(s => incomingMap.set(s.id, s));
    const next = studentsRef.current.map(s => incomingMap.get(s.id) ?? s);
    commitStudents(next);
    // Functional update so an open StudentDetail panel always refreshes with the
    // RPC-returned row. Reading `selectedStudent` directly here captured the
    // first-render value (null) inside the memoized handlers, so the panel never
    // updated after a payment/session change and could then write a stale balance back.
    setSelectedStudent(prev => (prev && incomingMap.has(prev.id) ? incomingMap.get(prev.id)! : prev));
  };

  // ── Students ──────────────────────────────────────────────────────────
  const handleAddStudent = useCallback(async (
    newStudentData: Omit<Student, 'id' | 'joinedDate' | 'status'>,
    initialPayments?: { amount: number; label: string; classCount?: number; classType?: Student['classTypes'][number] }[]
  ) => {
    const newStudent: Student = {
      ...newStudentData,
      id: newId('s'),
      joinedDate: new Date().toISOString(),
      status: 'Active',
      // Balance is owned by the payment RPCs — never seed it from form input.
      balance: 0
    };
    await withSync('Add student', () => dbUpsertStudent(newStudent));
    commitStudents([...studentsRef.current, newStudent]);

    // Record each initial payment via the atomic RPC so the balance + payment
    // land together. We don't need to roll back the student create since RLS
    // would have failed it earlier if the user weren't allowed.
    if (initialPayments && initialPayments.length > 0) {
      for (const ip of initialPayments) {
        const payment: Payment = {
          id: newId('p'),
          studentId: newStudent.id,
          amount: ip.amount,
          date: newStudent.joinedDate,
          method: ip.label,
          classCount: ip.classCount,
          classType: ip.classType
        };
        const { payment: saved, student } = await withSync('Record initial payment', () => rpcRecordPayment(payment));
        commitPayments([...paymentsRef.current, saved]);
        mergeStudents([student]);
      }
    }
  }, [commitStudents, commitPayments, withSync]);

  const handleUpdateStudent = useCallback(async (updated: Student) => {
    await withSync('Update student', () => dbUpsertStudent(updated));
    // Balance is owned exclusively by the payment/session RPCs. A profile, package,
    // or progress edit must never write balance — neither to the DB (fromStudent
    // omits it) nor to local state here, where `updated` may carry a stale value.
    const prevBalance = studentsRef.current.find(s => s.id === updated.id)?.balance;
    const merged: Student = prevBalance == null ? updated : { ...updated, balance: prevBalance };
    commitStudents(studentsRef.current.map(s => s.id === merged.id ? merged : s));
    setSelectedStudent(prev => (prev && prev.id === merged.id ? merged : prev));
  }, [commitStudents, withSync]);

  const handleDeleteStudent = useCallback(async (id: string) => {
    await withSync('Delete student', () => dbDeleteStudent(id));
    commitStudents(studentsRef.current.filter(s => s.id !== id));
    if (selectedStudent?.id === id) setSelectedStudent(null);
  }, [commitStudents, withSync, selectedStudent]);

  // ── Sessions (atomic via RPC) ────────────────────────────────────────
  const handleAddSession = useCallback(async (data: Omit<Session, 'id'>): Promise<Session> => {
    const newSession: Session = { ...data, id: newId('sess') };
    const { session, students: affected } = await withSync('Add session', () => rpcSaveSession(newSession));
    commitSessions([...sessionsRef.current, session]);
    mergeStudents(affected);
    return session;
  }, [commitSessions, withSync]);

  const handleUpdateSession = useCallback(async (updated: Session) => {
    const { session, students: affected } = await withSync('Update session', () => rpcSaveSession(updated));
    commitSessions(sessionsRef.current.map(s => s.id === session.id ? session : s));
    mergeStudents(affected);
  }, [commitSessions, withSync]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const { students: affected } = await withSync('Delete session', () => rpcDeleteSession(sessionId));
    commitSessions(sessionsRef.current.filter(s => s.id !== sessionId));
    mergeStudents(affected);
  }, [commitSessions, withSync]);

  // ── Payments (atomic via RPC) ────────────────────────────────────────
  const handlePayment = useCallback(async (studentId: string, amount: number, extras?: Partial<Payment>) => {
    const payment: Payment = {
      id: newId('p'),
      studentId,
      amount,
      date: extras?.date || new Date().toISOString(),
      method: extras?.method || 'Manual',
      classCount: extras?.classCount,
      classType: extras?.classType
    };
    const { payment: saved, student } = await withSync('Save payment', () => rpcRecordPayment(payment));
    commitPayments([...paymentsRef.current, saved]);
    mergeStudents([student]);
  }, [commitPayments, withSync]);

  const handleUpdatePayment = useCallback(async (updated: Payment) => {
    const { payment: saved, students } = await withSync('Update payment', () => rpcUpdatePayment(updated));
    commitPayments(paymentsRef.current.map(p => p.id === saved.id ? saved : p));
    mergeStudents(students);
  }, [commitPayments, withSync]);

  const handleDeletePayment = useCallback(async (id: string) => {
    const { student } = await withSync('Delete payment', () => rpcDeletePayment(id));
    commitPayments(paymentsRef.current.filter(p => p.id !== id));
    if (student) mergeStudents([student]);
  }, [commitPayments, withSync]);

  // ── Teachers ─────────────────────────────────────────────────────────
  const handleAddTeacher = useCallback(async (data: Omit<Teacher, 'id' | 'joinedDate' | 'status'>) => {
    const newTeacher: Teacher = {
      ...data,
      id: newId('t'),
      // Local date key, not toISOString().slice(0,10) (which is UTC and lands on
      // the wrong day before ~8–10am local in CN/AU timezones).
      joinedDate: todayLocalKey(),
      status: 'Active'
    };
    await withSync('Add teacher', () => dbUpsertTeacher(newTeacher));
    commitTeachers([...teachersRef.current, newTeacher]);
  }, [commitTeachers, withSync]);

  const handleUpdateTeacher = useCallback(async (t: Teacher) => {
    await withSync('Update teacher', () => dbUpsertTeacher(t));
    commitTeachers(teachersRef.current.map(x => x.id === t.id ? t : x));
  }, [commitTeachers, withSync]);

  const handleDeleteTeacher = useCallback(async (id: string) => {
    // RPC cascades: deletes the teacher row and nulls out teacher_id on related
    // sessions in one transaction; returns the affected sessions for us to reflect locally.
    const { sessions: affected } = await withSync('Delete teacher', () => rpcDeleteTeacher(id));
    commitTeachers(teachersRef.current.filter(t => t.id !== id));
    if (affected.length > 0) {
      const affectedMap = new Map(affected.map(s => [s.id, s] as const));
      commitSessions(sessionsRef.current.map(s => affectedMap.get(s.id) ?? s));
    }
  }, [commitTeachers, commitSessions, withSync]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-stone-500">Loading…</div>;
  }
  if (loadError) {
    return <div className="flex items-center justify-center min-h-screen text-red-600 p-8 text-center">Failed to load: {loadError}</div>;
  }

  const handleSignOut = async () => {
    await signOut();
    lockAdmin();
    setAdminUnlocked(false);
  };

  return (
    <div className="flex min-h-screen bg-cream text-stone-900 font-sans">
      {syncError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[90%] bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-start gap-3">
          <div className="flex-1 text-sm">
            <p className="font-semibold">Sync error — your change didn't save</p>
            <p className="text-xs mt-0.5 break-words">{syncError}</p>
          </div>
          <button
            onClick={() => setSyncError(null)}
            className="text-red-400 hover:text-red-600 text-xl leading-none"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-cream-border fixed h-full z-10">
        <div className="p-6 border-b border-cream-border flex items-center gap-2">
          <div className="bg-coral-600 p-2 rounded-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-2xl font-semibold text-stone-900 tracking-tight">
            TutorTrack
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-coral-50 text-coral-700 shadow-sm ring-1 ring-coral-200'
                    : 'text-stone-500 hover:bg-cream hover:text-stone-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-coral-600' : 'text-stone-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-cream-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-500 hover:text-stone-900 hover:bg-cream rounded-lg"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-cream-border z-20 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-coral-600 p-1.5 rounded-md">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif text-xl font-semibold text-stone-900 tracking-tight">TutorTrack</span>
        </div>
        <button aria-label="Toggle menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6 text-stone-600" /> : <Menu className="w-6 h-6 text-stone-600" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white z-10 pt-16 px-4">
          <nav className="space-y-2 mt-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-4 text-base font-medium rounded-xl transition-colors ${
                    activeTab === tab.id
                      ? 'bg-coral-50 text-coral-700'
                      : 'text-stone-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-4 text-base font-medium rounded-xl text-stone-500 hover:bg-cream"
            >
              <LogOut className="w-5 h-5" /> Sign out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8 max-w-7xl mx-auto w-full">
        <header className="mb-8">
          <h1 className="font-serif text-4xl font-semibold text-stone-900 tracking-tight">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>
          <p className="text-stone-500 text-sm mt-2">Manage your students and sessions effectively.</p>
        </header>

        {activeTab === 'dashboard' && (
          <Dashboard students={students} sessions={sessions} />
        )}

        {activeTab === 'admin' && (
          adminUnlocked ? (
            <Admin
              students={students}
              payments={payments}
              onUpdatePayment={handleUpdatePayment}
              onDeletePayment={handleDeletePayment}
              currency={currency}
              rate={rate}
              rateLoading={rateLoading}
              rateError={rateError}
              rateFetchedAt={rateFetchedAt}
              onToggleCurrency={toggleCurrency}
              onLock={() => setAdminUnlocked(false)}
            />
          ) : (
            <AdminGate onUnlock={() => setAdminUnlocked(true)} />
          )
        )}

        {activeTab === 'students' && (
          <StudentList
            students={students}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onSelectStudent={setSelectedStudent}
            currency={currency}
            rate={rate}
          />
        )}

        {activeTab === 'teachers' && (
          <TeacherList
            teachers={teachers}
            sessions={sessions}
            onAddTeacher={handleAddTeacher}
            onUpdateTeacher={handleUpdateTeacher}
            onDeleteTeacher={handleDeleteTeacher}
          />
        )}

        {activeTab === 'sessions' && (
          <SessionLog
            sessions={sessions}
            students={students}
            teachers={teachers}
            onAddSession={handleAddSession}
            onUpdateSession={handleUpdateSession}
            onDeleteSession={handleDeleteSession}
            onUpdateStudent={handleUpdateStudent}
            onSelectStudent={(s) => { setSelectedStudent(s); }}
          />
        )}
      </main>

      {selectedStudent && (
        <StudentDetail
          student={selectedStudent}
          sessions={sessions}
          payments={payments}
          onClose={() => setSelectedStudent(null)}
          onUpdatePayment={handlePayment}
          onUpdateStudent={handleUpdateStudent}
          onUpdateSession={handleUpdateSession}
          onDeleteSession={handleDeleteSession}
          onSavePayment={handleUpdatePayment}
          onDeletePayment={handleDeletePayment}
          currency={currency}
          rate={rate}
        />
      )}
    </div>
  );
};

export default App;
