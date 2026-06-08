export type BroadcastPriority = 'info' | 'warning' | 'emergency'
export type BroadcastTarget   = 'all' | 'clinic' | 'role' | 'department'
export type BroadcastStatus   = 'draft' | 'scheduled' | 'sent' | 'expired'

export interface Broadcast {
  id: string
  message: string
  priority: BroadcastPriority
  targetType: BroadcastTarget
  targetClinic: string | null
  targetRole: string | null
  status: BroadcastStatus
  scheduledAt: string | null
  sentAt: string | null
  expiresAt: string | null
  readCount: number
  totalRecipients: number
  createdBy: string
  createdAt: string
}

export interface BroadcastForm {
  message: string
  priority: BroadcastPriority
  targetType: BroadcastTarget
  targetClinic: string
  targetRole: string
  scheduleFor: string    // ISO string or ''
  expiresAfterHours: number
}
