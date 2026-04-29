import { useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../lib/auth';
import WardBoyIntake from './WardBoyIntake';
import DoctorPanel from './DoctorPanel';
import AdminDashboard from './AdminDashboard';
import { getQueue } from '../lib/api';
import { Token, PatientIntake, PRIORITY_LABEL } from '../types';
import { Shield, Loader2, RefreshCw, AlertCircle, Users, Heart } from 'lucide-react';

interface Props {
  onNavigate?: (p: string) => void;
  currentUser?: AuthUser | null;
}

/**
 * StaffDashboard — automatically shows the correct panel based on role.
 * Doctor  → DoctorPanel (filtered to their department)
 * Ward Boy → WardBoyDashboard (filtered to their department)
 * Pharmacy → PharmacyDashboard (redirect)
 * Admin   → AdminDashboard (full overview)
 */
export default function StaffDashboard({ onNavigate, currentUser }: Props) {

  // Auto-redirect pharmacy to pharmacy page
  useEffect(() => {
    if (currentUser?.role === 'PHARMACY') {
      onNavigate?.('pharmacy');
    }
  }, [currentUser?.role, onNavigate]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Not logged in</p>
      </div>
    );
  }

  const role = currentUser.role;

  // ── DOCTOR: sees only their department queue ──────────────
  if (role === 'DOCTOR') {
    return (
      <DoctorPanel
        doctorDepartment={currentUser.department}
        doctorName={currentUser.name}
        roomNumber={currentUser.room_number}
      />
    );
  }

  // ── WARD BOY: sees intake workflow for their department ───
  if (role === 'WARD_BOY') {
    return <WardBoyDashboard department={currentUser.department} />;
  }

  // ── PHARMACY: redirect handled in useEffect ───────────────
  if (role === 'PHARMACY') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Redirecting to Pharmacy...</p>
      </div>
    );
  }

  // ── ADMIN: full overview ──────────────────────────────────
  if (role === 'ADMIN') {
    return <AdminDashboard onNavigate={onNavigate} currentUser={currentUser} />;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Unknown role: {role}</p>
        <p className="text-gray-400 text-sm">Contact your administrator</p>
      </div>
    </div>
  );
}

// ── Ward Boy Dashboard ────────────────────────────────────────────────────────

interface WardBoyDashboardProps {
  department?: string; // if set, only show patients from this department
}

function WardBoyDashboard({ department }: WardBoyDashboardProps) {
  const [queue, setQueue] = useState<{
    waiting: Array<Token & { patient_intake?: PatientIntake[] }>;
    serving: (Token & { patient_intake?: PatientIntake[] }) | null;
  }>({ waiting: [], serving: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIntake, setActiveIntake] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      // Ward boy sees only their department's patients (if department is set)
      const data = await getQueue(department);
      setQueue(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 8000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const arrivedTokens = queue.waiting.filter(t => t.intake_status === 'ARRIVED');
  const inProgressTokens = queue.waiting.filter(t =>
    t.intake_status === 'INTAKE_DONE' || t.intake_status === 'READY_FOR_DOCTOR'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#005EB8]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Heart className="w-7 h-7 text-[#005EB8]" />
          <div>
            <h1 className="text-2xl font-bold text-[#005EB8]">Patient Intake</h1>
            <p className="text-gray-500 text-sm">
              {department
                ? <span className="capitalize font-semibold text-gray-600">{department} Department</span>
                : 'All Departments'
              }
              {' '}— {arrivedTokens.length} new arrivals to process
            </p>
          </div>
        </div>
        <button
          onClick={fetchQueue}
          className="flex items-center gap-2 px-4 py-2 border-2 border-[#005EB8] text-[#005EB8] rounded-xl font-semibold hover:bg-[#E8F3FF] transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'New Arrivals', value: arrivedTokens.length, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'Intake Done', value: inProgressTokens.length, color: 'bg-violet-50 border-violet-200 text-violet-700' },
          { label: 'Total Waiting', value: queue.waiting.length, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border-2 p-4 text-center ${s.color}`}>
            <div className="text-3xl font-extrabold">{s.value}</div>
            <div className="text-sm font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* New arrivals — need intake */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          New Arrivals — Need Intake
        </h2>

        {arrivedTokens.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 font-medium">No new patients to process</p>
          </div>
        ) : (
          <div className="space-y-3">
            {arrivedTokens.map(token => (
              <div key={token.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Token header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveIntake(activeIntake === token.id ? null : token.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#005EB8] rounded-xl flex items-center justify-center text-white font-extrabold text-lg">
                      #{token.token_number}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">{token.patients?.name || 'Patient'}</div>
                      <div className="text-sm text-gray-500">
                        {token.phone}
                        {token.patients?.age ? ` • ${token.patients.age} yrs` : ''}
                        {token.department ? ` • ${token.department}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      token.priority === 0 ? 'bg-red-100 text-red-700' :
                      token.priority === 1 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {PRIORITY_LABEL[token.priority]}
                    </span>
                    <span className="text-gray-400 text-sm">{activeIntake === token.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Intake form — expands on click */}
                {activeIntake === token.id && (
                  <div className="border-t border-gray-100 p-4">
                    <WardBoyIntake
                      token={token}
                      onDone={() => { fetchQueue(); setActiveIntake(null); }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Already processed */}
      {inProgressTokens.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            Intake Complete — Waiting for Doctor
          </h2>
          <div className="space-y-2">
            {inProgressTokens.map(token => (
              <div key={token.id} className="bg-violet-50 rounded-xl border border-violet-100 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center text-white font-bold">
                    #{token.token_number}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{token.patients?.name || 'Patient'}</div>
                    <div className="text-xs text-gray-500 capitalize">{token.department || 'General'}</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
                  Ready for Doctor
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
