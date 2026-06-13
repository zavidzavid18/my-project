import { useState } from 'react'
import { parseTeamStats } from '../../lib/engine.js'
import { Card, EmptyState } from '../ui.jsx'

const STAT_COLS = [
  { key: 'gol', label: 'Goluri' },
  { key: 'xg', label: 'xG' },
  { key: 'corn', label: 'Cornere' },
  { key: 'sot', label: 'Șuturi pe poartă' },
  { key: 'sav', label: 'Salvări' },
  { key: 'pos', label: 'Posesie', percent: true },
]

export function TeamStatsPanel({ teamStats, onAdd, onDelete }) {
  const [raw, setRaw] = useState('')
  const [msg, setMsg] = useState('')
  const teams = Object.entries(teamStats)
  return (
    <div className="space-y-5">
      <Card title="Adaugă Statistici Echipe" icon="📈" accent="border-violet-900/60">
        <p className="mb-2 text-xs text-slate-400">
          Copiază tabelul de statistici al unei echipe (ex. de pe <span className="font-semibold text-slate-300">PlayerStats</span>:
          selectezi tot, de la „Echipa Stats" în jos, Ctrl+C) și lipește-l aici. Rețin mediile —
          <span className="text-violet-300"> numărul mare = al echipei</span>, <span className="text-slate-300">cel mic = al adversarilor</span> —
          iar analiza fotbal trece automat pe <span className="font-semibold text-violet-300">modelul Poisson cu date reale</span>.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={'Paraguay Stats\nGoals  0.86  1.03 ...\nExpected Goals (xG)  1.07  0.98 ...\nCorners  3.97  4.45 ...'}
          className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none transition focus:border-violet-500"
        />
        <button
          onClick={() => {
            const parsed = parseTeamStats(raw)
            if (parsed.length === 0) { setMsg('⚠️ Nu am găsit niciun „Echipă Stats" cu indicatori în text.'); return }
            onAdd(parsed)
            setRaw('')
            setMsg(`✅ Salvat: ${parsed.map((t) => t.team).join(', ')}`)
          }}
          className="mt-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:from-violet-500 hover:to-violet-400 active:scale-[0.98]"
        >
          📈 Salvează statisticile
        </button>
        {msg && <p className="mt-2 text-xs text-slate-400">{msg}</p>}
      </Card>

      <Card title={`Echipe cu statistici (${teams.length})`} icon="🗂️">
        {teams.length === 0 ? (
          <EmptyState>Nicio echipă încă. Lipește un tabel mai sus — apoi orice meci dintre echipe cunoscute se analizează cu date reale.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3">Echipă</th>
                  {STAT_COLS.map((c) => <th key={c.key} className="pb-2 pr-3">{c.label}</th>)}
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {teams.map(([key, t]) => (
                  <tr key={key} className="border-b border-slate-800/60 transition hover:bg-slate-800/30">
                    <td className="py-2.5 pr-3 font-semibold capitalize text-slate-200">{t.team ?? key}</td>
                    {STAT_COLS.map((c) => {
                      const f = t.stats[`${c.key}For`]
                      const a = t.stats[`${c.key}Ag`]
                      const fmt = (v) => (v == null ? '—' : c.percent ? `${Math.round(v * 100)}%` : v.toFixed(2))
                      return (
                        <td key={c.key} className="py-2.5 pr-3">
                          <span className="font-mono text-base font-bold text-violet-300">{fmt(f)}</span>
                          {a != null && <span className="ml-1 align-bottom font-mono text-[10px] text-slate-500">{fmt(a)}</span>}
                        </td>
                      )
                    })}
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => onDelete(key)}
                        className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
