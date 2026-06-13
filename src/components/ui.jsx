import { useEffect } from 'react'

// ─── Primitive UI partajate ──────────────────────────────────────────────────

export const fmtPct = (p) => `${(p * 100).toFixed(1)}%`
export const fmtOdd = (o) => o.toFixed(2)
export const fmtRon = (v, signed = false) => `${signed && v >= 0 ? '+' : ''}${v.toFixed(2)} RON`

export const STATUS_STYLES = {
  'În așteptare': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'Câștigat': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Pierdut': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
}

export function Card({ title, icon, children, accent = 'border-slate-800', actions }) {
  return (
    <section className={`rounded-2xl border ${accent} bg-slate-900/70 shadow-xl shadow-black/30 backdrop-blur p-5`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-100">
          <span>{icon}</span> {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function VerdictBadge({ verdict }) {
  return verdict === '+EV' ? (
    <span className="rounded-full border border-emerald-400/60 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300 shadow-[0_0_12px_-2px_rgba(16,185,129,0.7)]">
      +EV
    </span>
  ) : (
    <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400">
      PASS
    </span>
  )
}

export const SPORT_LABELS = {
  fotbal: '⚽ WC 2026',
  tenis: '🎾 Tenis',
  baschet: '🏀 Baschet',
  baseball: '⚾ Baseball',
}

export function SportTag({ sport }) {
  return (
    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
      {SPORT_LABELS[sport] ?? sport}
    </span>
  )
}

// Linkuri rapide de cercetare pentru un meci (părerile oamenilor + video)
export function ResearchLinks({ match, compact = false }) {
  const q = encodeURIComponent(match)
  const links = [
    { label: '🔎 Reddit', href: `https://www.reddit.com/search/?q=${encodeURIComponent(match + ' prediction')}` },
    { label: '▶️ YouTube', href: `https://www.youtube.com/results?search_query=${q}` },
    { label: '🌐 Google', href: `https://www.google.com/search?q=${encodeURIComponent(match + ' statistici meci')}` },
  ]
  return (
    <span className={compact ? 'inline-flex gap-1' : 'inline-flex flex-wrap gap-1.5'}>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={
            compact
              ? 'rounded px-1 text-[10px] text-slate-500 transition hover:bg-slate-800 hover:text-slate-200'
              : 'rounded-lg border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-slate-200'
          }
          title={`Caută „${match}" pe ${l.label.slice(2).trim()}`}
        >
          {compact ? l.label.slice(0, 2) : l.label}
        </a>
      ))}
    </span>
  )
}

export function StatTile({ label, value, accent = 'text-slate-100', sub }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

export function EmptyState({ children }) {
  return <p className="text-sm text-slate-500">{children}</p>
}

// ─── Notificări (toast) ──────────────────────────────────────────────────────

const TOAST_STYLES = {
  success: 'border-emerald-500/40 bg-emerald-950/90',
  error: 'border-rose-500/40 bg-rose-950/90',
  info: 'border-slate-700 bg-slate-900/95',
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss(toast.id), toast.ttl ?? 6000)
    return () => clearTimeout(id)
  }, [toast.id, toast.ttl, onDismiss])

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm text-slate-200 shadow-xl shadow-black/40 backdrop-blur ${TOAST_STYLES[toast.type] ?? TOAST_STYLES.info}`}
    >
      <span className="flex-1">{toast.text}</span>
      {toast.actionLabel && (
        <button
          onClick={() => {
            toast.onAction?.()
            onDismiss(toast.id)
          }}
          className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/10 active:scale-95"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 transition hover:text-slate-200"
        title="Închide"
      >
        ✕
      </button>
    </div>
  )
}

export function ToastHost({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
