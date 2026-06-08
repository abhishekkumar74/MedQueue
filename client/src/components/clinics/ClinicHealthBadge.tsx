import { useClinicHealth } from '../../hooks/useClinicHealth'

interface Props {
  clinicId: string
  onResetQueue: (clinicId: string) => void
}

export function ClinicHealthBadge({ clinicId, onResetQueue }: Props) {
  const health = useClinicHealth(clinicId)

  if (!health) {
    return <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
  }

  const scoreColor =
    health.status === 'healthy'  ? 'text-green-600' :
    health.status === 'degraded' ? 'text-yellow-600' :
    'text-red-600'

  const barColor =
    health.status === 'healthy'  ? 'bg-green-500' :
    health.status === 'degraded' ? 'bg-yellow-400' :
    'bg-red-500'

  const bgColor =
    health.status === 'healthy'  ? 'bg-green-50/50  border-green-200' :
    health.status === 'degraded' ? 'bg-yellow-50/50 border-yellow-200' :
    'bg-red-50/50   border-red-200'

  return (
    <div className={`rounded-xl border p-4 mt-3 ${bgColor}`}>

      {/* Health score row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Hospital Health</span>
        <span className={`text-base font-black ${scoreColor}`}>
          {health.healthScore}/100
        </span>
      </div>

      {/* Score bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${health.healthScore}%` }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3 border-t pt-2 border-dashed border-gray-200">
        <div>
          <div className={`font-black text-sm ${health.queueLoadPercent > 80 ? 'text-red-600' : 'text-gray-750'}`}>
            {health.activeTokens}
          </div>
          <div className="text-[10px] text-gray-400 font-semibold uppercase">Tokens</div>
        </div>
        <div>
          <div className="font-black text-sm text-gray-750">
            {health.doctorsOnline}/{health.doctorsTotal}
          </div>
          <div className="text-[10px] text-gray-400 font-semibold uppercase">Doctors</div>
        </div>
        <div>
          <div className={`font-black text-sm ${health.avgWaitMins > 20 ? 'text-orange-600' : 'text-gray-750'}`}>
            {health.avgWaitMins}m
          </div>
          <div className="text-[10px] text-gray-400 font-semibold uppercase">Avg Wait</div>
        </div>
      </div>

      {/* Last incident */}
      {health.lastIncidentTitle && (
        <p className="text-[11px] font-bold text-red-600 mb-2 truncate">
          ⚠ {health.lastIncidentTitle}
        </p>
      )}

      {/* Force Reset Queue button */}
      {health.queueLoadPercent > 70 && (
        <button
          onClick={() => onResetQueue(clinicId)}
          className="w-full text-[10px] py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors uppercase tracking-wider shadow-sm"
        >
          Force Reset Queue
        </button>
      )}
    </div>
  )
}
