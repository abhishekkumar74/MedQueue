import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  SystemDiagnosticsData,
  HealthStatus,
  LogEntry
} from '../types/diagnostics'

// ── Helper: compute overall health from all subsystems ───
function computeOverallHealth(
  data: Partial<SystemDiagnosticsData>
): HealthStatus {
  if (
    data.network?.realtimeStatus === 'critical' ||
    (data.security?.bruteForceAlerts ?? 0) > 0 ||
    (data.crash?.crashFreeRate ?? 100) < 95
  ) return 'critical'

  if (
    (data.network?.supabaseLatencyMs ?? 0) > 1000 ||
    (data.performance?.apiAvgResponseMs ?? 0) > 2000 ||
    (data.crash?.crashFreeRate ?? 100) < 99
  ) return 'degraded'

  return 'healthy'
}

export function useDiagnostics(refreshIntervalMs = 30000) {
  const [data, setData] = useState<SystemDiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDiagnostics = useCallback(async () => {
    try {
      setError(null)
      const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString()

      // ── 1. Crash metrics ────────────────────────────────
      const { data: crashLogs } = await supabase
        .from('crash_logs')
        .select('*')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })

      const totalCrashes = crashLogs?.length ?? 0
      const affectedUsers = new Set(
        crashLogs?.map((c: any) => c.user_id).filter(Boolean)
      ).size

      // ── 2. Performance — measure Supabase round-trip ───
      const perfStart = performance.now()
      await supabase.from('tokens').select('id').limit(1)
      const apiAvgResponseMs = Math.round(performance.now() - perfStart)

      // ── 3. Lifecycle — active sessions + orphaned tokens
      const { data: sessions } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('is_active', true)

      const activeSessions = sessions?.length ?? 0

      const { data: orphanedTokens } = await supabase
        .from('tokens')
        .select('id')
        .is('patient_id', null)

      // ── 4. Security — failed logins + RLS violations ───
      const { data: failedLogins } = await supabase
        .from('auth_logs')
        .select('*')
        .eq('event_type', 'login_failed')
        .gte('created_at', oneHourAgo)

      const { data: rlsViolations } = await supabase
        .from('security_events')
        .select('*')
        .eq('type', 'rls_violation')
        .gte('created_at', oneHourAgo)

      const { data: bruteForceEvents } = await supabase
        .from('security_events')
        .select('*')
        .eq('type', 'brute_force')
        .gte('created_at', oneHourAgo)

      // ── 5. Logs — recent event stream ──────────────────
      const { data: recentLogs } = await supabase
        .from('app_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20)

      const errorLogs = recentLogs?.filter(
        (l: any) => l.level === 'error'
      ) ?? []
      const criticalLogs = recentLogs?.filter(
        (l: any) => l.level === 'critical'
      ) ?? []
      const warnLogs = recentLogs?.filter(
        (l: any) => l.level === 'warn'
      ) ?? []

      // ── 6. Network — Realtime channel check ────────────
      const realtimeConnected = supabase.getChannels().length > 0

      // ── Assemble full diagnostics object ───────────────
      const diagnostics: SystemDiagnosticsData = {
        lastUpdated: new Date().toISOString(),
        overallHealth: 'healthy',
        crash: {
          crashFreeRate: totalCrashes === 0
            ? 100
            : parseFloat(
                Math.max(0, 100 - (totalCrashes / 1000) * 100).toFixed(2)
              ),
          totalCrashes,
          affectedUsers,
          lastCrashAt: (crashLogs as any[])?.[0]?.created_at ?? null,
          topCrashReason: (crashLogs as any[])?.[0]?.reason ?? null,
        },
        performance: {
          avgPageLoadMs: apiAvgResponseMs,
          fcp: 0,
          lcp: 0,
          tti: 0,
          apiAvgResponseMs,
          slowestEndpoint: '/api/tokens',
          slowestEndpointMs: apiAvgResponseMs,
        },
        lifecycle: {
          activeSessions,
          expiredSessionsLast1h: 0,
          orphanedTokens: orphanedTokens?.length ?? 0,
          avgSessionDurationMin: 0,
          lastTokenRotationAt: null,
          rlsPoliciesActive: 8,
          rlsPoliciesTotal: 8,
        },
        network: {
          realtimeStatus: realtimeConnected ? 'healthy' : 'critical',
          supabaseLatencyMs: apiAvgResponseMs,
          smsGatewayStatus: 'healthy',
          vercelEdgeStatus: 'healthy',
          failedApiCallsLast1h: 0,
          retrySuccessRate: 100,
          offlineUsersDetected: 0,
          lastNetworkErrorAt: null,
        },
        security: {
          failedLoginAttempts: failedLogins?.length ?? 0,
          bruteForceAlerts: bruteForceEvents?.length ?? 0,
          rlsViolationAttempts: rlsViolations?.length ?? 0,
          activeAdminSessions:
            sessions?.filter((s: any) => s.role === 'admin').length ?? 0,
          lastSecurityEventAt:
            (failedLogins as any[])?.[0]?.created_at ?? null,
          suspiciousIps: [],
          otpAbuseDetected: false,
        },
        logging: {
          totalEventsLast1h: recentLogs?.length ?? 0,
          errorRateLast1h: (recentLogs?.length ?? 0) > 0
            ? parseFloat(
                ((errorLogs.length / recentLogs!.length) * 100).toFixed(1)
              )
            : 0,
          warnCount: warnLogs.length,
          criticalCount: criticalLogs.length,
          recentLogs: (recentLogs ?? []).map((l: any): LogEntry => ({
            id: l.id,
            timestamp: l.timestamp,
            level: l.level,
            source: l.source ?? 'system',
            message: l.message ?? '',
            userId: l.user_id,
            clinicId: l.clinic_id,
          })),
          topErrorSource: (errorLogs as any[])[0]?.source ?? 'none',
        },
      }

      diagnostics.overallHealth = computeOverallHealth(diagnostics)
      setData(diagnostics)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load diagnostics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDiagnostics()
    const interval = setInterval(fetchDiagnostics, refreshIntervalMs)
    return () => clearInterval(interval)
  }, [fetchDiagnostics, refreshIntervalMs])

  return { data, loading, error, refetch: fetchDiagnostics }
}
