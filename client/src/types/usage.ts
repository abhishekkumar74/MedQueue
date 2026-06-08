export interface HourlyUsage {
  hour: number           // 0-23
  pageViews: number
  apiCalls: number
  activeUsers: number
  queueActivity: number
}

export interface PageUsageStat {
  pageName: string
  visits: number
  avgTimeSeconds: number
  bounceRate: number
  lastVisitedAt: string
}

export interface ClinicLoadStat {
  clinicId: string
  clinicName: string
  tokenVolume: number
  staffLogins: number
  apiCallShare: number   // % of total API calls from this clinic
  peakHour: number
}

export interface UsageIntelligenceData {
  totalPageViewsToday: number
  totalApiCallsToday: number
  peakHour: number
  peakHourLoad: number
  mostVisitedPage: string
  hourlyHeatmap: HourlyUsage[]         // 24 entries
  pageStats: PageUsageStat[]
  clinicLoadStats: ClinicLoadStat[]
  weekdayHeatmap: number[][]           // [7 days][24 hours] load matrix
}
