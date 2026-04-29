import { useState, useEffect, useCallback } from 'react';
import { getQueue } from '../lib/api';
import { Token, PRIORITY_LABEL, PRIORITY_COLOR } from '../types';
import { Activity, RefreshCw } from 'lucide-react';

interface QueueData {
  waiting: Token[];
  serving: Token | null;
}

export default function DisplayBoard() {
  const [queue, setQueue] = useState<QueueData>({ waiting: [], serving: null });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [tick, setTick] = useState(0);

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getQueue();
      setQueue(data);
      setLastUpdated(new Date());
    } catch {
      // silent on display board
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => { fetchQueue(); setTick(t => t + 1); }, 8000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const nextThree = queue.waiting.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#003d7a] text-white flex flex-col">
      <div className="bg-[#005EB8] py-4 px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-[#00A3AD]" />
          <div>
            <div className="text-xl font-bold">MedQueue Display Board</div>
            <div className="text-blue-200 text-xs">Live Queue Status</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-blue-200 text-sm">
          <RefreshCw className={`w-4 h-4 ${tick % 2 === 0 ? 'opacity-100' : 'opacity-40'} transition-opacity`} />
          <span>Updated {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        <div className="lg:w-1/2 flex flex-col items-center justify-center bg-gradient-to-br from-[#005EB8] to-[#003d7a] p-8 lg:p-12">
          <div className="text-center w-full max-w-sm">
            <div className="text-[#00A3AD] font-bold text-lg tracking-widest uppercase mb-6">Now Serving</div>
            {queue.serving ? (
              <div>
                <div className="text-[9rem] leading-none font-extrabold text-white drop-shadow-lg">
                  #{queue.serving.token_number}
                </div>
                {queue.serving.patients?.name && (
                  <div className="text-2xl font-semibold text-blue-200 mt-2">{queue.serving.patients.name}</div>
                )}
                <div className="mt-4">
                  <span className={`inline-block text-sm font-bold px-4 py-1.5 rounded-full border ${PRIORITY_COLOR[queue.serving.priority]}`}>
                    {PRIORITY_LABEL[queue.serving.priority]}
                  </span>
                </div>
                <div className="mt-6 bg-[#00A3AD] text-white rounded-2xl px-6 py-3 text-lg font-bold animate-pulse">
                  Please proceed to the doctor
                </div>
              </div>
            ) : (
              <div className="text-blue-300 text-2xl font-light">No patient currently</div>
            )}
          </div>
        </div>

        <div className="lg:w-1/2 bg-[#002d5c] p-8 lg:p-10">
          <div className="text-[#00A3AD] font-bold text-lg tracking-widest uppercase mb-6">Next in Queue</div>
          {nextThree.length === 0 ? (
            <div className="text-blue-400 text-xl font-light py-8">Queue is empty</div>
          ) : (
            <div className="space-y-4">
              {nextThree.map((t, i) => (
                <div key={t.id} className={`flex items-center gap-4 rounded-2xl p-5 border transition-all ${i === 0 ? 'bg-[#005EB8] border-[#00A3AD] border-2' : 'bg-[#003d7a] border-blue-700'}`}>
                  <div className={`text-4xl font-extrabold w-20 text-center ${i === 0 ? 'text-white' : 'text-blue-300'}`}>
                    #{t.token_number}
                  </div>
                  <div className="flex-1">
                    {t.patients?.name && (
                      <div className={`font-semibold text-lg ${i === 0 ? 'text-white' : 'text-blue-200'}`}>{t.patients.name}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[t.priority]}`}>
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                      <span className="text-blue-400 text-xs">{new Date(t.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  {i === 0 && <div className="text-[#00A3AD] font-bold text-sm">UP NEXT</div>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-8 pt-6 border-t border-blue-800 grid grid-cols-2 gap-4">
            <div className="bg-[#003d7a] rounded-xl p-4 text-center">
              <div className="text-3xl font-extrabold text-[#00A3AD]">{queue.waiting.length}</div>
              <div className="text-blue-300 text-sm mt-1">Waiting</div>
            </div>
            <div className="bg-[#003d7a] rounded-xl p-4 text-center">
              <div className="text-3xl font-extrabold text-white">{queue.serving ? 1 : 0}</div>
              <div className="text-blue-300 text-sm mt-1">Serving</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
