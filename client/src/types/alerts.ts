export type AlertSeverity = 'P1' | 'P2' | 'P3'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'
export type AlertCategory =
  | 'queue_overload'
  | 'api_offline'
  | 'db_slow'
  | 'auth_failure'
  | 'billing_overdue'
  | 'staff_inactive'
  | 'realtime_disconnect'
  | 'otp_failure'
  | 'custom'

export interface AlertAction {
  label: string           // e.g. "Reset Queue"
  actionKey: string       // e.g. "reset_queue"
  variant: 'danger' | 'warning' | 'primary'
}

export interface Alert {
  id: string
  severity: AlertSeverity
  status: AlertStatus
  category: AlertCategory
  title: string
  description: string
  clinicId?: string
  clinicName?: string
  affectedEntity?: string   // e.g. "Apollo Clinic", "Dr. Abhishek"
  createdAt: string         // ISO
  acknowledgedAt?: string
  resolvedAt?: string
  resolvedBy?: string       // user name
  actions: AlertAction[]    // one-click fix buttons
  evidenceLinks?: {
    label: string
    navigateTo: string      // sidebar key to navigate to
  }[]
}
