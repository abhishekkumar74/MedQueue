import { useState } from 'react'
import { useBroadcasts } from '../../hooks/useBroadcasts'
import type { BroadcastForm, BroadcastPriority, BroadcastTarget, Broadcast } from '../../types/broadcast'

const priorityConfig = {
  info:      { label: 'Info',      color: 'bg-blue-500',   textColor: 'text-blue-700',   bg: 'bg-blue-50/70',   borderColor: 'border-blue-200' },
  warning:   { label: 'Warning',   color: 'bg-yellow-500', textColor: 'text-yellow-700', bg: 'bg-yellow-50/70', borderColor: 'border-yellow-200' },
  emergency: { label: 'Emergency', color: 'bg-red-500',    textColor: 'text-red-700',    bg: 'bg-red-50/70',    borderColor: 'border-red-200' },
}

const statusConfig = {
  draft:     'text-gray-500     bg-gray-100 border-gray-200',
  scheduled: 'text-purple-700  bg-purple-50 border-purple-200',
  sent:      'text-green-700   bg-green-50 border-green-200',
  expired:   'text-gray-400    bg-gray-50 border-gray-150',
}

const CLINICS = ['Apollo Clinic', 'Paras Hospital', 'RB Memorial', 'SR MEMORIAL Hospital']
const ROLES   = ['DOCTOR', 'WARD_BOY', 'PHARMACY', 'ADMIN']

const DEFAULT_FORM: BroadcastForm = {
  message: '',
  priority: 'info',
  targetType: 'all',
  targetClinic: '',
  targetRole: '',
  scheduleFor: '',
  expiresAfterHours: 24,
}

