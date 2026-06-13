import { useState } from 'react'
import { betProfit, parseBetDate } from '../../lib/stats.js'
import { Card } from '../ui.jsx'

const MONTH_NAMES = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']

export function CalendarView({ bets }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const days = {}
  for (const b of bets) {
    const d = parseBetDate(b)
    if (!d || d.getFullYear() !== month.getFullYear() || d.getMonth() !== month.getMonth()) continue
    const day = d.getDate()
    days[day] ??= { profit: 0, pending: 0, settled: 0 }
    if (b.status === 'În așteptare') days[day].pending += 1
    else {
      days[day].settled += 1
      days[day].profit += betProfit(b)
    }
  }
  const monthProfit = Object.values(days).reduce((a, d) => a + d.profit, 0)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDow = new Date(month.getFullYear(), month.getMonth(), 1).getDay() // 0 = duminică
  const shift = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

  const tile = (day) => {
    const d = days[day]
    if (!d) return { cls: 'bg-slate-900/60 text-slate-600', label: '' }
    if (d.settled === 0) return { cls: 'bg-sky-500/15 text-sky-300 border border-sky-500/20', label: `${d.pending} act.` }
    const p = d.profit
    return p >= 0
      ? { cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20', label: `+${p.toFixed(0)}` }
      : { cls: 'bg-rose-500/15 text-rose-400 border border-rose-500/20', label: p.toFixed(0) }
  }

  return (
    <Card title="Calendar Profit" icon="📅">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="rounded-lg px-3 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200">‹</button>
        <div className="text-center">
          <span className="text-lg font-bold text-slate-100">{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</span>
          <span className={`ml-2 font-mono text-sm font-bold ${monthProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {monthProfit >= 0 ? '+' : ''}{monthProfit.toFixed(1)} RON
          </span>
        </div>
        <button onClick={() => shift(1)} className="rounded-lg px-3 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S'].map((d, i) => (
          <div key={i} className="pb-1 text-[10px] uppercase tracking-wider text-slate-500">{d}</div>
        ))}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const t = tile(day)
          return (
            <div key={day} className={`rounded-lg px-1 py-1.5 ${t.cls}`}>
              <div className="text-[10px] opacity-60">{day}</div>
              <div className="font-mono text-[11px] font-bold leading-tight">{t.label}</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
