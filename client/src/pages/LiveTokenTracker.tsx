import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getTokenStatus } from '../lib/api';
import { Token, DEPARTMENT_LABEL, Department } from '../types';
import { calculateEstimatedWait } from '../lib/analytics';
import { todayStartUTC } from '../lib/dateUtils';
import {
  RefreshCw, Users, Clock, Wifi, WifiOff, Bell,
  MapPin, Stethoscope, CheckCircle2, ArrowRight,
  Heart, AlertTriangle
} from 'lucide-react';

interface QueueUpdate {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'success';
}

interface LiveTokenTrackerProps {
  tokenNumber?: number;
  phone?: string;
}

// ── Step guide based on intake_status ────────────────────────────────────────
function getPatientStep(token: Token): {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  action?: string;
} {
  const dept = token.department
    ? DEPARTMENT_LABEL[token.department as Department] ?? token.department
    : 'General';

  switch (token.intake_status) {
    case 'ARRIVED':
      return {
        step: 1,
        title: 'Please go to Ward Boy',
        description: 'Your token is registered. Go to the Ward Boy counter for initial health check (BP, Sugar, Temperature).',
        icon: <Heart className="w-6 h-6" />,
        color: 'text-amber-700',
        bgColor: 'bg-amber-50 border-amber-300',
        action: 'Proceed to Ward Boy Counter',
      };

    case 'INTAKE_DONE':
    case 'READY_FOR_DOCTOR':
      return {
        step: 2,
        title: token.room_number
          ? `Go to ${token.room_number}`
          : `Wait for Doctor — ${dept}`,
        description: token.room_number
          ? `Your vitals are recorded. Please proceed to ${token.room_number}${extractFloor(token.room_number) ? ` (${extractFloor(token.room_number)})` : ''} for your consultation.`
          : 'Your vitals are recorded. Please wait — the doctor will call you shortly.',
        icon: <MapPin className="w-6 h-6" />,
        color: 'text-violet-700',
        bgColor: 'bg-violet-50 border-violet-300',
        action: token.room_number ? `Go to ${token.room_number}` : 'Wait to be called',
      };

    case 'WITH_DOCTOR':
      return {
        step: 3,
        title: 'You are with the Doctor',
        description: token.room_number
          ? `Consultation in progress at ${token.room_number}.`
          : 'Your consultation is in progress.',
        icon: <Stethoscope className="w-6 h-6" />,
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50 border-emerald-300',
      };

    case 'COMPLETED':
      return {
        step: 4,
        title: 'Consultation Complete',
        description: 'Your consultation is done. Please collect your prescription from the Pharmacy counter.',
        icon: <CheckCircle2 className="w-6 h-6" />,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-300',
        action: 'Go to Pharmacy Counter',
      };

    default:
      return {
        step: 1,
        title: 'Waiting in Queue',
        description: `You are in the ${dept} queue. Please wait for your turn.`,
        icon: <Clock className="w-6 h-6" />,
        color: 'text-gray-700',
        bgColor: 'bg-gray-50 border-gray-300',
      };
  }
}

function extractFloor(roomNumber: string): string {
  const match = roomNumber.match(/\d+/);
  if (!match) return '';
  const num = parseInt(match[0]);
  if (num < 100) return 'Ground Floor';
  return `Floor ${Math.floor(num / 100)}`;
}

