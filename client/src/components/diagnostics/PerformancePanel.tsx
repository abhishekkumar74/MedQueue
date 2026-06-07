import type { PerformanceMetrics } from '../../types/diagnostics'

interface Props { data: PerformanceMetrics }

interface MetricRowProps {
  label: string
  value: number
  unit: string
  thresholdGood: number
  thresholdWarn: number
}

function MetricRow({ label, value, unit, thresholdGood, thresholdWarn }: MetricRowProps) {
  const color =
    value === 0        ? 'text-gray-400'       // not measured yet
    : value <= thresholdGood ? 'text-green-600'
    : value <= thresholdWarn ? 'text-yellow-600'
    : 'text-red-600'

  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${color}`}>
        {value === 0 ? '—' : `${value}${unit}`}
      </span>
    </div>
  )
}

export function PerformancePanel({ data }: Props) {
  const isSlow = data.apiAvgResponseMs > 1000

  return (
    <div className={`rounded-xl border p-5 bg-white ${isSlow ? 'border-yellow-200' : 'border-gray-200'}`}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">⚡</span>
        <h3 className="font-semibold text-sm tracking-widest uppercase text-gray-700">
          Performance & Smoothness
        </h3>
      </div>

      {/* Metrics */}
      <MetricRow
        label="API Avg Response"
        value={data.apiAvgResponseMs}
        unit="ms"
        thresholdGood={300}
        thresholdWarn={1000}
      />
      <MetricRow
        label="Slowest Endpoint"
        value={data.slowestEndpointMs}
        unit="ms"
        thresholdGood={500}
        thresholdWarn={1500}
      />
      <MetricRow
        label="First Contentful Paint (FCP)"
        value={data.fcp}
        unit="ms"
        thresholdGood={1800}
        thresholdWarn={3000}
      />
      <MetricRow
        label="Largest Contentful Paint (LCP)"
        value={data.lcp}
        unit="ms"
        thresholdGood={2500}
        thresholdWarn={4000}
      />
      <MetricRow
        label="Time to Interactive (TTI)"
        value={data.tti}
        unit="ms"
        thresholdGood={3800}
        thresholdWarn={7300}
      />

      {/* Slowest endpoint name */}
      <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
        Slowest endpoint:{' '}
        <span className="font-mono font-medium text-gray-600">
          {data.slowestEndpoint}
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-400">
        <span className="text-green-600">● Good</span>
        <span className="text-yellow-600">● Warn</span>
        <span className="text-red-600">● Slow</span>
        <span>● Not measured</span>
      </div>
    </div>
  )
}
