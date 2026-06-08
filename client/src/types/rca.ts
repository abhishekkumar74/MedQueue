import type { AlertCategory } from './alerts'

export type RCAStatus = 'analyzing' | 'complete' | 'insufficient_data'

export interface RCAEvidence {
  label: string           // e.g. "Active tokens: 100"
  value: string
  severity: 'critical' | 'warning' | 'info'
  navigateTo?: string     // sidebar key for "jump to" link
}

export interface RCAStep {
  order: number
  action: string          // e.g. "Reset the queue for Apollo Clinic"
  detail: string          // more detail on HOW to do it
  actionKey?: string      // maps to executeAction in useAlerts
  isComplete: boolean
}

export interface RCAResult {
  alertId: string
  status: RCAStatus
  summary: string         // 1-2 sentence explanation of root cause
  rootCause: string       // single root cause label
  confidence: number      // 0-100
  evidence: RCAEvidence[]
  fixSteps: RCAStep[]
  estimatedFixMins: number
  preventionTip: string
  analyzedAt: string
}
