import { useState } from 'react'
import { useAlerts } from '../../hooks/useAlerts'
import { AlertCard } from '../../components/alerts/AlertCard'
import type { Alert } from '../../types/alerts'

type DisplayTab = 'open' | 'acknowledged' | 'resolved' | 'all'

interface Props {
  onNavigate?: (key: string) => void
}

export function AlertCenter({ onNavigate }: Props) {
  const {
    alerts, loading, error,
    openAlerts, acknowledgedAlerts, resolvedAlerts,
    p1Count,
    acknowledgeAlert, resolveAlert, executeAction,
    refetch
  } = useAlerts()

  const [activeTab, setActiveTab] = useState<DisplayTab>('open')
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)

  const tabAlerts: Record<DisplayTab, Alert[]> = {
    open:         openAlerts,
    acknowledged: acknowledgedAlerts,
    resolved:     resolvedAlerts,
    all:          alerts,
  }

  const displayAlerts = tabAlerts[activeTab]

  const handleNavigate = (key: string) => {
    if (onNavigate) {
      onNavigate(key)
    } else {
      console.log('Navigate to:', key)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <span className="animate-pulse">Loading alerts...</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            Healthcare SaaS Admin · Real-time incident management
          </p>
        </div>
        <div className="flex items-center gap-3">
          {p1Count > 0 && (
            <span className="text-sm font-bold text-white bg-red-500 px-3 py-1.5 rounded-full animate-pulse">
              {p1Count} P1 CRITICAL
            </span>
          )}
          <button
            onClick={refetch}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors font-semibold"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Open',         count: openAlerts.length,         color: 'text-red-600',    bg: 'bg-red-50'    },
          { label: 'Acknowledged', count: acknowledgedAlerts.length,  color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Resolved',     count: resolvedAlerts.length,      color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Total',        count: alerts.length,              color: 'text-gray-700',   bg: 'bg-gray-50'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center border border-slate-100`}>
            <div className={`text-3xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500 mt-1 font-semibold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-150 p-1 rounded-lg w-fit">
        {(['open','acknowledged','resolved','all'] as DisplayTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab} {tab !== 'all' && `(${tabAlerts[tab].length})`}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 text-xs p-3 rounded-lg mb-4 font-semibold">
          Error: {error}
        </div>
      )}

      {/* Alerts list */}
      {displayAlerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-sm font-semibold">No {activeTab} alerts found.</p>
        </div>
      ) : (
        <div>
          {displayAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={acknowledgeAlert}
              onResolve={resolveAlert}
              onExecuteAction={executeAction}
              onViewDetails={setSelectedAlert}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}

      {/* Detail drawer modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-end">
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h2 className="text-lg font-bold text-gray-900">Alert Details</h2>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4 text-sm font-medium">
                <div><span className="text-gray-500 block text-xs">Incident ID</span> <span className="font-mono text-xs text-gray-900 bg-gray-55 px-2 py-0.5 rounded">{selectedAlert.id}</span></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-gray-500 block text-xs">Severity</span> <span className="font-bold">{selectedAlert.severity}</span></div>
                  <div><span className="text-gray-500 block text-xs">Status</span> <span className="font-bold capitalize">{selectedAlert.status}</span></div>
                </div>
                <div><span className="text-gray-500 block text-xs">Category</span> <span className="font-semibold">{selectedAlert.category}</span></div>
                <div><span className="text-gray-500 block text-xs">Hospital Context</span> <span className="font-semibold text-gray-800">{selectedAlert.clinicName ?? 'Global Scope'}</span></div>
                <div><span className="text-gray-500 block text-xs">Timestamp</span> <span className="text-gray-700">{new Date(selectedAlert.createdAt).toLocaleString()}</span></div>
                <div className="pt-3 border-t">
                  <p className="text-gray-500 text-xs mb-1">Alert Description</p>
                  <p className="text-gray-850 leading-relaxed font-semibold">{selectedAlert.description}</p>
                </div>
                {selectedAlert.evidenceLinks && selectedAlert.evidenceLinks.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-gray-500 text-xs mb-2">Evidence & Diagnostics</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedAlert.evidenceLinks.map(l => (
                        <span key={l.navigateTo} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg font-bold">
                          → {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="border-t pt-4 flex gap-3">
              <button
                onClick={() => setSelectedAlert(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
