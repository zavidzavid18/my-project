import { describe, expect, test } from 'vitest'
import {
  analyzeSelection,
  applyResultsToBet,
  buildSuggestions,
  DEMO_BET_TEXT,
  DEMO_TEAM_STATS,
  detectTicketMeta,
  footballStatsModel,
  isValueMarket,
  parseRawText,
  parseResults,
  parseTeamStats,
  selectionOutcome,
  settleSelection,
  splitMatch,
} from './engine.js'

// ─── Parser multi-format ─────────────────────────────────────────────────────

describe('parseRawText', () => {
  test('formatul simplu cu | produce selecția corectă', () => {
    // Arrange
    const raw = 'Mexic vs Africa de Sud | Under 2.5 Goluri | 1.80 | fotbal'

    // Act
    const sels = parseRawText(raw)

    // Assert
    expect(sels).toHaveLength(1)
    expect(sels[0].match).toBe('Mexic vs Africa de Sud')
    expect(sels[0].odds).toBe(1.8)
    expect(sels[0].sport).toBe('fotbal')
    expect(sels[0].marketType).toBe('under25')
  })

  test('blocul Betano cu scor atașează scorul selecției', () => {
    const raw = [
      'Bilet 1234',
      'sport-icon',
      'Sub 2.5',
      '1.85',
      'Total goluri',
      'Mexic - Africa de Sud',
      'Scor: 1-0',
    ].join('\n')

    const sels = parseRawText(raw)

    expect(sels).toHaveLength(1)
    expect(sels[0].score).toEqual([1, 0])
    expect(sels[0].market).toBe('Total goluri: Sub 2.5')
  })

  test('1X2 este clasificat ca winner', () => {
    const sels = parseRawText('Mexic vs Canada | 1X2: 1 | 1.95 | fotbal')
    expect(sels[0].marketType).toBe('winner')
  })

  test('piața de asi la tenis este clasificată prop_asi', () => {
    const sels = parseRawText('Hurkacz vs Medvedev | Total Asi Hurkacz: Peste 12.5 | 1.80 | tenis')
    expect(sels[0].sport).toBe('tenis')
    expect(sels[0].marketType).toBe('prop_asi')
  })

  test('„Total game-uri" e clasificat tenis + total_games, fără hint de sport', () => {
    const [s] = parseRawText('Hurkacz vs Griekspoor | Total game-uri: Peste 22.5 | 1.90')
    expect(s.sport).toBe('tenis')
    expect(s.marketType).toBe('total_games')
  })
})

describe('detectTicketMeta', () => {
  test('detectează miza și cota totală în stil Superbet', () => {
    const raw = ['Bani reali', '50.00', 'RON', 'Cotă totală', '3.18'].join('\n')
    expect(detectTicketMeta(raw)).toEqual({ status: 'În așteptare', stake: 50, totalOdds: 3.18 })
  })

  test('detectează statusul Pierdut', () => {
    const meta = detectTicketMeta('Pierdut\nCotă totală\n2.50')
    expect(meta.status).toBe('Pierdut')
  })

  test('text fără indicii de bilet întoarce null', () => {
    expect(detectTicketMeta('Mexic vs Canada | 1X2: 1 | 1.95')).toBeNull()
  })
})

// ─── Decizii din scorul final ────────────────────────────────────────────────

const sel = (over = {}) => ({
  id: 1,
  match: 'Mexic vs Canada',
  market: '1X2: 1',
  odds: 2,
  sport: 'fotbal',
  marketType: 'winner',
  score: [2, 1],
  ...over,
})