function BroadcastCard({ broadcast, onDelete }: { broadcast: Broadcast; onDelete: (id: string) => void }) {
  const priority = priorityConfig[broadcast.priority]
  const readPct  = broadcast.totalRecipients > 0 ? Math.round((broadcast.readCount / broadcast.totalRecipients) * 100) : 0

  return (
    <div className={`p-4 rounded-2xl border ${priority.borderColor} ${priority.bg} flex flex-col gap-3.5 transition-all shadow-sm`}>
      {/* Top badges */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider text-white ${priority.color}`}>
            {priority.label}
          </span>
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${statusConfig[broadcast.status]}`}>
            {broadcast.status}
          </span>
          <span className="text-[10px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded-full border border-slate-100">
            Target: {broadcast.targetType === 'all' ? 'All Staff' : broadcast.targetType === 'clinic' ? broadcast.targetClinic : broadcast.targetRole}
          </span>
        </div>
        <button
          onClick={() => onDelete(broadcast.id)}
          className="text-xs text-slate-400 hover:text-red-500 font-extrabold uppercase transition-colors"
          title="Delete Broadcast"
        >
          Recall
        </button>
      </div>

      {/* Message */}
      <p className="text-xs font-semibold text-slate-800 leading-relaxed bg-white/60 p-3 rounded-xl border border-white/20">
        {broadcast.message}
      </p>

      {/* Analytics: Read Receipts */}
      <div className="space-y-1 bg-white/40 p-2.5 rounded-xl border border-white/10">
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
          <span>Read receipts</span>
          <span>{broadcast.readCount} of {broadcast.totalRecipients} ({readPct}%)</span>
        </div>
        <div className="w-full bg-slate-200/60 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${broadcast.priority === 'emergency' ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${readPct}%` }}
          />
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex flex-col gap-1 text-[9px] text-slate-400 font-mono font-bold border-t border-slate-200/30 pt-2">
        <div className="flex justify-between">
          <span>Created:</span>
          <span>{new Date(broadcast.createdAt).toLocaleString()}</span>
        </div>
        {broadcast.scheduledAt && (
          <div className="flex justify-between text-purple-600">
            <span>Scheduled:</span>
            <span>{new Date(broadcast.scheduledAt).toLocaleString()}</span>
          </div>
        )}
        {broadcast.sentAt && (
          <div className="flex justify-between text-green-600">
            <span>Sent:</span>
            <span>{new Date(broadcast.sentAt).toLocaleString()}</span>
          </div>
        )}
        {broadcast.expiresAt && (
          <div className="flex justify-between text-slate-400">
            <span>Expires:</span>
            <span>{new Date(broadcast.expiresAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function GlobalBroadcasts() {
  const { broadcasts, loading, sending, sendBroadcast, deleteBroadcast } = useBroadcasts()
  const [form, setForm] = useState<BroadcastForm>(DEFAULT_FORM)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.message.trim()) return
    await sendBroadcast(form)
    setForm(DEFAULT_FORM)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <span className="animate-pulse">Loading broadcasts telemetry...</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enhanced Broadcast Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          Issue priority updates, scheduled deployments, and targeted notifications to specific clinics and roles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Compose Form */}
        <div className="lg:col-span-5">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b pb-3 mb-4 flex items-center gap-2">
              <span>📢</span> Compose New Broadcast
            </h3>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Compose Broadcast Message *
              </label>
              <textarea
                required
                rows={4}
                maxLength={300}
                placeholder="Compose a platform announcement, queue notification, or emergency notice..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none leading-relaxed font-medium"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              />
              <div className="text-[10px] text-right text-slate-400 font-bold font-mono">
                {form.message.length}/300 chars
              </div>
            </div>

            {/* Priority Select */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Priority Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['info', 'warning', 'emergency'] as BroadcastPriority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className={`py-2 text-[10px] font-black uppercase tracking-wider border rounded-xl transition-all ${
                      form.priority === p
                        ? p === 'emergency'
                          ? 'bg-red-500 border-red-500 text-white'
                          : p === 'warning'
                          ? 'bg-yellow-500 border-yellow-500 text-white'
                          : 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Select */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Target Audience Scope
                </label>
                <select
                  value={form.targetType}
                  onChange={e => setForm(f => ({ ...f, targetType: e.target.value as BroadcastTarget, targetClinic: '', targetRole: '' }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-650 focus:border-[#005EB8] focus:outline-none"
                >
                  <option value="all">Platform-Wide (All users)</option>
                  <option value="clinic">Targeted Clinic / Hospital</option>
                  <option value="role">Targeted Role Group</option>
                </select>
              </div>

              {/* Conditional Target inputs */}
              {form.targetType === 'clinic' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Select Target Clinic *
                  </label>
                  <select
                    required
                    value={form.targetClinic}
                    onChange={e => setForm(f => ({ ...f, targetClinic: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-650 focus:border-[#005EB8] focus:outline-none"
                  >
                    <option value="">-- Choose a Hospital --</option>
                    {CLINICS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.targetType === 'role' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Select Target Role Group *
                  </label>
                  <select
                    required
                    value={form.targetRole}
                    onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-650 focus:border-[#005EB8] focus:outline-none"
                  >
                    <option value="">-- Choose a Role --</option>
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Delivery scheduling & expirations */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Schedule Delivery
                </label>
                <input
                  type="datetime-local"
                  title="Schedule date and time"
                  className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-xl outline-none bg-white font-semibold text-slate-650"
                  value={form.scheduleFor}
                  onChange={e => setForm(f => ({ ...f, scheduleFor: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Expires After (hours)
                </label>
                <select
                  value={form.expiresAfterHours}
                  onChange={e => setForm(f => ({ ...f, expiresAfterHours: Number(e.target.value) }))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-650 focus:border-[#005EB8] focus:outline-none"
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={24}>24 hours (1 day)</option>
                  <option value={168}>168 hours (7 days)</option>
                  <option value={0}>Never expire</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 bg-[#005EB8] hover:bg-[#004A94] disabled:bg-slate-350 text-white font-extrabold text-[11px] rounded-xl border border-blue-600 shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
            >
              {sending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Dispatching...
                </>
              ) : (
                'Dispatch Broadcast Announcement'
              )}
            </button>
          </form>
        </div>

        {/* Broadcast History */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b pb-3 mb-4">
              📢 Active Announcements & Broadcast History
            </h3>

            {broadcasts.length === 0 ? (
              <div className="text-center py-12 text-gray-400 border border-dashed border-slate-100 rounded-2xl">
                No active announcements or broadcast history logged.
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {broadcasts.map(bc => (
                  <BroadcastCard
                    key={bc.id}
                    broadcast={bc}
                    onDelete={deleteBroadcast}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}
