import { useEffect, useState } from 'react'
import { recommendedStake } from '../../lib/bankroll.js'
import { fmtOdd, fmtPct } from '../ui.jsx'

// „Biletul Meu" — biletul construit manual din selecțiile bifate în tabel
export function TicketBuilder({ selections, onRemove, onClear, onSave, bankroll, kellyDivisor }) {
  const [stake, setStake] = useState(50)

  const cotaTotala = selections.reduce((a, s) => a * s.odds, 1)
  const probTotala = selections.reduce((a, s) => a * s.modelProb, 1)
  const ev = probTotala * cotaTotala - 1
  const sugerat = recommendedStake(probTotala, cotaTotala, bankroll, kellyDivisor)

  // meciuri duplicate pe bilet — bookmakerii refuză combinația
  const matchCounts = {}
  for (const s of selections) {
    const k = s.match.toLowerCase()
    matchCounts[k] = (matchCounts[k] || 0) + 1
  }
  const duplicated = Object.values(matchCounts).some((c) => c > 1)

  useEffect(() => {
    if (selections.length > 0 && sugerat > 0) setStake(sugerat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections.length])

  if (selections.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-500">
        🧾 <span className="font-semibold text-slate-400">Biletul Meu:</span> bifează ☐ selecții în tabelul
        de analiză și construiește-ți propriul bilet — cu cotă, șansă și miză Kelly calculate live.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-700/50 bg-slate-900/80 p-4 shadow-xl shadow-emerald-950/30">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">🧾 Biletul Meu ({selections.length})</h3>
        <button
          onClick={onClear}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
        >
          Golește
        </button>
      </div>
      <ul className="mb-3 space-y-1 text-xs text-slate-300">
        {selections.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-1">
            <span className="min-w-0">
              <span className="block truncate">{s.match}</span>
              <span className="text-slate-500">{s.market}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-slate-200">{fmtOdd(s.odds)}</span>
              <button
                onClick={() => onRemove(s.id)}
                className="rounded px-1 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                title="Scoate de pe bilet"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>

      {duplicated && (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
          ⚠️ Ai două selecții din același meci — bookmakerii de regulă nu le lasă pe același bilet.
        </p>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-950/70 px-2 py-1.5">
          <div className="text-slate-500">Cotă</div>
          <div className="font-mono text-base font-bold text-emerald-400">@{fmtOdd(cotaTotala)}</div>
        </div>
        <div className="rounded-lg bg-slate-950/70 px-2 py-1.5">
          <div className="text-slate-500">Șansă model</div>
          <div className="font-mono text-base font-bold text-slate-200">{fmtPct(probTotala)}</div>
        </div>
        <div className="rounded-lg bg-slate-950/70 px-2 py-1.5">
          <div className="text-slate-500">EV</div>
          <div className={`font-mono text-base font-bold ${ev > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          Miză (RON)
          <input
            type="number"
            min="1"
            value={stake}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 block w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-200 outline-none focus:border-emerald-500"
          />
        </label>
        {sugerat > 0 && (
          <button
            onClick={() => setStake(sugerat)}
            title={`Kelly/${kellyDivisor} din banca de ${bankroll.toFixed(0)} RON, plafonat la 5%`}
            className="rounded-lg border border-violet-700 px-2.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-600/20 active:scale-95"
          >
            📐 Sugerat: {sugerat} RON
          </button>
        )}
        <button
          onClick={() => onSave(stake)}
          className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 active:scale-95"
        >
          💾 Salvează biletul
        </button>
      </div>
      <p className="mt-2 text-right text-xs text-slate-500">
        Câștig potențial: <span className="font-mono text-amber-400">{(stake * cotaTotala).toFixed(2)} RON</span>
      </p>
    </div>
  )
}
