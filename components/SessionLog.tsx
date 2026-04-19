import React, { useState, useEffect } from 'react';
import { Session, Student, AttendanceStatus, ClassType, StudentSessionStatus, SkillProgress } from '../types';
import { Calendar as CalendarIcon, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, Sparkles, ChevronLeft, ChevronRight, X, Edit, Trash2, Search, ChevronDown, ChevronUp, MoreVertical, TrendingUp, LayoutGrid, List } from 'lucide-react';
import { generateLessonPlan } from '../services/geminiService';
import { PRICE_1ON1, PRICE_GROUP } from '../constants';

interface SessionLogProps {
  sessions: Session[];
  students: Student[];
  onAddSession: (session: Omit<Session, 'id'>) => void;
  onUpdateSession: (session: Session) => void;
  onDeleteSession: (id: string) => void;
  onUpdateStudent: (student: Student) => void; 
  onSelectStudent?: (student: Student) => void;
}

type ViewMode = 'year' | 'month' | 'week';

const SessionLog: React.FC<SessionLogProps> = ({ sessions, students, onAddSession, onUpdateSession, onDeleteSession, onUpdateStudent, onSelectStudent }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Form State
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<Record<string, AttendanceStatus>>({});
  
  const [date, setDate] = useState('');
  const [time, setTime] = useState('14:00');
  const [topic, setTopic] = useState('');
  const [sessionType, setSessionType] = useState<ClassType>(ClassType.OneOnOne);
  const [notes, setNotes] = useState('');
  
  // Progress Editing State
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [currentProgressStudentId, setCurrentProgressStudentId] = useState<string | null>(null);
  const [tempProgress, setTempProgress] = useState<Record<string, Partial<SkillProgress>>>({}); 

  // Dropdown UI State
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // AI State
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState('');

  // Filter students for dropdown
  const filteredStudents = students.filter(s => 
    s.status === 'Active' && 
    s.name.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Calendar Logic Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay, year, month };
  };

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  }

  // Navigation
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() - 1);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + 1);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getHeaderText = () => {
      if (viewMode === 'year') return currentDate.getFullYear().toString();
      if (viewMode === 'month') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (viewMode === 'week') {
          const start = getStartOfWeek(currentDate);
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          // Handle crossing months/years
          if (start.getMonth() === end.getMonth()) {
              return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
          }
          return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      return '';
  }

  const openAddModal = (dateStr?: string) => {
    resetForm();
    if (dateStr) {
        setDate(dateStr);
    } else {
        setDate(new Date().toISOString().split('T')[0]);
    }
    setEditingSessionId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (session: Session) => {
    setEditingSessionId(session.id);
    setSelectedStudents(session.studentIds);
    
    // Convert array of statuses to map for easy form handling
    const statusMap: Record<string, AttendanceStatus> = {};
    if (session.studentStatuses) {
        session.studentStatuses.forEach(s => statusMap[s.studentId] = s.status);
    } else {
        session.studentIds.forEach(id => statusMap[id] = session.status);
    }
    setStudentStatuses(statusMap);

    setDate(new Date(session.date).toISOString().split('T')[0]);
    setTime(new Date(session.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    setTopic(session.topic);
    setSessionType(session.type);
    setNotes(session.notes);
    setGeneratedPlan('');
    setTempProgress({});
    setIsModalOpen(true);
  };

  const handleStudentToggle = (id: string) => {
    let newSelected = [];
    if (selectedStudents.includes(id)) {
      newSelected = selectedStudents.filter(s => s !== id);
      const newStatuses = { ...studentStatuses };
      delete newStatuses[id];
      setStudentStatuses(newStatuses);
    } else {
      if (selectedStudents.length >= 2) return; 
      newSelected = [...selectedStudents, id];
      setStudentStatuses({ ...studentStatuses, [id]: AttendanceStatus.Present });
    }
    setSelectedStudents(newSelected);
    
    if (newSelected.length === 2) setSessionType(ClassType.Group);
    else if (newSelected.length === 1) setSessionType(ClassType.OneOnOne);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
      setStudentStatuses({ ...studentStatuses, [studentId]: status });
  }

  // --- Progress Handling ---

  const openProgressModal = (studentId: string) => {
      setCurrentProgressStudentId(studentId);
      
      if (tempProgress[studentId]) {
      } else {
          const s = students.find(st => st.id === studentId);
          const latest = s?.progressHistory && s.progressHistory.length > 0 
              ? s.progressHistory[s.progressHistory.length - 1]
              : { reading: 50, writing: 50, listening: 50, speaking: 50, notes: '' };
          
          setTempProgress(prev => ({
              ...prev,
              [studentId]: {
                  reading: latest.reading,
                  writing: latest.writing,
                  listening: latest.listening,
                  speaking: latest.speaking,
                  notes: '', 
              }
          }));
      }
      setProgressModalOpen(true);
  };

  const updateTempProgress = (field: keyof SkillProgress, value: any) => {
      if (!currentProgressStudentId) return;
      setTempProgress(prev => ({
          ...prev,
          [currentProgressStudentId]: {
              ...prev[currentProgressStudentId],
              [field]: value
          }
      }));
  };

  const handleGeneratePlan = async () => {
    if (!topic || selectedStudents.length === 0) return;
    setIsGeneratingPlan(true);
    const studentNames = students.filter(s => selectedStudents.includes(s.id)).map(s => s.name);
    const plan = await generateLessonPlan(topic, studentNames, 60);
    setGeneratedPlan(plan);
    setNotes(prev => prev + (prev ? '\n\n' : '') + "Lesson Plan: " + topic);
    setIsGeneratingPlan(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudents.length === 0) return;

    const pricePerStudent = sessionType === ClassType.OneOnOne ? PRICE_1ON1 : PRICE_GROUP;
    const totalPrice = pricePerStudent * selectedStudents.length;

    const studentStatusesArray: StudentSessionStatus[] = selectedStudents.map(id => ({
        studentId: id,
        status: studentStatuses[id] || AttendanceStatus.Present
    }));

    const overallStatus = AttendanceStatus.Present;

    const sessionData = {
      studentIds: selectedStudents,
      date: `${date}T${time}:00`,
      durationMinutes: 60,
      status: overallStatus,
      studentStatuses: studentStatusesArray,
      type: sessionType,
      topic,
      notes: generatedPlan ? `${notes}\n\n--- AI Plan ---\n${generatedPlan}` : notes,
      price: totalPrice
    };

    if (editingSessionId) {
        onUpdateSession({ ...sessionData, id: editingSessionId });
    } else {
        onAddSession(sessionData);
    }

    selectedStudents.forEach(stuId => {
        const pending = tempProgress[stuId];
        if (pending) {
            const student = students.find(s => s.id === stuId);
            if (student) {
                const newEntry: SkillProgress = {
                    id: `ph${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    date: date, 
                    reading: pending.reading || 50,
                    writing: pending.writing || 50,
                    listening: pending.listening || 50,
                    speaking: pending.speaking || 50,
                    notes: pending.notes || `Progress note from session: ${topic}`
                };
                
                const updatedHistory = [...(student.progressHistory || []), newEntry]
                    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                onUpdateStudent({
                    ...student,
                    progressHistory: updatedHistory
                });
            }
        }
    });

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (editingSessionId) {
        setSessionToDelete(editingSessionId);
    }
  }

  const confirmDeleteSession = () => {
    if (sessionToDelete) {
        onDeleteSession(sessionToDelete);
        setSessionToDelete(null);
        setIsModalOpen(false);
    }
  }

  const resetForm = () => {
    setSelectedStudents([]);
    setStudentStatuses({});
    setTopic('');
    setNotes('');
    setGeneratedPlan('');
    setSessionType(ClassType.OneOnOne);
    setEditingSessionId(null);
    setStudentSearch('');
    setIsStudentDropdownOpen(false);
    setTempProgress({});
    setCurrentProgressStudentId(null);
  };

  // --- Renderers ---

  const renderMonthView = () => {
    const { days, firstDay, year, month } = getDaysInMonth(currentDate);
    const blanks = Array(firstDay).fill(null);
    const daySlots = Array.from({ length: days }, (_, i) => i + 1);
    const allSlots = [...blanks, ...daySlots];

    return (
        <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-lg overflow-hidden border border-cream-border animate-in fade-in">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="bg-cream p-2 text-center text-xs font-semibold text-stone-500 uppercase">
                    {d}
                </div>
            ))}
            {allSlots.map((day, index) => {
                if (!day) return <div key={`blank-${index}`} className="bg-white h-32 md:h-40" />;
                
                const currentDayStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const daySessions = sessions.filter(s => s.date.startsWith(currentDayStr));

                return (
                    <div 
                        key={day} 
                        onClick={() => openAddModal(currentDayStr)}
                        className="bg-white h-32 md:h-40 p-2 border-t border-slate-50 hover:bg-cream transition-colors cursor-pointer overflow-y-auto"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm font-semibold ${
                                new Date().toDateString() === new Date(year, month, day as number).toDateString() 
                                ? 'bg-coral-600 text-white w-6 h-6 flex items-center justify-center rounded-full' 
                                : 'text-stone-700'
                            }`}>
                                {day}
                            </span>
                        </div>
                        <div className="space-y-1">
                            {daySessions.map(session => (
                                <div 
                                    key={session.id}
                                    onClick={(e) => { e.stopPropagation(); openEditModal(session); }}
                                    className={`text-[10px] p-1.5 rounded border border-l-2 shadow-sm cursor-pointer hover:opacity-80 transition-opacity ${
                                        session.type === ClassType.OneOnOne 
                                        ? 'bg-blue-50 border-blue-100 border-l-blue-500 text-blue-700' 
                                        : 'bg-orange-50 border-orange-100 border-l-orange-500 text-orange-700'
                                    }`}
                                >
                                    <div className="font-semibold truncate">{session.topic}</div>
                                    <div className="text-xs opacity-75">
                                        {new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    <div className="truncate opacity-75">
                                        {session.studentIds.map(sid => students.find(s => s.id === sid)?.name.split(' ')[0]).join(', ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderWeekView = () => {
      const startOfWeek = getStartOfWeek(currentDate);
      const weekDays = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(startOfWeek);
          d.setDate(d.getDate() + i);
          return d;
      });

      return (
          <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-lg overflow-hidden border border-cream-border h-[600px] animate-in fade-in">
              {weekDays.map((day, i) => {
                  const isToday = new Date().toDateString() === day.toDateString();
                  const dateStr = day.toISOString().split('T')[0];
                  const daySessions = sessions.filter(s => s.date.startsWith(dateStr))
                      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  return (
                      <div key={i} className="flex flex-col bg-white h-full group" onClick={() => openAddModal(dateStr)}>
                          <div className={`p-3 text-center border-b border-cream-border ${isToday ? 'bg-coral-50' : ''}`}>
                              <p className={`text-xs font-semibold uppercase ${isToday ? 'text-coral-600' : 'text-stone-500'}`}>
                                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                              </p>
                              <p className={`text-lg font-bold mt-1 ${isToday ? 'text-coral-700' : 'text-stone-800'}`}>
                                  {day.getDate()}
                              </p>
                          </div>
                          <div className="flex-1 p-2 space-y-2 overflow-y-auto hover:bg-cream transition-colors cursor-pointer">
                              {daySessions.map(session => (
                                  <div 
                                    key={session.id}
                                    onClick={(e) => { e.stopPropagation(); openEditModal(session); }}
                                    className={`p-2 rounded border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all ${
                                        session.type === ClassType.OneOnOne 
                                        ? 'bg-blue-50 border-blue-500 text-blue-800' 
                                        : 'bg-orange-50 border-orange-500 text-orange-800'
                                    }`}
                                  >
                                      <div className="flex justify-between items-start mb-1">
                                          <span className="text-xs font-bold opacity-75">
                                              {new Date(session.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                          </span>
                                      </div>
                                      <div className="font-semibold text-xs mb-1 line-clamp-2">{session.topic}</div>
                                      <div className="flex -space-x-1 overflow-hidden pt-1">
                                          {session.studentIds.map((sid, idx) => (
                                              <div key={idx} className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[8px] font-bold ring-1 ring-cream-border" title={students.find(s=>s.id===sid)?.name}>
                                                  {students.find(s => s.id === sid)?.name.charAt(0)}
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              ))}
                              {daySessions.length === 0 && (
                                  <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <PlusIcon className="w-6 h-6 text-stone-300" />
                                  </div>
                              )}
                          </div>
                      </div>
                  );
              })}
          </div>
      );
  };

  const renderYearView = () => {
      const months = Array.from({ length: 12 }, (_, i) => i);
      const currentYear = currentDate.getFullYear();

      return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in">
              {months.map(monthIndex => {
                  const monthDate = new Date(currentYear, monthIndex, 1);
                  const { days, firstDay } = getDaysInMonth(monthDate);
                  const blanks = Array(firstDay).fill(null);
                  const daySlots = Array.from({ length: days }, (_, i) => i + 1);
                  
                  return (
                      <div 
                        key={monthIndex} 
                        className="bg-white rounded-2xl border border-cream-border p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                            setCurrentDate(new Date(currentYear, monthIndex, 1));
                            setViewMode('month');
                        }}
                      >
                          <h4 className="font-bold text-stone-800 mb-2">{monthDate.toLocaleDateString('en-US', { month: 'long' })}</h4>
                          <div className="grid grid-cols-7 gap-1 text-[10px] text-center">
                              {['S','M','T','W','T','F','S'].map(d => <span key={d} className="text-stone-400">{d}</span>)}
                              
                              {blanks.map((_, i) => <div key={`b-${i}`} />)}
                              
                              {daySlots.map(day => {
                                  const dateStr = `${currentYear}-${(monthIndex + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                  const hasSession = sessions.some(s => s.date.startsWith(dateStr));
                                  const sessionTypes = sessions.filter(s => s.date.startsWith(dateStr)).map(s => s.type);
                                  
                                  let dotColor = 'bg-transparent';
                                  if (hasSession) {
                                      if (sessionTypes.includes(ClassType.Group)) dotColor = 'bg-orange-400';
                                      else if (sessionTypes.includes(ClassType.OneOnOne)) dotColor = 'bg-blue-500';
                                      else dotColor = 'bg-slate-400';
                                  }

                                  return (
                                      <div key={day} className="flex flex-col items-center justify-center h-5 w-5 rounded-full hover:bg-cream-soft">
                                          <span className={`text-stone-600 ${hasSession ? 'font-bold text-stone-900' : ''}`}>{day}</span>
                                          <div className={`w-1 h-1 rounded-full mt-[1px] ${dotColor}`}></div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )
              })}
          </div>
      );
  };

  const PlusIcon = ({className}: {className?: string}) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-12H4" />
      </svg>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <h2 className="text-xl font-serif font-semibold tracking-tight text-stone-800 min-w-[200px]">
                {getHeaderText()}
            </h2>
            <div className="flex items-center gap-2">
                <button 
                    onClick={handleToday}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-cream-border text-stone-600 rounded-lg hover:bg-cream transition-colors shadow-sm"
                >
                    Today
                </button>
                <div className="flex items-center bg-white rounded-lg border border-cream-border shadow-sm">
                    <button onClick={handlePrev} className="p-1.5 hover:bg-cream text-stone-600"><ChevronLeft className="w-5 h-5" /></button>
                    <div className="w-px h-6 bg-stone-200"></div>
                    <button onClick={handleNext} className="p-1.5 hover:bg-cream text-stone-600"><ChevronRight className="w-5 h-5" /></button>
                </div>
            </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex p-1 bg-stone-200/50 rounded-lg">
                <button 
                    onClick={() => setViewMode('year')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'year' ? 'bg-white text-coral-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                    Year
                </button>
                <button 
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-coral-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                    Month
                </button>
                <button 
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-coral-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                    Week
                </button>
            </div>
            
            <button
            onClick={() => openAddModal()}
            className="flex-1 sm:flex-none bg-coral-600 hover:bg-coral-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
            <CalendarIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Log Session</span>
            <span className="sm:hidden">Log</span>
            </button>
        </div>
      </div>

      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'year' && renderYearView()}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 relative">
                <div className="flex justify-between items-center p-6 border-b border-cream-border">
                    <h3 className="text-lg font-serif font-semibold tracking-tight text-stone-800">
                        {editingSessionId ? 'Edit Session' : 'Log New Session'}
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">Session Type</label>
                            <select
                                value={sessionType}
                                onChange={e => setSessionType(e.target.value as ClassType)}
                                className="w-full p-2 border rounded-md"
                            >
                                <option value={ClassType.OneOnOne}>One-on-One</option>
                                <option value={ClassType.Group}>One-on-Two (Group)</option>
                            </select>
                        </div>
                        
                        {/* Student Dropdown Selector */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-stone-700 mb-2">Select Students</label>
                            
                            {/* Selected Students Chips */}
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedStudents.map(id => {
                                    const s = students.find(student => student.id === id);
                                    if(!s) return null;
                                    return (
                                        <div key={id} className="bg-coral-50 border border-coral-200 text-coral-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                            {s.name}
                                            <button type="button" onClick={() => handleStudentToggle(id)}><X className="w-3 h-3" /></button>
                                        </div>
                                    )
                                })}
                            </div>

                            <button 
                                type="button"
                                onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                                className="w-full p-2 border rounded-md flex justify-between items-center bg-white hover:bg-cream text-left"
                            >
                                <span className="text-stone-500 text-sm">
                                    {selectedStudents.length === 0 ? "Search and select students..." : `${selectedStudents.length} selected`}
                                </span>
                                {isStudentDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {isStudentDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-cream-border rounded-lg shadow-lg z-20 max-h-60 overflow-hidden flex flex-col">
                                    <div className="p-2 border-b border-cream-border">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-stone-400" />
                                            <input 
                                                autoFocus
                                                type="text" 
                                                placeholder="Search name..."
                                                className="w-full pl-8 pr-2 py-1.5 text-sm bg-cream rounded-md focus:outline-none"
                                                value={studentSearch}
                                                onChange={e => setStudentSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto flex-1 p-1">
                                        {filteredStudents.length === 0 && <div className="p-2 text-center text-xs text-stone-400">No active students found.</div>}
                                        {filteredStudents.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => handleStudentToggle(s.id)}
                                                disabled={!selectedStudents.includes(s.id) && selectedStudents.length >= 2}
                                                className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between ${
                                                    selectedStudents.includes(s.id) ? 'bg-coral-50 text-coral-700' : 'hover:bg-cream text-stone-700 disabled:opacity-50'
                                                }`}
                                            >
                                                <span>{s.name}</span>
                                                {selectedStudents.includes(s.id) && <CheckCircle className="w-4 h-4" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Attendance Status Per Student */}
                    {selectedStudents.length > 0 && (
                        <div className="bg-cream p-3 rounded-lg border border-cream-border space-y-2">
                            <label className="block text-xs font-semibold text-stone-500 uppercase">Attendance & Progress</label>
                            {selectedStudents.map(id => {
                                const s = students.find(student => student.id === id);
                                if (!s) return null;
                                const hasProgress = !!tempProgress[id];
                                return (
                                    <div key={id} className="flex justify-between items-center gap-2">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                             <span className="text-sm font-medium text-stone-700 truncate">{s.name}</span>
                                             {hasProgress && <span className="bg-coral-100 text-violet-700 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Updated</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select 
                                                value={studentStatuses[id] || AttendanceStatus.Present}
                                                onChange={(e) => handleStatusChange(id, e.target.value as AttendanceStatus)}
                                                className={`text-sm p-1.5 rounded border ${
                                                    studentStatuses[id] === AttendanceStatus.Present ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                    studentStatuses[id] === AttendanceStatus.Late ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                    'bg-red-50 border-red-200 text-red-700'
                                                }`}
                                            >
                                                {Object.values(AttendanceStatus).map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                            <button 
                                                type="button" 
                                                onClick={() => openProgressModal(id)}
                                                className={`p-1.5 rounded transition-colors border ${hasProgress ? 'bg-coral-50 text-coral-600 border-violet-200' : 'text-stone-400 border-transparent hover:bg-cream-soft'}`}
                                                title="Edit Progress & Notes"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="p-2 border rounded-md"
                            required
                        />
                        <input
                            type="time"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className="p-2 border rounded-md"
                            required
                        />
                    </div>

                    <div className="flex gap-4">
                        <input
                            placeholder="Topic"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            className="flex-1 p-2 border rounded-md"
                            required
                        />
                    </div>

                    <div className="relative">
                        <textarea
                            placeholder="General session notes..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-2 border rounded-md"
                            rows={3}
                        />
                        <button
                            type="button"
                            disabled={!topic || selectedStudents.length === 0 || isGeneratingPlan}
                            onClick={handleGeneratePlan}
                            className="absolute bottom-2 right-2 text-xs flex items-center gap-1 bg-coral-100 text-violet-700 px-2 py-1 rounded-md hover:bg-violet-200 disabled:opacity-50"
                        >
                            <Sparkles className="w-3 h-3" />
                            {isGeneratingPlan ? 'Generating...' : 'AI Plan'}
                        </button>
                    </div>

                    {generatedPlan && (
                        <div className="bg-coral-50 p-3 rounded-md text-xs text-stone-700 max-h-40 overflow-y-auto whitespace-pre-wrap border border-violet-100">
                            <h4 className="font-semibold text-violet-800 mb-1">Generated Plan Preview:</h4>
                            {generatedPlan}
                        </div>
                    )}

                    <div className="flex justify-between pt-2">
                        {editingSessionId ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-md transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        ) : <div></div>}
                        
                        <div className="flex gap-2">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-stone-600 hover:bg-cream rounded-md"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="px-4 py-2 bg-coral-600 text-white rounded-md hover:bg-coral-700"
                            >
                                {editingSessionId ? 'Update Session' : 'Save Session'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Nested Modal for Progress Editing */}
                {progressModalOpen && currentProgressStudentId && (
                     <div className="absolute inset-0 z-[60] bg-white rounded-xl flex flex-col animate-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-center p-4 border-b border-cream-border bg-coral-50 rounded-t-xl">
                            <h3 className="font-bold text-violet-900 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> 
                                Progress: {students.find(s => s.id === currentProgressStudentId)?.name}
                            </h3>
                            <button onClick={() => setProgressModalOpen(false)} className="text-violet-400 hover:text-violet-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {(() => {
                                    const s = students.find(st => st.id === currentProgressStudentId);
                                    const latest = s?.progressHistory && s.progressHistory.length > 0
                                        ? s.progressHistory[s.progressHistory.length - 1]
                                        : null;

                                    return [
                                        { label: 'Reading', key: 'reading', color: 'bg-blue-100 text-blue-700' },
                                        { label: 'Writing', key: 'writing', color: 'bg-emerald-100 text-emerald-700' },
                                        { label: 'Listening', key: 'listening', color: 'bg-amber-100 text-amber-700' },
                                        { label: 'Speaking', key: 'speaking', color: 'bg-coral-100 text-violet-700' },
                                    ].map((field) => {
                                        const previousScore = latest ? latest[field.key as keyof SkillProgress] : null;
                                        return (
                                            <div key={field.key}>
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <label className={`block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full w-fit ${field.color}`}>
                                                        {field.label}
                                                    </label>
                                                    {previousScore !== null && (
                                                        <span className="text-[10px] text-stone-400 font-medium bg-cream-soft px-1.5 py-0.5 rounded">
                                                            Prev: {previousScore}
                                                        </span>
                                                    )}
                                                </div>
                                                <input 
                                                    type="number" 
                                                    min="0" max="100"
                                                    value={tempProgress[currentProgressStudentId]?.[field.key as keyof SkillProgress] || 0}
                                                    onChange={e => updateTempProgress(field.key as keyof SkillProgress, parseInt(e.target.value) || 0)}
                                                    className="w-full p-2 rounded-md border text-sm text-center font-semibold focus:ring-2 focus:ring-coral-500 outline-none"
                                                />
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-stone-500 mb-1">Student-Specific Note</label>
                                <textarea 
                                    value={tempProgress[currentProgressStudentId]?.notes || ''}
                                    onChange={e => updateTempProgress('notes', e.target.value)}
                                    placeholder="Specific achievements or struggles today..."
                                    className="w-full p-2 rounded-md border text-sm focus:ring-2 focus:ring-coral-500 outline-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-cream-border flex justify-end">
                             <button 
                                type="button" 
                                onClick={() => setProgressModalOpen(false)}
                                className="px-4 py-2 bg-coral-600 text-white rounded-md hover:bg-violet-700 text-sm font-medium"
                            >
                                Done
                            </button>
                        </div>
                     </div>
                )}
            </div>
        </div>
      )}

      {sessionToDelete && (() => {
        const s = sessions.find(ses => ses.id === sessionToDelete);
        if (!s) return null;
        const names = s.studentIds.map(id => students.find(st => st.id === id)?.name).filter(Boolean).join(', ');
        return (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-4">
                <div className="bg-red-50 rounded-full p-3">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-xl font-semibold text-stone-900 mb-2">Delete session?</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Removing "{s.topic}" on {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {names ? ` with ${names}` : ''}. Any balance charged for attendance will be refunded. This can't be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setSessionToDelete(null)}
                  className="px-4 py-2 text-stone-600 hover:bg-cream rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSession}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                >
                  Delete session
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default SessionLog;