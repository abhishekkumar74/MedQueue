import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getPendingPrescriptions, dispensePrescription } from '../lib/api';
import { Prescription, Medication, PRESCRIPTION_STATUS_COLOR, PRESCRIPTION_STATUS_LABEL } from '../types';
import { Pill, Clock, CheckCircle2, Loader2, AlertCircle, Package, User, RefreshCw, ChevronRight } from 'lucide-react';

export default function PharmacyDashboard() {
  const [pending, setPending] = useState<Prescription[]>([]);
  const [dispensedToday, setDispensedToday] = useState<Prescription[]>([]);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchPending = useCallback(async () => {
    try {
      const data = await getPendingPrescriptions();
      setPending(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDispensedToday = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('prescriptions')
      .select('id, created_at, dispensed_at')
      .eq('status', 'DISPENSED')
      .gte('dispensed_at', `${today}T00:00:00`);
    if (data) setDispensedToday(data as Prescription[]);
  }, []);

  useEffect(() => {
    fetchPending();
    fetchDispensedToday();
  }, [fetchPending, fetchDispensedToday]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('pharmacy-prescriptions')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'prescriptions',
      }, (payload) => {
        const rx = payload.new as Prescription;
        if (rx.status === 'PENDING' || rx.status === 'IN_PROGRESS') {
          setPending(prev => [...prev, rx]);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'prescriptions',
      }, (payload) => {
        const rx = payload.new as Prescription;
        setPending(prev => {
          if (rx.status === 'DISPENSED' || rx.status === 'CANCELLED') {
            return prev.filter(p => p.id !== rx.id);
          }
          return prev.map(p => p.id === rx.id ? rx : p);
        });
        if (rx.status === 'DISPENSED') {
          fetchDispensedToday();
          if (selected?.id === rx.id) setSelected(null);
        }
        if (selected?.id === rx.id) setSelected(rx);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selected, fetchDispensedToday]);

  async function handleStartPreparing(rx: Prescription) {
    setDispensing(rx.id);
    try {
      // Optimistic update to IN_PROGRESS
      setPending(prev => prev.map(p => p.id === rx.id ? { ...p, status: 'IN_PROGRESS' } : p));
      if (selected?.id === rx.id) setSelected(s => s ? { ...s, status: 'IN_PROGRESS' } : s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setDispensing(null);
    }
  }

  async function handleDispense(rx: Prescription) {
    const prevStatus = rx.status;
    setDispensing(rx.id);
    setPending(prev => prev.filter(p => p.id !== rx.id));
    if (selected?.id === rx.id) setSelected(null);
    try {
      await dispensePrescription(rx.id, 'Pharmacy Staff');
      fetchDispensedToday();
    } catch (e) {
      setPending(prev => [...prev, { ...rx, status: prevStatus }]);
      setError(e instanceof Error ? e.message : 'Failed to dispense');
    } finally {
      setDispensing(null);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Pill className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Pharmacy Dashboard</h1>
              <p className="text-sm text-gray-500">Manage prescriptions and dispensing</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-emerald-600">{dispensedToday.length}</div>
              <div className="text-xs text-gray-500">Dispensed Today</div>
            </div>
            <button
              onClick={() => { fetchPending(); fetchDispensedToday(); }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-xs underline">Dismiss</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Prescription Queue */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-700">
                Pending Queue
                <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {pending.length}
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#005EB8]" />
              </div>
            ) : pending.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 font-medium text-sm">No pending prescriptions</p>
                <p className="text-gray-300 text-xs mt-1">New prescriptions will appear here in real-time</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map(rx => (
                  <button
                    key={rx.id}
                    onClick={() => setSelected(rx)}
                    className={`w-full text-left bg-white rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                      selected?.id === rx.id ? 'border-[#005EB8]' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-gray-800 text-sm">
                          {rx.patients?.name ?? rx.tokens?.phone ?? 'Patient'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Token #{rx.tokens?.token_number ?? '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PRESCRIPTION_STATUS_COLOR[rx.status]}`}>
                          {PRESCRIPTION_STATUS_LABEL[rx.status]}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1 mb-2">{rx.diagnosis}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {timeAgo(rx.created_at)}
                      <span className="mx-1">·</span>
                      {rx.medications.length} medication{rx.medications.length !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prescription Detail */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                {/* Detail header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-bold text-gray-800">
                          {selected.patients?.name ?? 'Patient'}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PRESCRIPTION_STATUS_COLOR[selected.status]}`}>
                          {PRESCRIPTION_STATUS_LABEL[selected.status]}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Token #{selected.tokens?.token_number ?? '—'} · {timeAgo(selected.created_at)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnosis */}
                <div className="p-5 border-b border-gray-100">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Diagnosis</div>
                  <p className="text-gray-800 font-medium">{selected.diagnosis}</p>
                </div>

                {/* Medications */}
                <div className="p-5 border-b border-gray-100">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Medications ({selected.medications.length})
                  </div>
                  <div className="space-y-3">
                    {selected.medications.map((med: Medication, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-bold text-gray-800">{med.name}</div>
                          <div className="text-sm font-semibold text-[#005EB8]">{med.dosage}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div><span className="font-semibold">Frequency:</span> {med.frequency}</div>
                          <div><span className="font-semibold">Duration:</span> {med.duration}</div>
                          {med.quantity && <div><span className="font-semibold">Qty:</span> {med.quantity} units</div>}
                          {med.instructions && (
                            <div className="col-span-2"><span className="font-semibold">Instructions:</span> {med.instructions}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-5 flex gap-3">
                  {selected.status === 'PENDING' && (
                    <button
                      onClick={() => handleStartPreparing(selected)}
                      disabled={dispensing === selected.id}
                      className="flex-1 min-h-[44px] py-3 border-2 border-[#005EB8] text-[#005EB8] rounded-xl font-semibold hover:bg-[#E8F3FF] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {dispensing === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                      Start Preparing
                    </button>
                  )}
                  {(selected.status === 'PENDING' || selected.status === 'IN_PROGRESS') && (
                    <button
                      onClick={() => handleDispense(selected)}
                      disabled={dispensing === selected.id}
                      className="flex-1 min-h-[44px] py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {dispensing === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Mark Dispensed
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Pill className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">Select a prescription to view details</p>
                <p className="text-gray-300 text-sm mt-1">Click any prescription from the queue on the left</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
