import { describe, expect, test } from 'vitest'
import { currentBankroll, kellyPct, MAX_STAKE_PCT, pendingStake, recommendedStake } from './bankroll.js'

describe('kellyPct', () => {
  test('formula clasică: (p·b − q) / b', () => {
    // p=0.55, cotă 2.00 → b=1 → (0.55 - 0.45) / 1 = 0.10
    expect(kellyPct(0.55, 2)).toBeCloseTo(0.1)
  })

  test('fără avantaj → 0, niciodată negativ', () => {
    expect(kellyPct(0.5, 2)).toBe(0)
    expect(kellyPct(0.3, 2)).toBe(0)
  })

  test('intrări degenerate → 0', () => {
    expect(kellyPct(0.5, 1)).toBe(0)
    expect(kellyPct(0, 2)).toBe(0)
    expect(kellyPct(1, 2)).toBe(0)
  })
})

describe('recommendedStake', () => {
  test('Kelly fracționat din bancă', () => {
    // Kelly plin 10%, divizor 4 → 2.5% din 1000 = 25
    expect(recommendedStake(0.55, 2, 1000, 4)).toBe(25)
  })

  test('plafonat la MAX_STAKE_PCT din bancă', () => {
    // edge uriaș: Kelly plin ar depăși plafonul
    const stake = recommendedStake(0.9, 3, 1000, 1)
    expect(stake).toBe(1000 * MAX_STAKE_PCT)
  })

  test('bancă invalidă → 0', () => {
    expect(recommendedStake(0.55, 2, 0, 4)).toBe(0)
  })
})

describe('currentBankroll & pendingStake', () => {
  const bets = [
    { status: 'Câștigat', miza: 100, cotaTotala: 2 },   // +100
    { status: 'Pierdut', miza: 40, cotaTotala: 3 },     // -40
    { status: 'În așteptare', miza: 25, cotaTotala: 2 }, // blocat
  ]

  test('banca actuală = start + profit net decis', () => {
    expect(currentBankroll(1000, bets)).toBe(1060)
  })

  test('mizele în așteptare sunt raportate ca „în joc"', () => {
    expect(pendingStake(bets)).toBe(25)
  })
})
