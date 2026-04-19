import React, { useState } from 'react';
import { LayoutDashboard, Users, Calendar, Menu, X, BookOpen } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StudentList from './components/StudentList';
import SessionLog from './components/SessionLog';
import StudentDetail from './components/StudentDetail';
import { TabItem, Student, Session, Payment, AttendanceStatus } from './types';
import { INITIAL_STUDENTS, INITIAL_SESSIONS, INITIAL_PAYMENTS } from './constants';

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Data State
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
  const [financialOffset, setFinancialOffset] = useState(0);

  // Tabs Configuration
  const tabs: TabItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'sessions', label: 'Calendar', icon: Calendar },
  ];

  // Actions
  const handleAddStudent = (newStudentData: Omit<Student, 'id' | 'joinedDate' | 'status'>) => {
    const newStudent: Student = {
      ...newStudentData,
      id: `s${Date.now()}`,
      joinedDate: new Date().toISOString(),
      status: 'Active'
    };
    setStudents(prev => [...prev, newStudent]);
  };

  const handleUpdateStudent = (updatedStudent: Student) => {
    setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    if (selectedStudent?.id === updatedStudent.id) {
        setSelectedStudent(updatedStudent);
    }
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    if (selectedStudent?.id === id) setSelectedStudent(null);
  };

  const handleAddSession = (newSessionData: Omit<Session, 'id'>) => {
    const newSession: Session = {
      ...newSessionData,
      id: `sess${Date.now()}`
    };
    setSessions(prev => [...prev, newSession]);
    updateBalancesForSession(newSession, 'add');
  };

  const handleUpdateSession = (updatedSession: Session) => {
    const oldSession = sessions.find(s => s.id === updatedSession.id);
    if (oldSession) {
        updateBalancesForSession(oldSession, 'remove');
    }
    
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
    updateBalancesForSession(updatedSession, 'add');
  };

  const handleDeleteSession = (sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
          updateBalancesForSession(session, 'remove');
          setSessions(prev => prev.filter(s => s.id !== sessionId));
      }
  };

  const updateBalancesForSession = (session: Session, action: 'add' | 'remove') => {
    const multiplier = action === 'add' ? 1 : -1;
    setStudents(prevStudents => {
        return prevStudents.map(student => {
            // Check if this student is in the session
            if (session.studentIds.includes(student.id)) {
              // Find the specific status for this student
              const statusObj = session.studentStatuses?.find(s => s.studentId === student.id);
              const status = statusObj ? statusObj.status : session.status; // Fallback to main status if missing

              const cost = session.price / session.studentIds.length;
              
              // Logic: Charge if Present or Late. 
              // Modify this if you want to charge for Absent/Cancelled as well.
              if (status === AttendanceStatus.Present || status === AttendanceStatus.Late) {
                  return { ...student, balance: student.balance + (cost * multiplier) };
              }
            }
            return student;
        });
    });
  };

  const handlePayment = (studentId: string, amount: number) => {
    const newPayment: Payment = {
        id: `p${Date.now()}`,
        studentId,
        amount,
        date: new Date().toISOString(),
        method: 'Manual'
    };
    setPayments(prev => [...prev, newPayment]);

    // Update student balance (decrease balance)
    setStudents(prev => {
        const updated = prev.map(s => 
            s.id === studentId ? { ...s, balance: s.balance - amount } : s
        );
        if (selectedStudent?.id === studentId) {
            const s = updated.find(s => s.id === studentId);
            if (s) setSelectedStudent(s);
        }
        return updated;
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-10">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <BookOpen className="w-5 h-5 text-white" />
            </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
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
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="bg-indigo-600 rounded-xl p-4 text-white">
            <p className="text-xs font-medium text-indigo-200 mb-1">Pro Tip</p>
            <p className="text-sm leading-snug">Use the AI Assistant in Calendar to plan your next class instantly!</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-20 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-md">
                <BookOpen className="w-4 h-4 text-white" />
            </div>
          <span className="font-bold text-lg text-slate-800">TutorTrack</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6 text-slate-600" /> : <Menu className="w-6 h-6 text-slate-600" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
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
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500'
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

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 pt-20 md:pt-8 px-4 md:px-8 pb-8 max-w-7xl mx-auto w-full">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage your students and sessions effectively.</p>
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
            onSelectStudent={(s) => {
                setSelectedStudent(s);
            }}
          />
        )}
      </main>

      {/* Student Detail Modal */}
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