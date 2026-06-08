import { useAuditLog } from '../../hooks/useAuditLog'
import type { AuditLogEntry } from '../../types/audit'

const roleColor: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN:       'bg-blue-100 text-blue-700',
  DOCTOR:      'bg-green-100 text-green-700',
  WARD_BOY:    'bg-yellow-100 text-yellow-700',
  PHARMACY:    'bg-orange-100 text-orange-700',
}

const actionIcon: Record<string, string> = {
  token_deleted:   '🗑',
  staff_suspended: '🚫',
  queue_reset:     '🔄',
  alert_resolved:  '✅',
  broadcast_sent:  '📢',
  clinic_created:  '🏥',
  role_changed:    '🔑',
  plan_changed:    '💳',
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50 transition-colors text-xs ${
      entry.isSuspicious ? 'bg-red-50/70' : ''
    }`}>
      <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap font-mono font-bold">
        {new Date(entry.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3.5">
        <div className="font-semibold text-gray-800">{entry.actorName}</div>
        <div className="text-[10px] text-gray-400 font-medium">{entry.actorEmail}</div>
      </td>
      <td className="px-4 py-3.5">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
          roleColor[entry.actorRole] ?? 'bg-gray-150 text-gray-650'
        }`}>
          {entry.actorRole}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0">{actionIcon[entry.actionType] ?? '⚙️'}</span>
          <span className="text-gray-700 max-w-sm truncate font-medium">{entry.actionLabel}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-500 font-semibold">
        {entry.clinicName ?? '—'}
      </td>
      <td className="px-4 py-3.5 text-gray-400 font-mono font-medium">
        {entry.ipAddress ?? '—'}
      </td>
      <td className="px-4 py-3.5">
        {entry.isSuspicious ? (
          <span className="text-[10px] font-black text-red-650 bg-red-100/80 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
            ⚠️ Suspicious
          </span>
        ) : (
          <span className="text-[10px] font-extrabold text-green-650 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
            ✓ Normal
          </span>
        )}
      </td>
    </tr>
  )
}

export function AuditLog() {
  const {
    entries, loading, totalCount, filters, page,
    setFilters, setPage, exportCSV, pageCount
  } = useAuditLog()

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log Trail</h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete records of platform events across all clinics, patient queries, and administrator actions.
            <span className="ml-2 font-mono text-xs font-bold text-[#005EB8] bg-[#F0F7FF] px-2 py-0.5 rounded-full border border-blue-50">
              {totalCount} total entries
            </span>
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl font-black transition-all uppercase tracking-wider shadow-sm"
        >
          <span>↓</span> Export CSV Report
        </button>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200/60 shadow-inner">
        <div className="xl:col-span-2">
          <input
            type="text"
            placeholder="Search actions, actors, clinics..."
            className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-450 bg-white font-medium"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div>
          <select
            className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-bold text-slate-600"
            value={filters.actorRole ?? ''}
            onChange={e => setFilters(f => ({ ...f, actorRole: e.target.value || null }))}
          >
            <option value="">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="ADMIN">Admin</option>
            <option value="DOCTOR">Doctor</option>
            <option value="WARD_BOY">Ward Boy</option>
            <option value="PHARMACY">Pharmacy</option>
          </select>
        </div>
        <div>
          <select
            className="w-full text-xs px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none bg-white font-bold text-slate-600"
            value={filters.actionType ?? ''}
            onChange={e => setFilters(f => ({ ...f, actionType: e.target.value || null }))}
          >
            <option value="">All Actions</option>
            <option value="token_deleted">Token Deleted</option>
            <option value="staff_suspended">Staff Suspended</option>
            <option value="queue_reset">Queue Reset</option>
            <option value="alert_resolved">Alert Resolved</option>
            <option value="broadcast_sent">Broadcast Sent</option>
            <option value="clinic_created">Clinic Created</option>
            <option value="role_changed">Role Changed</option>
            <option value="plan_changed">Plan Changed</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            title="Date from"
            className="w-full text-xs px-2 py-2 border border-slate-200 rounded-xl outline-none bg-white font-semibold text-slate-650"
            value={filters.dateFrom ?? ''}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || null }))}
          />
          <input
            type="date"
            title="Date to"
            className="w-full text-xs px-2 py-2 border border-slate-200 rounded-xl outline-none bg-white font-semibold text-slate-655"
            value={filters.dateTo ?? ''}
            onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || null }))}
          />
        </div>
        <div className="flex items-center justify-center p-1 bg-white rounded-xl border border-slate-100 shadow-sm">
          <label className="flex items-center gap-2 text-xs font-black text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.suspiciousOnly}
              onChange={e => setFilters(f => ({ ...f, suspiciousOnly: e.target.checked }))}
              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span>Suspicious only</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 border-b border-gray-200">
              <tr className="text-[10px] text-gray-400 font-black uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-black">Time</th>
                <th className="px-4 py-3 text-left font-black">Actor</th>
                <th className="px-4 py-3 text-left font-black">Role</th>
                <th className="px-4 py-3 text-left font-black">Action</th>
                <th className="px-4 py-3 text-left font-black">Clinic</th>
                <th className="px-4 py-3 text-left font-black">IP Address</th>
                <th className="px-4 py-3 text-left font-black">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 animate-pulse">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-slate-100 rounded-lg" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-gray-400 text-sm font-semibold">
                    No audit log entries match your filter configuration.
                  </td>
                </tr>
              ) : (
                entries.map(entry => (
                  <AuditRow key={entry.id} entry={entry} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <span className="text-xs text-slate-500 font-semibold font-mono">
              Showing {page * 25 + 1}–{Math.min((page + 1) * 25, totalCount)} of {totalCount} entries
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3.5 py-1.5 text-xs font-black border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-100 bg-white shadow-sm transition-all"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="px-3.5 py-1.5 text-xs font-black border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-100 bg-white shadow-sm transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
