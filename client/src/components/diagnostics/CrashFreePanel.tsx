import type { CrashMetrics } from '../../types/diagnostics'

interface Props { data: CrashMetrics }

export function CrashFreePanel({ data }: Props) {
  const isCritical = data.crashFreeRate < 95
  const isDegraded = data.crashFreeRate >= 95 && data.crashFreeRate < 99.5
  const isHealthy  = data.crashFreeRate >= 99.5

  const borderBg = isCritical
    ? 'border-red-200 bg-red-50'
    : isDegraded
    ? 'border-yellow-200 bg-yellow-50'
    : 'border-green-200 bg-green-50'

  const statusLabel = isCritical ? 'CRITICAL' : isDegraded ? 'DEGRADED' : 'HEALTHY'
  const statusColor = isCritical
    ? 'text-red-600 bg-red-100 border-red-300'
    : isDegraded
    ? 'text-yellow-600 bg-yellow-100 border-yellow-300'
    : 'text-green-600 bg-green-100 border-green-300'

  const barColor = isCritical
    ? 'bg-red-500'
    : isDegraded
    ? 'bg-yellow-400'
    : 'bg-green-500'

  return (
    <div className={`rounded-xl border p-5 ${borderBg}`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">💥</span>
          <h3 className="font-semibold text-sm tracking-widest uppercase text-gray-700">
            Crash-Free Experience
          </h3>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Big number */}
      <div className="mb-1">
        <span className="text-4xl font-bold text-gray-900">
          {data.crashFreeRate.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-4">Crash-free sessions (last 24h)</p>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-5">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${data.crashFreeRate}%` }}
        />
      </div>

      {/* Sub-metrics */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-xl font-bold text-gray-800">{data.totalCrashes}</div>
          <div className="text-gray-500">Total Crashes</div>
        </div>
        <div>
          <div className="text-xl font-bold text-gray-800">{data.affectedUsers}</div>
          <div className="text-gray-500">Affected Users</div>
        </div>
        <div className="col-span-2 border-t border-gray-200 pt-2">
          <div className="text-gray-500">Last Crash</div>
          <div className="font-medium text-gray-700">
            {data.lastCrashAt
              ? new Date(data.lastCrashAt).toLocaleString()
              : '✓ No crashes recorded'}
          </div>
        </div>
        {data.topCrashReason && (
          <div className="col-span-2">
            <div className="text-gray-500">Top Reason</div>
            <div className="font-medium text-gray-700 truncate">
              {data.topCrashReason}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
