import { useEffect, useState } from 'react'
import { Card, EmptyState } from '../ui.jsx'
import { BetCard } from './BetCard.jsx'

const SORTS = {
  recente: { label: 'Recente', fn: (a, b) => (b.ts ?? 0) - (a.ts ?? 0) },
  miza: { label: 'Miză ↓', fn: (a, b) => b.miza - a.miza },
  cota: { label: 'Cotă ↓', fn: (a, b) => b.cotaTotala - a.cotaTotala },
  castig: { label: 'Câștig potențial ↓', fn: (a, b) => b.miza * b.cotaTotala - a.miza * a.cotaTotala },
}

// Cronometru până la următoarea verificare automată (tick de 1s cât e montat)
function NextCheckTimer({ lastVerifyAt, intervalMs }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  if (!lastVerifyAt) return null
  const left = Math.max(0, lastVerifyAt + intervalMs - Date.now())
  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  return (
    <span className="font-mono text-xs text-slate-500" title="Rezultatele se verifică automat cât timp tabul e deschis">
      ⏱ re-verificare în {mm}:{ss}
    </span>
  )
}

export function ActiveBets({
  bets, onStatusChange, onDelete, onReset, onLegMark, onValidate,
  onVerifyOnline, verifying, verifyMsg, lastVerifyAt, autoVerifyMs,
}) {
  const [resultsText, setResultsText] = useState('')
  const [sortBy, setSortBy] = useState('recente')
  const pendingCount = bets.filter((b) => b.status === 'În așteptare').length
  const sorted = [...bets].sort(SORTS[sortBy].fn)

  const totalStake = bets.reduce((a, b) => a + b.miza, 0)
  const totalPayout = bets.reduce((a, b) => a + b.miza * b.cotaTotala, 0)
  const liveCount = bets.reduce(
    (a, b) => a + b.selections.filter((s) => !s.score && s.liveScore).length,
    0,
  )

  return (
    <Card title="Bilete Active" icon="📒">
      {bets.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">În joc</div>
            <div className="font-mono text-base font-bold text-slate-100">{totalStake.toFixed(0)} RON</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Plată potențială</div>
            <div className="font-mono text-base font-bold text-amber-400">{totalPayout.toFixed(0)} RON</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Meciuri LIVE</div>
            <div className={`font-mono text-base font-bold ${liveCount ? 'animate-pulse text-rose-400' : 'text-slate-500'}`}>
              {liveCount ? `🔴 ${liveCount}` : '—'}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={onVerifyOnline}
          disabled={verifying || pendingCount === 0}
          className="rounded-lg bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:from-sky-500 hover:to-sky-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {verifying ? '⏳ Caut rezultatele online...' : '🔍 Verifică rezultatele online'}
        </button>
        <span className="text-xs text-slate-400">
          {verifyMsg || `${pendingCount} bilete în așteptare — caută automat scorurile finale pe TheSportsDB.`}
        </span>
        {pendingCount > 0 && !verifying && (
          <NextCheckTimer lastVerifyAt={lastVerifyAt} intervalMs={autoVerifyMs} />
        )}
      </div>

      {bets.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-slate-500">Sortează:</span>
          {Object.entries(SORTS).map(([id, s]) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                sortBy === id ? 'bg-emerald-600 text-white' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <details className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-300">
          ✍️ Validare manuală (dacă un meci nu e găsit online)
        </summary>
        <p className="mb-2 mt-2 text-xs text-slate-400">
          Lipește rezultatele finale (ex: <code className="rounded bg-slate-800 px-1">Coreea de Sud - Cehia 2-1</code>, câte unul pe linie).
        </p>
        <div className="flex gap-2">
          <textarea
            value={resultsText}
            onChange={(e) => setResultsText(e.target.value)}
            rows={2}
            spellCheck={false}
            placeholder="Echipa1 - Echipa2 2-1"
            className="flex-1 resize-y rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-slate-200 outline-none focus:border-emerald-500"
          />
          <button
            onClick={() => { onValidate(resultsText); setResultsText('') }}
            className="self-end rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 active:scale-95"
          >
            🔄 Validează
          </button>
        </div>
      </details>

      {bets.length === 0 ? (
        <EmptyState>Niciun bilet activ. Confirmă o sugestie, construiește „Biletul Meu" sau importă un bilet din tabul Analiză.</EmptyState>
      ) : (
        <div className="space-y-3">
          {sorted.map((b) => (
            <BetCard key={b.id} bet={b} onStatusChange={onStatusChange} onDelete={onDelete} onReset={onReset} onLegMark={onLegMark} />
          ))}
        </div>
      )}
    </Card>
  )
}
