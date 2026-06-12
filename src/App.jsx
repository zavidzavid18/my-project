import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COTA_MINIMA,
  analyzeSelection,
  applyResultsToBet,
  buildSuggestions,
  detectTicketMeta,
  fetchScoreOnline,
  fetchUpcomingMatches,
  parseRawText,
  parseResults,
  settleSelection,
  splitMatch,
} from './engine.js'

const APP_VERSION = 'v4.2'
const SETTINGS_KEY = 'betting-analyzer-settings'

const loadSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}
  } catch {
    return {}
  }
}

const fmtPct = (p) => `${(p * 100).toFixed(1)}%`
const fmtOdd = (o) => o.toFixed(2)

const STATUS_STYLES = {
  'În așteptare': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'Câștigat': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  'Pierdut': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
}

function Card({ title, icon, children, accent = 'border-slate-800' }) {
  return (
    <section className={`rounded-2xl border ${accent} bg-slate-900/70 shadow-xl shadow-black/30 backdrop-blur p-5`}>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-100">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </section>
  )
}

function VerdictBadge({ verdict }) {
  return verdict === '+EV' ? (
    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
      +EV
    </span>
  ) : (
    <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-400">
      PASS
    </span>
  )
}

const SPORT_LABELS = {
  fotbal: '⚽ WC 2026',
  tenis: '🎾 Tenis',
  baschet: '🏀 Baschet',
  baseball: '⚾ Baseball',
}

function SportTag({ sport }) {
  return (
    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
      {SPORT_LABELS[sport] ?? sport}
    </span>
  )
}

// ─── Zona de Import ──────────────────────────────────────────────────────────

function ImportZone({ rawText, setRawText, onProcess, onLoadReal, loadingReal, importMsg }) {
  return (
    <Card title="Zona de Import" icon="📥">
      <p className="mb-2 text-xs text-slate-400">
        Acceptă: <code className="rounded bg-slate-800 px-1 text-slate-300">Echipa1 vs Echipa2 | Piață | Cotă | sport</code>,
        {' '}bilete copiate din <span className="font-semibold text-slate-300">Betano</span> sau liste din{' '}
        <span className="font-semibold text-slate-300">Superbet</span> (lipește direct, exact cum apar).
        Sporturi: fotbal, tenis, baschet, baseball.
      </p>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={9}
        spellCheck={false}
        className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        placeholder="Lipește aici meciurile și cotele tale..."
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={onProcess}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98]"
        >
          ⚡ Procesează
        </button>
        <button
          onClick={onLoadReal}
          disabled={loadingReal}
          title="Încarcă următoarele meciuri oficiale din WC 2026 (cotele sunt orientative — pune-le pe cele de la Betano)"
          className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:from-sky-500 hover:to-sky-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loadingReal ? '⏳ Încarc...' : '📡 Meciuri reale'}
        </button>
      </div>
      {importMsg && <p className="mt-2 text-xs text-slate-400">{importMsg}</p>}
    </Card>
  )
}

// ─── Bilet finalizat detectat în paste ───────────────────────────────────────

function TicketBanner({ meta, analyzed, onImport }) {
  const [miza, setMiza] = useState(meta?.stake ?? 50)
  const [status, setStatus] = useState(meta?.status ?? 'În așteptare')
  useEffect(() => {
    setMiza(meta?.stake ?? 50)
    setStatus(meta?.status ?? 'În așteptare')
  }, [meta])

  if (analyzed.length === 0) return null
  // lista mare de cote din ofertă nu e un bilet — bannerul apare doar la
  // bilete reale (meta detectat) sau la selecții puține
  if (!meta && analyzed.length > 20) return null

  const cotaTotala = meta?.totalOdds ?? analyzed.reduce((a, s) => a * s.odds, 1)
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-3 text-sm text-slate-300">
        🎫 <span className="font-semibold">Bilet pregătit:</span> {analyzed.length} selecții
        {' '}· cotă totală <span className="font-mono font-bold text-slate-100">@{cotaTotala.toFixed(2)}</span>
        {' '}· câștig potențial{' '}
        <span className="font-mono font-bold text-amber-400">{(miza * cotaTotala).toFixed(2)} RON</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Miză (RON)
          <input
            type="number"
            min="1"
            value={miza}
            onChange={(e) => setMiza(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 block w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-200 outline-none focus:border-amber-500"
          />
        </label>
        <label className="text-xs text-slate-400">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`mt-1 block rounded-lg border bg-slate-950 px-2 py-1.5 text-sm font-semibold outline-none ${STATUS_STYLES[status]}`}
          >
            <option>În așteptare</option>
            <option>Câștigat</option>
            <option>Pierdut</option>
          </select>
        </label>
        <button
          onClick={() => onImport(miza, status, cotaTotala)}
          className="rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 active:scale-95"
        >
          💾 Salvează biletul
        </button>
      </div>
    </div>
  )
}

