import { useMemo, useState } from 'react'
import { COTA_MINIMA } from '../../lib/engine.js'
import { Card, EmptyState, ResearchLinks, SportTag, VerdictBadge, fmtOdd, fmtPct } from '../ui.jsx'

const SORTS = {
  original: { label: 'Original', fn: null },
  ev: { label: 'EV ↓', fn: (a, b) => b.ev - a.ev },
  prob: { label: 'Șansă ↓', fn: (a, b) => b.modelProb - a.modelProb },
  cota: { label: 'Cotă ↓', fn: (a, b) => b.odds - a.odds },
}

const FILTERS = [
  { id: 'toate', label: 'Toate' },
  { id: 'ev', label: '+EV' },
  { id: 'pass', label: 'PASS' },
]

const MAX_ROWS = 300

// Tabelul de analiză: sortare, filtrare, căutare, coloană EV și bife pentru
// construirea propriului bilet. Părintele dă un `key` nou la fiecare procesare
// ca starea internă (filtre, căutare) să pornească de la zero.
export function AnalysisTable({ analyzed, picked, onTogglePick }) {
  const isHuge = analyzed.length > 50
  const [filter, setFilter] = useState(isHuge ? 'ev' : 'toate')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('original')
  const [expanded, setExpanded] = useState(null)

  const evSelections = useMemo(() => analyzed.filter((s) => s.verdict === '+EV'), [analyzed])
  const avgEdge = evSelections.length
    ? evSelections.reduce((a, s) => a + s.edge, 0) / evSelections.length
    : 0

  const visible = useMemo(() => {
    let list = analyzed
    if (filter === 'ev') list = evSelections
    if (filter === 'pass') list = analyzed.filter((s) => s.verdict === 'PASS')
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((s) => `${s.match} ${s.market}`.toLowerCase().includes(q))
    const sortFn = SORTS[sortBy].fn
    if (sortFn) list = [...list].sort(sortFn)
    return list.slice(0, MAX_ROWS)
  }, [analyzed, evSelections, filter, search, sortBy])

  return (
    <Card title="Motorul de Analiză" icon="🧠">
      {analyzed.length === 0 ? (
        <EmptyState>Nicio selecție procesată. Lipește textul și apasă „Procesează".</EmptyState>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
            <span>
              <span className="font-mono font-bold text-slate-100">{analyzed.length}</span> selecții ·{' '}
              <span className="font-mono font-bold text-emerald-400">{evSelections.length}</span> +EV
              {evSelections.length > 0 && (
                <span className="ml-1 text-slate-500">(avantaj mediu +{(avgEdge * 100).toFixed(1)}%)</span>
              )}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">Bifează ☐ ca să-ți construiești propriul bilet →</span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  filter === f.id ? 'bg-emerald-600 text-white' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
            <span className="mx-1 text-slate-600">·</span>
            {Object.entries(SORTS).map(([id, s]) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  sortBy === id ? 'bg-slate-700 text-white' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 caută echipă / piață"
              className="ml-auto w-44 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none transition focus:border-emerald-500"
            />
          </div>

          {visible.length === MAX_ROWS && (
            <p className="mb-2 text-xs text-slate-500">(afișate primele {MAX_ROWS} — folosește căutarea sau filtrele)</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-2"></th>
                  <th className="pb-2 pr-3">Meci / Piață</th>
                  <th className="pb-2 pr-3">Cotă</th>
                  <th className="pb-2 pr-3">Prob. Model</th>
                  <th className="pb-2 pr-3">EV</th>
                  <th className="pb-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <SelectionRow
                    key={s.id}
                    s={s}
                    isPicked={picked.includes(s.id)}
                    onTogglePick={() => onTogglePick(s.id)}
                    expanded={expanded === s.id}
                    onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && <EmptyState>Nimic nu se potrivește cu filtrul/căutarea curentă.</EmptyState>}
        </>
      )}
    </Card>
  )
}

function SelectionRow({ s, isPicked, onTogglePick, expanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-800/40 ${isPicked ? 'bg-emerald-500/5' : ''}`}
      >
        <td className="py-2.5 pr-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePick()
            }}
            title={isPicked ? 'Scoate de pe biletul meu' : 'Adaugă pe biletul meu'}
            className={`h-5 w-5 rounded-md text-[11px] font-bold leading-none transition active:scale-90 ${
              isPicked
                ? 'bg-emerald-500 text-white shadow shadow-emerald-900/50'
                : 'border border-slate-700 text-transparent hover:border-emerald-500 hover:text-emerald-500'
            }`}
          >
            ✓
          </button>
        </td>
        <td className="py-2.5 pr-3">
          <div className="font-medium text-slate-200">{s.match}</div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {s.market} <SportTag sport={s.sport} />
          </div>
        </td>
        <td className={`py-2.5 pr-3 font-mono font-semibold ${s.odds >= COTA_MINIMA ? 'text-slate-200' : 'text-rose-400'}`}>
          {fmtOdd(s.odds)}
        </td>
        <td className="py-2.5 pr-3">
          <span className={`font-mono ${s.modelProb >= 0.45 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {fmtPct(s.modelProb)}
          </span>
          <span className="ml-1 text-xs text-slate-500">(impl. {fmtPct(s.implied)})</span>
        </td>
        <td className={`py-2.5 pr-3 font-mono text-xs font-semibold ${s.ev > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
          {s.ev >= 0 ? '+' : ''}{(s.ev * 100).toFixed(1)}%
        </td>
        <td className="py-2.5"><VerdictBadge verdict={s.verdict} /></td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-800/60 bg-slate-950/60">
          <td colSpan={6} className="px-3 py-2">
            <div className="pl-5 text-xs text-slate-500">Motor: <span className="text-slate-300">{s.engine}</span></div>
            <ul className="list-disc space-y-0.5 pl-10 text-xs text-slate-400">
              {s.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="mt-2 pl-5">
              <span className="mr-2 text-[11px] text-slate-500">Cercetează:</span>
              <ResearchLinks match={s.match} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
