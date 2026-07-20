import React, { useMemo, useState } from 'react';
import { Student, Session, Payment, AttendanceStatus, ClassType, ClassPackage, SkillProgress, Teacher } from '../types';
import { X, PlusCircle, Edit2, Save, XCircle, TrendingUp, Activity, Trash2, AlertTriangle } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { CURRENCY_SYMBOLS, Currency, formatMoney } from '../lib/currency';
import { isTrialForStudent, isChargeableStatus, isChargeableForStudent } from '../lib/sessionHelpers';
import { localDateKey, localDateTimeInputValue, localDateOnlyToISO, todayLocalKey, newId, parseLocalDateKey } from '../lib/dateUtils';
import { derivePackages } from '../lib/packages';
import { PRICE_1ON1, PRICE_GROUP, DEFAULT_PACKAGE_SIZE } from '../constants';

interface StudentDetailProps {
  student: Student;
  sessions: Session[];
  payments: Payment[];
  teachers?: Teacher[];
  onClose: () => void;
  onUpdatePayment: (studentId: string, amount: number, extras?: Partial<Payment>) => Promise<void> | void;
  onUpdateStudent: (student: Student) => void | Promise<void>;
  onUpdateSession?: (session: Session) => Promise<void> | void;
  onDeleteSession?: (id: string) => Promise<void> | void;
  onSavePayment?: (payment: Payment) => Promise<void> | void;
  onDeletePayment?: (id: string) => Promise<void> | void;
  currency?: Currency;
  rate?: number;
}