// ─── Motorul de Analiză ──────────────────────────────────────────────────────

function AnalysisEngine({ analyzed }) {
  const [expanded, setExpanded] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const evCount = analyzed.filter((s) => s.verdict === '+EV').length
  const isHuge = analyzed.length > 50
  const visible = (isHuge && !showAll ? analyzed.filter((s) => s.verdict === '+EV') : analyzed).slice(0, 300)
  return (
    <Card title="Motorul de Analiză" icon="🧠">
      {isHuge && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>
            <span className="font-mono font-bold text-slate-100">{analyzed.length}</span> selecții procesate ·{' '}
            <span className="font-mono font-bold text-emerald-400">{evCount}</span> +EV
          </span>
          <button
            onClick={() => setShowAll(!showAll)}
            className="rounded-lg border border-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            {showAll ? '✅ Arată doar +EV' : `📋 Arată toate (${analyzed.length})`}
          </button>
          {visible.length === 300 && <span className="text-slate-500">(afișate primele 300)</span>}
        </div>
      )}
      {analyzed.length === 0 ? (
        <p className="text-sm text-slate-500">Nicio selecție procesată. Lipește textul și apasă „Procesează".</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">Meci / Piață</th>
                <th className="pb-2 pr-3">Cotă</th>
                <th className="pb-2 pr-3">Prob. Model</th>
                <th className="pb-2 pr-3">Motor</th>
                <th className="pb-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <SelectionRow
                  key={s.id}
                  s={s}
                  expanded={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function SelectionRow({ s, expanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-800/40"
      >
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
        <td className="py-2.5 pr-3 text-xs text-slate-400">{s.engine}</td>
        <td className="py-2.5"><VerdictBadge verdict={s.verdict} /></td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-800/60 bg-slate-950/60">
          <td colSpan={5} className="px-3 py-2">
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-400">
              {s.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Sugestii Bilete ─────────────────────────────────────────────────────────

function ParlayCard({ name, icon, parlay, stake, onConfirm, emptyMsg }) {
  if (!parlay) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
        <span className="font-semibold text-slate-400">{icon} {name}:</span> {emptyMsg}
      </div>
    )
  }
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
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Câștig potențial: <span className="font-mono text-emerald-400">{(stake * parlay.cotaTotala).toFixed(2)} RON</span></span>
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

function Suggestions({ suggestions, stake, setStake, onConfirm }) {
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
        />
        <ParlayCard
          name="Biletul Cota Mare" icon="🚀" parlay={cotaMare} stake={stake}
          onConfirm={() => onConfirm('Biletul Cota Mare', cotaMare)}
          emptyMsg="sunt necesare minim 5 selecții +EV."
        />
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
          <h3 className="mb-2 font-semibold text-slate-100">🎯 Pariuri Single (top valoare)</h3>
          {single.length === 0 ? (
            <p className="text-sm text-slate-500">Nicio selecție +EV momentan.</p>
          ) : (
            <ul className="space-y-2">
              {single.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300">
                    {s.match} — <span className="text-slate-400">{s.market}</span>
                    <span className="ml-2 font-mono text-emerald-400">EV +{(s.ev * 100).toFixed(1)}%</span>
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

// ─── Setări (chei API, salvate doar în browser) ──────────────────────────────

function SettingsPanel({ settings, onSave }) {
  const [apiFootballKey, setApiFootballKey] = useState(settings.apiFootballKey ?? '')
  const [saved, setSaved] = useState(false)
  return (
    <Card title="Setări API" icon="⚙️">
      <p className="mb-3 text-xs text-slate-500">Cheile rămân doar în browserul tău — nu sunt trimise nicăieri altundeva.</p>
      <label className="block max-w-md text-xs text-slate-400">
        Cheie API-Football (rezultate fotbal extinse) — gratuit de la dashboard.api-football.com
        <input
          type="password"
          value={apiFootballKey}
          onChange={(e) => setApiFootballKey(e.target.value)}
          placeholder="opțional"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-emerald-500"
        />
      </label>
      <button
        onClick={() => { onSave({ apiFootballKey: apiFootballKey.trim() }); setSaved(true); setTimeout(() => setSaved(false), 2000) }}
        className="mt-3 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-600 active:scale-95"
      >
        {saved ? '✓ Salvat' : '💾 Salvează setările'}
      </button>
    </Card>
  )
}

// ─── Statistici (stil Pikkit) ────────────────────────────────────────────────

const betProfit = (b) =>
  b.status === 'Câștigat' ? b.miza * (b.cotaTotala - 1) : b.status === 'Pierdut' ? -b.miza : 0

function StatTile({ label, value, accent = 'text-slate-100' }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-bold ${accent}`}>{value}</div>
    </div>
  )
}

function ProfitChart({ bets }) {
  const settled = [...bets].reverse().filter((b) => b.status !== 'În așteptare')
  if (settled.length < 2) return null
  let acc = 0
  const pts = [0, ...settled.map((b) => (acc += betProfit(b)))]
  const min = Math.min(...pts, 0)
  const max = Math.max(...pts, 0)
  const range = max - min || 1
  const W = 600
  const H = 80
  const x = (i) => (i / (pts.length - 1)) * W
  const y = (p) => H - ((p - min) / range) * H
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Evoluție bankroll</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none">
        <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
        <path d={path} fill="none" stroke={last >= 0 ? '#34d399' : '#fb7185'} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function StatsBar({ bets }) {
  const settled = bets.filter((b) => b.status !== 'În așteptare')
  const won = bets.filter((b) => b.status === 'Câștigat')
  const lost = bets.filter((b) => b.status === 'Pierdut')
  const pending = bets.length - settled.length
  const staked = settled.reduce((a, b) => a + b.miza, 0)
  const profit = bets.reduce((a, b) => a + betProfit(b), 0)
  const roi = staked ? (profit / staked) * 100 : 0
  const winRate = settled.length ? (won.length / settled.length) * 100 : 0
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile
          label="Profit net"
          value={`${profit >= 0 ? '+' : ''}${profit.toFixed(2)} RON`}
          accent={profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <StatTile
          label="ROI"
          value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`}
          accent={roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <StatTile label="Rată câștig" value={`${winRate.toFixed(0)}%`} />
        <StatTile label="Record" value={`${won.length}W - ${lost.length}L - ${pending}P`} />
        <StatTile label="Miză decisă" value={`${staked.toFixed(0)} RON`} />
      </div>
      <ProfitChart bets={bets} />
    </div>
  )
}

// ─── Calendar lunar (stil Pikkit) ────────────────────────────────────────────

const MONTH_NAMES = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']

const parseBetDate = (b) => {
  if (b.ts) return new Date(b.ts)
  const m = (b.data ?? '').match(/(\d{2})\.(\d{2})\.(\d{4})/)
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null
}

function CalendarView({ bets }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const days = {}
  for (const b of bets) {
    const d = parseBetDate(b)
    if (!d || d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth()) continue
    const day = d.getDate()
    days[day] ??= { profit: 0, pending: 0, settled: 0 }
    if (b.status === 'În așteptare') days[day].pending += 1
    else {
      days[day].settled += 1
      days[day].profit += betProfit(b)
    }
  }
  const monthProfit = Object.values(days).reduce((a, d) => a + d.profit, 0)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDow = new Date(month.getFullYear(), month.getMonth(), 1).getDay() // 0 = duminică
  const shift = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  const tile = (day) => {
    const d = days[day]
    if (!d) return { cls: 'bg-slate-900/60 text-slate-600', label: '' }
    if (d.settled === 0) return { cls: 'bg-sky-500/15 text-sky-300 border border-sky-500/20', label: `${d.pending} act.` }
    const p = d.profit
    return p >= 0
      ? { cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20', label: `+${p.toFixed(0)}` }
      : { cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/20', label: p.toFixed(0) }
  }

  return (
    <Card title="Calendar Profit" icon="📅">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="rounded-lg px-3 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200">‹</button>
        <div className="text-center">
          <span className="text-lg font-bold text-slate-100">{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</span>
          <span className={`ml-2 font-mono text-sm font-bold ${monthProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {monthProfit >= 0 ? '+' : ''}{monthProfit.toFixed(1)} RON
          </span>
        </div>
        <button onClick={() => shift(1)} className="rounded-lg px-3 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} className="pb-1 text-[10px] uppercase tracking-wider text-slate-500">{d}</div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const t = tile(day)
          return (
            <div key={day} className={`rounded-lg px-1 py-1.5 ${t.cls}`}>
              <div className="text-[10px] opacity-60">{day}</div>
              <div className="font-mono text-[11px] font-bold leading-tight">{t.label}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Istoric Pariuri ─────────────────────────────────────────────────────────

function BetCard({ bet, onStatusChange, onDelete }) {
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
          <button
            onClick={() => onDelete(bet.id)}
            className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
            title="Șterge biletul"
          >
            ✕
          </button>
        </div>
      </div>
      <ul className="mb-3 space-y-1 border-l-2 border-slate-800 pl-3 text-xs text-slate-300">
        {bet.selections.map((s) => {
          const outcome = settleSelection(s)
          return (
            <li key={s.id} className="flex items-start gap-1.5">
              <span className="w-4 shrink-0">
                {outcome === 'Câștigat' ? '✅' : outcome === 'Pierdut' ? '❌' : '·'}
              </span>
              <span>
                {s.match} — <span className="text-slate-500">{s.market}</span>
                {s.score && <span className="ml-1 font-mono text-slate-400">({s.score[0]}-{s.score[1]})</span>}
                {!s.score && s.liveScore && (
                  <span className="ml-1 animate-pulse font-mono text-xs font-bold text-rose-400">
                    🔴 LIVE {s.liveScore[0]}-{s.liveScore[1]}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span>Cotă <span className="font-mono font-semibold text-slate-200">@{fmtOdd(bet.cotaTotala)}</span></span>
        <span>Miză <span className="font-mono text-slate-200">{bet.miza} RON</span></span>
        {bet.status === 'În așteptare' ? (
          <span>Plată potențială <span className="font-mono text-amber-400">{payout.toFixed(2)} RON</span></span>
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

const SORTS = {
  recente: { label: 'Recente', fn: (a, b) => (b.ts ?? 0) - (a.ts ?? 0) },
  miza: { label: 'Miză ↓', fn: (a, b) => b.miza - a.miza },
  cota: { label: 'Cotă ↓', fn: (a, b) => b.cotaTotala - a.cotaTotala },
  castig: { label: 'Câștig potențial ↓', fn: (a, b) => b.miza * b.cotaTotala - a.miza * a.cotaTotala },
}

function History({ bets, onStatusChange, onDelete, onValidate, onVerifyOnline, verifying, verifyMsg, title = 'Bilete Active', emptyMsg = 'Niciun bilet activ. Confirmă o sugestie sau importă un bilet din tabul Analiză.' }) {
  const [resultsText, setResultsText] = useState('')
  const [sortBy, setSortBy] = useState('recente')
  const pendingCount = bets.filter((b) => b.status === 'În așteptare').length
  const sorted = [...bets].sort(SORTS[sortBy].fn)

  return (
    <Card title={title} icon="📒">
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
        <p className="text-sm text-slate-500">{emptyMsg}</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((b) => (
            <BetCard key={b.id} bet={b} onStatusChange={onStatusChange} onDelete={onDelete} />
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'betting-analyzer-history'

export default function App() {
  const [rawText, setRawText] = useState('')
  const [analyzed, setAnalyzed] = useState([])
  const [tab, setTab] = useState('analiza')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [ticketMeta, setTicketMeta] = useState(null)
  const [stake, setStake] = useState(100)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')
  const [loadingReal, setLoadingReal] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [settings, setSettings] = useState(loadSettings)

  const handleSaveSettings = (next) => {
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }
  const [bets, setBets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bets))
  }, [bets])

  const suggestions = useMemo(() => buildSuggestions(analyzed), [analyzed])

  const handleProcess = () => {
    setAnalyzed(parseRawText(rawText).map(analyzeSelection))
    setTicketMeta(detectTicketMeta(rawText))
    setBannerDismissed(false)
  }

  const handleLoadReal = async () => {
    setLoadingReal(true)
    setImportMsg('')
    try {
      const lines = await fetchUpcomingMatches()
      const text = lines.join('\n')
      setRawText(text)
      setAnalyzed(parseRawText(text).map(analyzeSelection))
      setTicketMeta(null)
      setImportMsg(`📡 ${lines.length} meciuri oficiale WC 2026 încărcate. Cotele sunt orientative — înlocuiește-le cu cele de pe Betano și apasă din nou Procesează.`)
    } catch (e) {
      setImportMsg(`⚠️ Nu am putut încărca programul (${e.message}). Încearcă din nou sau lipește manual.`)
    }
    setLoadingReal(false)
  }

  const handleImportTicket = (miza, status, cotaTotala) => {
    if (analyzed.length === 0) return
    const bet = {
      id: Date.now() + Math.random(),
      ts: Date.now(),
      data: new Date().toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' }),
      tip: `Bilet importat (${analyzed.length} sel.)`,
      selections: analyzed,
      cotaTotala,
      miza,
      status,
    }
    // scorurile deja prezente în paste pot decide biletul pe loc
    setBets((prev) => [applyResultsToBet(bet, []), ...prev])
    setBannerDismissed(true)
    setTab('active')
  }

  const handleValidate = (text) => {
    const results = parseResults(text)
    if (results.length === 0) return
    setBets((prev) => prev.map((b) => applyResultsToBet(b, results)))
  }

  const lastVerifyRef = useRef(0)

  const handleVerifyOnline = async () => {
    if (verifying) return
    setVerifying(true)
    setVerifyMsg('')
    lastVerifyRef.current = Date.now()
    try {
      const pendingSels = []
      for (const b of bets) {
        if (b.status !== 'În așteptare') continue
        for (const s of b.selections) {
          if (!s.score && !pendingSels.some((x) => x.match === s.match)) pendingSels.push(s)
        }
      }
      const results = []
      const liveScores = new Map()
      let notFound = 0
      for (const s of pendingSels) {
        const r = await fetchScoreOnline(s, { apiFootballKey: settings.apiFootballKey }).catch(() => null)
        if (!r) { notFound += 1; continue }
        if (r.finished) {
          const teams = splitMatch(s.match)
          results.push({ t1: teams[0], t2: teams[1], s1: r.score[0], s2: r.score[1] })
        } else {
          liveScores.set(s.match, r.score)
        }
      }
      setBets((prev) =>
        prev.map((b) => {
          const withLive = {
            ...b,
            selections: b.selections.map((s) => {
              const live = liveScores.get(s.match)
              return live ? { ...s, liveScore: live } : s.liveScore && !liveScores.has(s.match) ? { ...s, liveScore: undefined } : s
            }),
          }
          return applyResultsToBet(withLive, results)
        }),
      )
      const parts = []
      if (results.length) parts.push(`✅ ${results.length} finale`)
      if (liveScores.size) parts.push(`🔴 ${liveScores.size} LIVE`)
      if (notFound) parts.push(`⏳ ${notFound} negăsite (probabil nu au început)`)
      setVerifyMsg(parts.length ? `${parts.join(' · ')} — verificat la ${new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}.` : 'Niciun meci în așteptare de verificat.')
    } catch (e) {
      setVerifyMsg(`⚠️ Eroare la căutarea online: ${e.message}. Folosește validarea manuală.`)
    }
    setVerifying(false)
  }

  // auto-verificare: la deschiderea tabului Bilete Active și apoi la fiecare
  // 3 minute cât timp tabul rămâne deschis
  const verifyFnRef = useRef(null)
  verifyFnRef.current = () => {
    if (bets.some((b) => b.status === 'În așteptare')) handleVerifyOnline()
  }
  useEffect(() => {
    if (tab !== 'active') return
    if (Date.now() - lastVerifyRef.current > 3 * 60 * 1000) verifyFnRef.current()
    const intervalId = setInterval(() => verifyFnRef.current(), 3 * 60 * 1000)
    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleConfirm = (tip, parlay) => {
    setBets((prev) => [
      {
        id: Date.now() + Math.random(),
        ts: Date.now(),
        data: new Date().toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' }),
        tip,
        selections: parlay.selections,
        cotaTotala: parlay.cotaTotala,
        miza: stake,
        status: 'În așteptare',
      },
      ...prev,
    ])
  }

  const handleStatusChange = (id, status) =>
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))

  const handleDelete = (id) => setBets((prev) => prev.filter((b) => b.id !== id))

  const activeBets = bets.filter((b) => b.status === 'În așteptare')
  const settledBets = bets.filter((b) => b.status !== 'În așteptare')

  const TABS = [
    { id: 'analiza', label: '🧠 Analiză' },
    { id: 'active', label: '⏳ Bilete Active', count: activeBets.length },
    { id: 'istoric', label: '📊 Istoric & Statistici' },
    { id: 'setari', label: '⚙️ Setări' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)] px-4 py-6 text-slate-200">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            ⚽🎾 Analizor & Tracker Pariuri
          </h1>
          <p className="text-sm text-slate-400">
            World Cup 2026 · ATP/WTA Iarbă · Baschet · Baseball · cotă min. {COTA_MINIMA.toFixed(2)}
            {' '}· <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-emerald-400">{APP_VERSION}</span>
          </p>
        </header>

        <nav className="sticky top-2 z-20 mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                tab === t.id
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-2 rounded-full px-2 py-0.5 font-mono text-xs ${tab === t.id ? 'bg-white/20' : 'bg-amber-500/20 text-amber-400'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {tab === 'analiza' && (
          <div className="grid gap-5 lg:grid-cols-5">
            <div className="space-y-5 lg:col-span-3">
              <ImportZone
                rawText={rawText}
                setRawText={setRawText}
                onProcess={handleProcess}
                onLoadReal={handleLoadReal}
                loadingReal={loadingReal}
                importMsg={importMsg}
              />
              {!bannerDismissed && <TicketBanner meta={ticketMeta} analyzed={analyzed} onImport={handleImportTicket} />}
              <AnalysisEngine analyzed={analyzed} />
            </div>
            <div className="lg:col-span-2">
              <Suggestions
                suggestions={suggestions}
                stake={stake}
                setStake={setStake}
                onConfirm={handleConfirm}
              />
            </div>
          </div>
        )}

        {tab === 'active' && (
          <History
            bets={activeBets}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onValidate={handleValidate}
            onVerifyOnline={handleVerifyOnline}
            verifying={verifying}
            verifyMsg={verifyMsg}
          />
        )}

        {tab === 'istoric' && (
          <div className="space-y-5">
            <StatsBar bets={bets} />
            <CalendarView bets={bets} />
            <Card title="Bilete Decise" icon="📒">
              {settledBets.length === 0 ? (
                <p className="text-sm text-slate-500">Niciun bilet decis încă. Biletele câștigate sau pierdute apar aici.</p>
              ) : (
                <div className="space-y-3">
                  {settledBets.map((b) => (
                    <BetCard key={b.id} bet={b} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === 'setari' && <SettingsPanel settings={settings} onSave={handleSaveSettings} />}

        <footer className="mt-6 text-center text-xs text-slate-600">
          Model intern — pariază responsabil. Probabilitățile sunt estimări, nu garanții.
        </footer>
      </div>
    </div>
  )
}
