import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser } from '../lib/auth';
import {
  Users, Stethoscope, Heart, Package, Activity,
  RefreshCw, AlertCircle, TrendingUp, Clock, CheckCircle2
} from 'lucide-react';

interface Props {
  onNavigate?: (p: string) => void;
  currentUser?: AuthUser | null;
}

interface Stats {
  totalToday: number;
  waiting: number;
  serving: number;
  done: number;
  noShow: number;
  pendingPrescriptions: number;
  staffOnline: number;
}

interface RecentToken {
  id: string;
  token_number: number;
  phone: string;
  status: string;
  intake_status: string;
  department: string | null;
  priority: number;
  created_at: string;
  patients?: { name: string } | null;
}

const PRIORITY_LABEL: Record<number, string> = { 0: 'Emergency', 1: 'Senior', 2: 'Normal' };
const PRIORITY_COLOR: Record<number, string> = {
  0: 'bg-red-100 text-red-700',
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-emerald-100 text-emerald-700',
};

export default function AdminDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<Stats>({
    totalToday: 0, waiting: 0, serving: 0, done: 0,
    noShow: 0, pendingPrescriptions: 0, staffOnline: 0,
  });
  const [recentTokens, setRecentTokens] = useState<RecentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's tokens
      const { data: tokens, error: te } = await supabase
        .from('tokens')
        .select('*, patients(name)')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });

      if (te) throw new Error(te.message);

      const allTokens = tokens ?? [];

      // Fetch pending prescriptions
      const { count: rxCount } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'IN_PROGRESS']);

      // Fetch active staff count
      const { count: staffCount } = await supabase
        .from('staff_users')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalToday: allTokens.length,
        waiting: allTokens.filter(t => t.status === 'WAITING').length,
        serving: allTokens.filter(t => t.status === 'SERVING').length,
        done: allTokens.filter(t => t.status === 'DONE').length,
        noShow: allTokens.filter(t => t.status === 'NO_SHOW').length,
        pendingPrescriptions: rxCount ?? 0,
        staffOnline: staffCount ?? 0,
      });

      setRecentTokens(allTokens.slice(0, 20));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statCards = [
    { label: 'Total Today', value: stats.totalToday, icon: TrendingUp, color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Waiting', value: stats.waiting, icon: Clock, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Serving', value: stats.serving, icon: Activity, color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Completed', value: stats.done, icon: CheckCircle2, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'No-Show', value: stats.noShow, icon: AlertCircle, color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'Pending Rx', value: stats.pendingPrescriptions, icon: Package, color: 'bg-violet-50 border-violet-200 text-violet-700' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-[#005EB8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-[#005EB8]" />
          <div>
            <h1 className="text-2xl font-bold text-[#005EB8]">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm">Hospital overview — today's activity</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate?.('display')}
            className="flex items-center gap-2 px-4 py-2 bg-[#005EB8] text-white rounded-xl font-semibold hover:bg-[#004a96] transition-colors text-sm"
          >
            Display Board
          </button>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 border-2 border-[#005EB8] text-[#005EB8] rounded-xl font-semibold hover:bg-[#E8F3FF] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statCards.map(card => (
          <div key={card.label} className={`rounded-2xl border-2 p-4 text-center ${card.color}`}>
            <card.icon className="w-5 h-5 mx-auto mb-1 opacity-70" />
            <div className="text-3xl font-extrabold">{card.value}</div>
            <div className="text-xs font-semibold mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Pharmacy Queue', icon: Package, page: 'pharmacy', color: 'bg-violet-500 hover:bg-violet-600' },
          { label: 'Display Board', icon: Activity, page: 'display', color: 'bg-[#005EB8] hover:bg-[#004a96]' },
          { label: 'Register Patient', icon: Users, page: 'register', color: 'bg-emerald-500 hover:bg-emerald-600' },
          { label: 'Appointments', icon: Stethoscope, page: 'appointment', color: 'bg-amber-500 hover:bg-amber-600' },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => onNavigate?.(action.page)}
            className={`${action.color} text-white rounded-2xl p-4 flex flex-col items-center gap-2 transition-colors`}
          >
            <action.icon className="w-6 h-6" />
            <span className="text-sm font-bold">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Staff Summary */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-[#005EB8]" />
            Staff Overview
          </h2>
          <div className="space-y-2">
            {[
              { role: 'Doctors', icon: '👨‍⚕️', count: stats.staffOnline },
              { role: 'Active Staff', icon: '👥', count: stats.staffOnline },
              { role: 'Pending Prescriptions', icon: '💊', count: stats.pendingPrescriptions },
            ].map(item => (
              <div key={item.role} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <span>{item.icon}</span> {item.role}
                </span>
                <span className="font-bold text-[#005EB8]">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#005EB8]" />
            Department Breakdown
          </h2>
          {(() => {
            const deptMap: Record<string, number> = {};
            recentTokens.forEach(t => {
              const dept = t.department || 'general';
              deptMap[dept] = (deptMap[dept] || 0) + 1;
            });
            const entries = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
            if (entries.length === 0) {
              return <p className="text-gray-400 text-sm text-center py-4">No data today</p>;
            }
            return (
              <div className="space-y-2">
                {entries.map(([dept, count]) => (
                  <div key={dept} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 capitalize w-28 truncate">{dept}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-[#005EB8] h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (count / stats.totalToday) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Recent Tokens Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#005EB8]" />
          Today's Tokens
          <span className="ml-auto text-xs text-gray-400 font-normal">Last 20</span>
        </h2>

        {recentTokens.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No tokens today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-semibold">Token</th>
                  <th className="pb-2 font-semibold">Patient</th>
                  <th className="pb-2 font-semibold">Department</th>
                  <th className="pb-2 font-semibold">Priority</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentTokens.map(token => (
                  <tr key={token.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 font-bold text-[#005EB8]">#{token.token_number}</td>
                    <td className="py-2 text-gray-700">
                      {token.patients?.name || token.phone}
                    </td>
                    <td className="py-2 text-gray-500 capitalize">{token.department || 'General'}</td>
                    <td className="py-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[token.priority]}`}>
                        {PRIORITY_LABEL[token.priority]}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        token.status === 'WAITING' ? 'bg-blue-100 text-blue-700' :
                        token.status === 'SERVING' ? 'bg-green-100 text-green-700' :
                        token.status === 'DONE' ? 'bg-gray-100 text-gray-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {token.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400 text-xs">
                      {new Date(token.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
