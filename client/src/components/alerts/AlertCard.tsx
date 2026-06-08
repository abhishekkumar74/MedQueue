import type { Alert } from '../../types/alerts'
import { RootCausePanel } from '../rca/RootCausePanel'

interface Props {
  alert: Alert
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
  onExecuteAction: (id: string, actionKey: string) => void
  onViewDetails: (alert: Alert) => void
  onNavigate: (key: string) => void
}

const severityConfig = {
  P1: { bg: 'bg-red-50',    border: 'border-red-400',    badge: 'bg-red-500 text-white',    label: 'P1 CRITICAL' },
  P2: { bg: 'bg-yellow-50', border: 'border-yellow-400', badge: 'bg-yellow-500 text-white', label: 'P2 WARNING'  },
  P3: { bg: 'bg-blue-50',   border: 'border-blue-300',   badge: 'bg-blue-500 text-white',   label: 'P3 INFO'     },
}

const statusConfig = {
  open:         'text-red-600 bg-red-50 border-red-200',
  acknowledged: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  resolved:     'text-green-600 bg-green-50 border-green-200',
}

const categoryIcon: Record<string, string> = {
  queue_overload:      '🏥',
  api_offline:         '🔌',
  db_slow:             '🗄️',
  auth_failure:        '🔐',
  billing_overdue:     '💳',
  staff_inactive:      '👤',
  realtime_disconnect: '📡',
  otp_failure:         '📱',
  custom:              '⚠️',
}

export function AlertCard({
  alert, onAcknowledge, onResolve, onExecuteAction, onViewDetails, onNavigate
}: Props) {
  const sev = severityConfig[alert.severity]

  return (
    <div className={`rounded-xl border-l-4 ${sev.border} ${sev.bg} p-4 mb-3`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl shrink-0">{categoryIcon[alert.category]}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sev.badge}`}>
                {sev.label}
              </span>
              {alert.clinicName && (
                <span className="text-xs text-gray-500 font-medium">
                  {alert.clinicName}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusConfig[alert.status]}`}>
                {alert.status.toUpperCase()}
              </span>
            </div>
            <h3 className="font-semibold text-sm text-gray-900 mt-1 truncate">
              {alert.title}
            </h3>
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(alert.createdAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 mb-3 leading-relaxed">
        {alert.description}
      </p>

      {/* One-click action buttons */}
      {alert.status !== 'resolved' && alert.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {alert.actions.map(action => (
            <button
              key={action.actionKey}
              onClick={() => onExecuteAction(alert.id, action.actionKey)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                action.variant === 'danger'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : action.variant === 'warning'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Bottom row: secondary actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {alert.status === 'open' && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Acknowledge
            </button>
          )}
          {alert.status !== 'resolved' && (
            <button
              onClick={() => onResolve(alert.id)}
              className="text-xs px-2 py-1 rounded border border-green-300 text-green-600 hover:bg-green-50 transition-colors"
            >
              Mark Resolved
            </button>
          )}
        </div>
        <button
          onClick={() => onViewDetails(alert)}
          className="text-xs text-blue-500 hover:underline"
        >
          View details →
        </button>
      </div>

      {/* Resolved by */}
      {alert.status === 'resolved' && alert.resolvedBy && (
        <p className="text-xs text-green-600 mt-2">
          ✓ Resolved by {alert.resolvedBy} at{' '}
          {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleTimeString() : '—'}
        </p>
      )}

      {/* Root cause analysis */}
      {alert.status !== 'resolved' && (
        <RootCausePanel
          alert={alert}
          onExecuteAction={onExecuteAction}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

