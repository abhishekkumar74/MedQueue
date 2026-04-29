import { useState, useEffect, useCallback } from 'react';
import { getQueue } from '../lib/api';
import { Token, PRIORITY_LABEL, DEPARTMENT_LABEL, Department } from '../types';
import { Activity, Clock } from 'lucide-react';

interface QueueData {
  waiting: Token[];
  serving: Token | null;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  });
}

export default function DisplayBoard() {
  const [queue, setQueue] = useState<QueueData>({ waiting: [], serving: null });
  const [now, setNow] = useState(new Date());
  const [tick, setTick] = useState(0);

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getQueue();
      setQueue(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchQueue();
    const qInterval = setInterval(() => { fetchQueue(); setTick(t => t + 1); }, 8000);
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(qInterval); clearInterval(clockInterval); };
  }, [fetchQueue]);

  const nextFour = queue.waiting.filter(t => t.intake_status === 'READY_FOR_DOCTOR').slice(0, 4);
  const waitingCount = queue.waiting.length;

  return (
    <div className="min-h-screen bg-[#001f4d] text-white flex flex-col select-none">

      {/* ── Top Bar ── */}
      <div className="bg-[#005EB8] px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-[#00A3AD]" />
          <div>
            <div className="text-lg font-extrabold tracking-wide">MedQueue</div>
            <div className="text-blue-200 text-xs">Hospital Queue Management</div>
          </div>
        </div>

        {/* Live clock */}
        <div className="flex items-center gap-2 bg-[#003d7a] px-4 py-2 rounded-xl">
          <Clock className="w-4 h-4 text-[#00A3AD]" />
          <span className="text-lg font-bold font-mono tracking-widest">{formatTime(now)}</span>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-extrabold text-[#00A3AD]">{waitingCount}</div>
            <div className="text-blue-300 text-xs">Waiting</div>
          </div>
          <div className="w-px h-8 bg-blue-600" />
          <div className="text-center">
            <div className={`text-2xl font-extrabold ${tick % 2 === 0 ? 'text-emerald-400' : 'text-emerald-300'} transition-colors`}>
              {queue.serving ? 1 : 0}
            </div>
            <div className="text-blue-300 text-xs">Serving</div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 grid lg:grid-cols-2 gap-0">

        {/* LEFT — Now Serving */}
        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-[#005EB8] via-[#003d7a] to-[#001f4d] p-8 lg:p-12 border-r border-blue-800">
          <div className="text-[#00A3AD] font-extrabold text-sm tracking-[0.3em] uppercase mb-8">
            ● Now Serving
          </div>

          {queue.serving ? (
            <div className="text-center w-full max-w-xs">
              {/* Big token number */}
              <div className="relative">
                <div className="text-[10rem] leading-none font-extrabold text-white drop-shadow-2xl">
                  {queue.serving.token_number}
                </div>
                <div className="absolute -top-2 -left-2 text-4xl font-bold text-[#00A3AD] opacity-60">#</div>
              </div>

              {/* Patient name */}
              {queue.serving.patients?.name && (
                <div className="text-2xl font-bold text-blue-100 mt-2 truncate">
                  {queue.serving.patients.name}
                </div>
              )}

              {/* Department */}
              {queue.serving.department && (
                <div className="mt-3 inline-block bg-[#00A3AD]/20 border border-[#00A3AD]/40 text-[#00A3AD] font-bold px-4 py-1.5 rounded-full text-sm capitalize">
                  {DEPARTMENT_LABEL[queue.serving.department as Department] ?? queue.serving.department}
                </div>
              )}

              {/* Priority badge */}
              <div className="mt-3">
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                  queue.serving.priority === 0 ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                  queue.serving.priority === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {PRIORITY_LABEL[queue.serving.priority]}
                </span>
              </div>

              {/* Proceed message */}
              <div className="mt-8 bg-[#00A3AD] text-white rounded-2xl px-6 py-4 text-lg font-bold animate-pulse shadow-lg shadow-[#00A3AD]/30">
                🏥 Please proceed to the doctor
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-8xl mb-4 opacity-30">🏥</div>
              <div className="text-blue-300 text-2xl font-light">No patient currently</div>
              <div className="text-blue-500 text-sm mt-2">Waiting for next call...</div>
            </div>
          )}
        </div>

        {/* RIGHT — Queue */}
        <div className="bg-[#002d5c] p-6 lg:p-8 flex flex-col">
          <div className="text-[#00A3AD] font-extrabold text-sm tracking-[0.3em] uppercase mb-6">
            ◆ Up Next
          </div>

          {nextFour.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-5xl mb-4 opacity-20">⏳</div>
              <div className="text-blue-400 text-xl font-light">Queue is empty</div>
              <div className="text-blue-600 text-sm mt-1">No patients ready for doctor</div>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {nextFour.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-4 rounded-2xl p-4 border-2 transition-all ${
                  i === 0
                    ? 'bg-[#005EB8]/60 border-[#00A3AD] shadow-lg shadow-[#00A3AD]/10'
                    : 'bg-[#003d7a]/50 border-blue-800'
                }`}>
                  {/* Position badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${
                    i === 0 ? 'bg-[#00A3AD] text-white' : 'bg-blue-800 text-blue-300'
                  }`}>
                    {i + 1}
                  </div>

                  {/* Token number */}
                  <div className={`text-4xl font-extrabold w-16 text-center flex-shrink-0 ${
                    i === 0 ? 'text-white' : 'text-blue-300'
                  }`}>
                    #{t.token_number}
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    {t.patients?.name && (
                      <div className={`font-bold text-base truncate ${i === 0 ? 'text-white' : 'text-blue-200'}`}>
                        {t.patients.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {t.department && (
                        <span className="text-xs text-blue-400 capitalize">
                          {DEPARTMENT_LABEL[t.department as Department] ?? t.department}
                        </span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        t.priority === 0 ? 'bg-red-500/20 text-red-300' :
                        t.priority === 1 ? 'bg-amber-500/20 text-amber-300' :
                        'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                    </div>
                  </div>

                  {i === 0 && (
                    <div className="text-[#00A3AD] font-extrabold text-xs tracking-wider flex-shrink-0">
                      NEXT →
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Bottom stats */}
          <div className="mt-6 pt-4 border-t border-blue-800 grid grid-cols-3 gap-3">
            {[
              { label: 'Waiting', value: waitingCount, color: 'text-yellow-400' },
              { label: 'Serving', value: queue.serving ? 1 : 0, color: 'text-emerald-400' },
              { label: 'Ready', value: nextFour.length, color: 'text-[#00A3AD]' },
            ].map(s => (
              <div key={s.label} className="bg-[#001f4d] rounded-xl p-3 text-center">
                <div className={`text-3xl font-extrabold ${s.color}`}>{s.value}</div>
                <div className="text-blue-400 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom ticker ── */}
      <div className="bg-[#005EB8] px-6 py-2 flex items-center gap-4 border-t border-blue-700">
        <span className="text-[#00A3AD] font-bold text-xs tracking-widest uppercase flex-shrink-0">Notice</span>
        <div className="flex-1 overflow-hidden">
          <p className="text-blue-200 text-xs animate-pulse">
            Please keep your token number ready • Kindly maintain silence in the hospital premises • Follow doctor's instructions carefully
          </p>
        </div>
      </div>
    </div>
  );
}
