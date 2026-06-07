import type { LoggingMetrics, LogEntry } from '../../types/diagnostics'

interface Props { data: LoggingMetrics }

const levelStyle: Record<LogEntry['level'], string> = {
  info:     'text-blue-400  bg-blue-900',
  warn:     'text-yellow-400 bg-yellow-900',
  error:    'text-red-400   bg-red-900',
  critical: 'text-white     bg-red-600',
}

export function LoggingAnalyticsPanel({ data }: Props) {
  const hasCritical = data.criticalCount > 0

  return (
    /* col-span-full → spans all 3 columns, sits at the bottom */
    <div className={`rounded-xl border p-5 bg-white col-span-full ${
      hasCritical ? 'border-red-200' : 'border-gray-200'
    }`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h3 className="font-semibold text-sm tracking-widest uppercase text-gray-700">
            Logging & Analytics
          </h3>
        </div>
        <span className="text-xs text-gray-400">
          Top error source:{' '}
          <span className="font-bold text-gray-700 font-mono">
            {data.topErrorSource}
          </span>
        </span>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-700">
            {data.totalEventsLast1h}
          </div>
          <div className="text-xs text-gray-500">Events (1h)</div>
        </div>
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">
            {data.warnCount}
          </div>
          <div className="text-xs text-gray-500">Warnings</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">
            {data.errorRateLast1h.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Error Rate</div>
        </div>
        <div className={`text-center p-3 rounded-lg ${
          hasCritical ? 'bg-red-600' : 'bg-gray-50'
        }`}>
          <div className={`text-2xl font-bold ${
            hasCritical ? 'text-white' : 'text-gray-700'
          }`}>
            {data.criticalCount}
          </div>
          <div className={`text-xs ${hasCritical ? 'text-red-200' : 'text-gray-500'}`}>
            Critical
          </div>
        </div>
      </div>

      {/* Live log stream terminal */}
      <div className="bg-gray-950 rounded-xl p-4 max-h-52 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">
            Live Log Stream
          </span>
        </div>

        {data.recentLogs.length === 0 ? (
          <p className="text-xs text-gray-500 font-mono">
            No recent log entries.
          </p>
        ) : (
          data.recentLogs.slice(0, 15).map(log => (
            <div key={log.id} className="flex items-start gap-2 text-xs mb-1.5">
              <span className="text-gray-500 font-mono shrink-0 w-20">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 font-mono ${levelStyle[log.level]}`}>
                {log.level.toUpperCase()}
              </span>
              <span className="text-gray-400 font-mono shrink-0">
                [{log.source}]
              </span>
              <span className="text-gray-300 font-mono truncate">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
