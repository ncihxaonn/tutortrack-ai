import React, { useState } from 'react';
import { Student, Session, Payment, AttendanceStatus, ClassType, ClassPackage, SkillProgress } from '../types';
import { X, Sparkles, PlusCircle, Edit2, Save, XCircle, TrendingUp, Activity, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { generateStudentReport } from '../services/geminiService';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { CURRENCY_SYMBOLS, Currency, formatMoney } from '../lib/currency';
import { isTrialForStudent } from '../lib/sessionHelpers';

interface StudentDetailProps {
  student: Student;
  sessions: Session[];
  payments: Payment[];
  onClose: () => void;
  onUpdatePayment: (studentId: string, amount: number) => void;
  onUpdateStudent: (student: Student) => void | Promise<void>;
  onUpdateSession?: (session: Session) => Promise<void> | void;
  onDeleteSession?: (id: string) => Promise<void> | void;
  onSavePayment?: (payment: Payment) => Promise<void> | void;
  onDeletePayment?: (id: string) => Promise<void> | void;
  currency?: Currency;
  rate?: number;
}

const StudentDetail: React.FC<StudentDetailProps> = ({ student, sessions, payments, onClose, onUpdateStudent, onUpdateSession, onDeleteSession, onSavePayment, onDeletePayment, currency = 'CNY' as Currency, rate = 1 }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'history'>('overview');
  const [historyTab, setHistoryTab] = useState<'classes' | 'purchases'>('classes');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  // Renew Package State
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewType, setRenewType] = useState<ClassType>(ClassType.OneOnOne);
  const [renewClasses, setRenewClasses] = useState(10);
  const [renewCost, setRenewCost] = useState(400);

  // Edit Package State
  const [editingPackageIndex, setEditingPackageIndex] = useState<number | null>(null);
  const [editRemainingCount, setEditRemainingCount] = useState<number>(0);

  // Progress State
  const [newProgress, setNewProgress] = useState({
      reading: 50,
      writing: 50,
      listening: 50,
      speaking: 50,
      date: new Date().toISOString().split('T')[0],
      notes: ''
  });

  // Edit History Log State
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogData, setEditLogData] = useState<SkillProgress | null>(null);

  // Delete Confirmation State
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'session' | 'payment'; id: string; label: string } | null>(null);

  // Edit Session State
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionData, setEditSessionData] = useState<Session | null>(null);

  // Edit Payment State
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentData, setEditPaymentData] = useState<Payment | null>(null);

  // Save error feedback
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const studentSessions = sessions.filter(s => s.studentIds.includes(student.id));
  const attendedCount = studentSessions.filter(s => s.status === AttendanceStatus.Present).length;
  const attendanceRate = studentSessions.length ? Math.round((attendedCount / studentSessions.length) * 100) : 0;

  // Lesson numbering per class type — only Present + non-trial sessions count toward a package
  const lessonNumberMap = new Map<string, number>();
  {
    const counters: Record<string, number> = {};
    const ascSessions = [...studentSessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const s of ascSessions) {
      if (isTrialForStudent(s, student.id)) continue;
      const myStatus = s.studentStatuses?.find(ss => ss.studentId === student.id)?.status || s.status;
      if (myStatus !== AttendanceStatus.Present) continue;
      counters[s.type] = (counters[s.type] || 0) + 1;
      lessonNumberMap.set(s.id, counters[s.type]);
    }
  }
  const PACKAGE_SIZE = 10;
  
  // Charts Data
  const progressHistory = student.progressHistory || [];
  const latestProgress = progressHistory.length > 0 
      ? progressHistory[progressHistory.length - 1] 
      : { reading: 0, writing: 0, listening: 0, speaking: 0 };

  const radarData = [
    { subject: 'Reading', A: latestProgress.reading, fullMark: 100 },
    { subject: 'Writing', A: latestProgress.writing, fullMark: 100 },
    { subject: 'Listening', A: latestProgress.listening, fullMark: 100 },
    { subject: 'Speaking', A: latestProgress.speaking, fullMark: 100 },
  ];

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    const report = await generateStudentReport(student, studentSessions.slice(0, 5));
    setAiReport(report);
    setIsGenerating(false);
  };

  const handleRenewPackage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (renewClasses <= 0) {
          setSaveError('Number of sessions must be at least 1.');
          return;
      }

      const newPackages = [...(student.packages || [])];
      const existingPackageIndex = newPackages.findIndex(p => p.type === renewType);

      if (existingPackageIndex >= 0) {
          newPackages[existingPackageIndex] = {
              ...newPackages[existingPackageIndex],
              total: newPackages[existingPackageIndex].total + renewClasses,
              active: true
          };
      } else {
          newPackages.push({
              type: renewType,
              total: renewClasses,
              active: true
          });
      }

      const newBalance = student.balance - renewCost;

      const newClassTypes = student.classTypes.includes(renewType)
        ? student.classTypes
        : [...student.classTypes, renewType];

      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateStudent({
              ...student,
              packages: newPackages,
              balance: newBalance,
              classTypes: newClassTypes
          });
          setIsRenewing(false);
          setRenewClasses(10);
          setRenewCost(400);
      } catch (err: any) {
          setSaveError(`Failed to save: ${err?.message ?? String(err)}`);
      } finally {
          setIsSaving(false);
      }
  };

  const startEditing = (index: number, total: number, attended: number) => {
      setEditingPackageIndex(index);
      setEditRemainingCount(total - attended);
  };

  const savePackageEdit = async (index: number, attended: number) => {
      if (!student.packages) return;

      const newPackages = [...student.packages];
      const newTotal = attended + editRemainingCount;

      newPackages[index] = {
          ...newPackages[index],
          total: newTotal
      };

      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateStudent({
              ...student,
              packages: newPackages
          });
          setEditingPackageIndex(null);
      } catch (err: any) {
          setSaveError(`Failed to save: ${err?.message ?? String(err)}`);
      } finally {
          setIsSaving(false);
      }
  };

  const handleAddProgress = (e: React.FormEvent) => {
      e.preventDefault();
      const newEntry: SkillProgress = {
          id: `ph${Date.now()}`,
          date: newProgress.date,
          reading: Number(newProgress.reading),
          writing: Number(newProgress.writing),
          listening: Number(newProgress.listening),
          speaking: Number(newProgress.speaking),
          notes: newProgress.notes
      };

      // Sort by date after adding
      const updatedHistory = [...progressHistory, newEntry].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      onUpdateStudent({
          ...student,
          progressHistory: updatedHistory
      });

      setNewProgress(prev => ({ ...prev, notes: '' }));
      // Optional: switch back to overview or clear form fully
  };

  const handleStartEditLog = (log: SkillProgress) => {
      setEditingLogId(log.id);
      setEditLogData({ ...log });
  };

  const confirmDeleteLog = () => {
      if (!logToDelete) return;
      const updatedHistory = (student.progressHistory || []).filter(p => p.id !== logToDelete);
      onUpdateStudent({
          ...student,
          progressHistory: updatedHistory
      });
      setLogToDelete(null);
  };

  const handleSaveEditLog = () => {
      if (!editLogData || !student.progressHistory) return;

      const updatedHistory = student.progressHistory.map(p =>
          p.id === editLogData.id ? editLogData : p
      ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      onUpdateStudent({
          ...student,
          progressHistory: updatedHistory
      });
      setEditingLogId(null);
      setEditLogData(null);
  };

  // ── Session edit/delete ────────────────────────────────────────────
  const startEditSession = (s: Session) => {
      setEditingSessionId(s.id);
      setEditSessionData({ ...s, studentStatuses: s.studentStatuses ? [...s.studentStatuses] : [] });
      setSaveError(null);
  };

  const cancelEditSession = () => {
      setEditingSessionId(null);
      setEditSessionData(null);
      setSaveError(null);
  };

  const saveEditSession = async () => {
      if (!editSessionData || !onUpdateSession) return;
      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateSession(editSessionData);
          setEditingSessionId(null);
          setEditSessionData(null);
      } catch (err: any) {
          setSaveError(`Failed to save: ${err?.message ?? String(err)}`);
      } finally {
          setIsSaving(false);
      }
  };

  const updateEditSessionStudentStatus = (status: AttendanceStatus) => {
      if (!editSessionData) return;
      const list = editSessionData.studentStatuses ? [...editSessionData.studentStatuses] : [];
      const idx = list.findIndex(s => s.studentId === student.id);
      if (idx >= 0) list[idx] = { ...list[idx], status };
      else list.push({ studentId: student.id, status });
      setEditSessionData({ ...editSessionData, studentStatuses: list, status });
  };

  // ── Payment edit/delete ────────────────────────────────────────────
  const startEditPayment = (p: Payment) => {
      setEditingPaymentId(p.id);
      setEditPaymentData({ ...p });
      setSaveError(null);
  };

  const cancelEditPayment = () => {
      setEditingPaymentId(null);
      setEditPaymentData(null);
      setSaveError(null);
  };

  const saveEditPayment = async () => {
      if (!editPaymentData || !onSavePayment) return;
      try {
          setIsSaving(true);
          setSaveError(null);
          await onSavePayment(editPaymentData);
          setEditingPaymentId(null);
          setEditPaymentData(null);
      } catch (err: any) {
          setSaveError(`Failed to save: ${err?.message ?? String(err)}`);
      } finally {
          setIsSaving(false);
      }
  };

  const performConfirmDelete = async () => {
      if (!confirmDelete) return;
      try {
          setIsSaving(true);
          setSaveError(null);
          if (confirmDelete.kind === 'session' && onDeleteSession) {
              await onDeleteSession(confirmDelete.id);
          } else if (confirmDelete.kind === 'payment' && onDeletePayment) {
              await onDeletePayment(confirmDelete.id);
          }
          setConfirmDelete(null);
      } catch (err: any) {
          setSaveError(`Failed to delete: ${err?.message ?? String(err)}`);
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-lg bg-cream h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col relative">
        {/* Header */}
        <div className="bg-white p-6 border-b border-cream-border flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-serif font-semibold tracking-tight text-stone-800">{student.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
               <span className={`text-xs px-2 py-0.5 rounded-full border ${student.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-cream-soft text-stone-600 border-cream-border'}`}>
                    {student.status}
               </span>
               {student.classTypes.map(type => (
                    <span key={type} className={`text-xs px-2 py-0.5 rounded-full ${type === ClassType.OneOnOne ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {type}
                    </span>
               ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cream-soft rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-6 border-b border-cream-border bg-white">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'overview' ? 'text-coral-600' : 'text-stone-500'}`}
            >
                Overview
                {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-coral-600 rounded-t-full"></div>}
            </button>
            <button 
                onClick={() => setActiveTab('progress')}
                className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'progress' ? 'text-coral-600' : 'text-stone-500'}`}
            >
                Progress
                {activeTab === 'progress' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-coral-600 rounded-t-full"></div>}
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`pb-3 text-sm font-medium transition-colors relative ${activeTab === 'history' ? 'text-coral-600' : 'text-stone-500'}`}
            >
                History
                {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-coral-600 rounded-t-full"></div>}
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'overview' ? (
                <>
                    {/* Skills Radar Chart */}
                    <div className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                             <Activity className="w-4 h-4 text-coral-600" />
                             <h3 className="font-semibold text-stone-800 text-sm">Skills Overview</h3>
                        </div>
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name="Student" dataKey="A" stroke="#D97757" fill="#D97757" fillOpacity={0.5} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="text-center text-xs text-stone-400 mt-[-10px]">
                            Most recent assessment
                        </div>
                    </div>

                    {/* Renew / Add Package Section */}
                    <div className="bg-cream-soft rounded-xl p-4 border border-cream-border">
                        {!isRenewing ? (
                            <button 
                                onClick={() => setIsRenewing(true)}
                                className="w-full flex items-center justify-center gap-2 bg-white p-3 rounded-lg border border-cream-border text-stone-700 font-medium hover:bg-cream transition-colors"
                            >
                                <PlusCircle className="w-5 h-5 text-coral-600" />
                                Renew Package / Add Credits
                            </button>
                        ) : (
                            <form onSubmit={handleRenewPackage} className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-semibold text-stone-800">Add Sessions</h4>
                                    <button type="button" onClick={() => { setIsRenewing(false); setSaveError(null); }} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-stone-500 mb-1">Program Type</label>
                                    <select 
                                        value={renewType}
                                        onChange={e => setRenewType(e.target.value as ClassType)}
                                        className="w-full p-2 rounded-md border text-sm"
                                    >
                                        <option value={ClassType.OneOnOne}>One-on-One</option>
                                        <option value={ClassType.Group}>One-on-Two (Group)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-stone-500 mb-1">No. of Sessions</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={renewClasses} 
                                            onChange={e => setRenewClasses(parseInt(e.target.value) || 0)}
                                            className="w-full p-2 rounded-md border text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-stone-500 mb-1">Amount Paid ({CURRENCY_SYMBOLS.CNY})</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={renewCost}
                                            onChange={e => setRenewCost(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2 rounded-md border text-sm"
                                        />
                                    </div>
                                </div>
                                {saveError && (
                                    <p className="text-xs text-red-600">{saveError}</p>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full bg-coral-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-coral-700 disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving…' : `Add ${renewClasses} sessions`}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm">
                            <p className="text-xs text-stone-500 uppercase font-semibold">Attendance Rate</p>
                            <p className="text-xl font-bold text-stone-800 mt-1">{attendanceRate}%</p>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm">
                            <p className="text-xs text-stone-500 uppercase font-semibold">Total Classes</p>
                            <p className="text-xl font-bold text-stone-800 mt-1">{attendedCount}</p>
                        </div>
                    </div>
                    
                    {/* Class Packages */}
                    {student.packages && student.packages.length > 0 && (
                        <div className="space-y-3">
                            {student.packages.map((pkg, idx) => {
                                // Trials don't consume package classes
                                const attendedForType = studentSessions.filter(s => s.type === pkg.type && s.status === AttendanceStatus.Present && !isTrialForStudent(s, student.id)).length;
                                const isEditing = editingPackageIndex === idx;
                                const progress = Math.min(100, Math.round((attendedForType / pkg.total) * 100));
                                
                                return (
                                    <div key={idx} className="bg-white p-5 rounded-2xl border border-cream-border shadow-sm transition-all">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-semibold text-stone-800">{pkg.type} Package</h3>
                                            {!isEditing && (
                                                <button 
                                                    onClick={() => startEditing(idx, pkg.total, attendedForType)}
                                                    className="p-1 text-stone-400 hover:text-coral-600 hover:bg-coral-50 rounded"
                                                    title="Edit Remaining Classes"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-3 bg-cream p-3 rounded-lg border border-cream-border">
                                                <div className="flex justify-between text-sm text-stone-600">
                                                    <span>Attended:</span>
                                                    <span className="font-medium">{attendedForType}</span>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-stone-500 mb-1">Remaining Classes (set total to attended + this)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={editRemainingCount}
                                                        onChange={(e) => setEditRemainingCount(parseInt(e.target.value) || 0)}
                                                        className="w-full p-2 border rounded-md text-sm"
                                                        autoFocus
                                                    />
                                                    <p className="text-[10px] text-stone-400 mt-1 text-right">New Total: {attendedForType + editRemainingCount}</p>
                                                </div>
                                                {saveError && (
                                                    <p className="text-xs text-red-600">{saveError}</p>
                                                )}
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingPackageIndex(null); setSaveError(null); }}
                                                        disabled={isSaving}
                                                        className="px-3 py-1.5 text-sm text-stone-600 bg-white border border-cream-border rounded-md hover:bg-stone-50 disabled:opacity-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => savePackageEdit(idx, attendedForType)}
                                                        disabled={isSaving}
                                                        className="px-3 py-1.5 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                                                    >
                                                        {isSaving ? 'Saving…' : 'Save'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-end mb-2">
                                                     <p className="text-sm font-medium text-stone-600">{attendedForType} / {pkg.total}</p>
                                                </div>
                                                <div className="w-full bg-cream-soft rounded-full h-2.5">
                                                    <div 
                                                        className={`h-2.5 rounded-full transition-all duration-500 ${pkg.type === ClassType.OneOnOne ? 'bg-blue-500' : 'bg-orange-500'}`} 
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                                {progress >= 100 ? (
                                                    <p className="text-xs text-red-500 mt-2 font-medium">Package complete! Time to renew.</p>
                                                ) : (
                                                    <p className="text-xs text-stone-400 mt-2">{pkg.total - attendedForType} classes remaining</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* AI Report Section */}
                    <div className="bg-coral-50 rounded-xl p-5 border border-violet-100">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-violet-900 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" /> AI Progress Report
                            </h3>
                            <button 
                                onClick={handleGenerateReport}
                                disabled={isGenerating}
                                className="text-xs bg-violet-200 text-violet-800 px-2 py-1 rounded hover:bg-violet-300 disabled:opacity-50 transition-colors"
                            >
                                {isGenerating ? 'Drafting...' : 'Generate New'}
                            </button>
                        </div>
                        {aiReport ? (
                            <div className="bg-white p-4 rounded-lg border border-violet-100 text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                                {aiReport}
                            </div>
                        ) : (
                            <p className="text-sm text-violet-700/70">
                                Click generate to create a professional email update for {student.parentName}.
                            </p>
                        )}
                    </div>
                </>
            ) : activeTab === 'progress' ? (
                <div className="space-y-6">
                    {/* Progress Chart */}
                    <div className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                             <TrendingUp className="w-4 h-4 text-coral-600" />
                             <h3 className="font-semibold text-stone-800 text-sm">Improvement Over Time</h3>
                        </div>
                        <div className="h-64 w-full">
                            {progressHistory.length > 1 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={progressHistory}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={d => new Date(d).toLocaleDateString(undefined, {month:'short', day:'numeric'})} />
                                        <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#64748b'}} />
                                        <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                                        <Legend wrapperStyle={{fontSize: '11px', marginTop: '10px'}} />
                                        <Line type="monotone" dataKey="reading" stroke="#3b82f6" strokeWidth={2} dot={{r: 3}} />
                                        <Line type="monotone" dataKey="writing" stroke="#10b981" strokeWidth={2} dot={{r: 3}} />
                                        <Line type="monotone" dataKey="listening" stroke="#f59e0b" strokeWidth={2} dot={{r: 3}} />
                                        <Line type="monotone" dataKey="speaking" stroke="#8b5cf6" strokeWidth={2} dot={{r: 3}} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-stone-400 text-sm">
                                    Not enough data points yet. Add more logs below.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add New Progress Log Form */}
                    <div className="bg-cream p-5 rounded-2xl border border-cream-border">
                        <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
                            <PlusCircle className="w-4 h-4 text-coral-600" />
                            Log New Progress
                        </h3>
                        <form onSubmit={handleAddProgress} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-stone-500 mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        value={newProgress.date} 
                                        onChange={e => setNewProgress({...newProgress, date: e.target.value})}
                                        className="w-full p-2 rounded-md border text-sm"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Reading', key: 'reading', color: 'bg-blue-100 text-blue-700' },
                                    { label: 'Writing', key: 'writing', color: 'bg-emerald-100 text-emerald-700' },
                                    { label: 'Listening', key: 'listening', color: 'bg-amber-100 text-amber-700' },
                                    { label: 'Speaking', key: 'speaking', color: 'bg-coral-100 text-violet-700' },
                                ].map((field) => (
                                    <div key={field.key}>
                                        <label className={`block text-[10px] uppercase font-bold mb-1 px-2 py-0.5 rounded-full w-fit ${field.color}`}>
                                            {field.label}
                                        </label>
                                        <input 
                                            type="number" 
                                            min="0" max="100"
                                            value={newProgress[field.key as keyof typeof newProgress] as number}
                                            onChange={e => setNewProgress({...newProgress, [field.key]: parseInt(e.target.value) || 0})}
                                            className="w-full p-2 rounded-md border text-sm text-center font-semibold"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-stone-500 mb-1">Observation Notes</label>
                                <textarea 
                                    value={newProgress.notes}
                                    onChange={e => setNewProgress({...newProgress, notes: e.target.value})}
                                    placeholder="Notable improvements, weaknesses, areas to focus on..."
                                    className="w-full p-2 rounded-md border text-sm"
                                    rows={2}
                                />
                            </div>

                            <button type="submit" className="w-full bg-coral-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-coral-700 transition-colors">
                                Add Log Entry
                            </button>
                        </form>
                    </div>

                    {/* Progress History List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-600">Progress History</h4>
                        {progressHistory.length === 0 && <p className="text-xs text-stone-400">No logs recorded.</p>}
                        {[...progressHistory].reverse().map(log => (
                            <div key={log.id} className="bg-white p-3 rounded-lg border border-cream-border shadow-sm relative">
                                {editingLogId === log.id && editLogData ? (
                                    <div className="space-y-3 animate-in fade-in">
                                         <div className="flex justify-between items-center mb-2">
                                             <input 
                                                 type="date" 
                                                 value={editLogData.date}
                                                 onChange={e => setEditLogData({...editLogData, date: e.target.value})}
                                                 className="text-xs border rounded p-1"
                                             />
                                         </div>
                                         <div className="grid grid-cols-4 gap-2">
                                             {/* Inputs for R, W, L, S */}
                                             {[
                                                 { key: 'reading', label: 'R' },
                                                 { key: 'writing', label: 'W' },
                                                 { key: 'listening', label: 'L' },
                                                 { key: 'speaking', label: 'S' }
                                             ].map(({key, label}) => (
                                                 <div key={key}>
                                                     <label className="block text-[10px] uppercase font-bold text-stone-500 mb-0.5">{label}</label>
                                                     <input 
                                                         type="number"
                                                         min="0" max="100"
                                                         value={(editLogData as any)[key]}
                                                         onChange={e => setEditLogData({...editLogData, [key]: parseInt(e.target.value) || 0})}
                                                         className="w-full p-1 text-xs border rounded text-center"
                                                     />
                                                 </div>
                                             ))}
                                         </div>
                                         <textarea 
                                             value={editLogData.notes}
                                             onChange={e => setEditLogData({...editLogData, notes: e.target.value})}
                                             className="w-full text-xs p-2 border rounded"
                                             rows={2}
                                             placeholder="Notes..."
                                         />
                                         <div className="flex justify-end gap-2">
                                             <button onClick={() => setEditingLogId(null)} className="p-1 text-stone-500 hover:bg-cream-soft rounded" title="Cancel"><XCircle className="w-4 h-4" /></button>
                                             <button onClick={handleSaveEditLog} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Save Changes"><Save className="w-4 h-4" /></button>
                                         </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-bold text-stone-500">{new Date(log.date).toLocaleDateString()}</span>
                                            <div className="flex items-center gap-1">
                                                <div className="flex gap-2 mr-2">
                                                    <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">R: {log.reading}</span>
                                                    <span className="text-[10px] font-medium bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">W: {log.writing}</span>
                                                    <span className="text-[10px] font-medium bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">L: {log.listening}</span>
                                                    <span className="text-[10px] font-medium bg-coral-50 text-coral-600 px-1.5 py-0.5 rounded">S: {log.speaking}</span>
                                                </div>
                                                <button onClick={() => handleStartEditLog(log)} className="p-1 text-stone-300 hover:text-coral-600 hover:bg-coral-50 rounded transition-colors" title="Edit Log">
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => setLogToDelete(log.id)} className="p-1 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Log">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                        {log.notes && <p className="text-xs text-stone-600 leading-relaxed">{log.notes}</p>}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Sub-tabs */}
                    <div className="flex gap-1 bg-cream p-1 rounded-lg w-fit">
                        <button
                            onClick={() => setHistoryTab('classes')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${historyTab === 'classes' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            Class History
                        </button>
                        <button
                            onClick={() => setHistoryTab('purchases')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${historyTab === 'purchases' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            Purchase History
                        </button>
                    </div>

                    {historyTab === 'classes' ? (
                        <div className="space-y-3">
                            {studentSessions.length === 0 && <p className="text-sm text-stone-400">No session history found.</p>}
                            {studentSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(session => {
                                const myStatus = session.studentStatuses?.find(s => s.studentId === student.id)?.status || session.status;
                                const myIsTrial = isTrialForStudent(session, student.id);
                                const lessonNum = lessonNumberMap.get(session.id);
                                const pkgIndex = lessonNum ? Math.floor((lessonNum - 1) / PACKAGE_SIZE) + 1 : null;
                                const inPkgIndex = lessonNum ? ((lessonNum - 1) % PACKAGE_SIZE) + 1 : null;
                                const isEditing = editingSessionId === session.id && editSessionData;
                                if (isEditing && editSessionData) {
                                    const editStatus = editSessionData.studentStatuses?.find(s => s.studentId === student.id)?.status || editSessionData.status;
                                    const dateValue = new Date(editSessionData.date).toISOString().slice(0, 16);
                                    return (
                                        <div key={session.id} className="bg-white p-4 rounded-2xl border border-coral-200 shadow-sm space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-semibold text-stone-800">Edit Session</h4>
                                                <button onClick={cancelEditSession} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Date & Time</label>
                                                    <input
                                                        type="datetime-local"
                                                        value={dateValue}
                                                        onChange={e => setEditSessionData({ ...editSessionData, date: new Date(e.target.value).toISOString() })}
                                                        className="w-full p-2 rounded-md border text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Type</label>
                                                    <select
                                                        value={editSessionData.type}
                                                        onChange={e => setEditSessionData({ ...editSessionData, type: e.target.value as ClassType })}
                                                        className="w-full p-2 rounded-md border text-xs"
                                                    >
                                                        <option value={ClassType.OneOnOne}>One-on-One</option>
                                                        <option value={ClassType.Group}>One-on-Two</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Topic</label>
                                                <input
                                                    type="text"
                                                    value={editSessionData.topic}
                                                    onChange={e => setEditSessionData({ ...editSessionData, topic: e.target.value })}
                                                    className="w-full p-2 rounded-md border text-xs"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">My Status</label>
                                                    <select
                                                        value={editStatus}
                                                        onChange={e => updateEditSessionStudentStatus(e.target.value as AttendanceStatus)}
                                                        className="w-full p-2 rounded-md border text-xs"
                                                    >
                                                        <option value={AttendanceStatus.Present}>Present</option>
                                                        <option value={AttendanceStatus.Late}>Late</option>
                                                        <option value={AttendanceStatus.Absent}>Absent</option>
                                                        <option value={AttendanceStatus.Cancelled}>Cancelled</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-end">
                                                    <label className="flex items-center gap-2 text-xs text-stone-700" title="Marks this session as a trial for THIS student only (others in a group session unaffected).">
                                                        <input
                                                            type="checkbox"
                                                            checked={isTrialForStudent(editSessionData, student.id)}
                                                            onChange={e => {
                                                                const next = e.target.checked;
                                                                const list = editSessionData.studentStatuses ? [...editSessionData.studentStatuses] : [];
                                                                const idx = list.findIndex(s => s.studentId === student.id);
                                                                if (idx >= 0) list[idx] = { ...list[idx], isTrial: next };
                                                                else list.push({ studentId: student.id, status: editSessionData.status, isTrial: next });
                                                                setEditSessionData({ ...editSessionData, studentStatuses: list });
                                                            }}
                                                            className="rounded"
                                                        />
                                                        Trial for {student.name}
                                                    </label>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Notes</label>
                                                <textarea
                                                    value={editSessionData.notes}
                                                    onChange={e => setEditSessionData({ ...editSessionData, notes: e.target.value })}
                                                    rows={2}
                                                    className="w-full p-2 rounded-md border text-xs"
                                                />
                                            </div>
                                            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={cancelEditSession}
                                                    disabled={isSaving}
                                                    className="px-3 py-1.5 text-xs text-stone-600 bg-white border border-cream-border rounded-md hover:bg-stone-50 disabled:opacity-50"
                                                >Cancel</button>
                                                <button
                                                    type="button"
                                                    onClick={saveEditSession}
                                                    disabled={isSaving}
                                                    className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                                                >{isSaving ? 'Saving…' : 'Save'}</button>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={session.id} className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm flex items-start gap-4">
                                        <div className="p-2 bg-cream rounded-lg text-center min-w-[3.5rem]">
                                            <p className="text-xs font-bold text-stone-500 uppercase">{new Date(session.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                                            <p className="text-lg font-bold text-stone-800">{new Date(session.date).getDate()}</p>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {myIsTrial ? (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">TRIAL</span>
                                                ) : lessonNum ? (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-900 text-white" title={`Lesson ${inPkgIndex} of package ${pkgIndex} · #${lessonNum} overall`}>
                                                        Lesson {inPkgIndex}{pkgIndex && pkgIndex > 1 ? ` · Pkg ${pkgIndex}` : ''}
                                                    </span>
                                                ) : null}
                                                <h4 className="font-medium text-stone-800">{session.topic}</h4>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${session.type === ClassType.OneOnOne ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                    {session.type}
                                                </span>
                                            </div>
                                            {session.notes && <p className="text-xs text-stone-500 mt-1">{session.notes}</p>}
                                            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
                                                myStatus === AttendanceStatus.Present ? 'bg-emerald-100 text-emerald-700' :
                                                myStatus === AttendanceStatus.Late ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {myStatus}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {onUpdateSession && (
                                                <button
                                                    onClick={() => startEditSession(session)}
                                                    className="p-1 text-stone-300 hover:text-coral-600 hover:bg-coral-50 rounded transition-colors"
                                                    title="Edit Session"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {onDeleteSession && (
                                                <button
                                                    onClick={() => setConfirmDelete({ kind: 'session', id: session.id, label: `${session.topic} on ${new Date(session.date).toLocaleDateString()}` })}
                                                    className="p-1 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                    title="Delete Session"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {(() => {
                                const studentPayments = (payments || [])
                                    .filter(p => p.studentId === student.id)
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                const totalPaid = studentPayments.reduce((sum, p) => sum + p.amount, 0);
                                if (studentPayments.length === 0) {
                                    return <p className="text-sm text-stone-400">No purchases recorded.</p>;
                                }
                                return (
                                    <>
                                        <div className="bg-cream p-3 rounded-lg border border-cream-border flex justify-between items-center">
                                            <span className="text-xs font-medium text-stone-500 uppercase">Total Paid</span>
                                            <span className="text-sm font-semibold text-stone-800">{formatMoney(totalPaid, currency, rate)}</span>
                                        </div>
                                        {studentPayments.map(payment => {
                                            const isEditing = editingPaymentId === payment.id && editPaymentData;
                                            if (isEditing && editPaymentData) {
                                                const dateValue = new Date(editPaymentData.date).toISOString().slice(0, 10);
                                                return (
                                                    <div key={payment.id} className="bg-white p-4 rounded-2xl border border-coral-200 shadow-sm space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-sm font-semibold text-stone-800">Edit Payment</h4>
                                                            <button onClick={cancelEditPayment} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Amount ({CURRENCY_SYMBOLS.CNY})</label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={editPaymentData.amount}
                                                                    onChange={e => setEditPaymentData({ ...editPaymentData, amount: parseFloat(e.target.value) || 0 })}
                                                                    className="w-full p-2 rounded-md border text-xs"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Date</label>
                                                                <input
                                                                    type="date"
                                                                    value={dateValue}
                                                                    onChange={e => setEditPaymentData({ ...editPaymentData, date: new Date(e.target.value).toISOString() })}
                                                                    className="w-full p-2 rounded-md border text-xs"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Method / Note</label>
                                                            <input
                                                                type="text"
                                                                value={editPaymentData.method || ''}
                                                                onChange={e => setEditPaymentData({ ...editPaymentData, method: e.target.value })}
                                                                className="w-full p-2 rounded-md border text-xs"
                                                            />
                                                        </div>
                                                        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={cancelEditPayment}
                                                                disabled={isSaving}
                                                                className="px-3 py-1.5 text-xs text-stone-600 bg-white border border-cream-border rounded-md hover:bg-stone-50 disabled:opacity-50"
                                                            >Cancel</button>
                                                            <button
                                                                type="button"
                                                                onClick={saveEditPayment}
                                                                disabled={isSaving}
                                                                className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                                                            >{isSaving ? 'Saving…' : 'Save'}</button>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={payment.id} className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm flex items-start gap-4">
                                                    <div className="p-2 bg-cream rounded-lg text-center min-w-[3.5rem]">
                                                        <p className="text-xs font-bold text-stone-500 uppercase">{new Date(payment.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                                                        <p className="text-lg font-bold text-stone-800">{new Date(payment.date).getDate()}</p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className="font-medium text-stone-800">{formatMoney(payment.amount, currency, rate)}</h4>
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                {payment.method || 'Payment'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-stone-500 mt-1">{new Date(payment.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        {onSavePayment && (
                                                            <button
                                                                onClick={() => startEditPayment(payment)}
                                                                className="p-1 text-stone-300 hover:text-coral-600 hover:bg-coral-50 rounded transition-colors"
                                                                title="Edit Payment"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {onDeletePayment && (
                                                            <button
                                                                onClick={() => setConfirmDelete({ kind: 'payment', id: payment.id, label: `${formatMoney(payment.amount, currency, rate)} on ${new Date(payment.date).toLocaleDateString()}` })}
                                                                className="p-1 text-stone-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                title="Delete Payment"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
        
        {/* Session/Payment Delete Confirmation Pop-up */}
        {confirmDelete && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/50 backdrop-blur-sm p-6">
                <div className="bg-white p-5 rounded-xl shadow-xl border border-cream-border w-full max-w-sm animate-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-red-50 p-3 rounded-full mb-3">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <h4 className="font-bold text-stone-800 text-lg mb-2">
                            Delete {confirmDelete.kind === 'session' ? 'Session' : 'Payment'}?
                        </h4>
                        <p className="text-sm text-stone-500 mb-2">{confirmDelete.label}</p>
                        <p className="text-xs text-stone-400 mb-6">
                            {confirmDelete.kind === 'session'
                                ? 'The student balance will be restored if this session was paid.'
                                : 'The amount will be added back to the student balance.'} This cannot be undone.
                        </p>
                        {saveError && <p className="text-xs text-red-600 mb-3">{saveError}</p>}
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => { setConfirmDelete(null); setSaveError(null); }}
                                disabled={isSaving}
                                className="flex-1 py-2 text-sm font-medium border border-cream-border rounded-lg hover:bg-cream text-stone-600 disabled:opacity-50"
                            >Cancel</button>
                            <button
                                onClick={performConfirmDelete}
                                disabled={isSaving}
                                className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >{isSaving ? 'Deleting…' : 'Delete'}</button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Delete Confirmation Pop-up */}
        {logToDelete && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-white/50 backdrop-blur-sm p-6">
                <div className="bg-white p-5 rounded-xl shadow-xl border border-cream-border w-full max-w-sm animate-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center">
                        <div className="bg-red-50 p-3 rounded-full mb-3">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <h4 className="font-bold text-stone-800 text-lg mb-2">Delete Progress Log?</h4>
                        <p className="text-sm text-stone-500 mb-6">Are you sure you want to delete this history entry? This action cannot be undone.</p>
                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={() => setLogToDelete(null)}
                                className="flex-1 py-2 text-sm font-medium border border-cream-border rounded-lg hover:bg-cream text-stone-600"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDeleteLog}
                                className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default StudentDetail;