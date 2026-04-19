import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { Users, DollarSign, CalendarCheck, TrendingUp, Activity, Calendar, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Student, Session, Payment, AttendanceStatus } from '../types';
import { Currency, CURRENCY_SYMBOLS, formatMoney } from '../lib/currency';

interface DashboardProps {
  students: Student[];
  sessions: Session[];
  payments: Payment[];
  onUpdatePayment: (p: Payment) => void;
  onDeletePayment: (id: string) => void;
  currency: Currency;
  rate: number;
}

const Dashboard: React.FC<DashboardProps> = ({ students, sessions, payments, onUpdatePayment, onDeletePayment, currency, rate }) => {
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  // --- Calculations ---

  // 1. Total Revenue
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  // 2. Attendance Rate (paid sessions only)
  const paidSessions = sessions.filter(s => !s.isTrial);
  const trialCount = sessions.length - paidSessions.length;
  const totalSessions = paidSessions.length;
  const attendedSessions = paidSessions.filter(s => s.status === AttendanceStatus.Present).length;
  const attendanceRate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

  // 3. Active Students
  const activeStudents = students.filter(s => s.status === 'Active').length;

  // 4. Outstanding Balance
  const totalOutstanding = students.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);

  // --- Chart Data Preparation ---

  // A. Revenue Trend (Monthly)
  const revenueData = React.useMemo(() => {
    const grouped: Record<string, number> = {};
    const sortedPayments = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Initialize with last 6 months to ensure continuity if needed, or just map existing
    if (sortedPayments.length === 0) return [];

    sortedPayments.forEach(p => {
        const date = new Date(p.date);
        const key = date.toLocaleDateString('en-US', { month: 'short' }); // e.g., "Oct"
        grouped[key] = (grouped[key] || 0) + p.amount;
    });

    return Object.entries(grouped).map(([name, amount]) => ({ name, amount }));
  }, [payments]);

  // B. Weekly Session Activity (Bar Chart)
  const sessionActivityData = React.useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d);
    }

    return days.map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const daySessions = sessions.filter(s => s.date.startsWith(dateStr));
        return {
            name: day.toLocaleDateString('en-US', { weekday: 'short' }),
            fullDate: dateStr,
            count: daySessions.filter(s => !s.isTrial).length,
            trials: daySessions.filter(s => s.isTrial).length
        };
    });
  }, [sessions]);

  // C. Attendance Breakdown (Pie Chart) — paid sessions only
  const attendanceData = React.useMemo(() => {
    const present = paidSessions.filter(s => s.status === AttendanceStatus.Present).length;
    const late = paidSessions.filter(s => s.status === AttendanceStatus.Late).length;
    const absent = paidSessions.filter(s => s.status === AttendanceStatus.Absent || s.status === AttendanceStatus.Cancelled).length;
    
    const data = [
        { name: 'Present', value: present, color: '#10b981' }, // Emerald
        { name: 'Late', value: late, color: '#f59e0b' },    // Amber
        { name: 'Absent', value: absent, color: '#ef4444' }  // Red
    ];
    return data.filter(d => d.value > 0);
  }, [paidSessions]);


  const StatCard = ({ title, value, sub, icon: Icon, color, trend }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-cream-border flex items-start justify-between transition-all hover:shadow-md">
      <div>
        <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
        <h3 className="font-serif text-3xl font-semibold text-stone-900 tracking-tight">{value}</h3>
        {sub && (
            <div className="flex items-center gap-1 mt-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-cream-soft text-stone-600'}`}>
                    {sub}
                </span>
            </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <h2 className="font-serif text-xl font-semibold text-stone-900">Business Overview</h2>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatMoney(totalRevenue, currency, rate)}
          sub="All time"
          trend="up"
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Active Students" 
          value={activeStudents} 
          sub={`${students.length - activeStudents} archived`}
          icon={Users} 
          color="bg-blue-500" 
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          sub={trialCount > 0 ? `${trialCount} trial${trialCount === 1 ? '' : 's'} (not counted)` : 'Paid sessions'}
          icon={CalendarCheck}
          color="bg-coral-500"
        />
        <StatCard
          title="Outstanding"
          value={formatMoney(totalOutstanding, currency, rate)}
          sub="To collect"
          icon={TrendingUp}
          color="bg-rose-500"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-cream-border flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-emerald-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                    <h3 className="font-serif text-lg font-semibold text-stone-900">Revenue Trend</h3>
                    <p className="text-xs text-stone-400">Monthly income over time</p>
                </div>
            </div>
            
            <div className="flex-1 min-h-[300px]">
                {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueData}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDE5D7" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} tickFormatter={(value) => formatMoney(value, currency, rate)} />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => [formatMoney(value, currency, rate), 'Revenue']}
                            />
                            <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-stone-400 bg-cream rounded-lg border border-dashed border-cream-border">
                        No payment data available yet.
                    </div>
                )}
            </div>
        </div>

        {/* Attendance Breakdown Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-cream-border flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                 <div className="p-2 bg-coral-50 rounded-lg">
                    <Activity className="w-5 h-5 text-coral-600" />
                </div>
                <div>
                    <h3 className="font-serif text-lg font-semibold text-stone-900">Attendance</h3>
                    <p className="text-xs text-stone-400">Session status distribution</p>
                </div>
            </div>

            <div className="flex-1 min-h-[300px] relative">
                 {attendanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={attendanceData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {attendanceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                 ) : (
                    <div className="h-full flex items-center justify-center text-stone-400 bg-cream rounded-lg border border-dashed border-cream-border">
                        No session data available yet.
                    </div>
                 )}
                 {attendanceData.length > 0 && (
                     <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                         <span className="font-serif text-4xl font-semibold text-stone-900">{totalSessions}</span>
                         <p className="text-xs text-stone-400 uppercase font-semibold">Total</p>
                     </div>
                 )}
            </div>
        </div>
      </div>

      {/* Bottom Row: Weekly Activity & Recent List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Weekly Bar Chart */}
           <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-cream-border h-80">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-coral-50 rounded-lg">
                        <Calendar className="w-5 h-5 text-coral-600" />
                    </div>
                    <div>
                        <h3 className="font-serif text-lg font-semibold text-stone-900">Weekly Activity</h3>
                        <p className="text-xs text-stone-400">Sessions per day (Last 7 Days)</p>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="80%">
                    <BarChart data={sessionActivityData} barSize={40}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDE5D7" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} allowDecimals={false} />
                        <RechartsTooltip 
                            cursor={{fill: '#F5EFE4'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {sessionActivityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="#D97757" />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
           </div>
           
           {/* Recent Payments List */}
           <div className="bg-white p-6 rounded-2xl border border-cream-border h-80 overflow-hidden flex flex-col">
                <h3 className="font-serif text-lg font-semibold text-stone-900 mb-4">Recent Payments</h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {payments.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No payments recorded.</p>}
                    {[...payments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(payment => {
                        const student = students.find(s => s.id === payment.studentId);
                        return (
                            <div key={payment.id} className="group flex justify-between items-center p-3 bg-cream rounded-lg border border-cream-border hover:border-coral-200 transition-colors">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-stone-800 truncate">{student?.name || 'Unknown'}</p>
                                    <p className="text-xs text-stone-500">{new Date(payment.date).toLocaleDateString()} · {payment.method}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-sm">
                                        +{formatMoney(payment.amount, currency, rate)}
                                    </span>
                                    <button
                                        onClick={() => setEditingPayment(payment)}
                                        title="Edit payment"
                                        className="p-1.5 text-stone-400 hover:text-coral-600 hover:bg-coral-50 rounded-md transition-colors"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setPaymentToDelete(payment)}
                                        title="Delete payment"
                                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
           </div>
      </div>

      {/* Edit Payment Modal */}
      {editingPayment && (
          <EditPaymentModal
              payment={editingPayment}
              students={students}
              onClose={() => setEditingPayment(null)}
              onSave={(p) => { onUpdatePayment(p); setEditingPayment(null); }}
          />
      )}

      {/* Delete Payment Confirmation */}
      {paymentToDelete && (
          <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 p-4" onClick={() => setPaymentToDelete(null)}>
              <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-cream-border" onClick={e => e.stopPropagation()}>
                  <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 bg-red-50 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                          <h3 className="font-serif text-lg font-semibold tracking-tight text-stone-900">Delete this payment?</h3>
                          <p className="text-sm text-stone-600 mt-1">
                              Removing {formatMoney(paymentToDelete.amount, currency, rate)} from {students.find(s => s.id === paymentToDelete.studentId)?.name || 'this student'}. Their balance will be restored by the same amount. This can't be undone.
                          </p>
                      </div>
                  </div>
                  <div className="flex justify-end gap-2">
                      <button
                          onClick={() => setPaymentToDelete(null)}
                          className="px-4 py-2 text-sm font-medium text-stone-700 bg-cream hover:bg-cream-soft rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button
                          onClick={() => { onDeletePayment(paymentToDelete.id); setPaymentToDelete(null); }}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                          Delete
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

interface EditPaymentModalProps {
    payment: Payment;
    students: Student[];
    onClose: () => void;
    onSave: (p: Payment) => void;
}

const EditPaymentModal: React.FC<EditPaymentModalProps> = ({ payment, students, onClose, onSave }) => {
    const [amount, setAmount] = useState(payment.amount.toString());
    const [date, setDate] = useState(payment.date.slice(0, 10));
    const [method, setMethod] = useState(payment.method);
    const [studentId, setStudentId] = useState(payment.studentId);

    const handleSave = () => {
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed <= 0) return;
        onSave({
            ...payment,
            amount: parsed,
            date: new Date(date).toISOString(),
            method: method.trim() || 'Manual',
            studentId
        });
    };

    return (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-cream-border" onClick={e => e.stopPropagation()}>
                <h3 className="font-serif text-lg font-semibold tracking-tight text-stone-900 mb-4">Edit Payment</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-600 mb-1">Student</label>
                        <select
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            className="w-full px-3 py-2 border border-cream-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm"
                        >
                            {students.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-600 mb-1">Amount ({CURRENCY_SYMBOLS.CNY})</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-cream-border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm"
                        />
                        <p className="text-[10px] text-stone-400 mt-1">Stored in CNY regardless of display toggle.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-600 mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 border border-cream-border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-600 mb-1">Method</label>
                        <input
                            type="text"
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            placeholder="Cash, Bank Transfer, etc."
                            className="w-full px-3 py-2 border border-cream-border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-700 bg-cream hover:bg-cream-soft rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-coral-600 hover:bg-coral-700 rounded-lg transition-colors">Save</button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;