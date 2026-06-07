export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown'

// ── Panel 1: Crash-Free ───────────────────────────────────
export interface CrashMetrics {
  crashFreeRate: number          // e.g. 99.7 (percentage)
  totalCrashes: number           // in last 24h
  affectedUsers: number
  lastCrashAt: string | null     // ISO timestamp
  topCrashReason: string | null
}

// ── Panel 2: Performance ─────────────────────────────────
export interface PerformanceMetrics {
  avgPageLoadMs: number
  fcp: number                    // First Contentful Paint (ms)
  lcp: number                    // Largest Contentful Paint (ms)
  tti: number                    // Time to Interactive (ms)
  apiAvgResponseMs: number
  slowestEndpoint: string
  slowestEndpointMs: number
}

// ── Panel 3: Lifecycle Safety ────────────────────────────
export interface LifecycleMetrics {
  activeSessions: number
  expiredSessionsLast1h: number
  orphanedTokens: number
  avgSessionDurationMin: number
  lastTokenRotationAt: string | null
  rlsPoliciesActive: number
  rlsPoliciesTotal: number
}

// ── Panel 4: Network Handling ────────────────────────────
export interface NetworkMetrics {
  realtimeStatus: HealthStatus
  supabaseLatencyMs: number
  smsGatewayStatus: HealthStatus
  vercelEdgeStatus: HealthStatus
  failedApiCallsLast1h: number
  retrySuccessRate: number
  offlineUsersDetected: number
  lastNetworkErrorAt: string | null
}

// ── Panel 5: Security ────────────────────────────────────
export interface SecurityMetrics {
  failedLoginAttempts: number
  bruteForceAlerts: number
  rlsViolationAttempts: number
  activeAdminSessions: number
  lastSecurityEventAt: string | null
  suspiciousIps: string[]
  otpAbuseDetected: boolean
}

// ── Panel 6: Logging ─────────────────────────────────────
export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'critical'
  source: string
  message: string
  userId?: string
  clinicId?: string
}

export interface LoggingMetrics {
  totalEventsLast1h: number
  errorRateLast1h: number
  warnCount: number
  criticalCount: number
  recentLogs: LogEntry[]
  topErrorSource: string
}

// ── Root object returned by useDiagnostics ───────────────
export interface SystemDiagnosticsData {
  lastUpdated: string
  overallHealth: HealthStatus
  crash: CrashMetrics
  performance: PerformanceMetrics
  lifecycle: LifecycleMetrics
  network: NetworkMetrics
  security: SecurityMetrics
  logging: LoggingMetrics
}
