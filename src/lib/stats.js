// ─── Statistici pe istoric (funcții pure, testabile) ────────────────────────

export const betProfit = (b) =>
  b.status === 'Câștigat' ? b.miza * (b.cotaTotala - 1) : b.status === 'Pierdut' ? -b.miza : 0

export const parseBetDate = (b) => {
  if (b.ts) return new Date(b.ts)
  const m = (b.data ?? '').match(/(\d{2})\.(\d{2})\.(\d{4})/)
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null
}

// days = null înseamnă „toată perioada"
export const filterByPeriod = (bets, days) => {
  if (!days) return bets
  const cutoff = Date.now() - days * 86400000
  return bets.filter((b) => {
    const d = parseBetDate(b)
    return d && d.getTime() >= cutoff
  })
}

export function overallStats(bets) {
  const settled = bets.filter((b) => b.status !== 'În așteptare')
  const won = settled.filter((b) => b.status === 'Câștigat')
  const staked = settled.reduce((a, b) => a + b.miza, 0)
  const profit = settled.reduce((a, b) => a + betProfit(b), 0)
  const profits = settled.map(betProfit)
  return {
    settledCount: settled.length,
    wonCount: won.length,
    lostCount: settled.length - won.length,
    pendingCount: bets.length - settled.length,
    staked,
    profit,
    roi: staked ? (profit / staked) * 100 : 0,
    winRate: settled.length ? (won.length / settled.length) * 100 : 0,
    avgOdds: settled.length ? settled.reduce((a, b) => a + b.cotaTotala, 0) / settled.length : 0,
    avgStake: settled.length ? staked / settled.length : 0,
    biggestWin: profits.length ? Math.max(...profits, 0) : 0,
    biggestLoss: profits.length ? Math.min(...profits, 0) : 0,
  }
}

const settledChrono = (bets) =>
  bets
    .filter((b) => b.status !== 'În așteptare')
    .sort((a, b) => (parseBetDate(a)?.getTime() ?? 0) - (parseBetDate(b)?.getTime() ?? 0))

// Serii W/L pe biletele decise, în ordine cronologică
export function computeStreaks(bets) {
  let current = { type: null, len: 0 }
  let bestWin = 0
  let worstLoss = 0
  for (const b of settledChrono(bets)) {
    const t = b.status === 'Câștigat' ? 'W' : 'L'
    current = t === current.type ? { type: t, len: current.len + 1 } : { type: t, len: 1 }
    if (t === 'W') bestWin = Math.max(bestWin, current.len)
    else worstLoss = Math.max(worstLoss, current.len)
  }
  return { current, bestWin, worstLoss }
}

// Profit cumulat după fiecare bilet decis — punctele graficului de bancă
export function profitSeries(bets) {
  let acc = 0
  return [0, ...settledChrono(bets).map((b) => (acc += betProfit(b)))]
}

// Sportul dominant al unui bilet (majoritatea selecțiilor)
export const betSport = (b) => {
  const counts = {}
  for (const s of b.selections ?? []) counts[s.sport] = (counts[s.sport] || 0) + 1
  return Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0] ?? 'altul'
}

export const oddsBand = (cota) =>
  cota < 2 ? '1.00 – 1.99' : cota < 3 ? '2.00 – 2.99' : cota < 5 ? '3.00 – 4.99' : '5.00+'

export const betKind = (b) => {
  const t = b.tip ?? ''
  if (/single/i.test(t)) return 'Single'
  if (/sigur/i.test(t)) return 'Biletul Sigur'
  if (/cota mare/i.test(t)) return 'Cota Mare'
  if (/meu/i.test(t)) return 'Biletul Meu'
  if (/importat/i.test(t)) return 'Importat'
  return t || 'Altele'
}

// Defalcare profit pe o cheie derivată din bilet (sport, tip, interval de cotă)
export function breakdown(bets, keyFn) {
  const groups = {}
  for (const b of bets) {
    if (b.status === 'În așteptare') continue
    const k = keyFn(b)
    groups[k] ??= { key: k, profit: 0, won: 0, lost: 0, staked: 0 }
    groups[k].profit += betProfit(b)
    groups[k].staked += b.miza
    if (b.status === 'Câștigat') groups[k].won += 1
    else groups[k].lost += 1
  }
  return Object.values(groups).sort((a, b) => b.profit - a.profit)
}
