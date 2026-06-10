import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { Users, CalendarCheck, Activity, Calendar } from 'lucide-react';
import { Student, Session, AttendanceStatus } from '../types';
import { localDateKey } from '../lib/dateUtils';
import { statusForStudent, isTrialForStudent } from '../lib/sessionHelpers';

interface DashboardProps {
  students: Student[];
  sessions: Session[];
}

const Dashboard: React.FC<DashboardProps> = ({ students, sessions }) => {
  // Group sessions by their LOCAL date key once, so day buckets are consistent
  // with what the user sees in the calendar (a 11pm session stays on its day,
  // not the next day in UTC).
  const sessionsByLocalDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const key = localDateKey(s.date);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return map;
  }, [sessions]);

  // A session is "paid" if at least one attendee is non-trial. Using the
  // session-level isTrial flag alone misclassified mixed sessions where every
  // student was individually marked trial via a per-student override.
  const isPaidSession = (s: Session) => s.studentIds.some(sid => !isTrialForStudent(s, sid));
  const paidSessions = useMemo(() => sessions.filter(isPaidSession), [sessions]);

  // A session counts as "attended" for the rate if at least one non-trial
  // student was Present or Late. Per-student status takes precedence so a
  // mixed group's stats reflect reality. Cancelled slots are excluded entirely
  // (the lesson didn't happen and was never billed), not counted as absences.
  const stats = useMemo(() => {
    let totalSlots = 0;
    let present = 0;
    let late = 0;
    let absent = 0;
    for (const s of sessions) {
      for (const sid of s.studentIds) {
        if (isTrialForStudent(s, sid)) continue;
        const st = statusForStudent(s, sid);
        if (st === AttendanceStatus.Cancelled) continue;
        totalSlots++;
        if (st === AttendanceStatus.Present) present++;
        else if (st === AttendanceStatus.Late) late++;
        else absent++;
      }
    }
    const attendanceRate = totalSlots > 0 ? Math.round(((present + late) / totalSlots) * 100) : 0;
    return { totalSlots, present, late, absent, attendanceRate };
  }, [sessions]);

  const trialCount = sessions.length - paidSessions.length;
  const activeStudents = students.filter(s => s.status === 'Active').length;

  const sessionActivityData = useMemo(() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days.map(day => {
      const key = localDateKey(day);
      const daySessions = sessionsByLocalDay.get(key) || [];
      return {
        name: day.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: key,
        count: daySessions.filter(isPaidSession).length,
        trials: daySessions.filter(s => !isPaidSession(s)).length
      };
    });
  }, [sessionsByLocalDay]);

  const attendanceData = useMemo(() => {
    const data = [
      { name: 'Present', value: stats.present, color: '#10b981' },
      { name: 'Late', value: stats.late, color: '#f59e0b' },
      { name: 'Absent', value: stats.absent, color: '#ef4444' }
    ];
    return data.filter(d => d.value > 0);
  }, [stats]);

  const StatCard: React.FC<{ title: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ElementType; color: string }> = ({ title, value, sub, icon: Icon, color }) => (
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
          value={`${stats.attendanceRate}%`}
          sub={trialCount > 0 ? `${trialCount} trial${trialCount === 1 ? '' : 's'} (not counted)` : 'Paid sessions'}
          icon={CalendarCheck}
          color="bg-coral-500"
        />
        <StatCard
          title="Total Sessions"
          value={paidSessions.length}
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
              <p className="text-xs text-stone-400">Per-student status</p>
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
                <span className="font-serif text-3xl font-semibold text-stone-900">{stats.totalSlots}</span>
                <p className="text-xs text-stone-400 uppercase font-semibold">Attendees</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