// ── Steps progress bar ────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Ward Boy', icon: <Heart className="w-3.5 h-3.5" /> },
  { label: 'Doctor Room', icon: <MapPin className="w-3.5 h-3.5" /> },
  { label: 'Consultation', icon: <Stethoscope className="w-3.5 h-3.5" /> },
  { label: 'Pharmacy', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function getStepIndex(token: Token): number {
  switch (token.intake_status) {
    case 'ARRIVED': return 0;
    case 'INTAKE_DONE':
    case 'READY_FOR_DOCTOR': return 1;
    case 'WITH_DOCTOR': return 2;
    case 'COMPLETED': return 3;
    default: return 0;
  }
}

export default function LiveTokenTracker({ phone }: LiveTokenTrackerProps) {
  const [token, setToken] = useState<Token | null>(null);
  const [ahead, setAhead] = useState(0);
  const [prevAhead, setPrevAhead] = useState<number | null>(null);
  const [completedToday, setCompletedToday] = useState<Token[]>([]);
  const [updates, setUpdates] = useState<QueueUpdate[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');
  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [positionPulse, setPositionPulse] = useState(false);

  const addUpdate = useCallback((msg: string, type: QueueUpdate['type'] = 'info') => {
    setUpdates(prev => [{
      id: crypto.randomUUID(),
      message: msg,
      timestamp: new Date(),
      type,
    }, ...prev].slice(0, 10));
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!phone) return;
    try {
      const data = await getTokenStatus(phone);
      if (data.token) {
        setToken(data.token as Token);
        setAhead(prev => {
          const newAhead = data.ahead ?? 0;
          // Pulse animation when position improves
          if (prev !== null && newAhead < prev) {
            setPrevAhead(prev);
            setPositionPulse(true);
            setTimeout(() => setPositionPulse(false), 2000);
          }
          return newAhead;
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const fetchCompletedToday = useCallback(async () => {
    const todayStart = todayStartUTC();
    const { data } = await supabase
      .from('tokens')
      .select('created_at')
      .eq('status', 'DONE')
      .gte('created_at', todayStart)
      .order('created_at', { ascending: true });
    if (data) setCompletedToday(data as Token[]);
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchCompletedToday();
    // Auto-refresh every 30 seconds as fallback
    const autoRefresh = setInterval(() => {
      fetchStatus();
      fetchCompletedToday();
    }, 30000);
    return () => clearInterval(autoRefresh);
  }, [fetchStatus, fetchCompletedToday]);

  // Realtime subscription — listen to token changes
  useEffect(() => {
    if (!phone) return;
    setConnectionStatus('connecting');

    const channel = supabase
      .channel(`tracker-${phone}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tokens',
        filter: `phone=eq.${phone}`,
      }, (payload) => {
        const updated = payload.new as Token;
        setToken(updated);

        // Show contextual alerts based on intake_status change
        if (updated.intake_status === 'READY_FOR_DOCTOR' || updated.intake_status === 'INTAKE_DONE') {
          const room = updated.room_number;
          const msg = room
            ? `✅ Vitals recorded! Please go to ${room}${extractFloor(room) ? ` (${extractFloor(room)})` : ''} for your consultation.`
            : '✅ Vitals recorded! Please wait — doctor will call you shortly.';
          setAlertMessage(msg);
          setShowAlert(true);
          addUpdate(msg, 'success');
        } else if (updated.status === 'SERVING' || updated.intake_status === 'WITH_DOCTOR') {
          const msg = '🔔 Your turn! Please proceed to the consultation room.';
          setAlertMessage(msg);
          setShowAlert(true);
          addUpdate(msg, 'success');
        } else if (updated.intake_status === 'ARRIVED') {
          addUpdate('🏥 Token registered. Please go to the Ward Boy counter.', 'info');
        } else if (updated.intake_status === 'COMPLETED') {
          addUpdate('✅ Consultation complete. Please collect prescription from Pharmacy.', 'success');
        } else if (updated.status === 'WAITING') {
          addUpdate('Queue updated — your position may have changed.', 'info');
        }

        fetchStatus();
        fetchCompletedToday();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          addUpdate('Connected to live queue updates.', 'info');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('offline');
          addUpdate('Connection lost. Reconnecting…', 'warning');
        } else {
          setConnectionStatus('connecting');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [phone, addUpdate, fetchStatus, fetchCompletedToday]);

  const { minutes: estimatedWait } = calculateEstimatedWait(ahead, completedToday);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E8F3FF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#005EB8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#005EB8] font-semibold">Loading your token status…</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#E8F3FF] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-700 mb-2">No active token found</h2>
          <p className="text-sm text-gray-500">No token found for {phone}. Please register first.</p>
        </div>
      </div>
    );
  }

  const patientStep = getPatientStep(token);
  const stepIndex = getStepIndex(token);
  const dept = token.department
    ? DEPARTMENT_LABEL[token.department as Department] ?? token.department
    : 'General';

  return (
    <div className="min-h-screen bg-[#E8F3FF]">
      {/* Connection banners */}
      {connectionStatus === 'offline' && (
        <div className="bg-amber-500 text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" /> Reconnecting to live updates…
        </div>
      )}
      {connectionStatus === 'connecting' && (
        <div className="bg-blue-500 text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4 animate-pulse" /> Connecting to live queue…
        </div>
      )}

      {/* Alert banner */}
      {showAlert && (
        <div className="bg-emerald-500 text-white px-4 py-4 text-center">
          <div className="text-base font-extrabold">{alertMessage}</div>
          <button onClick={() => setShowAlert(false)} className="mt-1 text-xs underline opacity-80">Dismiss</button>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-bold text-[#005EB8] uppercase tracking-widest">Live Status</div>
            <div className="font-bold text-gray-800">{dept} Queue</div>
          </div>
          <button
            onClick={() => { fetchStatus(); fetchCompletedToday(); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* Token card */}
        <div className={`rounded-2xl p-6 mb-4 text-white ${
          token.status === 'DONE' ? 'bg-gray-600' :
          token.status === 'NO_SHOW' ? 'bg-red-600' :
          'bg-[#005EB8]'
        }`}>
          <div className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">Your Token Number</div>
          <div className="text-7xl font-extrabold leading-none mb-3">
            #{String(token.token_number).padStart(3, '0')}
          </div>
          <div className="text-sm font-semibold">
            {token.status === 'SERVING' && '🟢 Now Serving — Please proceed!'}
            {token.status === 'WAITING' && '🔵 Waiting in queue'}
            {token.status === 'DONE' && '✅ Consultation complete'}
            {token.status === 'NO_SHOW' && '⚠️ Marked as no-show'}
          </div>
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-1.5 mt-2 text-xs opacity-75">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live updates active
            </div>
          )}
        </div>

        {/* ── MAIN STEP CARD ── */}
        {token.status !== 'DONE' && token.status !== 'NO_SHOW' && (
          <div className={`rounded-2xl border-2 p-5 mb-4 ${patientStep.bgColor}`}>
            <div className={`flex items-center gap-3 mb-3 ${patientStep.color}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${patientStep.bgColor} border-2 ${patientStep.bgColor.replace('bg-', 'border-').replace('-50', '-400')}`}>
                {patientStep.icon}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide opacity-70">Step {patientStep.step} of 4</div>
                <div className="font-extrabold text-lg leading-tight">{patientStep.title}</div>
              </div>
            </div>
            <p className={`text-sm leading-relaxed ${patientStep.color} opacity-90`}>
              {patientStep.description}
            </p>

            {/* Room info highlight */}
            {token.room_number && (token.intake_status === 'READY_FOR_DOCTOR' || token.intake_status === 'INTAKE_DONE' || token.intake_status === 'WITH_DOCTOR') && (
              <div className="mt-3 bg-white rounded-xl p-3 border border-violet-200 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-violet-600 flex-shrink-0" />
                <div>
                  <div className="font-extrabold text-violet-700 text-base">{token.room_number}</div>
                  {extractFloor(token.room_number) && (
                    <div className="text-xs text-violet-500">{extractFloor(token.room_number)}</div>
                  )}
                </div>
              </div>
            )}

            {patientStep.action && (
              <div className={`mt-3 flex items-center gap-2 font-bold text-sm ${patientStep.color}`}>
                <ArrowRight className="w-4 h-4" />
                {patientStep.action}
              </div>
            )}
          </div>
        )}

        {/* Done / No-show state */}
        {token.status === 'DONE' && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 mb-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-blue-500 mx-auto mb-2" />
            <div className="font-extrabold text-blue-700 text-lg">Consultation Complete</div>
            <p className="text-sm text-blue-600 mt-1">Please collect your prescription from the Pharmacy counter.</p>
          </div>
        )}
        {token.status === 'NO_SHOW' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-4 text-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <div className="font-extrabold text-red-700 text-lg">Marked as No-Show</div>
            <p className="text-sm text-red-600 mt-1">Please register again at the counter if you are still present.</p>
          </div>
        )}

        {/* Progress steps */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="text-xs font-bold text-gray-500 uppercase mb-3">Your Journey</div>
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    i < stepIndex
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : i === stepIndex
                      ? 'bg-[#005EB8] border-[#005EB8] text-white'
                      : 'bg-gray-100 border-gray-200 text-gray-400'
                  }`}>
                    {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : s.icon}
                  </div>
                  <div className={`text-xs mt-1 font-semibold text-center leading-tight ${
                    i <= stepIndex ? 'text-[#005EB8]' : 'text-gray-400'
                  }`} style={{ maxWidth: '56px' }}>
                    {s.label}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < stepIndex ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {token.status === 'WAITING' && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className={`bg-white rounded-xl p-4 text-center shadow-sm transition-all ${positionPulse ? 'ring-2 ring-emerald-400 scale-105' : ''}`}>
              <Users className="w-5 h-5 text-[#005EB8] mx-auto mb-1" />
              <div className={`text-xl font-extrabold ${positionPulse ? 'text-emerald-600' : 'text-gray-800'}`}>
                {ahead}
                {positionPulse && prevAhead !== null && (
                  <span className="text-sm text-emerald-500 ml-1">↓{prevAhead - ahead}</span>
                )}
              </div>
              <div className="text-xs text-gray-500">Patients Ahead</div>
              {positionPulse && (
                <div className="text-xs text-emerald-600 font-semibold mt-0.5 animate-pulse">Queue moved! ✓</div>
              )}
            </div>
            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
              <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <div className="text-xl font-extrabold text-gray-800">~{estimatedWait}m</div>
              <div className="text-xs text-gray-500">Est. Wait</div>
            </div>
          </div>
        )}

        {/* Queue updates feed */}
        {updates.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[#005EB8]" />
              <span className="text-sm font-bold text-gray-700">Updates</span>
              {connectionStatus === 'connected' && (
                <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {updates.map((u) => (
                <div key={u.id} className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                  u.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                  u.type === 'warning' ? 'bg-amber-50 text-amber-700' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  <span className="flex-1">{u.message}</span>
                  <span className="text-xs opacity-60 flex-shrink-0">
                    {u.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
