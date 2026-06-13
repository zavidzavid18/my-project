// ─── Motorul de Analiză (Quant Engine) ──────────────────────────────────────
// Reguli:
//  • WC 2026 (teren neutru): modelul favorizează "Under 2.5" și "GG NU".
//    Probabilitate minimă acceptată de model: 45%.
//  • Tenis iarbă: Câștigător Meci / Handicap Set / Câștigă un Set → Grass Elo.
//    Prop-uri (Asi / Duble Greșeli) → statistici de serviciu, NU Elo.
//  • Baschet & Baseball: model generic pe cote (Elo intern).
//  • Turneu Betano: cotă minimă per selecție >= 1.50.
//
// Formate de import acceptate:
//  1. Simplu:   "Echipa1 vs Echipa2 | Piață | Cotă | sport"
//  2. Betano:   bilet copiat (blocuri marcate cu "sport-icon")
//  3. Superbet: listă copiată (blocuri marcate cu "International")

export const COTA_MINIMA = 1.5
export const PROB_MINIMA_FOTBAL = 0.45

// ─── Baze de date model (mock deterministic) ────────────────────────────────

const GRASS_ELO = {
  alcaraz: 2180, djokovic: 2150, sinner: 2090, rybakina: 2080,
  fritz: 2010, hurkacz: 2005, swiatek: 1985, paolini: 1980,
  medvedev: 1975, bublik: 1975, gauff: 1960, mpetshi: 1960,
  lehecka: 1955, rune: 1950, mannarino: 1950, shelton: 1940,
  cilic: 1945, tiafoe: 1945, ostapenko: 1945, isner: 1930,
  opelka: 1920, zhizhen: 1905, giron: 1900, sabalenka: 2020,
  monfils: 1860,
}

const SERVE_STATS = {
  // [asi/meci pe iarbă, duble greșeli/meci]
  hurkacz: [14.2, 2.4], isner: [17.1, 2.0], opelka: [16.3, 2.6],
  mpetshi: [15.8, 3.0], bublik: [13.6, 4.1], fritz: [12.4, 2.8],
  shelton: [13.1, 3.4], cilic: [11.2, 2.7], medvedev: [8.4, 2.5],
  tiafoe: [9.6, 2.9], lehecka: [10.1, 2.6], alcaraz: [7.8, 2.9],
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

// ─── Parser text brut (multi-format) ────────────────────────────────────────

const num = (s) => parseFloat(s.replace(',', '.'))
const isOddLine = (l) => {
  if (!/^\d{1,3}[.,]\d{2}$/.test(l)) return false
  const v = num(l)
  return v > 1 && v < 100
}
const isDateLine = (l) =>
  /\d{1,2}:\d{2}/.test(l) ||
  /^(ieri|azi|astazi|astăzi|maine|mâine|lun|mar|mie|joi|vin|sam|sâm|dum)\b[\s,.]/i.test(l) ||
  /\d{1,2}[.,]?\s*(ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|nov|dec)\b/i.test(l) ||
  /\d{2}[.,]\d{2}[.,]\d{4}/.test(l)
const isFooterLine = (l) =>
  /cot[ăa] total[ăa]|bani reali|c[âa][șs]tig(uri)?\s+(poten[țt]ial|posibile)/i.test(l) ||
  /^\d{3,}[-–]|^(ron|lei)$|\d\s*(lei|ron)\s*$/i.test(l) ||
  /^vezi /i.test(l)

export function parseRawText(raw) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const selections = []
  // Biletele Betano au marcaje "sport-icon"; restul liniilor sunt decor
  // (antet cu rezumatul selecțiilor, totaluri), deci fallback-ul se oprește.
  const hasBetano = lines.some((l) => /^sport-icon$/i.test(l))
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Format Betano: sport-icon / selecție / cotă / piață / meci [/ scor]
    if (/^sport-icon$/i.test(line)) {
      const [sel, odds, market, match] = lines.slice(i + 1, i + 5)
      if (sel && odds && isOddLine(odds) && market && match && /[a-zăâîșț]/i.test(match)) {
        const entry = classify({ match, market: `${market}: ${sel}`, odds: num(odds) })
        let consumed = 5
        const scoreLine = lines[i + 5]?.match(/^scor:?\s*(\d+)\s*-\s*(\d+)/i)
        if (scoreLine) {
          entry.score = [Number(scoreLine[1]), Number(scoreLine[2])]
          consumed = 6
        }
        selections.push(entry)
        i += consumed
        continue
      }
      i += 1
      continue
    }

    // Format Superbet: bloc început cu "International" (sau altă categorie)
    if (/^international$|^nba$|^mlb$|^atp\b|^wta\b/i.test(line)) {
      const block = []
      let j = i + 1
      while (
        j < lines.length &&
        !/^international$|^nba$|^mlb$|^sport-icon$/i.test(lines[j]) &&
        !isFooterLine(lines[j])
      ) {
        block.push(lines[j])
        j += 1
      }
      const parsed = parseSuperbetBlock(block, line)
      if (parsed) {
        const entry = classify(parsed)
        if (parsed.score) entry.score = parsed.score
        selections.push(entry)
      }
      i = j
      continue
    }

    // Format "Cote filtrate": "01 — Echipa1 vs Echipa2" urmat de piețe
    // grupate (antet de grup, apoi linii "SELECȚIE — COTĂ")
    const matchHeader = line.match(/^\d{1,3}\s*[—–-]\s*(.+?\s+vs\s+.+)$/i)
    if (matchHeader) {
      const match = matchHeader[1].trim()
      let group = ''
      let j = i + 1
      while (j < lines.length && !/^\d{1,3}\s*[—–-]\s*.+?\s+vs\s+/i.test(lines[j])) {
        const l = lines[j]
        if (/^-{4,}/.test(l)) { j += 1; continue }
        const selLine = l.match(/^(.+?)\s+[—–-]\s+(\d{1,2}[.,]\d{2})\s*$/)
        if (selLine && group) {
          const odds = num(selLine[2])
          if (odds > 1) {
            selections.push(classify({ match, market: `${group}: ${selLine[1].trim()}`, odds, sportHint: 'fotbal' }))
          }
        } else if (!isDateLine(l) && !/·|cupa mondial|grupa\b|gr\./i.test(l)) {
          group = l
        }
        j += 1
      }
      i = j
      continue
    }

    // Format simplu cu "|"
    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean)
      if (parts.length >= 3) {
        const odds = num(parts[2])
        if (odds > 1) {
          selections.push(classify({ match: parts[0], market: parts[1], odds, sportHint: parts[3] }))
        }
      }
      i += 1
      continue
    }

    // Fallback: "text ... cotă" pe o singură linie (doar în afara biletelor Betano)
    if (!hasBetano && !isDateLine(line) && !isFooterLine(line)) {
      const m = line.match(/(\d+[.,]\d+)\s*$/)
      if (m) {
        const match = line.slice(0, m.index).trim()
        const odds = num(m[1])
        if (match.length >= 3 && /[a-zăâîșț]/i.test(match) && odds > 1 && odds < 100) {
          selections.push(classify({ match, market: match, odds }))
        }
      }
    }
    i += 1
  }
  return resolveAmbiguousSports(selections)
}

