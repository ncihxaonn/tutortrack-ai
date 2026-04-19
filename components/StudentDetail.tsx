import React, { useState } from 'react';
import { Student, Session, Payment, AttendanceStatus, ClassType, ClassPackage, SkillProgress } from '../types';
import { X, Sparkles, PlusCircle, Edit2, Save, XCircle, TrendingUp, Activity, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { generateStudentReport } from '../services/geminiService';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { CURRENCY_SYMBOLS } from '../lib/currency';

interface StudentDetailProps {
  student: Student;
  sessions: Session[];
  payments: Payment[]; 
  onClose: () => void;
  onUpdatePayment: (studentId: string, amount: number) => void;
  onUpdateStudent: (student: Student) => void;
}

const StudentDetail: React.FC<StudentDetailProps> = ({ student, sessions, onClose, onUpdateStudent }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'history'>('overview');
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

  const studentSessions = sessions.filter(s => s.studentIds.includes(student.id));
  const attendedCount = studentSessions.filter(s => s.status === AttendanceStatus.Present).length;
  const attendanceRate = studentSessions.length ? Math.round((attendedCount / studentSessions.length) * 100) : 0;
  
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

  const handleRenewPackage = (e: React.FormEvent) => {
      e.preventDefault();
      
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

      onUpdateStudent({
          ...student,
          packages: newPackages,
          balance: newBalance,
          classTypes: newClassTypes
      });

      setIsRenewing(false);
      setRenewClasses(10);
      setRenewCost(400);
  };

  const startEditing = (index: number, total: number, attended: number) => {
      setEditingPackageIndex(index);
      setEditRemainingCount(total - attended);
  };

  const savePackageEdit = (index: number, attended: number) => {
      if (!student.packages) return;
      
      const newPackages = [...student.packages];
      const newTotal = attended + editRemainingCount;
      
      newPackages[index] = {
          ...newPackages[index],
          total: newTotal
      };

      onUpdateStudent({
          ...student,
          packages: newPackages
      });
      setEditingPackageIndex(null);
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
                                    <button type="button" onClick={() => setIsRenewing(false)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
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
                                <button type="submit" className="w-full bg-coral-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-coral-700">
                                    Confirm Renewal
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
                                const attendedForType = studentSessions.filter(s => s.type === pkg.type && s.status === AttendanceStatus.Present).length;
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
                                                    <label className="block text-xs font-medium text-stone-500 mb-1">Remaining Classes</label>
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
                                                <div className="flex gap-2 justify-end">
                                                    <button 
                                                        onClick={() => setEditingPackageIndex(null)}
                                                        className="p-1.5 text-stone-500 hover:bg-stone-200 rounded"
                                                        title="Cancel"
                                                    >
                                                        <XCircle className="w-5 h-5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => savePackageEdit(idx, attendedForType)}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                                        title="Save"
                                                    >
                                                        <Save className="w-5 h-5" />
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
                    <h3 className="font-semibold text-stone-800">Recent Sessions</h3>
                    {studentSessions.length === 0 && <p className="text-sm text-stone-400">No session history found.</p>}
                    {studentSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(session => {
                        const myStatus = session.studentStatuses?.find(s => s.studentId === student.id)?.status || session.status;
                        return (
                            <div key={session.id} className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm flex items-start gap-4">
                                <div className="p-2 bg-cream rounded-lg text-center min-w-[3.5rem]">
                                    <p className="text-xs font-bold text-stone-500 uppercase">{new Date(session.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                                    <p className="text-lg font-bold text-stone-800">{new Date(session.date).getDate()}</p>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-stone-800">{session.topic}</h4>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${session.type === ClassType.OneOnOne ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                            {session.type}
                                        </span>
                                    </div>
                                    <p className="text-xs text-stone-500 mt-1">{session.notes}</p>
                                    <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
                                        myStatus === AttendanceStatus.Present ? 'bg-emerald-100 text-emerald-700' : 
                                        myStatus === AttendanceStatus.Late ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {myStatus}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
        
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