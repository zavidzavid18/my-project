// ─── Motorul de Analiză (Quant Engine) ──────────────────────────────────────
// Reguli:
//  • WC 2026 (teren neutru): modelul favorizează "Under 2.5" și "GG NU".
//    Probabilitate minimă acceptată de model: 45%.
//  • Tenis iarbă: Câștigător Meci → Grass Elo. Prop-uri (Asi / Duble Greșeli)
//    → statistici de serviciu, NU Elo.
//  • Turneu Betano: cotă minimă per selecție >= 1.50.

export const COTA_MINIMA = 1.5
export const PROB_MINIMA_FOTBAL = 0.45

// ─── Baze de date model (mock deterministic) ────────────────────────────────

const GRASS_ELO = {
  alcaraz: 2180, djokovic: 2150, sinner: 2090, rybakina: 2080,
  fritz: 2010, hurkacz: 2005, swiatek: 1985, paolini: 1980,
  rune: 1950, ostapenko: 1945, isner: 1930, monfils: 1860,
  opelka: 1920, shelton: 1940, gauff: 1960, sabalenka: 2020,
}

const SERVE_STATS = {
  // [asi/meci pe iarbă, duble greșeli/meci]
  hurkacz: [14.2, 2.4], isner: [17.1, 2.0], opelka: [16.3, 2.6],
  fritz: [12.4, 2.8], shelton: [13.1, 3.4], alcaraz: [7.8, 2.9],
  djokovic: [6.5, 2.2], rune: [8.2, 3.1], monfils: [9.0, 3.0],
  rybakina: [7.4, 2.6], ostapenko: [4.1, 4.2], sabalenka: [5.2, 3.8],
}

const hash = (s) => {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}
const jitter = (s, range) => (((hash(s) % 1000) / 1000 - 0.5) * 2) * range
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const logistic = (x) => 1 / (1 + Math.exp(-x))

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const findKey = (table, text) => {
  const t = norm(text)
  return Object.keys(table).find((k) => t.includes(k))
}

// ─── Parser text brut ───────────────────────────────────────────────────────
// Format acceptat: "Echipa1 vs Echipa2 | Piață | Cotă [| sport]"
// Fallback: ultima valoare numerică din linie = cota.

export function parseRawText(raw) {
  const selections = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    let match, market, odds, sportHint
    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 3) {
      ;[match, market] = parts
      odds = parseFloat(parts[2].replace(',', '.'))
      sportHint = parts[3]
    } else {
      const m = trimmed.match(/(\d+[.,]\d+)\s*$/)
      if (!m) continue
      odds = parseFloat(m[1].replace(',', '.'))
      match = trimmed.slice(0, m.index).trim()
      market = ''
    }
    if (!odds || odds <= 1) continue

    selections.push(classify({ match, market: market || match, odds, sportHint }))
  }
  return selections
}

function classify({ match, market, odds, sportHint }) {
  const m = norm(market)
  const tennisKeywords = /asi|aces|duble|double fault|set|game|tiebreak|tenis/
  const sport =
    (sportHint && norm(sportHint).includes('tenis')) ||
    tennisKeywords.test(m) ||
    findKey(GRASS_ELO, match)
      ? 'tenis'
      : 'fotbal'

  let marketType = 'altele'
  if (/under\s*2[.,]5|sub\s*2[.,]5/.test(m)) marketType = 'under25'
  else if (/gg\s*nu|ngg|nu\s*marcheaza ambele/.test(m)) marketType = 'ggnu'
  else if (/asi|aces/.test(m)) marketType = 'prop_asi'
  else if (/duble|double fault/.test(m)) marketType = 'prop_duble'
  else if (/castigator|winner|victorie|ml\b/.test(m)) marketType = 'winner'
  else if (/peste|over/.test(m)) marketType = 'over'

  return { id: hash(match + market + odds), match, market, odds, sport, marketType }
}

// ─── Analiză per selecție ───────────────────────────────────────────────────

