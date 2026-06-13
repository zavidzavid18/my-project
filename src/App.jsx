import { useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeSelection,
  applyResultsToBet,
  buildSuggestions,
  detectTicketMeta,
  RATE_LIMIT,
  fetchScoreOnline,
  fetchUpcomingMatches,
  statsKeyFor,
  parseRawText,
  parseResults,
  selectionOutcome,
  splitMatch,
} from './lib/engine.js'
import {
  currentBankroll,
  DEFAULT_BANKROLL_START,
  DEFAULT_KELLY_DIVISOR,
  pendingStake,
} from './lib/bankroll.js'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { useToasts } from './hooks/useToasts.js'
import { Card, EmptyState, ToastHost } from './components/ui.jsx'
import { ImportZone } from './components/analysis/ImportZone.jsx'
import { TicketBanner } from './components/analysis/TicketBanner.jsx'
import { AnalysisTable } from './components/analysis/AnalysisTable.jsx'
import { TicketBuilder } from './components/analysis/TicketBuilder.jsx'
import { Suggestions } from './components/analysis/Suggestions.jsx'
import { ActiveBets } from './components/bets/ActiveBets.jsx'
import { BetCard } from './components/bets/BetCard.jsx'
import { StatsBar } from './components/history/StatsBar.jsx'
import { Breakdowns } from './components/history/Breakdowns.jsx'
import { CalendarView } from './components/history/CalendarView.jsx'
import { TeamStatsPanel } from './components/stats/TeamStatsPanel.jsx'
import { SettingsPanel } from './components/settings/SettingsPanel.jsx'
import { filterByPeriod } from './lib/stats.js'

const APP_VERSION = 'v6.0'
const SETTINGS_KEY = 'betting-analyzer-settings'
const STORAGE_KEY = 'betting-analyzer-history'
const TEAM_STATS_KEY = 'analyzer-team-stats'
const AUTO_VERIFY_MS = 3 * 60 * 1000

const PERIODS = [
  { days: 7, label: '7 zile' },
  { days: 30, label: '30 zile' },
  { days: null, label: 'Tot' },
]

const newBet = (tip, selections, cotaTotala, miza, status = 'În așteptare') => ({
  id: Date.now() + Math.random(),
  ts: Date.now(),
  data: new Date().toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' }),
  tip,
  selections,
  cotaTotala,
  miza,
  status,
})

