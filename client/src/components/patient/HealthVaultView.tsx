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
  const badgeStyle: Record<VaultRecord['type'], string> = {
    prescription: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    token:        'bg-sky-500/10 text-sky-600 border border-sky-500/20',
    visit:        'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
  }

  const containerStyle: Record<VaultRecord['type'], string> = {
    prescription: 'hover:border-emerald-300 hover:shadow-emerald-500/5',
    token:        'hover:border-sky-300 hover:shadow-sky-500/5',
    visit:        'hover:border-indigo-300 hover:shadow-indigo-500/5',
  }

  return (
    <div className={`group relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.01] ${containerStyle[record.type]}`}>
      
      {/* Dynamic light subtle glow overlay */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-[36px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
        record.type === 'prescription' ? 'bg-emerald-500/10' :
        record.type === 'token' ? 'bg-sky-500/10' : 'bg-indigo-500/10'
      }`} />

      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 relative z-10">
        <div className="flex items-start gap-4 w-full sm:w-auto">
          {/* Circular Icon Wrapper */}
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-inner ${
            record.type === 'prescription' ? 'bg-emerald-50' :
            record.type === 'token' ? 'bg-sky-50' : 'bg-indigo-50'
          }`}>
            <span>{recordIcon[record.type]}</span>
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${badgeStyle[record.type]}`}>
                {record.type}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide truncate max-w-[180px]">
                {record.hospitalName}
              </span>
            </div>

            {record.department && (
              <h4 className="font-extrabold text-slate-800 text-sm tracking-tight leading-tight capitalize">
                {record.department} Department
              </h4>
            )}

            {record.diagnosis && (
              <p className="text-xs text-slate-500 font-semibold bg-slate-50 border border-slate-100/60 rounded-xl px-3 py-1.5 mt-1 leading-relaxed">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Clinical Diagnosis</span>
                {record.diagnosis}
              </p>
            )}

            {record.doctorName && (
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                Practitioner: <strong className="text-slate-650 font-extrabold">Dr. {record.doctorName}</strong>
              </p>
            )}

            {record.medicines && record.medicines.length > 0 && (
              <div className="mt-3">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Prescribed Medicines</span>
                <div className="flex flex-wrap gap-1.5">
                  {record.medicines.slice(0, 3).map(m => (
                    <span
                      key={m.name}
                      className="px-2.5 py-1 bg-emerald-50/50 border border-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-wider transition-all hover:bg-emerald-50"
                    >
                      {m.name}
                    </span>
                  ))}
                  {record.medicines.length > 3 && (
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                      +{record.medicines.length - 3} More
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Date and Status layout */}
        <div className="text-left sm:text-right shrink-0 flex sm:flex-col justify-between sm:justify-start items-center sm:items-end w-full sm:w-auto border-t sm:border-none border-slate-50 pt-2.5 sm:pt-0 gap-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {new Date(record.date).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric'
            })}
          </p>
          {record.status && (
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border ${
              record.status === 'done'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                : record.status === 'waiting'
                ? 'bg-sky-50 border-sky-100 text-sky-600'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}>
              {record.status}
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
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[100px] animate-skeleton flex flex-col justify-between">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl animate-pulse shrink-0" />
              <div className="space-y-2 flex-1 mt-1">
                <div className="h-3.5 bg-slate-200 rounded w-1/4 animate-pulse" />
                <div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="border-b border-slate-100 pb-4 text-left">
        <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
          🛡️ Health Vault Ledger
        </h2>
        <p className="text-xs text-slate-400 font-semibold mt-1">
          Unified repository containing <strong className="text-slate-600">{allRecords.length} clinical nodes</strong> synchronized across <strong className="text-slate-650">{hospitalHistory.length} campus databases</strong>.
        </p>
      </div>

      {/* Hospital filter tabs */}
      {hospitalHistory.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none w-full [-webkit-overflow-scrolling:touch]">
          <button
            onClick={() => setFilterHospital(null)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
              !filterHospital
                ? 'bg-[#005EB8] text-white border-transparent shadow-sm'
                : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
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
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                filterHospital === h.hospitalId
                  ? 'bg-[#005EB8] text-white border-transparent shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {h.hospitalName ?? 'Hospital'} ({h.totalVisits})
            </button>
          ))}
        </div>
      )}

      {/* Records list */}
      {records.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[28px] p-12 text-center text-slate-400 space-y-3">
          <span className="text-4xl block">📋</span>
          <h4 className="font-extrabold text-sm uppercase text-slate-750">Secure vault ledger is empty</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
            No clinical records or prescriptions are logged under this MQID. Once you consult at a clinic node, your files sync automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  )
}
