import { useEffect, useMemo, useState } from 'react'
import {
  COTA_MINIMA,
  analyzeSelection,
  buildSuggestions,
  parseRawText,
} from './engine.js'

const MOCK_INPUT = `Mexic vs Africa de Sud | Under 2.5 Goluri | 1.72
Argentina vs Nigeria | GG NU | 1.65
Franța vs Senegal | Under 2.5 Goluri | 1.58
Brazilia vs Maroc | GG NU | 1.80
Spania vs Japonia | Under 2.5 Goluri | 1.92
Hurkacz vs Fritz | Peste 12.5 Asi Hurkacz | 1.85 | tenis
Alcaraz vs Rune | Câștigător Meci Alcaraz | 1.55 | tenis
Rybakina vs Ostapenko | Câștigător Meci Rybakina | 1.62 | tenis
Isner vs Monfils | Sub 3.5 Duble Greșeli Isner | 1.44 | tenis
Anglia vs SUA | Peste 2.5 Goluri | 2.10
LA Lakers vs Boston Celtics | Peste 215.5 Puncte | 1.85 | baschet
NY Yankees vs Boston Red Sox | Câștigător Yankees | 1.72 | baseball`

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

function ImportZone({ rawText, setRawText, onProcess }) {
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
      <button
        onClick={onProcess}
        className="mt-3 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98]"
      >
        ⚡ Procesează
      </button>
    </Card>
  )
}

// ─── Motorul de Analiză ──────────────────────────────────────────────────────

function AnalysisEngine({ analyzed }) {
  const [expanded, setExpanded] = useState(null)
  return (
    <Card title="Motorul de Analiză" icon="🧠">
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
              {analyzed.map((s) => (
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

// ─── Istoric Pariuri ─────────────────────────────────────────────────────────

function History({ bets, onStatusChange, onDelete }) {
  const profit = bets.reduce((acc, b) => {
    if (b.status === 'Câștigat') return acc + b.miza * (b.cotaTotala - 1)
    if (b.status === 'Pierdut') return acc - b.miza
    return acc
  }, 0)

  return (
    <Card title="Istoric Pariuri" icon="📒">
      <div className="mb-3 flex gap-4 text-sm">
        <span className="text-slate-400">Bilete salvate: <span className="font-mono font-bold text-slate-100">{bets.length}</span></span>
        <span className="text-slate-400">
          Profit:{' '}
          <span className={`font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(2)} RON
          </span>
        </span>
      </div>
      {bets.length === 0 ? (
        <p className="text-sm text-slate-500">Niciun bilet confirmat încă. Confirmă o sugestie pentru a o urmări aici.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-3">Data</th>
                <th className="pb-2 pr-3">Tip</th>
                <th className="pb-2 pr-3">Selecții</th>
                <th className="pb-2 pr-3">Cotă</th>
                <th className="pb-2 pr-3">Miză</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => (
                <tr key={b.id} className="border-b border-slate-800/60">
                  <td className="py-2.5 pr-3 text-xs text-slate-400">{b.data}</td>
                  <td className="py-2.5 pr-3 text-slate-200">{b.tip}</td>
                  <td className="py-2.5 pr-3 text-xs text-slate-300">
                    {b.selections.map((s) => (
                      <div key={s.id}>{s.match} — <span className="text-slate-500">{s.market}</span></div>
                    ))}
                  </td>
                  <td className="py-2.5 pr-3 font-mono font-semibold text-slate-200">{fmtOdd(b.cotaTotala)}</td>
                  <td className="py-2.5 pr-3 font-mono text-slate-300">{b.miza} RON</td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={b.status}
                      onChange={(e) => onStatusChange(b.id, e.target.value)}
                      className={`rounded-lg border px-2 py-1 text-xs font-semibold outline-none ${STATUS_STYLES[b.status]} bg-slate-950`}
                    >
                      <option>În așteptare</option>
                      <option>Câștigat</option>
                      <option>Pierdut</option>
                    </select>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => onDelete(b.id)}
                      className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                      title="Șterge biletul"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'betting-analyzer-history'

export default function App() {
  const [rawText, setRawText] = useState(MOCK_INPUT)
  const [analyzed, setAnalyzed] = useState(() => parseRawText(MOCK_INPUT).map(analyzeSelection))
  const [stake, setStake] = useState(100)
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

  const handleProcess = () => setAnalyzed(parseRawText(rawText).map(analyzeSelection))

  const handleConfirm = (tip, parlay) => {
    setBets((prev) => [
      {
        id: Date.now() + Math.random(),
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

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)] px-4 py-6 text-slate-200">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            ⚽🎾 Analizor & Tracker Pariuri
          </h1>
          <p className="text-sm text-slate-400">
            World Cup 2026 · ATP/WTA Iarbă · Reguli: Under 2.5 / GG NU (≥45%), Grass Elo, cotă min. {COTA_MINIMA.toFixed(2)}
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <ImportZone rawText={rawText} setRawText={setRawText} onProcess={handleProcess} />
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

        <div className="mt-5">
          <History bets={bets} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        </div>

        <footer className="mt-6 text-center text-xs text-slate-600">
          Model intern — pariază responsabil. Probabilitățile sunt estimări, nu garanții.
        </footer>
      </div>
    </div>
  )
}