export default function App() {
  const [rawText, setRawText] = useState('')
  const [analyzed, setAnalyzed] = useState([])
  const [analysisKey, setAnalysisKey] = useState(0)
  const [picked, setPicked] = useState([])
  const [tab, setTab] = useState('analiza')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [ticketMeta, setTicketMeta] = useState(null)
  const [stake, setStake] = useState(100)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')
  const [lastVerifyAt, setLastVerifyAt] = useState(0)
  const [loadingReal, setLoadingReal] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [period, setPeriod] = useState(null)

  const [settings, setSettings] = useLocalStorage(SETTINGS_KEY, {})
  const [teamStats, setTeamStats] = useLocalStorage(TEAM_STATS_KEY, {})
  const [bets, setBets] = useLocalStorage(STORAGE_KEY, [])
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts()

  const bankrollStart = Number(settings.bankrollStart) > 0 ? Number(settings.bankrollStart) : DEFAULT_BANKROLL_START
  const kellyDivisor = Number(settings.kellyDivisor) > 0 ? Number(settings.kellyDivisor) : DEFAULT_KELLY_DIVISOR
  const bankNow = currentBankroll(bankrollStart, bets)
  const bankDelta = bankNow - bankrollStart
  const inPlay = pendingStake(bets)

  const suggestions = useMemo(() => buildSuggestions(analyzed), [analyzed])

  const statsDb = useMemo(() => {
    const db = {}
    for (const [k, v] of Object.entries(teamStats)) db[k] = v.stats
    return Object.keys(db).length ? db : null
  }, [teamStats])

  const pickedSelections = useMemo(
    () => analyzed.filter((s) => picked.includes(s.id)),
    [analyzed, picked],
  )

  // ── Analiză ────────────────────────────────────────────────────────────────

  const handleProcess = () => {
    setAnalyzed(parseRawText(rawText).map((s) => analyzeSelection(s, statsDb)))
    setTicketMeta(detectTicketMeta(rawText))
    setBannerDismissed(false)
    setPicked([])
    setAnalysisKey((k) => k + 1)
  }

  const handleLoadReal = async () => {
    setLoadingReal(true)
    setImportMsg('')
    try {
      const lines = await fetchUpcomingMatches()
      const text = lines.join('\n')
      setRawText(text)
      setAnalyzed(parseRawText(text).map((s) => analyzeSelection(s, statsDb)))
      setTicketMeta(null)
      setPicked([])
      setAnalysisKey((k) => k + 1)
      setImportMsg(`📡 ${lines.length} meciuri oficiale WC 2026 încărcate. Cotele sunt orientative — înlocuiește-le cu cele de pe Betano și apasă din nou Procesează.`)
    } catch (e) {
      setImportMsg(`⚠️ Nu am putut încărca programul (${e.message}). Încearcă din nou sau lipește manual.`)
    }
    setLoadingReal(false)
  }

  const handleTogglePick = (id) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // ── Salvare bilete ─────────────────────────────────────────────────────────

  const savedToast = () =>
    pushToast('🎫 Bilet salvat în Bilete Active.', {
      type: 'success',
      actionLabel: 'Vezi',
      onAction: () => setTab('active'),
    })

  const handleImportTicket = (miza, status, cotaTotala) => {
    if (analyzed.length === 0) return
    const bet = newBet(`Bilet importat (${analyzed.length} sel.)`, analyzed, cotaTotala, miza, status)
    // scorurile deja prezente în paste pot decide biletul pe loc
    setBets((prev) => [applyResultsToBet(bet, []), ...prev])
    setBannerDismissed(true)
    savedToast()
  }

  const handleConfirm = (tip, parlay) => {
    setBets((prev) => [newBet(tip, parlay.selections, parlay.cotaTotala, stake), ...prev])
    savedToast()
  }

  const handleSaveBuilder = (builderStake) => {
    if (pickedSelections.length === 0) return
    const cotaTotala = pickedSelections.reduce((a, s) => a * s.odds, 1)
    setBets((prev) => [
      newBet(`Biletul Meu (${pickedSelections.length} sel.)`, pickedSelections, cotaTotala, builderStake),
      ...prev,
    ])
    setPicked([])
    savedToast()
  }

  // ── Rezultate & validare ───────────────────────────────────────────────────

  const handleValidate = (text) => {
    const results = parseResults(text)
    if (results.length === 0) {
      pushToast('⚠️ Niciun rezultat recunoscut — formatul e „Echipa1 - Echipa2 2-1".', { type: 'error' })
      return
    }
    setBets((prev) => prev.map((b) => applyResultsToBet(b, results)))
    pushToast(`🔄 ${results.length} rezultate aplicate.`, { type: 'success' })
  }

  const lastVerifyRef = useRef(0)

  const handleVerifyOnline = async () => {
    if (verifying) return
    setVerifying(true)
    setVerifyMsg('')
    lastVerifyRef.current = Date.now()
    setLastVerifyAt(lastVerifyRef.current)
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
      let rateLimited = false
      for (const s of pendingSels) {
        let r = null
        try {
          r = await fetchScoreOnline(s, { apiFootballKey: settings.apiFootballKey })
        } catch (e) {
          if (e?.message === RATE_LIMIT) { rateLimited = true; break }
        }
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
      if (rateLimited) parts.push('🚦 limită API atinsă — restul se verifică la următoarea rundă')
      setVerifyMsg(parts.length ? `${parts.join(' · ')} — verificat la ${new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}.` : 'Niciun meci în așteptare de verificat.')
      if (results.length) pushToast(`✅ ${results.length} rezultate finale găsite și aplicate.`, { type: 'success' })
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
    if (Date.now() - lastVerifyRef.current > AUTO_VERIFY_MS) verifyFnRef.current()
    const intervalId = setInterval(() => verifyFnRef.current(), AUTO_VERIFY_MS)
    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // ── Gestionare bilete ──────────────────────────────────────────────────────

  const handleStatusChange = (id, status) =>
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))

  // ștergerea se poate anula din notificare — fără pierderi accidentale
  const handleDelete = (id) => {
    const bet = bets.find((b) => b.id === id)
    if (!bet) return
    setBets((prev) => prev.filter((b) => b.id !== id))
    pushToast(`🗑️ Bilet șters (${bet.tip}, ${bet.miza} RON).`, {
      actionLabel: 'Anulează',
      onAction: () =>
        setBets((prev) => (prev.some((b) => b.id === bet.id) ? prev : [bet, ...prev])),
      ttl: 8000,
    })
  }

  // bifă manuală pe o selecție: ✓ a ieșit / ✗ a picat; biletul se decide
  // singur când toate selecțiile au un rezultat
  const handleLegMark = (betId, selId, outcome) =>
    setBets((prev) =>
      prev.map((b) => {
        if (b.id !== betId) return b
        const selections = b.selections.map((s) =>
          s.id === selId ? { ...s, manual: outcome ?? undefined } : s,
        )
        const outcomes = selections.map(selectionOutcome)
        let status = 'În așteptare'
        if (outcomes.some((o) => o === 'Pierdut')) status = 'Pierdut'
        else if (outcomes.length && outcomes.every((o) => o === 'Câștigat')) status = 'Câștigat'
        return { ...b, selections, status }
      }),
    )

  // validare automată greșită? șterge scorurile găsite și readu În așteptare
  const handleResetBet = (id) =>
    setBets((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: 'În așteptare',
              selections: b.selections.map(({ score, liveScore, manual, ...s }) => s),
            }
          : b,
      ),
    )

  // ── Statistici echipe ──────────────────────────────────────────────────────

  const handleAddStats = (parsed) =>
    setTeamStats((prev) => {
      const next = { ...prev }
      for (const t of parsed) next[statsKeyFor(t.team)] = t
      return next
    })

  const handleDeleteStats = (key) =>
    setTeamStats((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })

  // ── Backup complet (acceptă și formatul vechi: doar lista de bilete) ───────

  const mergeBets = (imported) => {
    const known = new Set(bets.map((b) => b.id))
    const fresh = imported.filter((b) => b && b.id != null && !known.has(b.id) && Array.isArray(b.selections))
    if (fresh.length) {
      setBets((prev) => {
        const ids = new Set(prev.map((b) => b.id))
        return [...fresh.filter((b) => !ids.has(b.id)), ...prev]
      })
    }
    return fresh.length
  }

  const handleImportBackup = (data) => {
    if (Array.isArray(data)) {
      const added = mergeBets(data)
      return `✅ Backup vechi importat: ${added} bilete noi.`
    }
    if (!data || typeof data !== 'object') return null
    const parts = []
    if (Array.isArray(data.bets)) parts.push(`${mergeBets(data.bets)} bilete noi`)
    if (data.teamStats && typeof data.teamStats === 'object') {
      setTeamStats((prev) => ({ ...prev, ...data.teamStats }))
      parts.push(`${Object.keys(data.teamStats).length} echipe`)
    }
    if (data.settings && typeof data.settings === 'object') {
      // setările existente (ne-goale) au prioritate față de cele importate
      setSettings((prev) => ({
        ...data.settings,
        ...Object.fromEntries(Object.entries(prev).filter(([, v]) => v !== '' && v != null)),
      }))
      parts.push('setări')
    }
    if (parts.length === 0) return null
    return `✅ Backup importat: ${parts.join(', ')}.`
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeBets = bets.filter((b) => b.status === 'În așteptare')
  const settledBets = bets.filter((b) => b.status !== 'În așteptare')
  const periodBets = useMemo(() => filterByPeriod(bets, period), [bets, period])

  const TABS = [
    { id: 'analiza', label: '🧠 Analiză' },
    { id: 'active', label: '⏳ Bilete Active', count: activeBets.length },
    { id: 'stats', label: '📈 Statistici', count: Object.keys(teamStats).length },
    { id: 'istoric', label: '📊 Istoric' },
    { id: 'setari', label: '⚙️ Setări' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_60%)] px-4 py-6 text-slate-200">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-violet-600 text-xl shadow-lg shadow-emerald-900/40">
            ⚡
          </div>
          <div className="min-w-0">
            <h1 className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
              Analizor & Tracker Pariuri
            </h1>
            <p className="text-xs text-slate-400">
              WC 2026 · Tenis iarbă · Baschet · Baseball · Poisson pe date reale · Kelly staking
              {' '}· <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-emerald-400">{APP_VERSION}</span>
            </p>
          </div>
          <div
            className="ml-auto rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-2 text-right shadow-lg shadow-black/30"
            title={`Bancă de start ${bankrollStart.toFixed(0)} RON (modificabilă în ⚙️ Setări) + profit net. În joc: mize nedecise.`}
          >
            <div className="text-[10px] uppercase tracking-wider text-slate-500">💰 Bancă</div>
            <div className="font-mono text-lg font-bold leading-tight text-slate-100">
              {bankNow.toFixed(0)} <span className="text-xs font-semibold text-slate-500">RON</span>
              <span className={`ml-2 text-xs font-bold ${bankDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {bankDelta >= 0 ? '+' : ''}{bankDelta.toFixed(0)}
              </span>
            </div>
            {inPlay > 0 && <div className="text-[10px] text-amber-400/80">{inPlay.toFixed(0)} RON în joc</div>}
          </div>
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
              <AnalysisTable
                key={analysisKey}
                analyzed={analyzed}
                picked={picked}
                onTogglePick={handleTogglePick}
              />
            </div>
            <div className="space-y-5 lg:col-span-2">
              <TicketBuilder
                selections={pickedSelections}
                onRemove={(id) => setPicked((prev) => prev.filter((x) => x !== id))}
                onClear={() => setPicked([])}
                onSave={handleSaveBuilder}
                bankroll={bankNow}
                kellyDivisor={kellyDivisor}
              />
              <Suggestions
                suggestions={suggestions}
                stake={stake}
                setStake={setStake}
                onConfirm={handleConfirm}
                bankroll={bankNow}
                kellyDivisor={kellyDivisor}
              />
            </div>
          </div>
        )}

        {tab === 'active' && (
          <ActiveBets
            bets={activeBets}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onReset={handleResetBet}
            onLegMark={handleLegMark}
            onValidate={handleValidate}
            onVerifyOnline={handleVerifyOnline}
            verifying={verifying}
            verifyMsg={verifyMsg}
            lastVerifyAt={lastVerifyAt}
            autoVerifyMs={AUTO_VERIFY_MS}
          />
        )}

        {tab === 'istoric' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 text-slate-500">Perioadă:</span>
              {PERIODS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPeriod(p.days)}
                  className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                    period === p.days ? 'bg-emerald-600 text-white' : 'border border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <StatsBar bets={periodBets} />
            <Breakdowns bets={periodBets} />
            <CalendarView bets={bets} />
            <Card title="Bilete Decise" icon="📒">
              {settledBets.length === 0 ? (
                <EmptyState>Niciun bilet decis încă. Biletele câștigate sau pierdute apar aici.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {settledBets.map((b) => (
                    <BetCard key={b.id} bet={b} onStatusChange={handleStatusChange} onDelete={handleDelete} onReset={handleResetBet} onLegMark={handleLegMark} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {tab === 'stats' && <TeamStatsPanel teamStats={teamStats} onAdd={handleAddStats} onDelete={handleDeleteStats} />}

        {tab === 'setari' && (
          <SettingsPanel
            settings={settings}
            onSave={setSettings}
            bets={bets}
            teamStats={teamStats}
            onImportBackup={handleImportBackup}
          />
        )}

        <footer className="mt-6 text-center text-xs text-slate-600">
          Model intern — pariază responsabil. Probabilitățile sunt estimări, nu garanții.
        </footer>
      </div>
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
