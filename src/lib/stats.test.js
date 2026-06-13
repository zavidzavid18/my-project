import { describe, expect, test } from 'vitest'
import {
  betKind,
  betProfit,
  betSport,
  breakdown,
  computeStreaks,
  filterByPeriod,
  oddsBand,
  overallStats,
  profitSeries,
} from './stats.js'

const bet = (status, miza, cota, ts, extra = {}) => ({
  status, miza, cotaTotala: cota, ts, selections: [], ...extra,
})

describe('betProfit', () => {
  test('câștig = miza × (cota − 1), pierdere = −miza, în așteptare = 0', () => {
    expect(betProfit(bet('Câștigat', 100, 2.5, 1))).toBe(150)
    expect(betProfit(bet('Pierdut', 100, 2.5, 1))).toBe(-100)
    expect(betProfit(bet('În așteptare', 100, 2.5, 1))).toBe(0)
  })
})

describe('overallStats', () => {
  test('profit, ROI și rata de câștig pe un istoric mic', () => {
    const bets = [
      bet('Câștigat', 100, 2, 1), // +100
      bet('Pierdut', 50, 3, 2),   // -50
      bet('În așteptare', 30, 2, 3),
    ]
    const st = overallStats(bets)
    expect(st.profit).toBe(50)
    expect(st.staked).toBe(150)
    expect(st.roi).toBeCloseTo((50 / 150) * 100)
    expect(st.winRate).toBe(50)
    expect(st.pendingCount).toBe(1)
    expect(st.biggestWin).toBe(100)
    expect(st.biggestLoss).toBe(-50)
  })
})

describe('computeStreaks', () => {
  test('seria curentă și cele mai lungi serii, în ordine cronologică', () => {
    const bets = [
      bet('Câștigat', 10, 2, 1),
      bet('Câștigat', 10, 2, 2),
      bet('Pierdut', 10, 2, 3),
      bet('Câștigat', 10, 2, 4),
      bet('Câștigat', 10, 2, 5),
      bet('Câștigat', 10, 2, 6),
    ]
    const s = computeStreaks(bets)
    expect(s.current).toEqual({ type: 'W', len: 3 })
    expect(s.bestWin).toBe(3)
    expect(s.worstLoss).toBe(1)
  })

  test('fără bilete decise nu există serie', () => {
    expect(computeStreaks([bet('În așteptare', 10, 2, 1)]).current.type).toBeNull()
  })
})

describe('profitSeries', () => {
  test('pornește din 0 și acumulează cronologic', () => {
    const bets = [
      bet('Pierdut', 50, 2, 2),
      bet('Câștigat', 100, 2, 1), // mai vechi — primul în serie
    ]
    expect(profitSeries(bets)).toEqual([0, 100, 50])
  })
})

describe('breakdown & clasificări', () => {
  test('grupează profitul pe cheia dată', () => {
    const bets = [
      bet('Câștigat', 100, 2, 1, { tip: 'Single' }),
      bet('Pierdut', 50, 2, 2, { tip: 'Single' }),
      bet('Pierdut', 30, 5, 3, { tip: 'Biletul Cota Mare' }),
    ]
    const rows = breakdown(bets, betKind)
    const single = rows.find((r) => r.key === 'Single')
    expect(single.profit).toBe(50)
    expect(single.won).toBe(1)
    expect(single.lost).toBe(1)
  })

  test('oddsBand încadrează corect limitele', () => {
    expect(oddsBand(1.99)).toBe('1.00 – 1.99')
    expect(oddsBand(2)).toBe('2.00 – 2.99')
    expect(oddsBand(4.99)).toBe('3.00 – 4.99')
    expect(oddsBand(5)).toBe('5.00+')
  })

  test('betSport ia sportul majoritar al selecțiilor', () => {
    const b = bet('Câștigat', 10, 2, 1, {
      selections: [{ sport: 'tenis' }, { sport: 'tenis' }, { sport: 'fotbal' }],
    })
    expect(betSport(b)).toBe('tenis')
  })
})

describe('filterByPeriod', () => {
  test('null = toate; 7 zile exclude biletele vechi', () => {
    const old = bet('Câștigat', 10, 2, Date.now() - 10 * 86400000)
    const recent = bet('Câștigat', 10, 2, Date.now() - 86400000)
    expect(filterByPeriod([old, recent], null)).toHaveLength(2)
    expect(filterByPeriod([old, recent], 7)).toEqual([recent])
  })
})