function parseSuperbetBlock(block, header) {
  const competition = block[0] ?? ''
  const body = block.slice(1)

  let oddsIdx = -1
  for (let k = body.length - 1; k >= 0; k--) {
    if (isOddLine(body[k])) { oddsIdx = k; break }
  }
  if (oddsIdx < 2) return null

  const odds = num(body[oddsIdx])
  const market = body[oddsIdx - 1]
  const pick = body[oddsIdx - 2]
  const beforePick = body.slice(0, oddsIdx - 2)
  const teams = beforePick.filter(
    (l) => !/^adaug[ăa]$/i.test(l) && !isDateLine(l) && !/^\d+$/.test(l) && !isOddLine(l),
  )
  if (teams.length < 2) return null
  // meci încheiat: două linii cu numere întregi după echipe = scorul final
  const ints = beforePick.filter((l) => /^\d+$/.test(l)).map(Number)
  const score = ints.length === 2 ? ints : undefined

  const ctx = `${header} ${competition}`
  let sportHint = 'fotbal'
  if (/nba|baschet|euroliga/i.test(ctx)) sportHint = 'baschet'
  else if (/mlb|baseball/i.test(ctx)) sportHint = 'baseball'
  else if (/atp|wta|tenis/i.test(ctx)) sportHint = 'tenis'

  return {
    match: `${teams[teams.length - 2]} vs ${teams[teams.length - 1]}`,
    market: `${market}: ${pick}`,
    odds,
    sportHint,
    score,
  }
}

function classify({ match, market, odds, sportHint }) {
  const m = norm(market)
  const hint = sportHint ? norm(sportHint) : ''

  let sport
  let sportSource = 'sure'
  if (hint.includes('tenis')) sport = 'tenis'
  else if (hint.includes('basket') || hint.includes('baschet')) sport = 'baschet'
  else if (hint.includes('baseball')) sport = 'baseball'
  else if (hint.includes('fotbal')) sport = 'fotbal'
  else if (/asi|aces|duble|double fault|tiebreak|sa castige un set|castige un set|handicap meci \(set\)/.test(m)) sport = 'tenis'
  else if (/puncte|nba|baschet/.test(m)) sport = 'baschet'
  else if (/mlb|baseball|home run|inning/.test(m)) sport = 'baseball'
  else if (/goluri|gg\s*nu|ngg|1x2|sansa dubla|corner|cartonas/.test(m)) sport = 'fotbal'
  else if (findKey(GRASS_ELO, match)) sport = 'tenis'
  else {
    sport = 'fotbal'
    sportSource = 'default'
  }

  let marketType = 'altele'
  if (/under\s*2[.,]5|sub\s*2[.,]5|2[.,]5\s*(sub|under)/.test(m)) marketType = 'under25'
  else if (/gg\s*nu|ngg|nu marcheaza ambele/.test(m)) marketType = 'ggnu'
  else if (/asi|aces/.test(m)) marketType = 'prop_asi'
  else if (/duble|double fault/.test(m)) marketType = 'prop_duble'
  else if (/handicap.*set|set.*handicap/.test(m)) marketType = 'handicap_set'
  else if (/castige un set/.test(m)) marketType = 'castiga_set'
  else if (/sansa dubla/.test(m)) marketType = 'sansa_dubla'
  else if (/castigator|winner|victorie|final|ml\b|^1x2/.test(m)) marketType = 'winner'
  else if (/peste|over/.test(m)) marketType = 'over'

  return { id: hash(match + market + odds), match, market, odds, sport, marketType, sportSource }
}

