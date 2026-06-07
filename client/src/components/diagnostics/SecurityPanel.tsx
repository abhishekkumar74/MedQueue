import type { SecurityMetrics } from '../../types/diagnostics'

interface Props { data: SecurityMetrics }

export function SecurityPanel({ data }: Props) {
  const isCritical = data.bruteForceAlerts > 0 || data.otpAbuseDetected
  const isWarning  = data.failedLoginAttempts > 5 || data.rlsViolationAttempts > 0

  const borderBg = isCritical
    ? 'border-red-300 bg-red-50'
    : isWarning
    ? 'border-yellow-200 bg-yellow-50'
    : 'border-gray-200 bg-white'

  return (
    <div className={`rounded-xl border p-5 ${borderBg}`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔒</span>
          <h3 className="font-semibold text-sm tracking-widest uppercase text-gray-700">
            Security (Critical)
          </h3>
        </div>
        {isCritical && (
          <span className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-full animate-pulse">
            ⚠ ALERT
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`p-3 rounded-lg text-center ${
          data.failedLoginAttempts > 5 ? 'bg-red-100' : 'bg-gray-50'
        }`}>
          <div className={`text-2xl font-bold ${
            data.failedLoginAttempts > 5 ? 'text-red-600' : 'text-gray-700'
          }`}>
            {data.failedLoginAttempts}
          </div>
          <div className="text-xs text-gray-500">Failed Logins (1h)</div>
        </div>

        <div className={`p-3 rounded-lg text-center ${
          data.bruteForceAlerts > 0 ? 'bg-red-100' : 'bg-green-50'
        }`}>
          <div className={`text-2xl font-bold ${
            data.bruteForceAlerts > 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {data.bruteForceAlerts}
          </div>
          <div className="text-xs text-gray-500">Brute Force Alerts</div>
        </div>

        <div className={`p-3 rounded-lg text-center ${
          data.rlsViolationAttempts > 0 ? 'bg-orange-100' : 'bg-gray-50'
        }`}>
          <div className={`text-2xl font-bold ${
            data.rlsViolationAttempts > 0 ? 'text-orange-600' : 'text-gray-700'
          }`}>
            {data.rlsViolationAttempts}
          </div>
          <div className="text-xs text-gray-500">RLS Violations</div>
        </div>

        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-700">
            {data.activeAdminSessions}
          </div>
          <div className="text-xs text-gray-500">Admin Sessions</div>
        </div>
      </div>

      {/* OTP Abuse row */}
      <div className={`flex items-center justify-between p-2 rounded-lg text-xs mb-2 ${
        data.otpAbuseDetected
          ? 'bg-red-100 text-red-700'
          : 'bg-green-50 text-green-700'
      }`}>
        <span>OTP Abuse Detection</span>
        <span className="font-bold">
          {data.otpAbuseDetected ? '⚠ DETECTED' : '✓ CLEAN'}
        </span>
      </div>

      {/* Suspicious IPs */}
      {data.suspiciousIps.length > 0 && (
        <div className="mt-2 p-2 bg-red-100 rounded-lg">
          <div className="text-xs text-red-700 font-bold mb-1">
            Suspicious IPs ({data.suspiciousIps.length}):
          </div>
          {data.suspiciousIps.slice(0, 3).map(ip => (
            <div key={ip} className="text-xs font-mono text-red-600">{ip}</div>
          ))}
        </div>
      )}

      {/* Last event */}
      {data.lastSecurityEventAt && (
        <p className="text-xs text-gray-400 mt-3 border-t pt-2">
          Last event: {new Date(data.lastSecurityEventAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
