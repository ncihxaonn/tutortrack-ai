import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { Users, DollarSign, CalendarCheck, TrendingUp, Settings, Save, ArrowUpRight, Activity, Calendar } from 'lucide-react';
import { Student, Session, Payment, AttendanceStatus } from '../types';

interface DashboardProps {
  students: Student[];
  sessions: Session[];
  payments: Payment[];
  financialOffset: number;
  onUpdateOffset: (amount: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ students, sessions, payments, financialOffset, onUpdateOffset }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [tempOffset, setTempOffset] = useState(financialOffset.toString());

  const handleSaveOffset = () => {
      const val = parseFloat(tempOffset);
      if (!isNaN(val)) {
          onUpdateOffset(val);
      }
      setShowSettings(false);
  };

  // --- Calculations ---

  // 1. Total Revenue
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0) + financialOffset;

  // 2. Attendance Rate
  const totalSessions = sessions.length;
  const attendedSessions = sessions.filter(s => s.status === AttendanceStatus.Present).length;
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
    // Get last 7 days dates
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d);
    }

    return days.map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const count = sessions.filter(s => s.date.startsWith(dateStr)).length;
        return {
            name: day.toLocaleDateString('en-US', { weekday: 'short' }), // "Mon"
            fullDate: dateStr,
            count
        };
    });
  }, [sessions]);

  // C. Attendance Breakdown (Pie Chart)
  const attendanceData = React.useMemo(() => {
    const present = sessions.filter(s => s.status === AttendanceStatus.Present).length;
    const late = sessions.filter(s => s.status === AttendanceStatus.Late).length;
    const absent = sessions.filter(s => s.status === AttendanceStatus.Absent || s.status === AttendanceStatus.Cancelled).length;
    
    const data = [
        { name: 'Present', value: present, color: '#10b981' }, // Emerald
        { name: 'Late', value: late, color: '#f59e0b' },    // Amber
        { name: 'Absent', value: absent, color: '#ef4444' }  // Red
    ];
    return data.filter(d => d.value > 0);
  }, [sessions]);


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
      
      {/* Settings Toggle */}
      <div className="flex justify-between items-center">
          <h2 className="font-serif text-xl font-semibold text-stone-900">Business Overview</h2>
          <button 
            onClick={() => { setShowSettings(!showSettings); setTempOffset(financialOffset.toString()); }}
            className="flex items-center gap-2 text-xs text-stone-500 hover:text-coral-600 transition-colors bg-white px-3 py-1.5 rounded-lg border border-cream-border shadow-sm"
          >
              <Settings className="w-3 h-3" />
              Settings
          </button>
      </div>

      {showSettings && (
          <div className="bg-white p-6 rounded-xl border border-coral-100 shadow-sm animate-in slide-in-from-top-2">
              <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-coral-600" />
                  Data Configuration
              </h3>
              <div className="max-w-md">
                  <label className="block text-sm font-medium text-stone-600 mb-2">Historical Revenue Offset ($)</label>
                  <div className="flex gap-2">
                      <input 
                          type="number" 
                          value={tempOffset}
                          onChange={(e) => setTempOffset(e.target.value)}
                          className="w-full px-4 py-2 border border-cream-border rounded-lg focus:outline-none focus:ring-2 focus:ring-coral-500 text-sm"
                          placeholder="0.00"
                      />
                      <button 
                        onClick={handleSaveOffset}
                        className="bg-coral-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-coral-700 flex items-center gap-2 transition-colors"
                      >
                          <Save className="w-4 h-4" />
                          Save
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Revenue" 
          value={`$${totalRevenue.toLocaleString()}`} 
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
          sub="Overall"
          icon={CalendarCheck} 
          color="bg-coral-500" 
        />
        <StatCard 
          title="Outstanding" 
          value={`$${totalOutstanding}`} 
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
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => [`$${value}`, 'Revenue']}
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
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {payments.length === 0 && <p className="text-sm text-stone-400 text-center py-10">No payments recorded.</p>}
                    {[...payments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(payment => {
                        const student = students.find(s => s.id === payment.studentId);
                        return (
                            <div key={payment.id} className="flex justify-between items-center p-3 bg-cream rounded-lg border border-cream-border">
                                <div>
                                    <p className="text-sm font-semibold text-stone-700">{student?.name || 'Unknown'}</p>
                                    <p className="text-xs text-stone-400">{new Date(payment.date).toLocaleDateString()}</p>
                                </div>
                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-sm">
                                    +${payment.amount}
                                </span>
                            </div>
                        );
                    })}
                </div>
           </div>
      </div>
    </div>
  );
};

export default Dashboard;