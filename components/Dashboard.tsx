import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { Users, CalendarCheck, Activity, Calendar } from 'lucide-react';
import { Student, Session, AttendanceStatus } from '../types';

interface DashboardProps {
  students: Student[];
  sessions: Session[];
}

const Dashboard: React.FC<DashboardProps> = ({ students, sessions }) => {
  const paidSessions = sessions.filter(s => !s.isTrial);
  const trialCount = sessions.length - paidSessions.length;
  const totalSessions = paidSessions.length;
  const attendedSessions = paidSessions.filter(s => s.status === AttendanceStatus.Present).length;
  const attendanceRate = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

  const activeStudents = students.filter(s => s.status === 'Active').length;

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

  const attendanceData = React.useMemo(() => {
    const present = paidSessions.filter(s => s.status === AttendanceStatus.Present).length;
    const late = paidSessions.filter(s => s.status === AttendanceStatus.Late).length;
    const absent = paidSessions.filter(s => s.status === AttendanceStatus.Absent || s.status === AttendanceStatus.Cancelled).length;
    return [
      { name: 'Present', value: present, color: '#10b981' },
      { name: 'Late', value: late, color: '#f59e0b' },
      { name: 'Absent', value: absent, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [paidSessions]);

  const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-cream-border flex items-start justify-between transition-all hover:shadow-md">
      <div>
        <p className="text-sm font-medium text-stone-500 mb-1">{title}</p>
        <h3 className="font-serif text-3xl font-semibold text-stone-900 tracking-tight">{value}</h3>
        {sub && (
          <div className="flex items-center gap-1 mt-2">
            <span className="text-xs px-1.5 py-0.5 rounded bg-cream-soft text-stone-600">{sub}</span>
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
      <h2 className="font-serif text-xl font-semibold text-stone-900">Teaching Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          title="Total Sessions"
          value={totalSessions}
          sub="All time (paid)"
          icon={Calendar}
          color="bg-emerald-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly activity */}
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
              <RechartsTooltip cursor={{fill: '#F5EFE4'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sessionActivityData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill="#D97757" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance pie */}
        <div className="bg-white p-6 rounded-2xl border border-cream-border h-80 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-coral-50 rounded-lg">
              <Activity className="w-5 h-5 text-coral-600" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-stone-900">Attendance</h3>
              <p className="text-xs text-stone-400">Session status</p>
            </div>
          </div>
          <div className="flex-1 relative">
            {attendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attendanceData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
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
                No session data yet.
              </div>
            )}
            {attendanceData.length > 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pb-8">
                <span className="font-serif text-3xl font-semibold text-stone-900">{totalSessions}</span>
                <p className="text-xs text-stone-400 uppercase font-semibold">Total</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
