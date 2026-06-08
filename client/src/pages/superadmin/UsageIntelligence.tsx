import { useUsageData } from '../../hooks/useUsageData'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
)

function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0
  const bg =
    intensity === 0    ? '#f3f4f6' :
    intensity < 0.25   ? '#dbeafe' :
    intensity < 0.5    ? '#93c5fd' :
    intensity < 0.75   ? '#3b82f6' :
    '#1d4ed8'

  return (
    <div
      title={`${value} events`}
      style={{ background: bg, width: 20, height: 20, borderRadius: 3, flexShrink: 0 }}
    />
  )
}

export function UsageIntelligence() {
  const { data, loading, refetch } = useUsageData()

  if (loading || !data) {
    return (
      <div className="p-6 max-w-6xl mx-auto animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-150 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-150 rounded-xl mb-6" />
      </div>
    )
  }

  const maxHeatValue = Math.max(
    ...data.weekdayHeatmap.flatMap(row => row), 1
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">
            System load, page traffic, and clinic activity heatmap
          </p>
        </div>
        <button
          onClick={refetch}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors font-semibold"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Page Views Today',  value: data.totalPageViewsToday, color: 'text-blue-600'   },
          { label: 'API Calls Today',   value: data.totalApiCallsToday,  color: 'text-purple-600' },
          { label: 'Peak Hour',         value: `${data.peakHour}:00`,    color: 'text-orange-600' },
          { label: 'Most Visited',      value: data.mostVisitedPage,     color: 'text-green-600'  },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`text-xl font-bold ${s.color} truncate`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1 font-semibold">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly Heatmap */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wide">
          Weekly Activity Heatmap
        </h2>
        <p className="text-xs text-gray-400 mb-4 font-medium">
          Darker blue = higher system load. Use this to plan maintenance windows.
        </p>

        {/* Hour labels */}
        <div className="flex gap-1 mb-1 ml-8">
          {HOURS.filter((_, i) => i % 3 === 0).map(h => (
            <div key={h} style={{ width: 62, fontSize: 9, color: '#9ca3af', textAlign: 'left', flex: '0 0 auto' }} className="font-bold uppercase font-mono">
              {h}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        {data.weekdayHeatmap.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1 mb-1">
            <span style={{ width: 28, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }} className="font-bold mr-1">
              {DAYS[dayIdx]}
            </span>
            {row.map((val, hourIdx) => (
              <HeatCell key={hourIdx} value={val} max={maxHeatValue} />
            ))}
          </div>
        ))}
      </div>

      {/* Grid: Page Stats & Clinic Load Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Page Usage */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-sm text-gray-700 mb-3 uppercase tracking-wide">
            Top Visited Pages / Modules
          </h3>
          <div className="space-y-3">
            {data.pageStats.map(stat => (
              <div key={stat.pageName} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-xs font-mono font-black text-gray-800">{stat.pageName}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">Bounce Rate: {stat.bounceRate}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">{stat.visits} visits</p>
                  <p className="text-[10px] text-gray-400 font-semibold">Avg Time: {stat.avgTimeSeconds}s</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinic Load */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-sm text-gray-700 mb-3 uppercase tracking-wide">
            Hospital / Clinic Queue Volume & Share
          </h3>
          <div className="space-y-3">
            {data.clinicLoadStats.map(stat => (
              <div key={stat.clinicId} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-xs font-bold text-gray-800">{stat.clinicName}</p>
                  <p className="text-[10px] text-gray-400 font-semibold">Peak Hour: {stat.peakHour}:00</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">{stat.tokenVolume} tokens</p>
                  <p className="text-[10px] text-blue-600 font-black uppercase tracking-wider">{stat.apiCallShare}% load share</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
