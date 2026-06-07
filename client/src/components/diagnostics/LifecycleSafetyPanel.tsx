import type { LifecycleMetrics } from '../../types/diagnostics'

interface Props { data: LifecycleMetrics }

export function LifecycleSafetyPanel({ data }: Props) {
  const rlsPct = data.rlsPoliciesTotal > 0
    ? Math.round((data.rlsPoliciesActive / data.rlsPoliciesTotal) * 100)
    : 0

  const hasIssues = data.orphanedTokens > 0 || rlsPct < 100

  return (
    <div className={`rounded-xl border p-5 bg-white ${hasIssues ? 'border-orange-200' : 'border-gray-200'}`}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔄</span>
        <h3 className="font-semibold text-sm tracking-widest uppercase text-gray-700">
          Lifecycle Safety
        </h3>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">{data.activeSessions}</div>
          <div className="text-xs text-blue-500 mt-1">Active Sessions</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">
            {data.avgSessionDurationMin > 0 ? `${data.avgSessionDurationMin}m` : '—'}
          </div>
          <div className="text-xs text-purple-500 mt-1">Avg Session</div>
        </div>
        <div className={`text-center p-3 rounded-lg ${data.orphanedTokens > 0 ? 'bg-red-100' : 'bg-green-50'}`}>
          <div className={`text-2xl font-bold ${data.orphanedTokens > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {data.orphanedTokens}
          </div>
          <div className="text-xs text-gray-500 mt-1">Orphaned Tokens</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-700">
            {data.expiredSessionsLast1h}
          </div>
          <div className="text-xs text-gray-500 mt-1">Expired (1h)</div>
        </div>
      </div>

      {/* RLS Policy bar */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-gray-500">RLS Policies Active</span>
          <span className={`font-bold ${rlsPct === 100 ? 'text-green-600' : 'text-red-600'}`}>
            {data.rlsPoliciesActive}/{data.rlsPoliciesTotal}
            {' '}({rlsPct}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${rlsPct === 100 ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${rlsPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {rlsPct === 100 ? '✓ All Row Level Security policies active' : '⚠ Some RLS policies are inactive!'}
        </p>
      </div>
    </div>
  )
}