const StudentDetail: React.FC<StudentDetailProps> = ({ student, sessions, payments, teachers = [], onClose, onUpdatePayment, onUpdateStudent, onUpdateSession, onDeleteSession, onSavePayment, onDeletePayment, currency = 'CNY' as Currency, rate = 1 }) => {
  const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'history'>('overview');
  const [historyTab, setHistoryTab] = useState<'classes' | 'purchases'>('classes');

  // Renew Package State
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewType, setRenewType] = useState<ClassType>(ClassType.OneOnOne);
  const [renewClasses, setRenewClasses] = useState(10);
  const [renewCost, setRenewCost] = useState(400);
  const [renewDate, setRenewDate] = useState<string>(() => todayLocalKey());
  const [renewMethod, setRenewMethod] = useState<string>('WeChat');

  // Edit Package State
  const [editingPackageIndex, setEditingPackageIndex] = useState<number | null>(null);
  const [editRemainingCount, setEditRemainingCount] = useState<number>(0);

  // Progress State
  const [newProgress, setNewProgress] = useState({
      reading: 50,
      writing: 50,
      listening: 50,
      speaking: 50,
      date: todayLocalKey(),
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

  // Edit Profile State (name, parentName, email, notes)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState<{ name: string; parentName: string; email: string; notes: string } | null>(null);

  // Save error feedback
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const studentSessions = useMemo(
    () => sessions.filter(s => s.studentIds.includes(student.id)),
    [sessions, student.id]
  );

  // Use PER-STUDENT status (not the session-level summary) so mixed groups show
  // correctly: if Bob is Absent and Alice is Present in the same session, Alice's
  // detail page should show Present.
  const myAttendance = useMemo(() => {
    let chargeable = 0;
    let present = 0;
    let total = 0;
    for (const s of studentSessions) {
      if (isTrialForStudent(s, student.id)) continue;
      const my = s.studentStatuses?.find(ss => ss.studentId === student.id)?.status || s.status;
      // A cancelled lesson didn't take place and was never billed — exclude it
      // from the rate rather than counting it as an absence.
      if (my === AttendanceStatus.Cancelled) continue;
      total++;
      if (my === AttendanceStatus.Present) present++;
      if (isChargeableStatus(my)) chargeable++;
    }
    const rate = total > 0 ? Math.round(((chargeable) / total) * 100) : 0;
    return { chargeable, present, total, rate };
  }, [studentSessions, student.id]);

  const attendedCount = myAttendance.chargeable;
  const attendanceRate = myAttendance.rate;

  // Lesson numbering per class type — chargeable + non-trial sessions count toward
  // a package. We treat Late the same as Present (consistent with charging).
  const lessonNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    const counters: Record<string, number> = {};
    const ascSessions = [...studentSessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const s of ascSessions) {
      if (isTrialForStudent(s, student.id)) continue;
      const myStatus = s.studentStatuses?.find(ss => ss.studentId === student.id)?.status || s.status;
      if (!isChargeableStatus(myStatus)) continue;
      counters[s.type] = (counters[s.type] || 0) + 1;
      map.set(s.id, counters[s.type] as number);
    }
    return map;
  }, [studentSessions, student.id]);

  // Package sizes per class type, derived from payment classCounts (the source of
  // truth for how big each purchased package was). Lets lesson badges show the
  // real "lesson N of package P" instead of assuming every package is 10.
  // Derived from payments, with refunds (negative classCount) already deducted.
  const derivedPackages = useMemo(
    () => derivePackages(payments || [], student.id),
    [payments, student.id]
  );

  const packageSizesByType = useMemo(() => {
    const map = new Map<ClassType, number[]>();
    derivedPackages.forEach((v, type) => map.set(type, v.sizes));
    return map;
  }, [derivedPackages]);

  // Translate a 1-based global lesson number for a class type into its package
  // index and position within that package, using the real purchased sizes.
  const locateLesson = (type: ClassType, lessonNum: number): { pkg: number; inPkg: number } => {
    const sizes = packageSizesByType.get(type);
    if (!sizes || sizes.length === 0) {
      return { pkg: Math.floor((lessonNum - 1) / DEFAULT_PACKAGE_SIZE) + 1, inPkg: ((lessonNum - 1) % DEFAULT_PACKAGE_SIZE) + 1 };
    }
    let remaining = lessonNum;
    for (let i = 0; i < sizes.length; i++) {
      if (remaining <= sizes[i]) return { pkg: i + 1, inPkg: remaining };
      remaining -= sizes[i];
    }
    // Beyond all purchased packages — extend using the most recent package's size.
    const lastSize = sizes[sizes.length - 1] || DEFAULT_PACKAGE_SIZE;
    return { pkg: sizes.length + Math.floor((remaining - 1) / lastSize) + 1, inPkg: ((remaining - 1) % lastSize) + 1 };
  };
  
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

      const newClassTypes = student.classTypes.includes(renewType)
        ? student.classTypes
        : [...student.classTypes, renewType];

      try {
          setIsSaving(true);
          setSaveError(null);
          // Record the payment FIRST — payments are the source of truth for the
          // Overview package card and purchase history. Always create it when
          // classes are being added (even a free/comp renewal with amount 0) so a
          // zero-cost renewal still shows up. The payment RPC is the only thing
          // that touches balance.
          await onUpdatePayment(student.id, Math.max(0, renewCost), {
              // A same-day purchase keeps its real time. Stamping it at local
              // midnight would sort it BEFORE a refund taken earlier today, and
              // derivePackages would then charge that refund against this brand
              // new package instead of the old one. Back-dated purchases keep the
              // midnight convention — there is no true time to recover for them.
              date: renewDate === todayLocalKey()
                  ? new Date().toISOString()
                  : localDateOnlyToISO(renewDate),
              method: renewMethod || 'WeChat',
              classCount: renewClasses,
              classType: renewType
          });
          // Then update the (legacy) packages/classTypes list. The card no longer
          // depends on this and balance is untouched here, so it can't double-charge
          // or, on retry, double-bump the package totals.
          await onUpdateStudent({
              ...student,
              packages: newPackages,
              classTypes: newClassTypes
          });
          setIsRenewing(false);
          setRenewClasses(10);
          setRenewCost(400);
          setRenewDate(todayLocalKey());
          setRenewMethod('WeChat');
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

  const handleAddProgress = async (e: React.FormEvent) => {
      e.preventDefault();
      const newEntry: SkillProgress = {
          id: newId('ph'),
          date: newProgress.date,
          reading: Number(newProgress.reading),
          writing: Number(newProgress.writing),
          listening: Number(newProgress.listening),
          speaking: Number(newProgress.speaking),
          notes: newProgress.notes
      };

      // Sort by date after adding
      const updatedHistory = [...progressHistory, newEntry].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateStudent({ ...student, progressHistory: updatedHistory });
          setNewProgress(prev => ({ ...prev, notes: '' }));
      } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setSaveError(`Failed to save progress: ${msg}`);
      } finally {
          setIsSaving(false);
      }
  };

  const handleStartEditLog = (log: SkillProgress) => {
      setEditingLogId(log.id);
      setEditLogData({ ...log });
  };

  const confirmDeleteLog = async () => {
      if (!logToDelete) return;
      const updatedHistory = (student.progressHistory || []).filter(p => p.id !== logToDelete);
      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateStudent({ ...student, progressHistory: updatedHistory });
          setLogToDelete(null);
      } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setSaveError(`Failed to delete log: ${msg}`);
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveEditLog = async () => {
      if (!editLogData || !student.progressHistory) return;

      const updatedHistory = student.progressHistory.map(p =>
          p.id === editLogData.id ? editLogData : p
      ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateStudent({ ...student, progressHistory: updatedHistory });
          setEditingLogId(null);
          setEditLogData(null);
      } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setSaveError(`Failed to save log: ${msg}`);
      } finally {
          setIsSaving(false);
      }
  };

  // ── Session edit/delete ────────────────────────────────────────────
  const startEditSession = (s: Session) => {
      setEditingSessionId(s.id);
      // Seed an explicit per-student status entry for EVERY participant (preserving
      // any existing entry, incl. its trial override). Otherwise a legacy session
      // with a partial studentStatuses array could have one student's edit
      // implicitly flip an unentered student to the recomputed summary status.
      const seeded = s.studentIds.map(sid => {
        const existing = s.studentStatuses?.find(ss => ss.studentId === sid);
        return existing ? { ...existing } : { studentId: sid, status: s.status };
      });
      setEditSessionData({ ...s, studentStatuses: seeded });
      setSaveError(null);
  };

  const cancelEditSession = () => {
      setEditingSessionId(null);
      setEditSessionData(null);
      setSaveError(null);
  };

  const saveEditSession = async () => {
      if (!editSessionData || !onUpdateSession) return;
      // Recompute price from the (possibly edited) type and per-student trial
      // flags — mirroring SessionLog. The save_session RPC divides the stored
      // price by the CURRENT non-trial headcount, so a stale price would over- or
      // under-charge (e.g. trialing one of two students would double the other's bill).
      const nonTrial = editSessionData.studentIds.filter(sid => !isTrialForStudent(editSessionData, sid)).length;
      const unit = editSessionData.type === ClassType.OneOnOne ? PRICE_1ON1 : PRICE_GROUP;
      const price = editSessionData.isTrial ? 0 : unit * nonTrial;
      const payload: Session = { ...editSessionData, price };
      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateSession(payload);
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

      // Recompute the session-level summary status from ALL per-student statuses
      // — don't blindly write this student's status into the summary, which used
      // to make a single absent student look like the whole session was absent.
      const all = list.map(s => s.status);
      let summary: AttendanceStatus = editSessionData.status;
      if (all.length > 0) {
          if (all.includes(AttendanceStatus.Cancelled)) summary = AttendanceStatus.Cancelled;
          else if (all.includes(AttendanceStatus.Absent)) summary = AttendanceStatus.Absent;
          else if (all.includes(AttendanceStatus.Late)) summary = AttendanceStatus.Late;
          else summary = AttendanceStatus.Present;
      }

      setEditSessionData({ ...editSessionData, studentStatuses: list, status: summary });
  };

  // ── Profile edit ───────────────────────────────────────────────────
  const startEditProfile = () => {
      setEditProfileData({
          name: student.name || '',
          parentName: student.parentName || '',
          email: student.email || '',
          notes: student.notes || ''
      });
      setIsEditingProfile(true);
      setSaveError(null);
  };

  const cancelEditProfile = () => {
      setIsEditingProfile(false);
      setEditProfileData(null);
      setSaveError(null);
  };

  const saveEditProfile = async () => {
      if (!editProfileData) return;
      const trimmedName = editProfileData.name.trim();
      if (!trimmedName) {
          setSaveError('Name cannot be empty.');
          return;
      }
      try {
          setIsSaving(true);
          setSaveError(null);
          await onUpdateStudent({
              ...student,
              name: trimmedName,
              parentName: editProfileData.parentName.trim() || undefined,
              email: editProfileData.email.trim() || undefined,
              notes: editProfileData.notes
          });
          setIsEditingProfile(false);
          setEditProfileData(null);
      } catch (err: any) {
          setSaveError(`Failed to save: ${err?.message ?? String(err)}`);
      } finally {
          setIsSaving(false);
      }
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
      // A blank amount field parks NaN in state so the "-" keystroke survives;
      // it must never reach the RPC, where it would null out the balance delta.
      if (!Number.isFinite(editPaymentData.amount)) {
          setSaveError('Enter an amount (use a negative number for a refund).');
          return;
      }
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
                    {/* Profile Card (editable) */}
                    <div className="bg-white p-4 rounded-2xl border border-cream-border shadow-sm">
                        {!isEditingProfile ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-stone-800 text-sm">Profile</h3>
                                    <button
                                        onClick={startEditProfile}
                                        className="p-1 text-stone-400 hover:text-coral-600 hover:bg-coral-50 rounded transition-colors"
                                        title="Edit Profile"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-stone-500">Name</p>
                                        <p className="text-stone-800">{student.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-stone-500">Parent</p>
                                        <p className="text-stone-800">{student.parentName || <span className="text-stone-400 italic">—</span>}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] uppercase font-bold text-stone-500">Email</p>
                                        <p className="text-stone-800 break-all">{student.email || <span className="text-stone-400 italic">—</span>}</p>
                                    </div>
                                    {student.notes && (
                                        <div className="col-span-2">
                                            <p className="text-[10px] uppercase font-bold text-stone-500">Notes</p>
                                            <p className="text-stone-700 whitespace-pre-wrap">{student.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : editProfileData && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-stone-800 text-sm">Edit Profile</h3>
                                    <button onClick={cancelEditProfile} className="p-1 text-stone-400 hover:text-stone-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={editProfileData.name}
                                        onChange={e => setEditProfileData({ ...editProfileData, name: e.target.value })}
                                        className="w-full p-2 rounded-md border text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Parent Name</label>
                                    <input
                                        type="text"
                                        value={editProfileData.parentName}
                                        onChange={e => setEditProfileData({ ...editProfileData, parentName: e.target.value })}
                                        className="w-full p-2 rounded-md border text-xs"
                                        placeholder="Parent's name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={editProfileData.email}
                                        onChange={e => setEditProfileData({ ...editProfileData, email: e.target.value })}
                                        className="w-full p-2 rounded-md border text-xs"
                                        placeholder="parent@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Notes</label>
                                    <textarea
                                        value={editProfileData.notes}
                                        onChange={e => setEditProfileData({ ...editProfileData, notes: e.target.value })}
                                        rows={3}
                                        className="w-full p-2 rounded-md border text-xs"
                                        placeholder="Any notes about the student"
                                    />
                                </div>
                                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={cancelEditProfile}
                                        disabled={isSaving}
                                        className="px-3 py-1.5 text-xs text-stone-600 bg-white border border-cream-border rounded-md hover:bg-stone-50 disabled:opacity-50"
                                    >Cancel</button>
                                    <button
                                        type="button"
                                        onClick={saveEditProfile}
                                        disabled={isSaving}
                                        className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
                                    >{isSaving ? 'Saving…' : 'Save'}</button>
                                </div>
                            </div>
                        )}
                    </div>

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
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-stone-500 mb-1">Payment Date</label>
                                        <input
                                            type="date"
                                            value={renewDate}
                                            onChange={e => setRenewDate(e.target.value)}
                                            className="w-full p-2 rounded-md border text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-stone-500 mb-1">Method / Note</label>
                                        <input
                                            type="text"
                                            value={renewMethod}
                                            onChange={e => setRenewMethod(e.target.value)}
                                            placeholder="WeChat"
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
                    
                    {/* Class Packages — derived from PAYMENTS (the source of truth).
                        For each class type, the latest payment's classCount = current package size.
                        Progress = sessions attended after subtracting earlier (finished) payments. */}
                    {(() => {
                        // Package sizes come from derivePackages, so a refund has already
                        // been deducted from the package it was charged back against.
                        if (derivedPackages.size === 0) return null;
                        type Visible = { type: ClassType; total: number; previousTotal: number; latestPaymentDate: string };
                        const visible: Visible[] = [];
                        derivedPackages.forEach(({ sizes, latestPurchaseDate }, type) => {
                            if (sizes.length === 0) return;
                            const total = sizes[sizes.length - 1];
                            const previousTotal = sizes.slice(0, -1).reduce((sum, n) => sum + n, 0);
                            visible.push({ type, total, previousTotal, latestPaymentDate: latestPurchaseDate });
                        });
                        if (visible.length === 0) return null;
                        return (
                        <div className="space-y-3">
                            {visible.map(({ type, total, previousTotal, latestPaymentDate }) => {
                                // Total chargeable for this type — per-student status, counting
                                // Present AND Late (matches lesson numbering and the SQL charge logic).
                                const totalAttendedForType = studentSessions.filter(s => s.type === type && isChargeableForStudent(s, student.id)).length;
                                // Subtract sessions that belong to earlier (finished) packages of the same type
                                const attendedForType = Math.max(0, Math.min(total, totalAttendedForType - previousTotal));
                                const isEditing = false; // legacy package edit form is disabled in payment-driven mode
                                // total can be 0 when a package was refunded in full — guard the divide.
                                const progress = total > 0 ? Math.min(100, Math.round((attendedForType / total) * 100)) : 100;
                                const pkg = { type, total, active: true } as ClassPackage;
                                const idx = -1;
                                
                                return (
                                    <div key={`${type}-${latestPaymentDate}`} className="bg-white p-5 rounded-2xl border border-cream-border shadow-sm transition-all">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-semibold text-stone-800">{pkg.type} Package</h3>
                                            <span className="text-[10px] text-stone-400" title="Edit number of classes from the payment in History → Purchases">
                                                Last renewed {new Date(latestPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
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
                        );
                    })()}

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
                                        <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} tickFormatter={d => parseLocalDateKey(d).toLocaleDateString(undefined, {month:'short', day:'numeric'})} />
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
                                            <span className="text-xs font-bold text-stone-500">{parseLocalDateKey(log.date).toLocaleDateString()}</span>
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
                            {[...studentSessions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(session => {
                                const myStatus = session.studentStatuses?.find(s => s.studentId === student.id)?.status || session.status;
                                const myIsTrial = isTrialForStudent(session, student.id);
                                const lessonNum = lessonNumberMap.get(session.id);
                                const loc = lessonNum ? locateLesson(session.type, lessonNum) : null;
                                const pkgIndex = loc ? loc.pkg : null;
                                const inPkgIndex = loc ? loc.inPkg : null;
                                const isEditing = editingSessionId === session.id && editSessionData;
                                if (isEditing && editSessionData) {
                                    const editStatus = editSessionData.studentStatuses?.find(s => s.studentId === student.id)?.status || editSessionData.status;
                                    // Show local time in datetime-local input (not UTC). Mixing toISOString
                                    // with the local input value caused drift on every round trip.
                                    const dateValue = localDateTimeInputValue(editSessionData.date);
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
                                                        onChange={e => {
                                                            // The datetime-local value is "YYYY-MM-DDTHH:MM" in LOCAL time.
                                                            // `new Date(value)` interprets it as local — that's what we want.
                                                            const next = e.target.value ? new Date(e.target.value).toISOString() : editSessionData.date;
                                                            setEditSessionData({ ...editSessionData, date: next });
                                                        }}
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
                                            {session.teacherId && <p className="text-xs text-stone-500 mt-1">Teacher: {teacherMap.get(session.teacherId) || 'Unknown'}</p>}
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
                                                const dateValue = localDateKey(editPaymentData.date);
                                                return (
                                                    <div key={payment.id} className="bg-white p-4 rounded-2xl border border-coral-200 shadow-sm space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-sm font-semibold text-stone-800">Edit Payment</h4>
                                                            <button onClick={cancelEditPayment} className="p-1 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Amount ({CURRENCY_SYMBOLS.CNY})</label>
                                                                {/* No min: a refund row carries a NEGATIVE amount. Empty/partial
                                                                    input maps to '' rather than 0 — coercing the intermediate
                                                                    "-" state to 0 makes React rewrite the box and eat the minus,
                                                                    so a refund could never be retyped. */}
                                                                <input
                                                                    type="number"
                                                                    placeholder="negative = refund"
                                                                    value={Number.isFinite(editPaymentData.amount) ? editPaymentData.amount : ''}
                                                                    onChange={e => {
                                                                        const v = e.target.value;
                                                                        const n = parseFloat(v);
                                                                        setEditPaymentData({
                                                                            ...editPaymentData,
                                                                            amount: v === '' || Number.isNaN(n) ? NaN : n
                                                                        });
                                                                    }}
                                                                    className="w-full p-2 rounded-md border text-xs"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Date</label>
                                                                <input
                                                                    type="date"
                                                                    value={dateValue}
                                                                    onChange={e => {
                                                                        // Preserve the original intraday time when the day itself
                                                                        // hasn't changed. Collapsing to local midnight would re-sort
                                                                        // this payment before a same-day refund and hand the refund
                                                                        // to the wrong package.
                                                                        const next = e.target.value === localDateKey(editPaymentData.date)
                                                                            ? editPaymentData.date
                                                                            : localDateOnlyToISO(e.target.value);
                                                                        setEditPaymentData({ ...editPaymentData, date: next });
                                                                    }}
                                                                    className="w-full p-2 rounded-md border text-xs"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Number of Classes</label>
                                                                {/* No lower clamp: a refund row legitimately carries a
                                                                    NEGATIVE classCount. Clamping to 0 would silently turn
                                                                    an edited refund back into a purchase and hand the
                                                                    student their classes back while the money stayed out. */}
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    placeholder="e.g. 10 (negative = refund)"
                                                                    value={editPaymentData.classCount ?? ''}
                                                                    onChange={e => {
                                                                        const v = e.target.value;
                                                                        const n = parseInt(v, 10);
                                                                        setEditPaymentData({
                                                                            ...editPaymentData,
                                                                            classCount: v === '' || Number.isNaN(n) ? undefined : n
                                                                        });
                                                                    }}
                                                                    className="w-full p-2 rounded-md border text-xs"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">Class Type</label>
                                                                <select
                                                                    value={editPaymentData.classType || ''}
                                                                    onChange={e => setEditPaymentData({ ...editPaymentData, classType: e.target.value === '' ? undefined : e.target.value as ClassType })}
                                                                    className="w-full p-2 rounded-md border text-xs"
                                                                >
                                                                    <option value="">— None —</option>
                                                                    <option value={ClassType.OneOnOne}>One-on-One</option>
                                                                    <option value={ClassType.Group}>One-on-Two</option>
                                                                </select>
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
                                                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                                                {typeof payment.classCount === 'number' && (
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-coral-50 text-coral-700 border border-coral-100">
                                                                        {payment.classCount} {payment.classCount === 1 ? 'class' : 'classes'}
                                                                    </span>
                                                                )}
                                                                {payment.classType && (
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${payment.classType === ClassType.OneOnOne ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
                                                                        {payment.classType}
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                    {payment.method || 'Payment'}
                                                                </span>
                                                            </div>
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