// Selecțiile cu sport incert moștenesc sportul majoritar al biletului
// (ex: jucători de tenis necunoscuți pe un bilet altfel plin de tenis).
function resolveAmbiguousSports(selections) {
  const counts = {}
  for (const s of selections) {
    if (s.sportSource === 'sure') counts[s.sport] = (counts[s.sport] || 0) + 1
  }
  const majority = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
  if (majority) {
    for (const s of selections) {
      if (s.sportSource === 'default') s.sport = majority
    }
  }
  return selections
}

// ─── Detectare bilet finalizat (status + miză) ──────────────────────────────

export function detectTicketMeta(raw) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  let status = null
  let stake = null
  let totalOdds = null
  const nextNumber = (i) => {
    const m = lines[i + 1]?.match(/^(\d+(?:[.,]\d{1,2})?)$/)
    return m ? num(m[1]) : null
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (status === null) {
      if (/^pierdut$/i.test(l)) status = 'Pierdut'
      else if (/^c[âa][șs]tigat$/i.test(l)) status = 'Câștigat'
    }
    if (stake === null) {
      const m = l.match(/^(\d+(?:[.,]\d{1,2})?)\s*(lei|ron)$/i)
      if (m && num(m[1]) > 0) stake = num(m[1])
      // Superbet: "Bani reali" / "50.00" / "RON" pe linii separate
      else if (/^bani reali$|^miz[ăa]$/i.test(l)) stake = nextNumber(i)
    }
    if (totalOdds === null && /^cot[ăa] total[ăa]$/i.test(l)) totalOdds = nextNumber(i)
  }
  if (status === null && stake === null && totalOdds === null) return null
  return { status: status ?? 'În așteptare', stake, totalOdds }
}

// ─── Analiză per selecție ───────────────────────────────────────────────────

