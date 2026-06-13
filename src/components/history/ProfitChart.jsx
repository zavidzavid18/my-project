import { useState } from 'react'
import { profitSeries } from '../../lib/stats.js'

const W = 600
const H = 90

// Graficul profitului cumulat, cu umplere gradient și inspecție la hover
export function ProfitChart({ bets }) {
  const [hover, setHover] = useState(null)
  const pts = profitSeries(bets)
  if (pts.length < 3) return null

  const min = Math.min(...pts, 0)
  const max = Math.max(...pts, 0)
  const range = max - min || 1
  const x = (i) => (i / (pts.length - 1)) * W
  const y = (p) => H - ((p - min) / range) * H
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const area = `${path} L${W},${H} L0,${H} Z`
  const last = pts[pts.length - 1]
  const lineColor = last >= 0 ? '#34d399' : '#fb7185'

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (pts.length - 1))
    setHover(Math.min(pts.length - 1, Math.max(0, i)))
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">Evoluție bankroll</span>
        <span className="font-mono text-xs text-slate-400">
          {hover != null ? (
            <>
              după biletul {hover}:{' '}
              <span className={pts[hover] >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {pts[hover] >= 0 ? '+' : ''}{pts[hover].toFixed(2)} RON
              </span>
            </>
          ) : (
            <>
              <span className="text-slate-600">max +{max.toFixed(0)} · min {min.toFixed(0)} · </span>
              <span className={last >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                acum {last >= 0 ? '+' : ''}{last.toFixed(2)} RON
              </span>
            </>
          )}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-24 w-full cursor-crosshair touch-none"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bankrollFill)" />
        <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" />
        {hover != null && (
          <line x1={x(hover)} y1="0" x2={x(hover)} y2={H} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
        )}
      </svg>
    </div>
  )
}
