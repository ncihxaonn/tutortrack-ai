import React, { useState } from 'react';
import { Teacher, StudentStatus, Session } from '../types';
import { Search, Plus, GraduationCap, Trash2, Archive, RotateCcw, AlertTriangle, X, Save } from 'lucide-react';

interface TeacherListProps {
  teachers: Teacher[];
  sessions: Session[];
  onAddTeacher: (teacher: Omit<Teacher, 'id' | 'joinedDate' | 'status'>) => void | Promise<void>;
  onUpdateTeacher: (teacher: Teacher) => void | Promise<void>;
  onDeleteTeacher: (id: string) => void | Promise<void>;
}

const TeacherList: React.FC<TeacherListProps> = ({ teachers, sessions, onAddTeacher, onUpdateTeacher, onDeleteTeacher }) => {
  const [viewStatus, setViewStatus] = useState<StudentStatus>('Active');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (t: Teacher) => {
    setEditingId(t.id);
    setIsAdding(false);
    setName(t.name);
    setEmail(t.email || '');
    setPhone(t.phone || '');
    setNotes(t.notes);
  };

  const filtered = teachers.filter(t =>
    t.status === viewStatus &&
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sessionsCountFor = (teacherId: string) =>
    sessions.filter(s => s.teacherId === teacherId).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      const existing = teachers.find(t => t.id === editingId);
      if (!existing) return;
      await onUpdateTeacher({
        ...existing,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim()
      });
    } else {
      await onAddTeacher({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim()
      });
    }
    resetForm();
  };

  const toggleArchive = async (t: Teacher) => {
    await onUpdateTeacher({ ...t, status: t.status === 'Active' ? 'Archived' : 'Active' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-stone-900 tracking-tight">Teachers</h1>
          <p className="text-stone-500 mt-1">Manage tutors who lead your sessions.</p>
        </div>
        <button
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          className="bg-coral-600 hover:bg-coral-700 text-white font-medium px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-cream p-1 rounded-lg">
          {(['Active', 'Archived'] as StudentStatus[]).map(s => (
            <button
              key={s}
              onClick={() => setViewStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewStatus === s ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search teachers…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-cream-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-coral-200"
          />
        </div>
      </div>

      {/* Add/Edit form */}
      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-cream-border shadow-sm p-5 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-stone-800">{editingId ? 'Edit teacher' : 'New teacher'}</h3>
            <button type="button" onClick={resetForm} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 border rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-2 border rounded-md text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 text-sm text-stone-600 bg-white border border-cream-border rounded-md hover:bg-stone-50">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm text-white bg-coral-600 hover:bg-coral-700 rounded-md flex items-center gap-1">
              <Save className="w-4 h-4" /> {editingId ? 'Save changes' : 'Add teacher'}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center text-stone-400 text-sm py-12 bg-white rounded-2xl border border-cream-border">
          No {viewStatus.toLowerCase()} teachers.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => {
            const sessionCount = sessionsCountFor(t.id);
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-cream-border shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-coral-100 p-2 rounded-xl">
                      <GraduationCap className="w-5 h-5 text-coral-700" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-800">{t.name}</h3>
                      <p className="text-xs text-stone-500">{sessionCount} session{sessionCount === 1 ? '' : 's'} taught</p>
                    </div>
                  </div>
                </div>
                {(t.email || t.phone) && (
                  <div className="text-xs text-stone-500 space-y-0.5">
                    {t.email && <div>✉️ {t.email}</div>}
                    {t.phone && <div>📱 {t.phone}</div>}
                  </div>
                )}
                {t.notes && (
                  <p className="text-xs text-stone-600 bg-cream rounded-md p-2 border border-cream-border whitespace-pre-line">{t.notes}</p>
                )}
                <div className="flex gap-2 pt-2 border-t border-cream-border">
                  <button onClick={() => startEdit(t)} className="flex-1 text-xs px-2 py-1.5 bg-cream hover:bg-cream-soft border border-cream-border rounded-md text-stone-700">Edit</button>
                  <button onClick={() => toggleArchive(t)} className="flex-1 text-xs px-2 py-1.5 bg-cream hover:bg-cream-soft border border-cream-border rounded-md text-stone-700 flex items-center justify-center gap-1">
                    {t.status === 'Active' ? (<><Archive className="w-3 h-3" /> Archive</>) : (<><RotateCcw className="w-3 h-3" /> Restore</>)}
                  </button>
                  <button onClick={() => setTeacherToDelete(t)} className="text-xs px-2 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-md text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm */}
      {teacherToDelete && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-cream-border p-6 max-w-sm w-full">
            <div className="flex flex-col items-center text-center">
              <div className="bg-red-50 p-3 rounded-full mb-3">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h4 className="font-bold text-stone-800 text-lg mb-2">Delete {teacherToDelete.name}?</h4>
              <p className="text-sm text-stone-500 mb-6">
                Past sessions taught by them will keep the records but show as unassigned.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setTeacherToDelete(null)} className="px-3 py-1.5 text-sm text-stone-600 bg-white border border-cream-border rounded-md hover:bg-stone-50">Cancel</button>
              <button
                onClick={async () => { const id = teacherToDelete.id; setTeacherToDelete(null); await onDeleteTeacher(id); }}
                className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherList;
