// ─── Validarea backup-urilor importate (JSON nesigur) ────────────────────────
// Fișierul de backup vine de la utilizator — câmpurile intră direct în
// calculele de bancă/profit, deci tot ce nu e numeric valid se aruncă.

const BET_STATUSES = ['În așteptare', 'Câștigat', 'Pierdut']
const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v)
// cheile care ar putea atinge lanțul de prototipuri nu se copiază niciodată
const isSafeKey = (k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'

export const isValidBet = (b) =>
  !!b &&
  typeof b === 'object' &&
  isFiniteNum(b.id) &&
  isFiniteNum(b.miza) && b.miza > 0 &&
  isFiniteNum(b.cotaTotala) && b.cotaTotala >= 1 &&
  BET_STATUSES.includes(b.status) &&
  Array.isArray(b.selections)

// doar cheile cunoscute, cu tipul corect — restul se aruncă
export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  if (typeof raw.apiFootballKey === 'string') out.apiFootballKey = raw.apiFootballKey
  const start = Number(raw.bankrollStart)
  if (Number.isFinite(start) && start > 0) out.bankrollStart = start
  const kd = Number(raw.kellyDivisor)
  if (Number.isFinite(kd) && kd >= 1) out.kellyDivisor = kd
  return out
}

export function sanitizeTeamStats(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const [key, t] of Object.entries(raw)) {
    if (!isSafeKey(key)) continue
    if (!t || typeof t !== 'object' || typeof t.team !== 'string') continue
    if (!t.stats || typeof t.stats !== 'object') continue
    const stats = {}
    for (const [k, v] of Object.entries(t.stats)) {
      if (isSafeKey(k) && isFiniteNum(v)) stats[k] = v
    }
    if (Object.keys(stats).length) out[key] = { team: t.team, stats }
  }
  return out
}