describe('settleSelection', () => {
  test('1X2: 1 câștigă cu scor 2-1', () => {
    expect(settleSelection(sel())).toBe('Câștigat')
  })

  test('1X2: 1 pierde la egalitate', () => {
    expect(settleSelection(sel({ score: [1, 1] }))).toBe('Pierdut')
  })

  test('Peste 2.5 câștigă la 2-1, Sub 2.5 pierde', () => {
    expect(settleSelection(sel({ market: 'Total goluri: Peste 2.5', marketType: 'over' }))).toBe('Câștigat')
    expect(settleSelection(sel({ market: 'Total goluri: Sub 2.5', marketType: 'under25' }))).toBe('Pierdut')
  })

  test('GG NU câștigă doar dacă nu marchează ambele', () => {
    expect(settleSelection(sel({ market: 'GG/NGG: GG NU', marketType: 'ggnu', score: [1, 0] }))).toBe('Câștigat')
    expect(settleSelection(sel({ market: 'GG/NGG: GG NU', marketType: 'ggnu', score: [1, 1] }))).toBe('Pierdut')
  })

  test('șansă dublă 1X câștigă la egalitate', () => {
    expect(settleSelection(sel({ market: 'Șansă dublă: 1X', marketType: 'sansa_dubla', score: [1, 1] }))).toBe('Câștigat')
  })

  test('cornerele nu se decid din scorul final', () => {
    expect(settleSelection(sel({ market: 'Cornere: Peste 8.5', marketType: 'over' }))).toBeNull()
  })

  test('tenis: câștigătorul meciului din scorul pe seturi', () => {
    const t = sel({ match: 'Alcaraz vs Djokovic', market: 'Câștigător Meci: Alcaraz', sport: 'tenis', score: [2, 0] })
    expect(settleSelection(t)).toBe('Câștigat')
    expect(settleSelection({ ...t, score: [0, 2] })).toBe('Pierdut')
  })

  test('bifa manuală a utilizatorului bate scorul', () => {
    expect(selectionOutcome(sel({ manual: 'Pierdut' }))).toBe('Pierdut')
  })
})

describe('parseResults + applyResultsToBet', () => {
  test('parsează linia „Echipa1 - Echipa2 2-1"', () => {
    expect(parseResults('Coreea de Sud - Cehia 2-1')).toEqual([
      { t1: 'Coreea de Sud', t2: 'Cehia', s1: 2, s2: 1 },
    ])
  })

  test('scorul se inversează când rezultatul e dat cu echipele inversate', () => {
    const bet = {
      status: 'În așteptare',
      selections: [sel({ score: undefined })],
    }
    const result = [{ t1: 'Canada', t2: 'Mexic', s1: 2, s2: 0 }]

    const updated = applyResultsToBet(bet, result)

    expect(updated.selections[0].score).toEqual([0, 2])
    expect(updated.status).toBe('Pierdut') // 1X2: 1 cu 0-2 = pierdut
  })

  test('biletul devine Câștigat doar când toate selecțiile au ieșit', () => {
    const bet = {
      status: 'În așteptare',
      selections: [sel({ score: undefined }), sel({ id: 2, match: 'Franța vs Brazilia', score: undefined })],
    }
    const partial = applyResultsToBet(bet, [{ t1: 'Mexic', t2: 'Canada', s1: 2, s2: 1 }])
    expect(partial.status).toBe('În așteptare')

    const full = applyResultsToBet(partial, [{ t1: 'Franța', t2: 'Brazilia', s1: 1, s2: 0 }])
    expect(full.status).toBe('Câștigat')
  })
})

// ─── Analiză & modele ────────────────────────────────────────────────────────

describe('analyzeSelection', () => {
  test('cota sub 1.50 primește PASS', () => {
    const [s] = parseRawText('Mexic vs Canada | Under 2.5 | 1.30 | fotbal')
    const a = analyzeSelection(s)
    expect(a.verdict).toBe('PASS')
    expect(a.reasons.join(' ')).toMatch(/1\.30.*1\.50/)
  })

  test('probabilitățile rămân în (0, 1)', () => {
    for (const line of [
      'Mexic vs Canada | Under 2.5 | 1.80 | fotbal',
      'Alcaraz vs Djokovic | Câștigător Meci: Alcaraz | 1.60 | tenis',
      'Hurkacz vs Fritz | Total Asi Hurkacz: Peste 12.5 | 1.85 | tenis',
    ]) {
      const a = analyzeSelection(parseRawText(line)[0])
      expect(a.modelProb).toBeGreaterThan(0)
      expect(a.modelProb).toBeLessThan(1)
    }
  })
})

