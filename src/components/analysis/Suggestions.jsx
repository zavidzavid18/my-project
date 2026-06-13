import { kellyPct, recommendedStake } from '../../lib/bankroll.js'
import { Card, EmptyState, fmtOdd, fmtPct } from '../ui.jsx'

function ParlayCard({ name, icon, parlay, stake, onConfirm, emptyMsg, bankroll, kellyDivisor }) {
  if (!parlay) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
        <span className="font-semibold text-slate-400">{icon} {name}:</span> {emptyMsg}
      </div>
    )
  }
  const sugerat = recommendedStake(parlay.probTotala, parlay.cotaTotala, bankroll, kellyDivisor)
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-100">{icon} {name}</h3>
        <div className="text-right text-xs">
          <div className="font-mono text-base font-bold text-emerald-400">@{fmtOdd(parlay.cotaTotala)}</div>
          <div className="text-slate-400">șansă model: {fmtPct(parlay.probTotala)}</div>
        </div>
      </div>
      <ul className="mb-3 space-y-1 text-xs text-slate-300">
        {parlay.selections.map((s) => (
          <li key={s.id} className="flex justify-between gap-2 border-b border-slate-800/60 pb-1">
            <span>{s.match} — <span className="text-slate-400">{s.market}</span></span>
            <span className="font-mono text-slate-200">{fmtOdd(s.odds)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          Câștig potențial: <span className="font-mono text-emerald-400">{(stake * parlay.cotaTotala).toFixed(2)} RON</span>
          {sugerat > 0 && (
            <span
              className="ml-2 text-violet-300"
              title={`Kelly/${kellyDivisor} din banca de ${bankroll.toFixed(0)} RON, plafonat la 5%`}
            >
              📐 miză sugerată: {sugerat} RON
            </span>
          )}
        </span>
        <button
          onClick={onConfirm}
          className="rounded-lg bg-emerald-600/90 px-3 py-1.5 font-semibold text-white transition hover:bg-emerald-500 active:scale-95"
        >
          ✓ Confirmă biletul
        </button>
      </div>
    </div>
  )
}

export function Suggestions({ suggestions, stake, setStake, onConfirm, bankroll, kellyDivisor }) {
  const { evCount, sigur, cotaMare, single } = suggestions
  return (
    <Card title="Sugestii Bilete" icon="🎯" accent="border-emerald-900/60">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Selecții <span className="font-bold text-emerald-400">+EV</span> disponibile:{' '}
          <span className="font-mono font-bold text-slate-100">{evCount}</span>
        </span>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Miză (RON)
          <input
            type="number"
            min="1"
            value={stake}
            onChange={(e) => setStake(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-200 outline-none focus:border-emerald-500"
          />
        </label>
      </div>
      <div className="space-y-3">
        <ParlayCard
          name="Biletul Sigur" icon="🛡️" parlay={sigur} stake={stake}
          onConfirm={() => onConfirm('Biletul Sigur', sigur)}
          emptyMsg="sunt necesare minim 2 selecții +EV."
          bankroll={bankroll} kellyDivisor={kellyDivisor}
        />
        <ParlayCard
          name="Biletul Cota Mare" icon="🚀" parlay={cotaMare} stake={stake}
          onConfirm={() => onConfirm('Biletul Cota Mare', cotaMare)}
          emptyMsg="sunt necesare minim 5 selecții +EV (din meciuri diferite)."
          bankroll={bankroll} kellyDivisor={kellyDivisor}
        />
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
          <h3 className="mb-2 font-semibold text-slate-100">🎯 Pariuri Single (top valoare)</h3>
          {single.length === 0 ? (
            <EmptyState>Nicio selecție +EV momentan.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {single.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">
                    {s.match} — <span className="text-slate-400">{s.market}</span>
                    <span className="ml-2 font-mono text-emerald-400">EV +{(s.ev * 100).toFixed(1)}%</span>
                    <span
                      className="ml-2 font-mono text-violet-300"
                      title="Criteriul Kelly: procentul din bancă justificat matematic pentru acest pariu"
                    >
                      Kelly {(kellyPct(s.modelProb, s.odds) * 100).toFixed(1)}%
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-200">{fmtOdd(s.odds)}</span>
                    <button
                      onClick={() => onConfirm('Single', { selections: [s], cotaTotala: s.odds, probTotala: s.modelProb })}
                      className="rounded-lg border border-emerald-700 px-2 py-1 font-semibold text-emerald-400 transition hover:bg-emerald-600 hover:text-white active:scale-95"
                    >
                      + Salvează
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}
