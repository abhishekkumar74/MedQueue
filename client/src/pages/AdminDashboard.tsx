import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser } from '../lib/auth';
import {
  Users, Stethoscope, Activity, RefreshCw, AlertCircle,
  TrendingUp, Clock, CheckCircle2, Calendar, ChevronLeft, ChevronRight,
  Package, Search
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
}

interface TokenRow {
  id: string;
  token_number: number;
  phone: string;
  status: string;
  intake_status: string;
  department: string | null;
  priority: number;
  created_at: string;
  patients?: { name: string; age?: number } | null;
}

const PRIORITY_LABEL: Record<number, string> = { 0: 'Emergency', 1: 'Senior', 2: 'Normal' };
const PRIORITY_COLOR: Record<number, string> = {
  0: 'bg-red-100 text-red-700',
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-emerald-100 text-emerald-700',
};

function toIST(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });
}

export default function AdminDashboard({ onNavigate }: Props) {
  // ── Date filter ───────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  // ── State ─────────────────────────────────────────────────
  const [stats, setStats] = useState<Stats>({
    totalToday: 0, waiting: 0, serving: 0, done: 0, noShow: 0, pendingPrescriptions: 0,
  });
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // ── Fetch data for selected date ──────────────────────────
  const fetchData = useCallback(async () => {
    try {
      // Build date range in IST → UTC
      const startIST = `${selectedDate}T00:00:00+05:30`;
      const endIST   = `${selectedDate}T23:59:59+05:30`;

      const { data: allTokens, error: te } = await supabase
        .from('tokens')
        .select('*, patients(name, age)')
        .gte('created_at', startIST)
        .lte('created_at', endIST)
        .order('created_at', { ascending: false });

      if (te) throw new Error(te.message);
      const rows = allTokens ?? [];

      // Pending prescriptions (only relevant for today)
      const { count: rxCount } = await supabase
        .from('prescriptions')
        .select('*', { count: 'exact', head: true })
        .in('status', ['PENDING', 'IN_PROGRESS']);

      setStats({
        totalToday: rows.length,
        waiting:  rows.filter(t => t.status === 'WAITING').length,
        serving:  rows.filter(t => t.status === 'SERVING').length,
        done:     rows.filter(t => t.status === 'DONE').length,
        noShow:   rows.filter(t => t.status === 'NO_SHOW').length,
        pendingPrescriptions: rxCount ?? 0,
      });

      setTokens(rows);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    if (isToday) {
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchData, isToday]);

  // ── Date navigation ───────────────────────────────────────
  function changeDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    // Don't go into future
    if (newDate <= todayStr) setSelectedDate(newDate);
  }

  // ── Filtered tokens ───────────────────────────────────────
  const filtered = tokens.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.patients?.name?.toLowerCase().includes(q) ||
      t.phone.includes(q) ||
      String(t.token_number).includes(q) ||
      (t.department ?? '').toLowerCase().includes(q)
    );
  });

  // ── Department breakdown ──────────────────────────────────
  const deptMap: Record<string, number> = {};
  tokens.forEach(t => {
    const dept = t.department || 'general';
    deptMap[dept] = (deptMap[dept] || 0) + 1;
  });
  const deptEntries = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);

  const statCards = [
    { label: 'Total', value: stats.totalToday, icon: TrendingUp, color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Waiting', value: stats.waiting, icon: Clock, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { label: 'Serving', value: stats.serving, icon: Activity, color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'Done', value: stats.done, icon: CheckCircle2, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
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

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-[#005EB8]" />
          <div>
            <h1 className="text-2xl font-bold text-[#005EB8]">Admin Dashboard</h1>
            <p className="text-gray-500 text-sm">
              {isToday ? "Today's activity" : `History — ${new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate?.('display')}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-[#005EB8] text-white rounded-xl font-semibold hover:bg-[#004a96] transition-colors text-sm">
            Display Board
          </button>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 border-2 border-[#005EB8] text-[#005EB8] rounded-xl font-semibold hover:bg-[#E8F3FF] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5" /><span className="text-sm">{error}</span>
        </div>
      )}

      {/* ── Date Picker ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <button onClick={() => changeDate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#005EB8]" />
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-base font-bold text-gray-800 border-none outline-none bg-transparent cursor-pointer"
            />
            {isToday && (
              <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Today</span>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            disabled={selectedDate >= todayStr}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-30">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {statCards.map(card => (
          <div key={card.label} className={`rounded-2xl border-2 p-3 text-center ${card.color}`}>
            <card.icon className="w-4 h-4 mx-auto mb-1 opacity-70" />
            <div className="text-2xl font-extrabold">{card.value}</div>
            <div className="text-xs font-semibold mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions (admin only — no pharmacy) ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Display Board', icon: Activity, page: 'display', color: 'bg-[#005EB8] hover:bg-[#004a96]' },
          { label: 'Register Patient', icon: Users, page: 'register', color: 'bg-emerald-500 hover:bg-emerald-600' },
          { label: 'Appointments', icon: Stethoscope, page: 'appointment', color: 'bg-amber-500 hover:bg-amber-600' },
        ].map(action => (
          <button key={action.label} onClick={() => onNavigate?.(action.page)}
            className={`${action.color} text-white rounded-2xl p-4 flex flex-col items-center gap-2 transition-colors`}>
            <action.icon className="w-6 h-6" />
            <span className="text-sm font-bold">{action.label}</span>
          </button>
        ))}
      </div>

      {/* ── Department Breakdown ── */}
      {deptEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#005EB8]" />
            Department Breakdown
          </h2>
          <div className="space-y-2">
            {deptEntries.map(([dept, count]) => (
              <div key={dept} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 capitalize w-28 truncate">{dept}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-[#005EB8] h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (count / stats.totalToday) * 100)}%` }} />
                </div>
                <span className="text-sm font-bold text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tokens Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#005EB8]" />
            {isToday ? "Today's Tokens" : 'Tokens'}
            <span className="text-xs text-gray-400 font-normal ml-1">({tokens.length} total)</span>
          </h2>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name / phone..."
              className="pl-9 pr-4 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-[#005EB8] focus:outline-none w-48"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">
            {tokens.length === 0 ? 'No tokens for this date' : 'No results found'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-semibold">#</th>
                  <th className="pb-2 font-semibold">Patient</th>
                  <th className="pb-2 font-semibold">Dept</th>
                  <th className="pb-2 font-semibold">Priority</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(token => (
                  <tr key={token.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 font-bold text-[#005EB8]">#{token.token_number}</td>
                    <td className="py-2">
                      <div className="font-medium text-gray-800">{token.patients?.name || '—'}</div>
                      <div className="text-xs text-gray-400">{token.phone}</div>
                    </td>
                    <td className="py-2 text-gray-500 capitalize text-xs">{token.department || 'General'}</td>
                    <td className="py-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[token.priority]}`}>
                        {PRIORITY_LABEL[token.priority]}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        token.status === 'WAITING'  ? 'bg-blue-100 text-blue-700' :
                        token.status === 'SERVING'  ? 'bg-green-100 text-green-700' :
                        token.status === 'DONE'     ? 'bg-gray-100 text-gray-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {token.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400 text-xs">{toIST(token.created_at)}</td>
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
