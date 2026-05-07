import React, { useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { DollarSign, TrendingUp, Pencil, Trash2, AlertTriangle, Wallet, Loader2, LogOut } from 'lucide-react';
import { Student, Payment } from '../types';
import { Currency, CURRENCY_SYMBOLS, CURRENCY_LABELS, BASE_CURRENCY, formatMoney } from '../lib/currency';
import { lockAdmin } from './AdminGate';

interface AdminProps {
  students: Student[];
  payments: Payment[];
  onUpdatePayment: (p: Payment) => void;
  onDeletePayment: (id: string) => void;
  currency: Currency;
  rate: number;
  rateLoading: boolean;
  rateError: string | null;
  rateFetchedAt: Date | null;
  onToggleCurrency: () => void;
  onLock: () => void;
}

const Admin: React.FC<AdminProps> = ({ students, payments, onUpdatePayment, onDeletePayment, currency, rate, rateLoading, rateError, rateFetchedAt, onToggleCurrency, onLock }) => {
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = students.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0);
  const totalCredit = students.reduce((sum, s) => sum + (s.balance < 0 ? -s.balance : 0), 0);

  const revenueData = React.useMemo(() => {
    const grouped: Record<string, number> = {};
    const sorted = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sorted.length === 0) return [];
    sorted.forEach(p => {
      const key = new Date(p.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      grouped[key] = (grouped[key] || 0) + p.amount;
    });
    return Object.entries(grouped).map(([name, amount]) => ({ name, amount }));
  }, [payments]);

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-cream-border flex items-start justify-between transition-all hover:shadow-md">
      <div>
        <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
        <h3 className="font-serif text-3xl font-semibold text-stone-900 tracking-tight">{value}</h3>
        {sub && <p className="text-xs text-stone-500 mt-2">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-stone-900 tracking-tight">Admin · Finance</h1>
          <p className="text-stone-500 mt-1">Revenue, outstanding balances, and payment records.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCurrency}
              disabled={rateLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cream border border-cream-border hover:border-coral-200 hover:bg-coral-50 transition-colors text-sm font-medium text-stone-700 disabled:opacity-60"
              title={currency === 'CNY' ? 'Switch to Australian Dollar' : 'Switch to Chinese Yuan'}
            >
              <span className={`inline-block w-7 text-center rounded text-xs px-1 py-0.5 ${currency === 'CNY' ? 'bg-coral-600 text-white' : 'bg-stone-200 text-stone-600'}`}>¥</span>
              <span className="text-stone-400">/</span>
              <span className={`inline-block w-7 text-center rounded text-xs px-1 py-0.5 ${currency === 'AUD' ? 'bg-coral-600 text-white' : 'bg-stone-200 text-stone-600'}`}>A$</span>
              <span className="ml-1 text-xs text-stone-500 flex items-center gap-1">
                {rateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : CURRENCY_LABELS[currency]}
              </span>
            </button>
            <button
              onClick={() => { lockAdmin(); onLock(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium transition-colors"
              title="Lock the Admin page"
            >
              <LogOut className="w-3.5 h-3.5" /> Lock
            </button>
          </div>
          {currency !== BASE_CURRENCY && !rateLoading && !rateError && (
            <p className="text-[11px] text-stone-400">
              ¥1 = A${rate.toFixed(4)}
              {rateFetchedAt && <> · {rateFetchedAt.toLocaleDateString()}</>}
            </p>
          )}
          {rateError && (
            <p className="text-[11px] text-red-500">Rate unavailable: {rateError}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatMoney(totalRevenue, currency, rate)}
          sub="All payments received"
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <StatCard
          title="Outstanding"
          value={formatMoney(totalOutstanding, currency, rate)}
          sub="To collect from students"
          icon={TrendingUp}
          color="bg-rose-500"
        />
        <StatCard
          title="Student Credit"
          value={formatMoney(totalCredit, currency, rate)}
          sub="Prepaid balances"
          icon={Wallet}
          color="bg-blue-500"
        />
      </div>

      {/* Revenue trend */}
      <div className="bg-white p-6 rounded-2xl border border-cream-border">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-stone-900">Revenue Trend</h3>
            <p className="text-xs text-stone-400">Monthly income over time</p>
          </div>
        </div>
        <div className="h-72">
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
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
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#adminRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-stone-400 bg-cream rounded-lg border border-dashed border-cream-border">
              No payment data yet.
            </div>
          )}
        </div>
      </div>

      {/* Payments list */}
      <div className="bg-white p-6 rounded-2xl border border-cream-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg font-semibold text-stone-900">All Payments</h3>
          <span className="text-xs text-stone-500">{payments.length} record{payments.length === 1 ? '' : 's'}</span>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-10">No payments recorded.</p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
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
                    <button onClick={() => setEditingPayment(payment)} title="Edit payment" className="p-1.5 text-stone-400 hover:text-coral-600 hover:bg-coral-50 rounded-md transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPaymentToDelete(payment)} title="Delete payment" className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          students={students}
          onClose={() => setEditingPayment(null)}
          onSave={(p) => { onUpdatePayment(p); setEditingPayment(null); }}
        />
      )}

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
              <button onClick={() => setPaymentToDelete(null)} className="px-4 py-2 text-sm font-medium text-stone-700 bg-cream hover:bg-cream-soft rounded-lg transition-colors">Cancel</button>
              <button onClick={() => { onDeletePayment(paymentToDelete.id); setPaymentToDelete(null); }} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
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
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full px-3 py-2 border border-cream-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm">
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Amount ({CURRENCY_SYMBOLS.CNY})</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 border border-cream-border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm" />
            <p className="text-[10px] text-stone-400 mt-1">Stored in CNY regardless of display toggle.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 border border-cream-border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Method</label>
            <input type="text" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Cash, Bank Transfer, etc." className="w-full px-3 py-2 border border-cream-border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm" />
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

export default Admin;
