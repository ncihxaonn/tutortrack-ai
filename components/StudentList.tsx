import React, { useState } from 'react';
import { Student, ClassType, StudentStatus, ClassPackage } from '../types';
import { Search, Plus, User, Trash2, Archive, RotateCcw, AlertTriangle } from 'lucide-react';

interface StudentListProps {
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id' | 'joinedDate' | 'status'>) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onSelectStudent: (student: Student) => void;
}

const StudentList: React.FC<StudentListProps> = ({ students, onAddStudent, onUpdateStudent, onDeleteStudent, onSelectStudent }) => {
  const [viewStatus, setViewStatus] = useState<StudentStatus>('Active');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Delete confirmation state
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  
  // New student form state
  const [name, setName] = useState('');
  const [parentName, setParentName] = useState('');
  const [notes, setNotes] = useState('');
  
  // Package Data
  const [oneOnOneEnabled, setOneOnOneEnabled] = useState(false);
  const [oneOnOneClasses, setOneOnOneClasses] = useState(0);
  const [oneOnOnePaid, setOneOnOnePaid] = useState(0);

  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groupClasses, setGroupClasses] = useState(0);
  const [groupPaid, setGroupPaid] = useState(0);

  const filteredStudents = students.filter(s => 
    s.status === viewStatus &&
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.parentName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!oneOnOneEnabled && !groupEnabled) {
        alert("Please enable at least one class program.");
        return;
    }

    const classTypes: ClassType[] = [];
    const packages: ClassPackage[] = [];
    let initialBalance = 0;
    let autoNotes = "";

    if (oneOnOneEnabled) {
        classTypes.push(ClassType.OneOnOne);
        packages.push({ type: ClassType.OneOnOne, total: oneOnOneClasses, active: true });
        initialBalance -= oneOnOnePaid; // Credit
        if (oneOnOnePaid > 0) {
            autoNotes += `Initial Payment: $${oneOnOnePaid} for ${oneOnOneClasses} One-on-One sessions. `;
        }
    }

    if (groupEnabled) {
        classTypes.push(ClassType.Group);
        packages.push({ type: ClassType.Group, total: groupClasses, active: true });
        initialBalance -= groupPaid; // Credit
        if (groupPaid > 0) {
            autoNotes += `Initial Payment: $${groupPaid} for ${groupClasses} One-on-Two sessions. `;
        }
    }

    const finalNotes = notes + (notes && autoNotes ? "\n" : "") + autoNotes;

    onAddStudent({
        name,
        parentName,
        classTypes,
        packages,
        notes: finalNotes,
        balance: initialBalance,
        progressHistory: []
    });

    setIsAdding(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setParentName('');
    setNotes('');
    setOneOnOneEnabled(false);
    setOneOnOneClasses(0);
    setOneOnOnePaid(0);
    setGroupEnabled(false);
    setGroupClasses(0);
    setGroupPaid(0);
  }

  const handleDeleteClick = (e: React.MouseEvent, student: Student) => {
      e.stopPropagation();
      setStudentToDelete(student);
  };

  const confirmDelete = () => {
      if (studentToDelete) {
          onDeleteStudent(studentToDelete.id);
          setStudentToDelete(null);
      }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button 
                onClick={() => setViewStatus('Active')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewStatus === 'Active' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Active
            </button>
            <button 
                onClick={() => setViewStatus('Archived')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewStatus === 'Archived' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                Archived
            </button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
            </div>
            {viewStatus === 'Active' && (
                <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                <Plus className="w-4 h-4" />
                Add Student
                </button>
            )}
        </div>
      </div>

      {/* Add Student Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="font-semibold text-lg mb-4">New Student Registration</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    required
                    placeholder="Student Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="p-2 border rounded-md w-full"
                />
                <input
                    placeholder="Parent Name"
                    value={parentName}
                    onChange={e => setParentName(e.target.value)}
                    className="p-2 border rounded-md w-full"
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                {/* One on One Column */}
                <div className={`space-y-3 transition-opacity ${oneOnOneEnabled ? 'opacity-100' : 'opacity-70'}`}>
                     <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={oneOnOneEnabled}
                            onChange={(e) => setOneOnOneEnabled(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        One-on-One Program
                    </label>
                    <div className="pl-6 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Number of Sessions</label>
                            <input
                                type="number"
                                min="0"
                                disabled={!oneOnOneEnabled}
                                value={oneOnOneClasses || ''}
                                onChange={e => setOneOnOneClasses(parseInt(e.target.value) || 0)}
                                className="w-full p-2 border rounded-md text-sm"
                                placeholder="e.g. 10"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Amount Paid ($)</label>
                            <input
                                type="number"
                                min="0"
                                disabled={!oneOnOneEnabled}
                                value={oneOnOnePaid || ''}
                                onChange={e => setOneOnOnePaid(parseFloat(e.target.value) || 0)}
                                className="w-full p-2 border rounded-md text-sm"
                                placeholder="e.g. 400"
                            />
                        </div>
                    </div>
                </div>

                 {/* Group Column */}
                 <div className={`space-y-3 transition-opacity ${groupEnabled ? 'opacity-100' : 'opacity-70'}`}>
                     <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={groupEnabled}
                            onChange={(e) => setGroupEnabled(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        One-on-Two (Group) Program
                    </label>
                    <div className="pl-6 space-y-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Number of Sessions</label>
                            <input
                                type="number"
                                min="0"
                                disabled={!groupEnabled}
                                value={groupClasses || ''}
                                onChange={e => setGroupClasses(parseInt(e.target.value) || 0)}
                                className="w-full p-2 border rounded-md text-sm"
                                placeholder="e.g. 10"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Amount Paid ($)</label>
                            <input
                                type="number"
                                min="0"
                                disabled={!groupEnabled}
                                value={groupPaid || ''}
                                onChange={e => setGroupPaid(parseFloat(e.target.value) || 0)}
                                className="w-full p-2 border rounded-md text-sm"
                                placeholder="e.g. 300"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <textarea
              placeholder="Additional Notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2 border rounded-md"
              rows={2}
            />
            
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => { setIsAdding(false); resetForm(); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-md"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create Student
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Student Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-400">
                No {viewStatus.toLowerCase()} students found.
            </div>
        )}
        {filteredStudents.map(student => (
          <div 
            key={student.id} 
            className="group bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between h-full"
          >
            <div className="cursor-pointer" onClick={() => onSelectStudent(student)}>
                <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-slate-100 rounded-full group-hover:bg-indigo-50 transition-colors">
                        <User className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                        {student.classTypes.map(type => (
                            <span key={type} className={`text-[10px] px-2 py-1 rounded-full whitespace-nowrap ${type === ClassType.OneOnOne ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                {type}
                            </span>
                        ))}
                    </div>
                </div>
                <h3 className="font-semibold text-slate-800">{student.name}</h3>
                <p className="text-sm text-slate-500 mb-1">{student.parentName || 'No parent listed'}</p>
                {student.packages && student.packages.length > 0 ? (
                    <div className="flex flex-col gap-1 mb-4">
                        {student.packages.map((pkg, idx) => (
                             <p key={idx} className="text-xs text-slate-400">
                                {pkg.type === ClassType.OneOnOne ? '1-on-1' : 'Group'}: {pkg.total} classes
                             </p>
                        ))}
                    </div>
                ) : (
                    <div className="h-4 mb-4"></div>
                )}
            </div>
            
            <div className="pt-4 border-t border-slate-50 flex items-end justify-between">
              <div className="text-xs">
                <p className="text-slate-400">Balance</p>
                <p className={`font-medium ${student.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {student.balance > 0 ? `Owes $${student.balance}` : student.balance < 0 ? `Credit $${Math.abs(student.balance)}` : 'Settled'}
                </p>
              </div>
              
              <div className="flex gap-2">
                 {student.status === 'Active' ? (
                     <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateStudent({...student, status: 'Archived'}); }}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                        title="Archive"
                     >
                        <Archive className="w-4 h-4" />
                     </button>
                 ) : (
                    <>
                     <button 
                        onClick={(e) => { e.stopPropagation(); onUpdateStudent({...student, status: 'Active'}); }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        title="Restore"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                     <button 
                        onClick={(e) => handleDeleteClick(e, student)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete Permanently"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                    </>
                 )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center text-center">
                      <div className="bg-red-100 p-3 rounded-full mb-4">
                          <AlertTriangle className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Student?</h3>
                      <p className="text-slate-500 text-sm mb-6">
                          Are you sure you want to permanently delete <strong>{studentToDelete.name}</strong>? This action cannot be undone and all data will be lost.
                      </p>
                      <div className="flex gap-3 w-full">
                          <button 
                              onClick={() => setStudentToDelete(null)}
                              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={confirmDelete}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                          >
                              Delete
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default StudentList;