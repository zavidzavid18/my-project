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
      if (parsed) selections.push(classify(parsed))
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
  const teams = body
    .slice(0, oddsIdx - 2)
    .filter((l) => !/^adaug[ăa]$/i.test(l) && !isDateLine(l) && !/^\d+$/.test(l) && !isOddLine(l))
  if (teams.length < 2) return null

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
  for (const l of lines) {
    if (status === null) {
      if (/^pierdut$/i.test(l)) status = 'Pierdut'
      else if (/^c[âa][șs]tigat$/i.test(l)) status = 'Câștigat'
    }
    if (stake === null) {
      const m = l.match(/^(\d+(?:[.,]\d{1,2})?)\s*(lei|ron)$/i)
      if (m && num(m[1]) > 0) stake = num(m[1])
    }
  }
  if (status === null && stake === null) return null
  return { status: status ?? 'În așteptare', stake }
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
    const outcomes = selections.map(settleSelection)
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

export async function fetchScoreOnline(sel, { apiFootballKey } = {}) {
  // API-Football (cheie proprie) are acoperire mai bună — încercat primul
  if (apiFootballKey && sel.sport === 'fotbal') {
    const score = await fetchScoreApiFootball(sel, apiFootballKey).catch(() => null)
    if (score) return score
  }
  return fetchScoreSportsDb(sel)
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
  const finished = (data?.event ?? []).filter(
    (e) => e.intHomeScore != null && e.intAwayScore != null,
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

  const fResp = await fetch(
    `https://v3.football.api-sports.io/fixtures?team=${teamId}&last=15`,
    { headers },
  )
  if (!fResp.ok) return null
  const fixtures = (await fResp.json())?.response ?? []
  const oppWord = norm(en[1]).split(' ')[0]
  const fx = fixtures.find(
    (f) =>
      ['FT', 'AET', 'PEN'].includes(f?.fixture?.status?.short) &&
      (norm(f?.teams?.home?.name ?? '').includes(oppWord) ||
        norm(f?.teams?.away?.name ?? '').includes(oppWord)),
  )
  if (!fx || fx.goals?.home == null || fx.goals?.away == null) return null
  const homeIsFirst = norm(fx.teams.home.name).includes(norm(en[0]).split(' ')[0])
  return homeIsFirst ? [fx.goals.home, fx.goals.away] : [fx.goals.away, fx.goals.home]
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
