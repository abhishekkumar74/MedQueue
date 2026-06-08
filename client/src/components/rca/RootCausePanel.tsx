import { useState } from 'react'
import { useRootCause } from '../../hooks/useRootCause'
import type { Alert } from '../../types/alerts'

interface Props {
  alert: Alert
  onExecuteAction: (alertId: string, actionKey: string) => void
  onNavigate: (key: string) => void
}

const confidenceColor = (c: number) =>
  c >= 80 ? 'text-green-600 font-extrabold' : c >= 50 ? 'text-yellow-600 font-extrabold' : 'text-gray-400 font-extrabold'

const severityStyle = {
  critical: 'bg-red-50 border-red-200 text-red-700 font-semibold',
  warning:  'bg-yellow-50 border-yellow-200 text-yellow-700 font-semibold',
  info:     'bg-blue-50 border-blue-200 text-blue-700 font-semibold',
}

export function RootCausePanel({ alert, onExecuteAction, onNavigate }: Props) {
  const { results, analyzing, analyze, markStepComplete } = useRootCause()
  const [expanded, setExpanded] = useState(false)

  const result = results[alert.id]
  const isAnalyzing = analyzing === alert.id

  const handleAnalyze = async () => {
    setExpanded(true)
    await analyze(alert)
  }

  return (
    <div className="mt-3 border-t border-gray-200/60 pt-3">

      {/* Trigger button */}
      {!expanded && !result && (
        <button
          onClick={handleAnalyze}
          className="flex items-center gap-2 text-xs font-black text-purple-600 hover:text-purple-800 transition-colors uppercase tracking-wider"
        >
          <span>🔬</span>
          Diagnose Root Cause
        </button>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2 font-bold">
          <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          Analyzing system state and log telemetry...
        </div>
      )}

      {/* Result */}
      {result && expanded && (
        <div className="bg-purple-50/50 border border-purple-100/80 rounded-2xl p-4 mt-2">

          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">🔬</span>
                <h4 className="text-[10px] font-black text-purple-800 uppercase tracking-widest">
                  Root Cause Analysis
                </h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-purple-100 ${confidenceColor(result.confidence)}`}>
                  {result.confidence}% confidence
                </span>
              </div>
              <p className="text-xs font-extrabold text-slate-800 mt-1">{result.rootCause}</p>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none transition-colors"
            >
              ×
            </button>
          </div>

          {/* Summary */}
          <p className="text-xs text-slate-600 mb-3 leading-relaxed bg-white/85 p-3 rounded-xl border border-purple-100/40 font-medium">
            {result.summary}
          </p>

          {/* Evidence */}
          {result.evidence.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Evidence telemetry</p>
              <div className="space-y-1.5">
                {result.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center px-3 py-2 rounded-xl border text-xs ${severityStyle[ev.severity]}`}
                  >
                    <span>{ev.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{ev.value}</span>
                      {ev.navigateTo && (
                        <button
                          onClick={() => onNavigate(ev.navigateTo!)}
                          className="underline opacity-80 hover:opacity-100 transition-opacity font-extrabold"
                        >
                          View →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fix steps */}
          {result.fixSteps.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Fix Steps Checklist ({result.fixSteps.filter(s => s.isComplete).length}/{result.fixSteps.length} done)
                <span className="text-slate-400 font-bold ml-2 font-mono">~{result.estimatedFixMins} mins</span>
              </p>
              <div className="space-y-2">
                {result.fixSteps.map(step => (
                  <div
                    key={step.order}
                    className={`flex gap-3 p-3 rounded-xl text-xs transition-all ${
                      step.isComplete
                        ? 'bg-green-50/50 border border-green-200/60 opacity-60'
                        : 'bg-white border border-slate-200/60 shadow-sm'
                    }`}
                  >
                    {/* Step number / check */}
                    <button
                      onClick={() => markStepComplete(alert.id, step.order)}
                      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${
                        step.isComplete
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-slate-300 text-slate-400 hover:border-green-450 hover:text-green-550'
                      }`}
                    >
                      {step.isComplete ? '✓' : step.order}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`font-bold ${step.isComplete ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {step.action}
                      </p>
                      <p className="text-slate-500 mt-1.5 leading-relaxed font-medium">{step.detail}</p>
                      {step.actionKey && !step.isComplete && (
                        <button
                          onClick={() => {
                            onExecuteAction(alert.id, step.actionKey!)
                            markStepComplete(alert.id, step.order)
                          }}
                          className="mt-2.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black transition-colors uppercase tracking-wider"
                        >
                          Execute Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prevention tip */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-[10px] font-black text-blue-700 mb-1 uppercase tracking-wider">💡 Prevention Tip</p>
            <p className="text-xs text-blue-600 leading-relaxed font-medium">{result.preventionTip}</p>
          </div>
        </div>
      )}
    </div>
  )
}
