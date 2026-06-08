import { useEffect, useRef, useState } from 'react'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'
import type { SearchResult, SearchResultType } from '../../hooks/useGlobalSearch'

interface Props {
  isOpen: boolean
  onClose: () => void
  onNavigate: (key: string) => void
}

const typeIcon: Record<SearchResultType, string> = {
  patient: '🧑‍⚕️',
  staff:   '👤',
  clinic:  '🏥',
  token:   '🎫',
  alert:   '🔔',
}

const typeBadge: Record<SearchResultType, string> = {
  patient: 'bg-blue-50 text-blue-700',
  staff:   'bg-purple-50 text-purple-700',
  clinic:  'bg-green-50 text-green-700',
  token:   'bg-yellow-50 text-yellow-700',
  alert:   'bg-red-50 text-red-700',
}

export function GlobalSearch({ isOpen, onClose, onNavigate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { query, results, loading, search, clear } = useGlobalSearch()
  const [selected, setSelected] = useState(0)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setSelected(0)
    } else {
      clear()
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Enter' && results[selected]) {
        e.preventDefault()
        onNavigate(results[selected].navigateTo)
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, results, selected, onNavigate, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-50 flex items-start justify-center pt-24 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
          <span className="text-xl">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search patients, staff, clinics..."
            className="flex-1 text-sm outline-none placeholder-gray-400 font-semibold text-slate-800"
            value={query}
            onChange={e => {
              search(e.target.value)
              setSelected(0)
            }}
          />
          {loading && <span className="text-xs text-gray-400 font-medium">Searching...</span>}
          <kbd className="text-xs text-gray-400 bg-gray-150 px-2 py-1 rounded font-mono font-bold">ESC</kbd>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-96 overflow-y-auto py-2">
            {results.map((result, idx) => (
              <div
                key={result.id}
                className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all ${
                  idx === selected ? 'bg-blue-50/70 border-l-4 border-blue-600 pl-3' : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
                onClick={() => { onNavigate(result.navigateTo); onClose() }}
                onMouseEnter={() => setSelected(idx)}
              >
                <span className="text-xl shrink-0">{typeIcon[result.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate">{result.title}</p>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${typeBadge[result.type]}`}>
                      {result.meta}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{result.subtitle}</p>
                </div>
                <span className="text-xs text-gray-400 font-mono font-bold">↵</span>
              </div>
            ))}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div className="py-12 text-center text-gray-400 text-sm font-semibold">
            No results found for "{query}"
          </div>
        ) : query.length === 0 ? (
          <div className="px-5 py-5 text-xs text-gray-400 border-t border-slate-50">
            <p className="mb-3 font-black text-slate-400 uppercase tracking-widest text-[9px]">Quick suggestions</p>
            <div className="flex gap-2 flex-wrap">
              {['Apollo Clinic', 'Staff Directory', 'Open Alerts', 'Analytics'].map(hint => (
                <span
                  key={hint}
                  className="px-3 py-1.5 bg-slate-50 rounded-xl text-slate-600 font-bold border border-slate-200/50 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-all"
                  onClick={() => search(hint)}
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-2.5 flex gap-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  )
}
