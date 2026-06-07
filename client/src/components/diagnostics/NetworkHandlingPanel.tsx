import type { NetworkMetrics, HealthStatus } from '../../types/diagnostics'

interface Props { data: NetworkMetrics }

function StatusDot({ status }: { status: HealthStatus }) {
  const color =
    status === 'healthy'  ? 'bg-green-500' :
    status === 'degraded' ? 'bg-yellow-400' :
    status === 'critical' ? 'bg-red-500' :
    'bg-gray-400'

  const label =
    status === 'healthy'  ? 'text-green-600' :
    status === 'degraded' ? 'text-yellow-600' :
    status === 'critical' ? 'text-red-600' :
    'text-gray-500'

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full inline-block animate-pulse ${color}`} />
      <span className={`text-xs font-bold uppercase ${label}`}>{status}</span>
    </div>
  )
}

export function NetworkHandlingPanel({ data }: Props) {
  const services: { name: string; status: HealthStatus }[] = [
    { name: 'Supabase Realtime',  status: data.realtimeStatus },
    { name: 'SMS Gateway',        status: data.smsGatewayStatus },
    { name: 'Vercel Edge CDN',    status: data.vercelEdgeStatus },
  ]

  const hasCritical = services.some(s => s.status === 'critical')

  return (
    <div className={`rounded-xl border p-5 bg-white ${hasCritical ? 'border-red-200' : 'border-gray-200'}`}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🌐</span>
        <h3 className="font-semibold text-sm tracking-widest uppercase text-gray-700">
          Network Handling
        </h3>
      </div>

      {/* Service status list */}
      <div className="space-y-0 mb-4">
        {services.map(s => (
          <div
            key={s.name}
            className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
          >
            <span className="text-xs text-gray-600">{s.name}</span>
            <StatusDot status={s.status} />
          </div>
        ))}
      </div>

      {/* Network stats */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className={`text-2xl font-bold ${
            data.supabaseLatencyMs > 1000 ? 'text-red-600'
            : data.supabaseLatencyMs > 500  ? 'text-yellow-600'
            : 'text-green-600'
          }`}>
            {data.supabaseLatencyMs}ms
          </div>
          <div className="text-gray-500">DB Latency</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-600">
            {data.retrySuccessRate}%
          </div>
          <div className="text-gray-500">Retry Success Rate</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${data.failedApiCallsLast1h > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {data.failedApiCallsLast1h}
          </div>
          <div className="text-gray-500">Failed Calls (1h)</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${data.offlineUsersDetected > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {data.offlineUsersDetected}
          </div>
          <div className="text-gray-500">Offline Users</div>
        </div>
      </div>

      {data.lastNetworkErrorAt && (
        <p className="text-xs text-gray-400 mt-3 border-t pt-2">
          Last error: {new Date(data.lastNetworkErrorAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