describe('parseTeamStats + footballStatsModel', () => {
  // formatul real de copy/paste de pe PlayerStats: eticheta pe rândul ei,
  // valorile pe rândurile următoare (xG e singura potrivită ca prefix)
  const statsText = [
    'Paraguay Stats',
    'Goals', '0.86', '1.03',
    'Expected Goals (xG) 1.07 0.98',
    'Corners', '3.97', '4.45',
    'Mexico Stats',
    'Goals', '1.40', '1.10',
    'Expected Goals (xG) 1.35 1.05',
    'Corners', '5.10', '4.20',
  ].join('\n')

  test('parsează două echipe cu medii pentru/împotrivă', () => {
    const teams = parseTeamStats(statsText)
    expect(teams.map((t) => t.team)).toEqual(['Paraguay', 'Mexico'])
    expect(teams[0].stats.golFor).toBe(0.86)
    expect(teams[0].stats.golAg).toBe(1.03)
    expect(teams[0].stats.xgFor).toBe(1.07)
  })

  test('Under 2.5 și Peste 2.5 sunt complementare', () => {
    const db = {}
    for (const t of parseTeamStats(statsText)) db[t.team.toLowerCase()] = t.stats
    const under = footballStatsModel(parseRawText('Paraguay vs Mexico | Total goluri: Sub 2.5 | 1.80 | fotbal')[0], db)
    const over = footballStatsModel(parseRawText('Paraguay vs Mexico | Total goluri: Peste 2.5 | 2.00 | fotbal')[0], db)
    expect(under).not.toBeNull()
    expect(over).not.toBeNull()
    expect(under.prob + over.prob).toBeCloseTo(1, 5)
  })

  test('1X2: probabilitățile 1, X, 2 însumează 1', () => {
    const db = {}
    for (const t of parseTeamStats(statsText)) db[t.team.toLowerCase()] = t.stats
    const probs = ['1', 'x', '2'].map(
      (p) => footballStatsModel(parseRawText(`Paraguay vs Mexico | 1X2: ${p} | 2.00 | fotbal`)[0], db).prob,
    )
    expect(probs[0] + probs[1] + probs[2]).toBeCloseTo(1, 2)
  })

  test('meci complet necunoscut întoarce null (rămâne pe modelul generic)', () => {
    expect(footballStatsModel(parseRawText('A vs B | Under 2.5 | 1.80 | fotbal')[0], { ceva: {} })).toBeNull()
  })
})

// ─── Tenis: model Total game-uri ─────────────────────────────────────────────

describe('totalGamesModel (via analyzeSelection)', () => {
  const probFor = (line, side = 'Peste') =>
    analyzeSelection(parseRawText(`Hurkacz vs Griekspoor | Total game-uri: ${side} ${line} | 2.00 | tenis`)[0]).modelProb

  test('motorul „game-uri" e selectat și probabilitatea e în (0,1)', () => {
    const a = analyzeSelection(parseRawText('Hurkacz vs Griekspoor | Total game-uri: Peste 22.5 | 1.90 | tenis')[0])
    expect(a.engine).toMatch(/Game-uri/)
    expect(a.modelProb).toBeGreaterThan(0)
    expect(a.modelProb).toBeLessThan(1)
  })

  test('Peste și Sub pe aceeași linie sunt complementare', () => {
    expect(probFor(22.5, 'Peste') + probFor(22.5, 'Sub')).toBeCloseTo(1, 5)
  })

  test('o linie mai mare scade probabilitatea de „Peste"', () => {
    expect(probFor(26.5, 'Peste')).toBeLessThan(probFor(18.5, 'Peste'))
  })

  test('gap Elo mare (favorit clar) înclină spre Sub vs meci echilibrat', () => {
    // Alcaraz(2180) vs Giron(1900) — gap mare → meci scurt → „Peste" mai puțin probabil
    const lopsided = analyzeSelection(parseRawText('Alcaraz vs Giron | Total game-uri: Peste 22.5 | 2.00 | tenis')[0]).modelProb
    // Fritz(2010) vs Hurkacz(2005) — echilibru + servă mare → meci lung → „Peste" mai probabil
    const even = analyzeSelection(parseRawText('Fritz vs Hurkacz | Total game-uri: Peste 22.5 | 2.00 | tenis')[0]).modelProb
    expect(even).toBeGreaterThan(lopsided)
  })
})

// ─── Sugestii ────────────────────────────────────────────────────────────────

