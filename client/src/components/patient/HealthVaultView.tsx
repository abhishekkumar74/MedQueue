import { useHealthVault } from '../../hooks/useHealthVault'
import type { VaultRecord } from '../../hooks/useHealthVault'

interface Props { mqid: string }

const recordIcon: Record<VaultRecord['type'], string> = {
  prescription: '💊',
  token:        '🎫',
  visit:        '🏥',
}

const typeColor: Record<VaultRecord['type'], string> = {
  prescription: 'bg-green-50 border-green-200',
  token:        'bg-blue-50 border-blue-200',
  visit:        'bg-purple-50 border-purple-200',
}

function RecordCard({ record }: { record: VaultRecord }) {
  return (
    <div className={`rounded-xl border p-4 ${typeColor[record.type]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{recordIcon[record.type]}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                {record.type}
              </span>
              <span className="text-xs text-gray-400">
                {record.hospitalName}
              </span>
            </div>
            {record.department && (
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {record.department}
              </p>
            )}
            {record.diagnosis && (
              <p className="text-xs text-gray-600 mt-1">{record.diagnosis}</p>
            )}
            {record.doctorName && (
              <p className="text-xs text-gray-500 mt-0.5">Dr. {record.doctorName}</p>
            )}
            {record.medicines && record.medicines.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {record.medicines.slice(0, 3).map(m => (
                  <span
                    key={m.name}
                    className="px-2 py-0.5 bg-white border border-green-200 text-green-700 text-xs rounded-full"
                  >
                    {m.name}
                  </span>
                ))}
                {record.medicines.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{record.medicines.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">
            {new Date(record.date).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}
          </p>
          {record.status && (
            <span className={`text-xs font-medium ${
              record.status === 'done'    ? 'text-green-600' :
              record.status === 'waiting' ? 'text-blue-600' :
              'text-gray-500'
            }`}>
              {record.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function HealthVaultView({ mqid }: Props) {
  const {
    records, allRecords, hospitalHistory,
    loading, filterHospital, setFilterHospital
  } = useHealthVault(mqid)

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Health Vault</h2>
          <p className="text-xs text-gray-500">
            {allRecords.length} records across {hospitalHistory.length} hospital(s)
          </p>
        </div>
      </div>

      {/* Hospital filter tabs */}
      {hospitalHistory.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterHospital(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              !filterHospital
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Hospitals ({allRecords.length})
          </button>
          {hospitalHistory.map(h => (
            <button
              key={h.hospitalId}
              onClick={() => setFilterHospital(
                filterHospital === h.hospitalId ? null : h.hospitalId
              )}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filterHospital === h.hospitalId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {h.hospitalName ?? 'Hospital'} ({h.totalVisits})
            </button>
          ))}
        </div>
      )}

      {/* Records list */}
      {records.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm">No records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(record => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  )
}
