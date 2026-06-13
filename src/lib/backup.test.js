import { describe, expect, test } from 'vitest'
import { isValidBet, sanitizeSettings, sanitizeTeamStats } from './backup.js'

const goodBet = {
  id: 123.45,
  miza: 50,
  cotaTotala: 2.5,
  status: 'În așteptare',
  selections: [],
}

describe('isValidBet', () => {
  test('acceptă un bilet bine format', () => {
    expect(isValidBet(goodBet)).toBe(true)
  })

  test('respinge câmpurile numerice corupte', () => {
    expect(isValidBet({ ...goodBet, miza: 'abc' })).toBe(false)
    expect(isValidBet({ ...goodBet, miza: -5 })).toBe(false)
    expect(isValidBet({ ...goodBet, cotaTotala: NaN })).toBe(false)
    expect(isValidBet({ ...goodBet, cotaTotala: 0.5 })).toBe(false)
    expect(isValidBet({ ...goodBet, id: 'x' })).toBe(false)
  })

  test('respinge statusuri necunoscute și selecții lipsă', () => {
    expect(isValidBet({ ...goodBet, status: 'Hacked' })).toBe(false)
    expect(isValidBet({ ...goodBet, selections: 'nu-e-array' })).toBe(false)
    expect(isValidBet(null)).toBe(false)
    expect(isValidBet('text')).toBe(false)
  })
})

describe('sanitizeSettings', () => {
  test('păstrează doar cheile cunoscute cu tipuri valide', () => {
    const out = sanitizeSettings({
      apiFootballKey: 'cheie',
      bankrollStart: '2500',
      kellyDivisor: 4,
      malicious: 'x',
      isAdmin: true,
    })
    expect(out).toEqual({ apiFootballKey: 'cheie', bankrollStart: 2500, kellyDivisor: 4 })
  })

  test('aruncă valorile cu tip greșit', () => {
    expect(sanitizeSettings({ apiFootballKey: [1, 2], bankrollStart: -10, kellyDivisor: 0 })).toEqual({})
    expect(sanitizeSettings(null)).toEqual({})
    expect(sanitizeSettings('text')).toEqual({})
  })
})

describe('sanitizeTeamStats', () => {
  test('păstrează echipele valide cu statistici numerice', () => {
    const out = sanitizeTeamStats({
      mexic: { team: 'Mexic', stats: { golFor: 1.4, golAg: 1.1, rau: 'text' } },
      stricat: { team: 42, stats: { golFor: 1 } },
      gol: { team: 'Gol', stats: {} },
    })
    expect(out).toEqual({ mexic: { team: 'Mexic', stats: { golFor: 1.4, golAg: 1.1 } } })
  })

  test('nu copiază chei care ating lanțul de prototipuri', () => {
    const dangerous = JSON.parse('{"__proto__": {"team": "X", "stats": {"golFor": 1}}, "ok": {"team": "Ok", "stats": {"golFor": 2, "__proto__": 9}}}')
    const out = sanitizeTeamStats(dangerous)
    expect(Object.keys(out)).toEqual(['ok'])
    expect(out.ok.stats).toEqual({ golFor: 2 })
    expect({}.team).toBeUndefined()
  })
})