describe('isValueMarket & Cota Mare', () => {
  test('recunoaște GG NU, +1.5 seturi, câștigă un set și cotele mari', () => {
    expect(isValueMarket({ marketType: 'ggnu', market: 'GG NU', odds: 1.7 })).toBe(true)
    expect(isValueMarket({ marketType: 'handicap_set', market: 'Handicap seturi: X +1.5', odds: 1.6 })).toBe(true)
    expect(isValueMarket({ marketType: 'castiga_set', market: 'Câștigă un set', odds: 1.4 })).toBe(true)
    expect(isValueMarket({ marketType: 'winner', market: 'Final: X', odds: 2.4 })).toBe(true)
    expect(isValueMarket({ marketType: 'winner', market: 'Final: X', odds: 1.5 })).toBe(false)
  })

  test('Biletul Cota Mare urcă piețele de valoare în față', () => {
    const sel = (id, match, mt, market, odds, prob) => ({
      id, match, marketType: mt, market, odds, modelProb: prob, ev: prob * odds - 1, verdict: '+EV', sport: 'fotbal',
    })
    const analyzed = [
      sel(1, 'A vs B', 'winner', 'Final: A', 1.55, 0.7),     // favorit, NU value
      sel(2, 'C vs D', 'ggnu', 'GG NU', 2.2, 0.5),           // value
      sel(3, 'E vs F', 'handicap_set', 'Handicap: F +1.5', 2.1, 0.55), // value
      sel(4, 'G vs H', 'winner', 'Final: G', 1.6, 0.66),     // favorit
      sel(5, 'I vs J', 'castiga_set', 'Câștigă un set', 2.0, 0.55), // value
    ]
    const { cotaMare } = buildSuggestions(analyzed)
    expect(cotaMare).not.toBeNull()
    // primele selecții trebuie să fie piețele de valoare
    expect(isValueMarket(cotaMare.selections[0])).toBe(true)
    expect(isValueMarket(cotaMare.selections[1])).toBe(true)
  })
})

describe('date demo', () => {
  test('textul demo se parsează în selecții, inclusiv tenis +1.5 și total_games', () => {
    const sels = parseRawText(DEMO_BET_TEXT)
    expect(sels.length).toBeGreaterThanOrEqual(6)
    expect(sels.some((s) => s.marketType === 'total_games')).toBe(true)
    expect(sels.some((s) => s.marketType === 'handicap_set')).toBe(true)
  })

  test('cu statisticile demo, meciurile WC folosesc Poisson real', () => {
    const sels = parseRawText(DEMO_BET_TEXT).map((s) => analyzeSelection(s, DEMO_TEAM_STATS))
    const wc = sels.find((s) => s.match.includes('Mexic'))
    expect(wc.engine).toMatch(/Poisson/)
  })

  test('demo-ul produce cel puțin câteva selecții +EV', () => {
    const sels = parseRawText(DEMO_BET_TEXT).map((s) => analyzeSelection(s, DEMO_TEAM_STATS))
    expect(sels.filter((s) => s.verdict === '+EV').length).toBeGreaterThanOrEqual(2)
  })
})

describe('buildSuggestions', () => {
  const evSel = (id, match, prob, odds) => ({
    id, match, market: 'Piață', odds, modelProb: prob, ev: prob * odds - 1, verdict: '+EV', sport: 'fotbal',
  })

  test('biletele combinate nu repetă același meci', () => {
    const analyzed = [
      evSel(1, 'Mexic vs Canada', 0.6, 1.8),
      evSel(2, 'Mexic vs Canada', 0.58, 1.9),
      evSel(3, 'Franța vs Brazilia', 0.55, 1.85),
      evSel(4, 'Anglia vs Spania', 0.52, 1.95),
    ]
    const { sigur } = buildSuggestions(analyzed)
    const matches = sigur.selections.map((s) => s.match)
    expect(new Set(matches).size).toBe(matches.length)
  })

  test('cota totală este produsul cotelor', () => {
    const analyzed = [evSel(1, 'A vs B', 0.6, 2), evSel(2, 'C vs D', 0.6, 3)]
    const { sigur } = buildSuggestions(analyzed)
    expect(sigur.cotaTotala).toBeCloseTo(6)
  })
})

describe('splitMatch', () => {
  test('desparte pe vs și pe liniuță', () => {
    expect(splitMatch('Mexic vs Canada')).toEqual(['Mexic', 'Canada'])
    expect(splitMatch('Mexic - Canada')).toEqual(['Mexic', 'Canada'])
  })
})
