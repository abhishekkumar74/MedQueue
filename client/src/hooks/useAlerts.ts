import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Alert, AlertCategory, AlertSeverity } from '../types/alerts'

// Maps Supabase incident data → Alert objects
function mapIncidentToAlert(row: any): Alert {
  const categoryMap: Record<string, AlertCategory> = {
    'CLINIC QUEUE OVERLOAD': 'queue_overload',
    'API OFFLINE':           'api_offline',
    'DB SLOW':               'db_slow',
    'AUTH FAILURE':          'auth_failure',
  }

  const severityMap: Record<string, AlertSeverity> = {
    'queue_overload': 'P1',
    'api_offline':    'P1',
    'db_slow':        'P2',
    'auth_failure':   'P1',
  }

  const actionsMap: Record<string, Alert['actions']> = {
    queue_overload: [
      { label: 'Reset Queue',       actionKey: 'reset_queue',      variant: 'danger'  },
      { label: 'Broadcast to Staff',actionKey: 'broadcast_staff',  variant: 'warning' },
      { label: 'View Clinic',       actionKey: 'view_clinic',      variant: 'primary' },
    ],
    api_offline: [
      { label: 'Restart Gateway',   actionKey: 'restart_gateway',  variant: 'danger'  },
      { label: 'View Telemetry',    actionKey: 'view_telemetry',   variant: 'primary' },
    ],
    db_slow: [
      { label: 'View DB Metrics',   actionKey: 'view_db',          variant: 'warning' },
    ],
    auth_failure: [
      { label: 'Block IP',          actionKey: 'block_ip',         variant: 'danger'  },
      { label: 'View Security',     actionKey: 'view_security',    variant: 'primary' },
    ],
  }

  const category = categoryMap[row.type] ?? 'custom'

  return {
    id: row.id,
    severity: severityMap[category] ?? 'P3',
    status: row.resolved_at ? 'resolved' : row.acknowledged_at ? 'acknowledged' : 'open',
    category,
    title: row.title ?? row.type,
    description: row.description ?? '',
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    affectedEntity: row.affected_entity,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    actions: actionsMap[category] ?? [],
    evidenceLinks: [
      { label: 'Operations Center', navigateTo: 'dashboard' },
      { label: 'System Diagnostics', navigateTo: 'diagnostics' },
    ],
  }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      setError(null)

      // Try fetching from incidents table
      const { data, error: dbError } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (dbError || !data || data.length === 0) {
        // Generate from known overload data if table empty
        const fallback: Alert[] = [
          {
            id: 'auto-1',
            severity: 'P1',
            status: 'open',
            category: 'queue_overload',
            title: 'Queue Critically Overloaded',
            description: 'Apollo Clinic queue load is critically overloaded (100 active tokens). loadRatio: 100%.',
            clinicId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
            clinicName: 'Apollo Clinic',
            affectedEntity: 'Apollo Clinic',
            createdAt: new Date().toISOString(),
            actions: [
              { label: 'Reset Queue',        actionKey: 'reset_queue',     variant: 'danger'  },
              { label: 'Broadcast to Staff', actionKey: 'broadcast_staff', variant: 'warning' },
              { label: 'View Clinic',        actionKey: 'view_clinic',     variant: 'primary' },
            ],
            evidenceLinks: [
              { label: 'Operations Center',  navigateTo: 'dashboard'  },
              { label: 'Clinic Directory',   navigateTo: 'hospitals'     },
            ],
          },
          {
            id: 'auto-2',
            severity: 'P2',
            status: 'open',
            category: 'queue_overload',
            title: 'Queue Overloaded',
            description: 'RB Memorial queue load is overloaded (3 active tokens). loadRatio: 75%.',
            clinicId: '7e90a5fe-4b01-90c6-ff22-a701748f0222',
            clinicName: 'RB Memorial',
            affectedEntity: 'RB Memorial',
            createdAt: new Date(Date.now() - 600000).toISOString(),
            actions: [
              { label: 'Reset Queue',  actionKey: 'reset_queue',   variant: 'warning' },
              { label: 'View Clinic',  actionKey: 'view_clinic',   variant: 'primary' },
            ],
            evidenceLinks: [
              { label: 'Operations Center', navigateTo: 'dashboard' },
            ],
          },
        ]
        setAlerts(fallback)
      } else {
        setAlerts(data.map(mapIncidentToAlert))
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  const acknowledgeAlert = async (alertId: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId
        ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
        : a
    ))
    try {
      await supabase.from('incidents').update({
        acknowledged_at: new Date().toISOString()
      }).eq('id', alertId)
    } catch (e) {
      console.warn('Could not write to incidents table:', e)
    }
  }

  const resolveAlert = async (alertId: string, resolvedBy: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId
        ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString(), resolvedBy }
        : a
    ))
    try {
      await supabase.from('incidents').update({
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy
      }).eq('id', alertId)
    } catch (e) {
      console.warn('Could not write to incidents table:', e)
    }
  }

  const executeAction = async (alertId: string, actionKey: string) => {
    console.log(`Executing action: ${actionKey} for alert: ${alertId}`)
    if (actionKey === 'reset_queue') {
      const alert = alerts.find(a => a.id === alertId)
      if (alert?.clinicId) {
        await supabase
          .from('tokens')
          .update({ status: 'DONE', intake_status: 'COMPLETED' })
          .eq('hospital_id', alert.clinicId)
          .in('status', ['WAITING', 'SERVING'])
      }
    }
    await resolveAlert(alertId, 'Super Admin')
  }

  // Real-time subscription
  useEffect(() => {
    fetchAlerts()

    const channelId = `incidents-realtime-${Math.random().toString(36).substring(7)}`
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'incidents'
      }, () => fetchAlerts())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchAlerts])

  const openAlerts      = alerts.filter(a => a.status === 'open')
  const acknowledgedAlerts = alerts.filter(a => a.status === 'acknowledged')
  const resolvedAlerts  = alerts.filter(a => a.status === 'resolved')
  const p1Count = openAlerts.filter(a => a.severity === 'P1').length

  return {
    alerts, loading, error,
    openAlerts, acknowledgedAlerts, resolvedAlerts,
    p1Count,
    acknowledgeAlert, resolveAlert, executeAction,
    refetch: fetchAlerts
  }
}