export function analyzeSelection(sel, statsDb = null) {
  const implied = 1 / sel.odds
  const reasons = []
  let modelProb
  let engine

  if (sel.sport === 'tenis') {
    if (sel.marketType === 'prop_asi' || sel.marketType === 'prop_duble') {
      engine = 'Statistici Serviciu'
      modelProb = serveModel(sel)
      reasons.push('Prop evaluat pe statistici de serviciu (NU pe Elo).')
    } else if (sel.marketType === 'handicap_set' || sel.marketType === 'castiga_set') {
      engine = 'Grass Elo (Seturi)'
      modelProb = setMarketModel(sel)
      reasons.push('Probabilitate pe seturi derivată din Grass Elo.')
    } else {
      engine = 'Grass Elo'
      modelProb = grassEloModel(sel)
    }
  } else if (sel.sport === 'baschet') {
    engine = 'Model Baschet'
    modelProb = clamp(implied + 0.03 + jitter(sel.match, 0.025), 0.05, 0.95)
  } else if (sel.sport === 'baseball') {
    engine = 'Model Baseball'
    modelProb = clamp(implied + 0.025 + jitter(sel.match, 0.025), 0.05, 0.95)
  } else if (statsDb && (() => { const r = footballStatsModel(sel, statsDb); if (r) { modelProb = r.prob; engine = 'Poisson (statistici reale)'; reasons.push(...r.notes) } return !!r })()) {
    // probabilitate calculată din statisticile reale ale echipelor
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

function pickedPlayerProb(sel) {
  const players = sel.match.split(/\s+(?:vs|v)\s+|\s+-\s+/i).map((p) => p.trim())
  const [p1 = sel.match, p2 = ''] = players
  const eloOf = (name) => {
    const key = findKey(GRASS_ELO, name)
    return key ? GRASS_ELO[key] : 1900 + jitter(name, 60)
  }
  // Selecția pariată: jucătorul menționat în piață, altfel primul.
  const pickedIsP2 = p2 && norm(sel.market).includes(norm(p2).split(' ')[0])
  const [me, opp] = pickedIsP2 ? [p2, p1] : [p1, p2 || p1]
  return 1 / (1 + Math.pow(10, (eloOf(opp) - eloOf(me)) / 400))
}

function grassEloModel(sel) {
  return clamp(pickedPlayerProb(sel) + jitter(sel.match, 0.02), 0.05, 0.95)
}

function setMarketModel(sel) {
  const pMatch = pickedPlayerProb(sel)
  const pSet = clamp(0.5 + (pMatch - 0.5) * 0.75, 0.05, 0.95)
  const minus = /-\s*1[.,]5/.test(sel.market)
  // -1.5 seturi = câștigă 2-0; +1.5 / câștigă un set = ia măcar un set
  const prob = minus ? pSet * pSet : 1 - (1 - pSet) * (1 - pSet)
  return clamp(prob + jitter(sel.match, 0.02), 0.03, 0.97)
}

function serveModel(sel) {
  const lineMatch = sel.market.match(/(\d+[.,]\d+)/)
  const line = lineMatch ? parseFloat(lineMatch[1].replace(',', '.')) : 10.5
  const key = findKey(SERVE_STATS, sel.market) || findKey(SERVE_STATS, sel.match)
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

// ─── Validare selecții pe baza scorului final ───────────────────────────────
// Returnează 'Câștigat' / 'Pierdut' sau null dacă piața nu poate fi decisă
// automat din scor (ex: game-uri/asi la tenis când scorul e pe seturi).

export function settleSelection(sel) {
  if (!sel.score) return null
  const [a, b] = sel.score
  const m = norm(sel.market)
  const pick = (m.split(':').pop() || '').trim()
  const sides = sel.match.split(/\s+(?:vs|v)\s+|\s+-\s+/i).map((p) => norm(p.trim()))
  const [p1 = '', p2 = ''] = sides
  const sideOf = (text) => {
    if (p2 && text.includes(p2)) return 1
    if (p1 && text.includes(p1)) return 0
    if (p2 && p2.split(' ').some((w) => w.length > 3 && text.includes(w))) return 1
    if (p1 && p1.split(' ').some((w) => w.length > 3 && text.includes(w))) return 0
    return -1
  }
  const res = (ok) => (ok ? 'Câștigat' : 'Pierdut')

  if (sel.sport === 'tenis') {
    const side = sideOf(m)
    if (side === -1) return null
    const me = sel.score[side]
    const opp = sel.score[1 - side]
    // "Câștigător set (Set N)" nu se poate decide din scorul final pe seturi
    if (sel.marketType === 'winner') {
      if (/castigator set|set \d/.test(m)) return null
      return res(me > opp)
    }
    if (sel.marketType === 'castiga_set') {
      const yes = me >= 1
      return res(/\bnu$/.test(pick) ? !yes : yes)
    }
    if (sel.marketType === 'handicap_set') {
      const h = /-\s*1[.,]5/.test(m) ? -1.5 : 1.5
      return res(me + h > opp)
    }
    return null
  }

  if (sel.sport !== 'fotbal') return null
  // Cornere, șuturi, salvări, reprize, props de jucător — nu se pot decide
  // din scorul final; rămân pe validare manuală.
  if (/cornere|corner|sutur|mingi salvate|repriz[ăa]|cartonas|jucator|player/.test(m)) return null
  const total = a + b

  if (/gg sau peste 2[.,]5/.test(m)) {
    const yes = (a > 0 && b > 0) || total > 2.5
    return res(/\bnu$/.test(pick) ? !yes : yes)
  }
  if (/gg sau egalitate/.test(m)) {
    const yes = (a > 0 && b > 0) || a === b
    return res(/\bnu$/.test(pick) ? !yes : yes)
  }

  // Combo "1X2 & Total goluri": ambele condiții trebuie să fie adevărate
  if (/1x2\s*&\s*total/.test(m)) {
    const token = pick.split('&')[0].trim()
    const winPart = token === '1' ? a > b : token === '2' ? b > a : a === b
    const ou = m.match(/(peste|over|sub|under)\s*(\d+[.,]5)/)
    if (!ou) return null
    const line = num(ou[2])
    const totalPart = ou[1] === 'sub' || ou[1] === 'under' ? total < line : total > line
    return res(winPart && totalPart)
  }
  if (/ambele(?:\s+\S+)* inscriu sau peste 2[.,]5/.test(m)) {
    const yes = (a > 0 && b > 0) || total > 2.5
    return res(/\bnu$/.test(pick) ? !yes : yes)
  }
  if (sel.marketType === 'ggnu') return res(!(a > 0 && b > 0))
  if (/\bgg\b|ambele(?:\s+\S+)* inscriu/.test(m)) {
    const yes = a > 0 && b > 0
    return res(/\bnu$/.test(pick) ? !yes : yes)
  }
  // Ambele ordini: "Peste 2.5" și "2.5 PESTE"
  const ou = m.match(/(peste|over|sub|under)\s*(\d+[.,]5)/)
  const ou2 = ou ? null : m.match(/(\d+[.,]5)\s*(peste|over|sub|under)/)
  if (ou || ou2) {
    const line = num(ou ? ou[2] : ou2[1])
    const dir = ou ? ou[1] : ou2[2]
    // dacă piața numește o echipă ("Maroc - Total goluri"), se ia doar scorul ei
    const side = sideOf(m.split(':')[0])
    const value = side === -1 ? total : sel.score[side]
    return res(dir === 'sub' || dir === 'under' ? value < line : value > line)
  }
  if (sel.marketType === 'sansa_dubla') {
    if (pick.includes('1x')) return res(a >= b)
    if (pick.includes('x2')) return res(b >= a)
    if (pick.includes('12')) return res(a !== b)
    return null
  }
  if (sel.marketType === 'winner') {
    // "1 (Mexic)" → token "1"
    const token = pick.split(/[\s(]+/)[0]
    if (token === '1') return res(a > b)
    if (token === '2') return res(b > a)
    if (token === 'x') return res(a === b)
    const side = sideOf(pick)
    return side === -1 ? null : res(sel.score[side] > sel.score[1 - side])
  }
  return null
}

// Rezultatul unei selecții: bifa manuală a utilizatorului are prioritate,
// apoi decizia automată din scor.
export const selectionOutcome = (s) => s.manual ?? settleSelection(s)

// ─── Rezultate lipite manual ("Echipa1 - Echipa2 2-1") ─────────────────────

export function parseResults(raw) {
  const results = []
  for (const line of raw.split('\n')) {
    const t = line.trim()
    const sc = t.match(/(\d+)\s*[-:]\s*(\d+)\s*$/)
    if (!sc || sc.index === 0) continue
    const teams = t
      .slice(0, sc.index)
      .replace(/[|,]/g, ' ')
      .split(/\s+(?:vs|v)\s+|\s+-\s+/i)
      .map((x) => x.trim())
      .filter(Boolean)
    if (teams.length < 2) continue
    results.push({ t1: teams[0], t2: teams[1], s1: Number(sc[1]), s2: Number(sc[2]) })
  }
  return results
}

export function applyResultsToBet(bet, results) {
  const selections = bet.selections.map((s) => {
    if (s.score) return s
    const r = results.find(
      (r) => norm(s.match).includes(norm(r.t1)) && norm(s.match).includes(norm(r.t2)),
    )
    if (!r) return s
    const flipped = norm(s.match).indexOf(norm(r.t2)) < norm(s.match).indexOf(norm(r.t1))
    return { ...s, score: flipped ? [r.s2, r.s1] : [r.s1, r.s2] }
  })

  let status = bet.status
  if (status === 'În așteptare') {
    const outcomes = selections.map(selectionOutcome)
    if (outcomes.some((o) => o === 'Pierdut')) status = 'Pierdut'
    else if (outcomes.length && outcomes.every((o) => o === 'Câștigat')) status = 'Câștigat'
  }
  return { ...bet, selections, status }
}

// ─── Căutare rezultate online (TheSportsDB, gratuit) ────────────────────────
// Echipele sunt afișate în română la bookmakeri, dar baza de date e în
// engleză — traducem înainte de căutare.

const RO_EN_TEAMS = {
  'mexic': 'Mexico', 'africa de sud': 'South Africa', 'franta': 'France',
  'spania': 'Spain', 'anglia': 'England', 'olanda': 'Netherlands',
  'germania': 'Germany', 'elvetia': 'Switzerland', 'brazilia': 'Brazil',
  'maroc': 'Morocco', 'scotia': 'Scotland', 'norvegia': 'Norway',
  'irak': 'Iraq', 'algeria': 'Algeria', 'iordania': 'Jordan',
  'portugalia': 'Portugal', 'rd congo': 'DR Congo', 'croatia': 'Croatia',
  'columbia': 'Colombia', 'bosnia si hertegovina': 'Bosnia and Herzegovina',
  'bosnia-hertegovina': 'Bosnia and Herzegovina', 'haiti': 'Haiti',
  'coasta de fildes': 'Ivory Coast', 'arabia saudita': 'Saudi Arabia',
  'belgia': 'Belgium', 'ghana': 'Ghana', 'noua zeelanda': 'New Zealand',
  'japonia': 'Japan', 'coreea de sud': 'South Korea', 'cehia': 'Czech Republic',
  'suedia': 'Sweden', 'tunisia': 'Tunisia', 'capul verde': 'Cape Verde',
  'sua': 'USA', 'turcia': 'Turkey', 'grecia': 'Greece', 'polonia': 'Poland',
  'ungaria': 'Hungary', 'rusia': 'Russia', 'ucraina': 'Ukraine',
  'danemarca': 'Denmark', 'finlanda': 'Finland', 'irlanda': 'Ireland',
}

export const splitMatch = (match) =>
  match.split(/\s+(?:vs|v)\s+|\s+-\s+/i).map((t) => t.trim()).filter(Boolean)

// Returnează { score, finished } — finished=false înseamnă meci în desfășurare
// (scor live, biletul NU se decide încă).
export async function fetchScoreOnline(sel, { apiFootballKey } = {}) {
  // Tenis: căutarea după numele exact al evenimentului eșuează des —
  // se folosește lista meciurilor pe zile, potrivită după numele jucătorilor.
  if (sel.sport === 'tenis') {
    const r = await fetchScoreTennis(sel).catch(() => null)
    if (r) return r
  }
  // API-Football (cheie proprie) are acoperire mai bună — încercat primul
  if (apiFootballKey && sel.sport === 'fotbal') {
    const r = await fetchScoreApiFootball(sel, apiFootballKey).catch(() => null)
    if (r) return r
  }
  const score = await fetchScoreSportsDb(sel)
  return score ? { score, finished: true } : null
}

// ─── Tenis: lista meciurilor pe zi, cache 3 minute ──────────────────────────

const tennisDayCache = new Map()
const TENNIS_CACHE_TTL = 3 * 60 * 1000

function tennisEventsForDate(dateStr) {
  const cached = tennisDayCache.get(dateStr)
  if (cached && Date.now() - cached.at < TENNIS_CACHE_TTL) return cached.promise
  const promise = (async () => {
    const resp = await fetch(
      `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${dateStr}&s=Tennis`,
    )
    if (!resp.ok) return []
    return (await resp.json())?.events ?? []
  })().catch(() => [])
  tennisDayCache.set(dateStr, { at: Date.now(), promise })
  return promise
}

const lastName = (p) => {
  const words = norm(p).replace(/,/g, ' ').split(/\s+/).filter((w) => w.length > 2)
  return words[words.length - 1] ?? norm(p)
}

async function fetchScoreTennis(sel) {
  const players = splitMatch(sel.match)
  if (players.length < 2) return null
  const [l1, l2] = players.map(lastName)
  for (let back = 0; back < 4; back++) {
    const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)
    const events = await tennisEventsForDate(d)
    const ev = events.find((e) => {
      const text = norm(`${e.strHomeTeam ?? ''} ${e.strAwayTeam ?? ''} ${e.strEvent ?? ''}`)
      return text.includes(l1) && text.includes(l2)
    })
    if (!ev) continue
    if (ev.intHomeScore == null || ev.intAwayScore == null) continue
    const score = [Number(ev.intHomeScore), Number(ev.intAwayScore)]
    // orientare: jucătorul 1 din bilet e "acasă" în eveniment?
    const home = norm(ev.strHomeTeam ?? '')
    let firstIsHome
    if (home) firstIsHome = home.includes(l1)
    else {
      const evText = norm(ev.strEvent ?? '')
      firstIsHome = evText.indexOf(l1) <= evText.indexOf(l2)
    }
    // PRUDENT: un meci e considerat încheiat doar cu confirmare explicită
    // SAU dacă scorul pe seturi arată complet (cineva are 2 seturi, best-of-3).
    // Status gol + scor parțial (1-0, 1-1) = meci în desfășurare, NU se decide.
    const status = ev.strStatus ?? ''
    const explicitFinished = /finished|\bft\b|ended|aet|retired|walkover/i.test(status)
    const explicitLive = /live|progress|set\b|1st|2nd|3rd|4th|5th|\bht\b/i.test(status)
    const looksComplete = Math.max(score[0], score[1]) >= 2 && score[0] !== score[1]
    const finished = explicitFinished || (!explicitLive && looksComplete)
    return { score: firstIsHome ? score : [score[1], score[0]], finished }
  }
  return null
}

async function fetchScoreSportsDb(sel) {
  const teams = splitMatch(sel.match)
  if (teams.length < 2) return null
  const en = teams.map((t) => RO_EN_TEAMS[norm(t)] ?? t)
  const url =
    'https://www.thesportsdb.com/api/v1/json/123/searchevents.php?e=' +
    encodeURIComponent(`${en[0]} vs ${en[1]}`)
  const resp = await fetch(url)
  if (!resp.ok) return null
  const data = await resp.json()
  // doar evenimente din ultimele 7 zile — altfel riscăm să luăm o
  // întâlnire veche dintre aceleași echipe drept rezultatul curent
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const finished = (data?.event ?? []).filter(
    (e) => e.intHomeScore != null && e.intAwayScore != null && (e.dateEvent ?? '') >= cutoff,
  )
  if (!finished.length) return null
  finished.sort((a, b) => (b.dateEvent ?? '').localeCompare(a.dateEvent ?? ''))
  const ev = finished[0]
  const score = [Number(ev.intHomeScore), Number(ev.intAwayScore)]
  const home = norm(ev.strHomeTeam ?? '')
  const firstWord = norm(en[0]).split(' ')[0]
  const homeIsFirst = home.includes(firstWord) || norm(en[0]).includes(home)
  return homeIsFirst ? score : [score[1], score[0]]
}

async function fetchScoreApiFootball(sel, key) {
  const teams = splitMatch(sel.match)
  if (teams.length < 2) return null
  const en = teams.map((t) => RO_EN_TEAMS[norm(t)] ?? t)
  const headers = { 'x-apisports-key': key }

  const tResp = await fetch(
    `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(en[0])}`,
    { headers },
  )
  if (!tResp.ok) return null
  const teamId = (await tResp.json())?.response?.[0]?.team?.id
  if (!teamId) return null

  const oppWord = norm(en[1]).split(' ')[0]
  const vsOpponent = (f) =>
    norm(f?.teams?.home?.name ?? '').includes(oppWord) ||
    norm(f?.teams?.away?.name ?? '').includes(oppWord)
  const orient = (fx) => {
    const homeIsFirst = norm(fx.teams.home.name).includes(norm(en[0]).split(' ')[0])
    return homeIsFirst ? [fx.goals.home, fx.goals.away] : [fx.goals.away, fx.goals.home]
  }

  const fResp = await fetch(
    `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=15`,
    { headers },
  )
  if (!fResp.ok) return null
  const fixtures = (await fResp.json())?.response ?? []
  const done = fixtures.find(
    (f) => ['FT', 'AET', 'PEN'].includes(f?.fixture?.status?.short) && vsOpponent(f),
  )
  if (done && done.goals?.home != null && done.goals?.away != null) {
    return { score: orient(done), finished: true }
  }

  // meci în desfășurare? scor live, fără decizie
  const lResp = await fetch(
    `https://v3.football.api-sports.io/fixtures?team=${teamId}&live=all`,
    { headers },
  ).catch(() => null)
  if (lResp?.ok) {
    const liveFx = ((await lResp.json())?.response ?? []).find(vsOpponent)
    if (liveFx && liveFx.goals?.home != null) {
      return { score: orient(liveFx), finished: false }
    }
  }
  return null
}

// ─── Meciuri reale (program oficial, TheSportsDB) ───────────────────────────
// Ia următoarele meciuri din Cupa Mondială și le pune în formatul de import.
// Cotele generate sunt orientative — utilizatorul le înlocuiește cu cele
// reale de la bookmaker.

const WORLD_CUP_LEAGUE_ID = 4429

export async function fetchUpcomingMatches() {
  const url = `https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=${WORLD_CUP_LEAGUE_ID}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('API-ul de program este indisponibil')
  const data = await resp.json()
  const events = data?.events ?? []
  if (!events.length) throw new Error('Niciun meci viitor găsit')
  return events.slice(0, 12).map((e, idx) => {
    const match = `${e.strHomeTeam} vs ${e.strAwayTeam}`
    const market = idx % 2 ? 'GG NU' : 'Under 2.5 Goluri'
    const p = 0.52 + jitter(match, 0.05)
    const odds = Math.max(1.5, Math.round((1.05 / p) * 100) / 100)
    return `${match} | ${market} | ${odds.toFixed(2)}`
  })
}

// ─── Statistici echipe (stil PlayerStats) + model Poisson ───────────────────
// Utilizatorul lipește tabelul copiat de pe un site de statistici; reținem
// media "pentru" (numărul mare) și "împotriva" (numărul mic) per indicator.

const STAT_LABELS = [
  { key: 'xgot', re: /^expected goals on target/i, skip: true },
  { key: 'xg', re: /^expected goals/i },
  { key: 'gol', re: /^goals?$/i },
  { key: 'corn', re: /^(total\s+)?corners?$/i },
  { key: 'sot', re: /^shots?\s*[-–]?\s*on target$/i },
  { key: 'sav', re: /^saves?$/i },
  { key: 'pos', re: /^possession$/i, percent: true },
]

export function parseTeamStats(raw) {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const teams = []
  let current = null
  const numsOf = (s) => (s.match(/\d+(?:[.,]\d+)?%?/g) ?? []).map((x) => num(x.replace('%', '')))

  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/^(.+?)\s+Stats$/i)
    if (header) {
      current = { team: header[1].trim(), stats: {} }
      teams.push(current)
      continue
    }
    if (!current) continue
    const label = STAT_LABELS.find((l) => l.re.test(lines[i]))
    if (!label) continue
    // numerele pot fi pe aceeași linie sau pe liniile următoare
    let nums = numsOf(lines[i].replace(label.re, ''))
    let j = i + 1
    while (nums.length < 2 && j < lines.length && numsOf(lines[j]).length > 0 && !/[a-z]{3,}/i.test(lines[j].replace(/%/g, ''))) {
      nums = nums.concat(numsOf(lines[j]))
      j += 1
    }
    if (label.skip || nums.length === 0) continue
    const scale = label.percent ? 0.01 : 1
    current.stats[`${label.key}For`] = nums[0] * scale
    if (nums[1] != null) current.stats[`${label.key}Ag`] = nums[1] * scale
  }
  return teams.filter((t) => Object.keys(t.stats).length > 0)
}

export const statsKeyFor = (teamName) => norm(teamName)

// nume alternative frecvente (bilete RO vs. site-uri de statistici EN)
const TEAM_ALIASES = {
  'sua': 'united states', 'usa': 'united states',
  'olanda': 'netherlands', 'tarile de jos': 'netherlands',
  'coreea de sud': 'south korea', 'anglia': 'england',
}

export function lookupTeamStats(statsDb, teamName) {
  if (!statsDb) return null
  const tryKeys = []
  const n = norm(teamName)
  tryKeys.push(n)
  if (TEAM_ALIASES[n]) tryKeys.push(TEAM_ALIASES[n])
  const en = RO_EN_TEAMS[n]
  if (en) {
    tryKeys.push(norm(en))
    if (TEAM_ALIASES[norm(en)]) tryKeys.push(TEAM_ALIASES[norm(en)])
  }
  for (const k of tryKeys) if (statsDb[k]) return statsDb[k]
  // și invers: în bilet e numele englez, în baza de date cel românesc
  for (const [ro, enName] of Object.entries(RO_EN_TEAMS)) {
    if (norm(enName) === n && statsDb[ro]) return statsDb[ro]
  }
  return null
}

// Poisson
const factCache = [1]
const fact = (k) => factCache[k] ?? (factCache[k] = k * fact(k - 1))
const poissonPmf = (l, k) => (Math.exp(-l) * Math.pow(l, k)) / fact(k)
const poissonCdf = (l, k) => {
  let s = 0
  for (let i = 0; i <= k; i++) s += poissonPmf(l, i)
  return s
}

// Modelul real: probabilități din mediile celor două echipe.
// Returnează null când piața nu e acoperită sau lipsesc datele.
export function footballStatsModel(sel, statsDb) {
  const teams = splitMatch(sel.match)
  if (teams.length < 2) return null
  const A = lookupTeamStats(statsDb, teams[0])
  const B = lookupTeamStats(statsDb, teams[1])
  if (!A || !B) return null
  const m = norm(sel.market)
  const pick = (m.split(':').pop() || '').trim()

  const lam = (forA, agB) => (forA != null && agB != null ? (forA + agB) / 2 : forA)
  // atac echipă temperat de apărarea adversarului (xG dacă există, altfel goluri)
  const lamGoals = (S, O) => lam(S.xgFor ?? S.golFor, O.xgAg ?? O.golAg)
  const l1 = lamGoals(A, B)
  const l2 = lamGoals(B, A)
  if (l1 == null || l2 == null) return null

  const clampP = (p) => clamp(p, 0.03, 0.97)
  const lineMatch = m.match(/(\d+)[.,]5/)
  const line = lineMatch ? Number(lineMatch[1]) : null
  const isUnder = /sub|under/.test(pick) || /(sub|under)\s*\d+[.,]5/.test(m)
  const note = (txt) => [`Model Poisson pe statistici reale: ${txt}`]

  // domeniu statistic: cornere / șuturi pe poartă / salvări / goluri
  const domain = /cornere|corner/.test(m) ? 'corn' : /sutur.*poarta|on target/.test(m) ? 'sot' : /mingi salvate|saves/.test(m) ? 'sav' : 'gol'

  if (domain !== 'gol') {
    if (line == null) return null
    const dFor = (S) => S[`${domain}For`]
    const dAg = (S) => S[`${domain}Ag`]
    if (dFor(A) == null || dFor(B) == null) return null
    const sideIdx = (() => {
      const name = m.split(':')[0]
      if (norm(teams[1]) && name.includes(norm(teams[1]))) return 1
      if (norm(teams[0]) && name.includes(norm(teams[0]))) return 0
      return -1
    })()
    const lamStat = sideIdx === -1
      ? lam(dFor(A), dAg(B)) + lam(dFor(B), dAg(A))
      : lam(dFor(sideIdx === 0 ? A : B), dAg(sideIdx === 0 ? B : A))
    const pOver = 1 - poissonCdf(lamStat, line)
    return { prob: clampP(isUnder ? 1 - pOver : pOver), notes: note(`λ=${lamStat.toFixed(2)} pentru linia ${line}.5`) }
  }

  // goluri: distribuție dublă Poisson
  const P1 = [], P2 = []
  for (let k = 0; k <= 10; k++) { P1.push(poissonPmf(l1, k)); P2.push(poissonPmf(l2, k)) }
  let pHome = 0, pDraw = 0, pAway = 0
  const totalDist = new Array(21).fill(0)
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    const p = P1[a] * P2[b]
    totalDist[a + b] += p
    if (a > b) pHome += p
    else if (a === b) pDraw += p
    else pAway += p
  }
  const pTotalOver = (ln) => { let s = 0; for (let t = ln + 1; t <= 20; t++) s += totalDist[t]; return s }
  const pGG = (1 - Math.exp(-l1)) * (1 - Math.exp(-l2))
  const baseNote = `λ ${teams[0]} ${l1.toFixed(2)} · λ ${teams[1]} ${l2.toFixed(2)}`

  if (sel.marketType === 'under25') return { prob: clampP(1 - pTotalOver(2)), notes: note(baseNote) }
  if (sel.marketType === 'ggnu') return { prob: clampP(1 - pGG), notes: note(baseNote) }
  if (/gg sau peste 2[.,]5/.test(m)) {
    const yes = pGG + pTotalOver(2) - pGG * pTotalOver(2)
    return { prob: clampP(/\bnu$/.test(pick) ? 1 - yes : yes), notes: note(baseNote) }
  }
  if (/gg sau egalitate/.test(m)) {
    const yes = pGG + pDraw - pGG * pDraw
    return { prob: clampP(/\bnu$/.test(pick) ? 1 - yes : yes), notes: note(baseNote) }
  }
  if (/\bgg\b|ambele(?:\s+\S+)* inscriu/.test(m)) {
    return { prob: clampP(/\bnu$/.test(pick) ? 1 - pGG : pGG), notes: note(baseNote) }
  }
  if (sel.marketType === 'sansa_dubla') {
    if (pick.includes('1x')) return { prob: clampP(pHome + pDraw), notes: note(baseNote) }
    if (pick.includes('x2')) return { prob: clampP(pAway + pDraw), notes: note(baseNote) }
    if (pick.includes('12')) return { prob: clampP(pHome + pAway), notes: note(baseNote) }
    return null
  }
  if (sel.marketType === 'winner') {
    const token = pick.split(/[\s(]+/)[0]
    if (token === '1') return { prob: clampP(pHome), notes: note(baseNote) }
    if (token === '2') return { prob: clampP(pAway), notes: note(baseNote) }
    if (token === 'x') return { prob: clampP(pDraw), notes: note(baseNote) }
    if (pick.includes(norm(teams[0]))) return { prob: clampP(pHome), notes: note(baseNote) }
    if (pick.includes(norm(teams[1]))) return { prob: clampP(pAway), notes: note(baseNote) }
    return null
  }
  if (line != null) {
    // total goluri / goluri echipă cu linie
    const name = m.split(':')[0]
    const teamIdx = norm(teams[1]) && name.includes(norm(teams[1])) ? 1 : norm(teams[0]) && name.includes(norm(teams[0])) ? 0 : -1
    if (teamIdx === -1) {
      const pOver = pTotalOver(line)
      return { prob: clampP(isUnder ? 1 - pOver : pOver), notes: note(baseNote) }
    }
    const lt = teamIdx === 0 ? l1 : l2
    const pOver = 1 - poissonCdf(lt, line)
    return { prob: clampP(isUnder ? 1 - pOver : pOver), notes: note(`λ ${teams[teamIdx]} ${lt.toFixed(2)}`) }
  }
  return null
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
