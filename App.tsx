import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Calendar, Menu, X, BookOpen } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import SessionLog from './components/SessionLog';
import StudentDetail from './components/StudentDetail';
import { TabItem, Student, Session, Payment, AttendanceStatus } from './types';
import {
  fetchAll,
  upsertStudent as dbUpsertStudent,
  deleteStudent as dbDeleteStudent,
  upsertSession as dbUpsertSession,
  deleteSession as dbDeleteSession,
  insertPayment as dbInsertPayment
} from './services/supabaseClient';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financialOffset, setFinancialOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
          <div className="bg-coral-600 rounded-xl p-4 text-white">
            <p className="text-xs font-medium text-coral-100 mb-1">Pro Tip</p>
            <p className="text-sm leading-snug">Use the AI Assistant in Calendar to plan your next class instantly!</p>
          </div>
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
            financialOffset={financialOffset}
            onUpdateOffset={setFinancialOffset}
          />
        )}

        {activeTab === 'students' && (
          <StudentList
            students={students}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onSelectStudent={setSelectedStudent}
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