export function analyzeSelection(sel) {
  const implied = 1 / sel.odds
  const reasons = []
  let modelProb
  let engine

  if (sel.sport === 'tenis') {
    if (sel.marketType === 'prop_asi' || sel.marketType === 'prop_duble') {
      engine = 'Statistici Serviciu'
      modelProb = serveModel(sel)
      reasons.push('Prop evaluat pe statistici de serviciu (NU pe Elo).')
    } else {
      engine = 'Grass Elo'
      modelProb = grassEloModel(sel)
    }
  } else {
    engine = 'Model Goluri (teren neutru)'
    if (sel.marketType === 'under25' || sel.marketType === 'ggnu') {
      modelProb = clamp(implied + 0.07 + jitter(sel.match, 0.03), 0.05, 0.93)
      reasons.push('Piață favorizată de model pe teren neutru (Under 2.5 / GG NU).')
    } else {
      modelProb = clamp(implied - 0.05 + jitter(sel.match, 0.02), 0.05, 0.93)
      reasons.push('Piață nefavorizată de model (modelul preferă Under 2.5 / GG NU).')
    }
  }

  const edge = modelProb - implied
  const ev = modelProb * sel.odds - 1

  let verdict = '+EV'
  if (sel.odds < COTA_MINIMA) {
    verdict = 'PASS'
    reasons.push(`Cota ${sel.odds.toFixed(2)} < ${COTA_MINIMA.toFixed(2)} — nu califică pentru turneul Betano.`)
  }
  if (sel.sport === 'fotbal' && modelProb < PROB_MINIMA_FOTBAL) {
    verdict = 'PASS'
    reasons.push(`Probabilitate model ${(modelProb * 100).toFixed(1)}% < 45% (minim WC 2026).`)
  }
  if (edge <= 0) {
    verdict = 'PASS'
    reasons.push('Fără avantaj matematic: probabilitatea modelului ≤ probabilitatea implicită a cotei.')
  }
  if (verdict === '+EV') {
    reasons.push(`Avantaj +${(edge * 100).toFixed(1)}% față de cota bookmakerului.`)
  }

  return { ...sel, implied, modelProb, edge, ev, engine, verdict, reasons }
}

function grassEloModel(sel) {
  const players = sel.match.split(/\s+(?:vs|v|-)\s+/i).map((p) => p.trim())
  const [p1 = sel.match, p2 = ''] = players
  const eloOf = (name) => {
    const key = findKey(GRASS_ELO, name)
    return key ? GRASS_ELO[key] : 1900 + jitter(name, 60)
  }
  // Selecția pariată: jucătorul menționat în piață, altfel primul.
  const pickedIsP2 = p2 && norm(sel.market).includes(norm(p2).split(' ')[0])
  const [me, opp] = pickedIsP2 ? [p2, p1] : [p1, p2 || p1]
  const prob = 1 / (1 + Math.pow(10, (eloOf(opp) - eloOf(me)) / 400))
  return clamp(prob + jitter(sel.match, 0.02), 0.05, 0.95)
}

function serveModel(sel) {
  const lineMatch = sel.market.match(/(\d+[.,]\d+)/)
  const line = lineMatch ? parseFloat(lineMatch[1].replace(',', '.')) : 10.5
  const key = findKey(SERVE_STATS, sel.match) || findKey(SERVE_STATS, sel.market)
  const [aces, dfs] = key ? SERVE_STATS[key] : [9.0, 3.2]
  const isUnder = /sub|under/.test(norm(sel.market))

  if (sel.marketType === 'prop_asi') {
    const grassBoost = 1.5 // iarba crește numărul de asi
    const overProb = logistic((aces + grassBoost - line) / 2.5)
    return clamp(isUnder ? 1 - overProb : overProb, 0.05, 0.95)
  }
  const underProb = logistic((line - dfs) / 1.2)
  return clamp(isUnder ? underProb : 1 - underProb, 0.05, 0.95)
}

// ─── Generator de bilete ────────────────────────────────────────────────────

const combine = (sels) => ({
  selections: sels,
  cotaTotala: sels.reduce((a, s) => a * s.odds, 1),
  probTotala: sels.reduce((a, s) => a * s.modelProb, 1),
})

export function buildSuggestions(analyzed) {
  const ev = analyzed.filter((s) => s.verdict === '+EV')

  const byProb = [...ev].sort((a, b) => b.modelProb - a.modelProb)
  const byEv = [...ev].sort((a, b) => b.ev - a.ev)

  const sigur = byProb.length >= 2 ? combine(byProb.slice(0, 3)) : null
  const cotaMare = byEv.length >= 5 ? combine(byEv.slice(0, Math.min(7, byEv.length))) : null
  const single = byEv.slice(0, 3)

  return { evCount: ev.length, sigur, cotaMare, single }
}
