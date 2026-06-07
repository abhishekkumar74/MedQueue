import { useDiagnostics } from '../../hooks/useDiagnostics'
import { CrashFreePanel }        from '../../components/diagnostics/CrashFreePanel'
import { PerformancePanel }      from '../../components/diagnostics/PerformancePanel'
import { LifecycleSafetyPanel }  from '../../components/diagnostics/LifecycleSafetyPanel'
import { NetworkHandlingPanel }  from '../../components/diagnostics/NetworkHandlingPanel'
import { SecurityPanel }         from '../../components/diagnostics/SecurityPanel'
import { LoggingAnalyticsPanel } from '../../components/diagnostics/LoggingAnalyticsPanel'
import type { HealthStatus } from '../../types/diagnostics'

// ── Health badge styles ──────────────────────────────────
const healthBadgeClass: Record<HealthStatus, string> = {
  healthy:  'bg-green-100  text-green-700  border-green-300',
  degraded: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  critical: 'bg-red-100    text-red-700    border-red-300 animate-pulse',
  unknown:  'bg-gray-100   text-gray-600   border-gray-300',
}

const healthLabel: Record<HealthStatus, string> = {
  healthy:  '✓ ALL SYSTEMS NOMINAL',
  degraded: '⚠ DEGRADED',
  critical: '🚨 CRITICAL',
  unknown:  '? UNKNOWN',
}

// ── Loading skeleton ─────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-52 bg-gray-200 rounded-full animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 bg-gray-100 rounded-xl animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Error state ──────────────────────────────────────────
function ErrorState({
  message, onRetry
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="text-4xl">⚠️</div>
      <p className="text-red-500 text-sm font-medium">{message}</p>
      <button
        onClick={onRetry}
        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
      >
        ↻ Retry
      </button>
    </div>
  )
}

// ── Main component ───────────────────────────────────────
export function SystemDiagnostics() {
  const { data, loading, error, refetch } = useDiagnostics(30000)

  if (loading) return <LoadingSkeleton />
  if (error || !data) return (
    <ErrorState
      message={error ?? 'Failed to load diagnostics'}
      onRetry={refetch}
    />
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            System Diagnostics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Healthcare SaaS Admin · SuperAdmin View
            <span className="text-gray-300 mx-2">·</span>
            Last updated:{' '}
            <span className="font-medium text-gray-600">
              {new Date(data.lastUpdated).toLocaleTimeString()}
            </span>
            <span className="text-gray-300 mx-2">·</span>
            Auto-refreshes every 30s
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Overall Health Badge */}
          <span className={`text-sm font-bold px-4 py-2 rounded-full border uppercase tracking-wide ${healthBadgeClass[data.overallHealth]}`}>
            {healthLabel[data.overallHealth]}
          </span>

          {/* Manual Refresh */}
          <button
            onClick={refetch}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 text-sm rounded-lg font-medium transition-colors"
          >
            ↻ Refresh Now
          </button>
        </div>
      </div>

      {/* ── Quick Summary Strip ──────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-center">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className={`text-lg font-bold ${
            data.crash.totalCrashes > 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {data.crash.crashFreeRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Crash-Free</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className={`text-lg font-bold ${
            data.performance.apiAvgResponseMs > 1000 ? 'text-red-600'
            : data.performance.apiAvgResponseMs > 500 ? 'text-yellow-600'
            : 'text-green-600'
          }`}>
            {data.performance.apiAvgResponseMs}ms
          </div>
          <div className="text-xs text-gray-500">API Response</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className={`text-lg font-bold ${
            data.security.bruteForceAlerts > 0 ? 'text-red-600 animate-pulse' : 'text-green-600'
          }`}>
            {data.security.failedLoginAttempts}
          </div>
          <div className="text-xs text-gray-500">Failed Logins (1h)</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className={`text-lg font-bold ${
            data.network.realtimeStatus === 'critical' ? 'text-red-600'
            : data.network.realtimeStatus === 'degraded' ? 'text-yellow-600'
            : 'text-green-600'
          }`}>
            {data.network.realtimeStatus === 'healthy' ? 'Online' : 'Issues'}
          </div>
          <div className="text-xs text-gray-500">Realtime Status</div>
        </div>
      </div>

      {/* ── 6 Diagnostic Panels ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

        {/* Row 1: Panels 1-3 */}
        <CrashFreePanel       data={data.crash} />
        <PerformancePanel     data={data.performance} />
        <LifecycleSafetyPanel data={data.lifecycle} />

        {/* Row 2: Panels 4-5 */}
        <NetworkHandlingPanel data={data.network} />
        <SecurityPanel        data={data.security} />

        {/* Empty spacer to push Logging to full width */}
        <div className="hidden xl:block" />

        {/* Panel 6 — full width (col-span-full set inside component) */}
        <LoggingAnalyticsPanel data={data.logging} />
      </div>

      {/* ── Footer note ──────────────────────────────── */}
      <p className="text-xs text-gray-400 text-center mt-6">
        Diagnostics auto-refresh every 30 seconds.
        Data sourced live from Supabase — crash_logs, app_logs, security_events, auth_logs.
      </p>

    </div>
  )
}
