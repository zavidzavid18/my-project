// ─── Bancă & staking (criteriul Kelly) ───────────────────────────────────────

import { betProfit } from './stats.js'

export const DEFAULT_BANKROLL_START = 1000
export const DEFAULT_KELLY_DIVISOR = 4 // sfert-Kelly: standardul prudent în practică
export const MAX_STAKE_PCT = 0.05 // plafon de siguranță: max 5% din bancă pe un bilet

export const KELLY_PROFILES = [
  { divisor: 8, label: 'Kelly/8 — foarte prudent' },
  { divisor: 4, label: 'Kelly/4 — echilibrat (recomandat)' },
  { divisor: 2, label: 'Kelly/2 — agresiv' },
]

// Fracția din bancă justificată matematic de avantaj (0 când nu există edge)
export const kellyPct = (prob, odds) => {
  if (!(odds > 1) || !(prob > 0) || prob >= 1) return 0
  const b = odds - 1
  return Math.max(0, (prob * b - (1 - prob)) / b)
}

// Miza recomandată: Kelly fracționat, plafonat la MAX_STAKE_PCT din bancă
export const recommendedStake = (prob, odds, bankroll, kellyDivisor = DEFAULT_KELLY_DIVISOR) => {
  if (!(bankroll > 0)) return 0
  const pct = Math.min(kellyPct(prob, odds) / kellyDivisor, MAX_STAKE_PCT)
  return Math.round(bankroll * pct)
}

// Banca actuală = banca de start + profitul net al biletelor decise
export const currentBankroll = (start, bets) =>
  start + bets.reduce((a, b) => a + betProfit(b), 0)

// Bani blocați în biletele încă nedecise
export const pendingStake = (bets) =>
  bets.filter((b) => b.status === 'În așteptare').reduce((a, b) => a + b.miza, 0)
