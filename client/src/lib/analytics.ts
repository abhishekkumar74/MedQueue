import type { Token, Visit } from '../types';

export interface HourlyTrafficPoint {
  hour: number;       // 0-23
  tokenCount: number;
  avgWait: number;
}

export interface AnalyticsMetrics {
  totalTokensToday: number;
  avgWaitTimeMinutes: number;
  serviceThroughput: number;  // tokens/hour
  peakHour: string;
  completionRate: number;     // percentage
}

/**
 * Calculate estimated wait time based on queue position and historical service times.
 * 
 * Preconditions:
 * - aheadCount >= 0
 * - completedTokensToday is an array (may be empty)
 * 
 * Postconditions:
 * - Returns minutes >= 0
 * - projectedTime is always a valid future Date
 * 
 * @param aheadCount - Number of patients ahead in queue
 * @param completedTokensToday - Array of completed tokens from today (sorted by created_at)
 * @returns Object with estimated minutes and projected start time
 */
export function calculateEstimatedWait(
  aheadCount: number,
  completedTokensToday: Token[]
): { minutes: number; projectedTime: Date } {
  const DEFAULT_AVG_MINUTES = 15;

  if (completedTokensToday.length < 2) {
    // Not enough data: use default
    const minutes = aheadCount * DEFAULT_AVG_MINUTES;
    return {
      minutes,
      projectedTime: new Date(Date.now() + minutes * 60_000)
    };
  }

  // Calculate average service time from completed tokens
  // Loop invariant: sum accumulates valid durations only
  let totalDuration = 0;
  let validCount = 0;

  for (let i = 1; i < completedTokensToday.length; i++) {
    const prev = new Date(completedTokensToday[i - 1].created_at).getTime();
    const curr = new Date(completedTokensToday[i].created_at).getTime();
    const duration = (curr - prev) / 60_000;  // minutes

    // Filter outliers: ignore durations > 60 min (likely gaps in service)
    if (duration > 0 && duration <= 60) {
      totalDuration += duration;
      validCount++;
    }
  }

  const avgMinutes = validCount > 0
    ? totalDuration / validCount
    : DEFAULT_AVG_MINUTES;

  const estimatedMinutes = Math.ceil(aheadCount * avgMinutes);

  return {
    minutes: estimatedMinutes,
    projectedTime: new Date(Date.now() + estimatedMinutes * 60_000)
  };
}

/**
 * Build hourly traffic data points for the current day.
 * 
 * Preconditions:
 * - tokens is an array (may be empty)
 * - Each token has a valid created_at ISO timestamp
 * 
 * Postconditions:
 * - Returns exactly 24 entries (one per hour, 0-23)
 * - Each entry has hour in range [0, 23]
 * - tokenCount >= 0 for all entries
 * 
 * Loop Invariants:
 * - Each token is counted exactly once
 * - Hour buckets are mutually exclusive and collectively exhaustive
 * 
 * @param tokens - Array of tokens from today
 * @returns Array of 24 hourly data points
 */
export function buildHourlyTraffic(tokens: Token[]): HourlyTrafficPoint[] {
  // Initialize 24 hours with zero counts
  const hourlyData: HourlyTrafficPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    tokenCount: 0,
    avgWait: 0
  }));

  // Count tokens per hour
  for (const token of tokens) {
    const hour = new Date(token.created_at).getHours();
    if (hour >= 0 && hour <= 23) {
      hourlyData[hour].tokenCount++;
    }
  }

  // Calculate average wait time per hour (simplified - using token count as proxy)
  for (const point of hourlyData) {
    // In a real implementation, this would calculate actual wait times
    // For now, we'll use a simple heuristic based on volume
    point.avgWait = point.tokenCount > 0 ? point.tokenCount * 5 : 0;
  }

  return hourlyData;
}

/**
 * Aggregate analytics metrics from today's tokens and visits.
 * 
 * Preconditions:
 * - tokens contains today's tokens (may be empty)
 * - visits contains today's completed visits (may be empty)
 * 
 * Postconditions:
 * - totalTokensToday >= 0
 * - avgWaitTimeMinutes >= 0
 * - completionRate is in range [0, 100]
 * - All numeric fields are finite numbers (no NaN or Infinity)
 * 
 * @param tokens - Array of today's tokens
 * @param visits - Array of today's completed visits
 * @returns Aggregated analytics metrics
 */
export function aggregateAnalytics(
  tokens: Token[],
  _visits: Visit[]
): AnalyticsMetrics {
  const totalTokensToday = tokens.length;
  
  // Calculate completion rate
  const completedCount = tokens.filter(t => t.status === 'DONE').length;
  const completionRate = totalTokensToday > 0
    ? Math.min(100, Math.max(0, (completedCount / totalTokensToday) * 100))
    : 0;

  // Calculate average wait time
  let totalWaitMinutes = 0;
  let waitCount = 0;

  for (const token of tokens) {
    if (token.status === 'DONE' || token.status === 'SERVING') {
      const created = new Date(token.created_at).getTime();
      const now = Date.now();
      const waitMinutes = (now - created) / 60_000;
      
      if (waitMinutes >= 0 && waitMinutes < 1440) { // Less than 24 hours
        totalWaitMinutes += waitMinutes;
        waitCount++;
      }
    }
  }

  const avgWaitTimeMinutes = waitCount > 0
    ? totalWaitMinutes / waitCount
    : 0;

  // Ensure avgWaitTimeMinutes is finite
  const safeAvgWait = Number.isFinite(avgWaitTimeMinutes) ? avgWaitTimeMinutes : 0;

  // Calculate service throughput (tokens per hour)
  const hourlyData = buildHourlyTraffic(tokens);
  const activeHours = hourlyData.filter(h => h.tokenCount > 0).length;
  const serviceThroughput = activeHours > 0
    ? totalTokensToday / activeHours
    : 0;

  // Find peak hour
  const peakHourData = hourlyData.reduce((max, current) =>
    current.tokenCount > max.tokenCount ? current : max
  , hourlyData[0]);
  
  const peakHour = peakHourData.tokenCount > 0
    ? `${peakHourData.hour.toString().padStart(2, '0')}:00`
    : 'N/A';

  return {
    totalTokensToday,
    avgWaitTimeMinutes: Math.round(safeAvgWait),
    serviceThroughput: Math.round(serviceThroughput * 10) / 10, // Round to 1 decimal
    peakHour,
    completionRate: Math.round(completionRate)
  };
}
