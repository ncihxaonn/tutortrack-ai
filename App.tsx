import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Calendar, Menu, X, BookOpen, Loader2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import SessionLog from './components/SessionLog';
import StudentDetail from './components/StudentDetail';
import { TabItem, Student, Session, Payment, AttendanceStatus } from './types';
import { Currency, BASE_CURRENCY, fetchRate, CURRENCY_LABELS } from './lib/currency';
import {
  fetchAll,
  upsertStudent as dbUpsertStudent,
  deleteStudent as dbDeleteStudent,
  upsertSession as dbUpsertSession,
  deleteSession as dbDeleteSession,
  insertPayment as dbInsertPayment,
  updatePayment as dbUpdatePayment,
  deletePayment as dbDeletePayment
} from './services/supabaseClient';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Currency display: base is CNY; toggle to AUD using a live exchange rate.
  const [currency, setCurrency] = useState<Currency>(BASE_CURRENCY);
  const [rate, setRate] = useState<number>(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateFetchedAt, setRateFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetchAll()
      .then(({ students, sessions, payments }) => {
        setStudents(students);
        setSessions(sessions);
        setPayments(payments);
      })
      .catch(e => setLoadError(e.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

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
        setRateError(e.message ?? 'Failed to fetch rate');
      })
      .finally(() => {
        if (!cancelled) setRateLoading(false);
      });
    return () => { cancelled = true; };
  }, [currency]);

  const toggleCurrency = () => {
    setCurrency(prev => prev === 'CNY' ? 'AUD' : 'CNY');
  };

  const tabs: TabItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'sessions', label: 'Calendar', icon: Calendar },
  ];

  const handleAddStudent = async (newStudentData: Omit<Student, 'id' | 'joinedDate' | 'status'>) => {
    const newStudent: Student = {
      ...newStudentData,
      id: `s${Date.now()}`,
      joinedDate: new Date().toISOString(),
      status: 'Active'
    };
    await dbUpsertStudent(newStudent);
    setStudents(prev => [...prev, newStudent]);
  };

  const handleUpdateStudent = async (updatedStudent: Student) => {
    await dbUpsertStudent(updatedStudent);
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    if (selectedStudent?.id === updatedStudent.id) {
      setSelectedStudent(updatedStudent);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    await dbDeleteStudent(id);
    setStudents(prev => prev.filter(s => s.id !== id));
    if (selectedStudent?.id === id) setSelectedStudent(null);
  };

  const applyBalanceChanges = async (session: Session, action: 'add' | 'remove') => {
    if (session.isTrial) return;
    const multiplier = action === 'add' ? 1 : -1;
    const updates: Student[] = [];
    const nextStudents = students.map(student => {
      if (!session.studentIds.includes(student.id)) return student;
      const statusObj = session.studentStatuses?.find(s => s.studentId === student.id);
      const status = statusObj ? statusObj.status : session.status;
      const cost = session.price / session.studentIds.length;
      if (status === AttendanceStatus.Present || status === AttendanceStatus.Late) {
        const updated = { ...student, balance: student.balance + (cost * multiplier) };
        updates.push(updated);
        return updated;
      }
      return student;
    });
    setStudents(nextStudents);
    await Promise.all(updates.map(dbUpsertStudent));
  };

  const handleAddSession = async (newSessionData: Omit<Session, 'id'>) => {
    const newSession: Session = { ...newSessionData, id: `sess${Date.now()}` };
    await dbUpsertSession(newSession);
    setSessions(prev => [...prev, newSession]);
    await applyBalanceChanges(newSession, 'add');
  };

  const handleUpdateSession = async (updatedSession: Session) => {
    const oldSession = sessions.find(s => s.id === updatedSession.id);
    if (oldSession) await applyBalanceChanges(oldSession, 'remove');
    await dbUpsertSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
    await applyBalanceChanges(updatedSession, 'add');
  };

  const handleDeleteSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    await applyBalanceChanges(session, 'remove');
    await dbDeleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handlePayment = async (studentId: string, amount: number) => {
    const newPayment: Payment = {
      id: `p${Date.now()}`,
      studentId,
      amount,
      date: new Date().toISOString(),
      method: 'Manual'
    };
    const target = students.find(s => s.id === studentId);
    if (!target) return;
    const updatedStudent = { ...target, balance: target.balance - amount };
    await dbInsertPayment(newPayment);
    await dbUpsertStudent(updatedStudent);
    setPayments(prev => [...prev, newPayment]);
    setStudents(prev => prev.map(s => s.id === studentId ? updatedStudent : s));
    if (selectedStudent?.id === studentId) setSelectedStudent(updatedStudent);
  };

  const handleUpdatePayment = async (updated: Payment) => {
    const original = payments.find(p => p.id === updated.id);
    if (!original) return;
    await dbUpdatePayment(updated);
    setPayments(prev => prev.map(p => p.id === updated.id ? updated : p));
    if (original.amount !== updated.amount || original.studentId !== updated.studentId) {
      const delta = updated.amount - original.amount;
      const nextStudents = students.map(s => {
        if (s.id === original.studentId && s.id === updated.studentId) {
          return { ...s, balance: s.balance - delta };
        }
        if (s.id === original.studentId) return { ...s, balance: s.balance + original.amount };
        if (s.id === updated.studentId) return { ...s, balance: s.balance - updated.amount };
        return s;
      });
      const changed = nextStudents.filter((s, i) => s !== students[i]);
      setStudents(nextStudents);
      await Promise.all(changed.map(dbUpsertStudent));
      if (selectedStudent) {
        const refreshed = nextStudents.find(s => s.id === selectedStudent.id);
        if (refreshed) setSelectedStudent(refreshed);
      }
    }
  };

  const handleDeletePayment = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;
    await dbDeletePayment(id);
    setPayments(prev => prev.filter(p => p.id !== id));
    const target = students.find(s => s.id === payment.studentId);
    if (target) {
      const restored = { ...target, balance: target.balance + payment.amount };
      await dbUpsertStudent(restored);
      setStudents(prev => prev.map(s => s.id === restored.id ? restored : s));
      if (selectedStudent?.id === restored.id) setSelectedStudent(restored);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-stone-500">Loading…</div>;
  }
  if (loadError) {
    return <div className="flex items-center justify-center min-h-screen text-red-600 p-8 text-center">Failed to load: {loadError}</div>;
  }

  return (
    <div className="flex min-h-screen bg-cream text-stone-900 font-sans">
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
          <p className="text-[10px] uppercase font-semibold text-stone-400 mb-2 tracking-wider">Currency</p>
          <button
            onClick={toggleCurrency}
            disabled={rateLoading}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-cream border border-cream-border hover:border-coral-200 hover:bg-coral-50 transition-colors text-sm font-medium text-stone-700 disabled:opacity-60"
            title={currency === 'CNY' ? 'Switch to Australian Dollar' : 'Switch to Chinese Yuan'}
          >
            <span className="flex items-center gap-2">
              <span className={`inline-block w-7 text-center rounded text-xs px-1 py-0.5 ${currency === 'CNY' ? 'bg-coral-600 text-white' : 'bg-stone-200 text-stone-600'}`}>¥</span>
              <span>/</span>
              <span className={`inline-block w-7 text-center rounded text-xs px-1 py-0.5 ${currency === 'AUD' ? 'bg-coral-600 text-white' : 'bg-stone-200 text-stone-600'}`}>A$</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-stone-500">
              {rateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : CURRENCY_LABELS[currency]}
            </span>
          </button>
          {currency !== BASE_CURRENCY && !rateLoading && !rateError && (
            <p className="text-[10px] text-stone-400 mt-1.5 leading-tight">
              ¥1 = A${rate.toFixed(4)}
              {rateFetchedAt && <> · {rateFetchedAt.toLocaleDateString()}</>}
            </p>
          )}
          {rateError && (
            <p className="text-[10px] text-red-500 mt-1.5 leading-tight">Rate unavailable: {rateError}</p>
          )}
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-cream-border z-20 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-coral-600 p-1.5 rounded-md">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-serif text-xl font-semibold text-stone-900 tracking-tight">TutorTrack</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
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
              onClick={toggleCurrency}
              disabled={rateLoading}
              className="w-full flex items-center justify-between gap-3 px-4 py-4 text-base font-medium rounded-xl bg-cream border border-cream-border"
            >
              <span className="flex items-center gap-2 text-stone-700">
                <span className={`inline-block w-8 text-center rounded text-sm px-1.5 py-0.5 ${currency === 'CNY' ? 'bg-coral-600 text-white' : 'bg-stone-200 text-stone-600'}`}>¥</span>
                <span>/</span>
                <span className={`inline-block w-8 text-center rounded text-sm px-1.5 py-0.5 ${currency === 'AUD' ? 'bg-coral-600 text-white' : 'bg-stone-200 text-stone-600'}`}>A$</span>
              </span>
              <span className="text-sm text-stone-500 flex items-center gap-1">
                {rateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : CURRENCY_LABELS[currency]}
              </span>
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
          <Dashboard
            students={students}
            sessions={sessions}
            payments={payments}
            onUpdatePayment={handleUpdatePayment}
            onDeletePayment={handleDeletePayment}
            currency={currency}
            rate={rate}
          />
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

        {activeTab === 'sessions' && (
          <SessionLog
            sessions={sessions}
            students={students}
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
        />
      )}
    </div>
  );
};

export default App;
