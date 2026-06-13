import { selectionOutcome } from '../../lib/engine.js'
import { betProfit } from '../../lib/stats.js'
import { ResearchLinks, STATUS_STYLES, fmtOdd } from '../ui.jsx'

export function BetCard({ bet, onStatusChange, onDelete, onReset, onLegMark }) {
  const outcomes = bet.selections.map(selectionOutcome)
  const wonLegs = outcomes.filter((o) => o === 'Câștigat').length
  const lostLegs = outcomes.filter((o) => o === 'Pierdut').length
  const decided = wonLegs + lostLegs
  const hasAutoData = bet.selections.some((s) => s.score || s.liveScore) || bet.status !== 'În așteptare'
  const profit = betProfit(bet)
  const payout = bet.miza * bet.cotaTotala
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[bet.status]}`}>
            {bet.status === 'Câștigat' ? '✓ Câștigat' : bet.status === 'Pierdut' ? '✗ Pierdut' : '⏳ În așteptare'}
          </span>
          <span className="text-sm font-semibold text-slate-200">{bet.tip}</span>
          <span className="text-xs text-slate-500">{bet.data}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={bet.status}
            onChange={(e) => onStatusChange(bet.id, e.target.value)}
            className={`rounded-lg border bg-slate-950 px-2 py-1 text-xs font-semibold outline-none ${STATUS_STYLES[bet.status]}`}
          >
            <option>În așteptare</option>
            <option>Câștigat</option>
            <option>Pierdut</option>
          </select>
          {onReset && hasAutoData && (
            <button
              onClick={() => onReset(bet.id)}
              className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:bg-amber-500/10 hover:text-amber-400"
              title="Date eronate? Șterge scorurile găsite automat și readu biletul În așteptare"
            >
              ↺ Resetează
            </button>
          )}
          <button
            onClick={() => onDelete(bet.id)}
            aria-label={`Șterge biletul ${bet.tip}`}
            className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
            title="Șterge biletul (cu Anulează în notificare)"
          >
            ✕
          </button>
        </div>
      </div>

      {bet.status === 'În așteptare' && bet.selections.length > 1 && (
        <div className="mb-2.5 flex h-1.5 overflow-hidden rounded-full bg-slate-800" title={`Decise ${decided}/${bet.selections.length}`}>
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(wonLegs / bet.selections.length) * 100}%` }} />
          <div className="h-full bg-rose-500 transition-all" style={{ width: `${(lostLegs / bet.selections.length) * 100}%` }} />
        </div>
      )}

      <ul className="mb-3 space-y-1.5 border-l-2 border-slate-800 pl-3 text-xs text-slate-300">
        {bet.selections.map((s) => {
          const outcome = selectionOutcome(s)
          return (
            <li key={s.id} className="flex items-start gap-2">
              {onLegMark ? (
                <span className="flex shrink-0 gap-1">
                  <button
                    onClick={() => onLegMark(bet.id, s.id, s.manual === 'Câștigat' ? null : 'Câștigat')}
                    aria-label={`Marchează „${s.match}" drept câștigată`}
                    aria-pressed={outcome === 'Câștigat'}
                    title="Bifează: selecția a ieșit"
                    className={`h-5 w-5 rounded-md text-[11px] font-bold leading-none transition active:scale-90 ${
                      outcome === 'Câștigat'
                        ? 'bg-emerald-500 text-white shadow shadow-emerald-900/50'
                        : 'border border-slate-700 text-slate-500 hover:border-emerald-500 hover:text-emerald-400'
                    }`}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => onLegMark(bet.id, s.id, s.manual === 'Pierdut' ? null : 'Pierdut')}
                    aria-label={`Marchează „${s.match}" drept pierdută`}
                    aria-pressed={outcome === 'Pierdut'}
                    title="Bifează: selecția a picat"
                    className={`h-5 w-5 rounded-md text-[11px] font-bold leading-none transition active:scale-90 ${
                      outcome === 'Pierdut'
                        ? 'bg-rose-500 text-white shadow shadow-rose-900/50'
                        : 'border border-slate-700 text-slate-500 hover:border-rose-500 hover:text-rose-400'
                    }`}
                  >
                    ✗
                  </button>
                </span>
              ) : (
                <span className="w-4 shrink-0">
                  {outcome === 'Câștigat' ? '✅' : outcome === 'Pierdut' ? '❌' : '·'}
                </span>
              )}
              <span>
                {s.match} — <span className="text-slate-500">{s.market}</span>
                {s.score && <span className="ml-1 font-mono text-slate-400">({s.score[0]}-{s.score[1]})</span>}
                {!s.score && s.liveScore && (
                  <span className="ml-1 animate-pulse font-mono text-xs font-bold text-rose-400">
                    🔴 LIVE {s.liveScore[0]}-{s.liveScore[1]}
                  </span>
                )}
                <span className="ml-1.5"><ResearchLinks match={s.match} compact /></span>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>Cotă <span className="font-mono font-semibold text-slate-200">@{fmtOdd(bet.cotaTotala)}</span></span>
        <span>Miză <span className="font-mono text-slate-200">{bet.miza} RON</span></span>
        {bet.status === 'În așteptare' ? (
          <>
            <span>Decise <span className="font-mono text-slate-200">{decided}/{bet.selections.length}</span></span>
            <span>Plată potențială <span className="font-mono text-amber-400">{payout.toFixed(2)} RON</span></span>
          </>
        ) : (
          <span>
            Rezultat{' '}
            <span className={`font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {profit >= 0 ? '+' : ''}{profit.toFixed(2)} RON
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
