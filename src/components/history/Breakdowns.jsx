import { betKind, betSport, breakdown, oddsBand } from '../../lib/stats.js'
import { Card, EmptyState, SPORT_LABELS } from '../ui.jsx'

function BreakdownList({ title, rows }) {
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.profit)), 1)
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">{title}</div>
      {rows.length === 0 ? (
        <EmptyState>Niciun bilet decis.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="text-xs">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-300">{r.key}</span>
                <span className="text-slate-500">
                  {r.won}W-{r.lost}L
                  <span className={`ml-2 font-mono font-bold ${r.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${r.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.max(4, (Math.abs(r.profit) / maxAbs) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Unde se câștigă și unde se pierde: profit defalcat pe sport / tip / cotă
export function Breakdowns({ bets }) {
  const sport = breakdown(bets, (b) => SPORT_LABELS[betSport(b)] ?? betSport(b))
  const kind = breakdown(bets, betKind)
  const band = breakdown(bets, (b) => oddsBand(b.cotaTotala)).sort((a, b) => a.key.localeCompare(b.key))
  return (
    <Card title="Defalcare Profit" icon="🧭">
      <div className="grid gap-3 md:grid-cols-3">
        <BreakdownList title="Pe sport" rows={sport} />
        <BreakdownList title="Pe tip de bilet" rows={kind} />
        <BreakdownList title="Pe interval de cotă" rows={band} />
      </div>
    </Card>
  )
}
