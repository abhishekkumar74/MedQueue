/**
 * Patient History — shows all past visits, prescriptions, tokens
 * Reference: ABHA app style with tabs (Tokens | Records)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser } from '../lib/auth';
import { formatDate, formatTime } from '../lib/dateUtils';
import {
  Clock, FileText, Pill, ChevronDown, ChevronUp,
  Loader2, AlertCircle, Calendar, Stethoscope, RefreshCw
} from 'lucide-react';

interface Props {
  currentUser: AuthUser;
}

interface VisitRecord {
  id: string;
  created_at: string;
  bp: string;
  sugar: string;
  symptoms: string;
  doctor_notes: string;
  tokens?: {
    token_number: number;
    department: string;
    status: string;
  };
  prescriptions?: Array<{
    id: string;
    diagnosis: string;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions: string;
    }>;
    status: string;
    created_at: string;
  }>;
}

interface TokenRecord {
  id: string;
  token_number: number;
  department: string;
  status: string;
  priority: number;
  created_at: string;
}

const PRIORITY_LABEL: Record<number, string> = { 0: 'Emergency', 1: 'Senior', 2: 'Normal' };
const PRIORITY_COLOR: Record<number, string> = {
  0: 'bg-red-100 text-red-700',
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-emerald-100 text-emerald-700',
};

export default function PatientHistory({ currentUser }: Props) {
  const [tab, setTab] = useState<'tokens' | 'records'>('tokens');
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!currentUser.id) return;
    setLoading(true);
    try {
      // Fetch visits with prescriptions
      const { data: visitData, error: ve } = await supabase
        .from('visits')
        .select('*, tokens(token_number, department, status), prescriptions(id, diagnosis, medications, status, created_at)')
        .eq('patient_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (ve) throw new Error(ve.message);
      setVisits(visitData ?? []);

      // Fetch all tokens
      const { data: tokenData, error: te } = await supabase
        .from('tokens')
        .select('id, token_number, department, status, priority, created_at')
        .eq('patient_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (te) throw new Error(te.message);
      setTokens(tokenData ?? []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#005EB8]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#005EB8]">My Health Records</h1>
          <p className="text-gray-500 text-sm mt-0.5">Your complete visit history</p>
        </div>
        <button onClick={fetchHistory}
          className="flex items-center gap-2 px-3 py-2 border-2 border-[#005EB8] text-[#005EB8] rounded-xl hover:bg-[#E8F3FF] transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Patient card */}
      <div className="bg-gradient-to-r from-[#005EB8] to-[#0077cc] rounded-2xl p-5 mb-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-extrabold">
            {currentUser.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-extrabold text-lg">{currentUser.name}</div>
            <div className="text-blue-100 text-sm">{currentUser.phone}</div>
            {currentUser.age && <div className="text-blue-200 text-xs mt-0.5">{currentUser.age} years old</div>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <div className="text-2xl font-extrabold">{tokens.length}</div>
            <div className="text-blue-200 text-xs">Total Visits</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold">{visits.length}</div>
            <div className="text-blue-200 text-xs">Consultations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-extrabold">
              {visits.reduce((acc, v) => acc + (v.prescriptions?.length ?? 0), 0)}
            </div>
            <div className="text-blue-200 text-xs">Prescriptions</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
        <button onClick={() => setTab('tokens')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'tokens' ? 'bg-white text-[#005EB8] shadow-sm' : 'text-gray-500'}`}>
          Token History
        </button>
        <button onClick={() => setTab('records')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'records' ? 'bg-white text-[#005EB8] shadow-sm' : 'text-gray-500'}`}>
          Medical Records
        </button>
      </div>

      {/* ── TOKEN HISTORY ── */}
      {tab === 'tokens' && (
        <div className="space-y-3">
          {tokens.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No token history yet</p>
              <p className="text-gray-300 text-sm">Your visit tokens will appear here</p>
            </div>
          ) : (
            tokens.map(token => (
              <div key={token.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#E8F3FF] rounded-xl flex items-center justify-center">
                      <span className="font-extrabold text-[#005EB8] text-lg">#{token.token_number}</span>
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 capitalize">{token.department || 'General'}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(token.created_at)} • {formatTime(token.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      token.status === 'DONE' ? 'bg-gray-100 text-gray-600' :
                      token.status === 'SERVING' ? 'bg-green-100 text-green-700' :
                      token.status === 'WAITING' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {token.status}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_COLOR[token.priority]}`}>
                      {PRIORITY_LABEL[token.priority]}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MEDICAL RECORDS ── */}
      {tab === 'records' && (
        <div className="space-y-3">
          {visits.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No medical records yet</p>
              <p className="text-gray-300 text-sm">Your consultation records will appear here</p>
            </div>
          ) : (
            visits.map(visit => (
              <div key={visit.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Visit header */}
                <button
                  onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 text-sm">
                        {visit.tokens?.department ? visit.tokens.department.charAt(0).toUpperCase() + visit.tokens.department.slice(1) : 'Consultation'}
                        {visit.tokens?.token_number && <span className="text-gray-400 font-normal ml-1">• Token #{visit.tokens.token_number}</span>}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(visit.created_at)}
                      </div>
                    </div>
                  </div>
                  {expandedVisit === visit.id
                    ? <ChevronUp className="w-5 h-5 text-gray-400" />
                    : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>

                {/* Expanded details */}
                {expandedVisit === visit.id && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Vitals */}
                    {(visit.bp || visit.sugar) && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Vitals</div>
                        <div className="grid grid-cols-2 gap-2">
                          {visit.bp && (
                            <div className="bg-blue-50 rounded-xl p-3">
                              <div className="text-xs text-blue-500 font-semibold">Blood Pressure</div>
                              <div className="font-extrabold text-blue-700 text-lg">{visit.bp}</div>
                            </div>
                          )}
                          {visit.sugar && (
                            <div className="bg-emerald-50 rounded-xl p-3">
                              <div className="text-xs text-emerald-500 font-semibold">Sugar Level</div>
                              <div className="font-extrabold text-emerald-700 text-lg">{visit.sugar}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Symptoms */}
                    {visit.symptoms && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Chief Complaint</div>
                        <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-800">{visit.symptoms}</div>
                      </div>
                    )}

                    {/* Doctor notes */}
                    {visit.doctor_notes && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Doctor Notes</div>
                        <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">{visit.doctor_notes}</div>
                      </div>
                    )}

                    {/* Prescriptions */}
                    {visit.prescriptions && visit.prescriptions.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Prescriptions</div>
                        {visit.prescriptions.map(rx => (
                          <div key={rx.id} className="bg-violet-50 rounded-xl p-4 border border-violet-100">
                            <div className="flex items-center justify-between mb-3">
                              <div className="font-bold text-violet-800 text-sm">{rx.diagnosis}</div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                rx.status === 'DISPENSED' ? 'bg-green-100 text-green-700' :
                                rx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {rx.status}
                              </span>
                            </div>
                            {Array.isArray(rx.medications) && rx.medications.length > 0 && (
                              <div className="space-y-2">
                                {rx.medications.map((med, mi) => (
                                  <div key={mi} className="flex items-start gap-2 bg-white rounded-lg p-2.5">
                                    <Pill className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <div className="font-semibold text-gray-800 text-sm">{med.name} — {med.dosage}</div>
                                      <div className="text-xs text-gray-500">
                                        {[med.frequency, med.duration, med.instructions].filter(Boolean).join(' • ')}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
