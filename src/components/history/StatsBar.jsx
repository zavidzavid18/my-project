import { computeStreaks, overallStats } from '../../lib/stats.js'
import { StatTile } from '../ui.jsx'
import { ProfitChart } from './ProfitChart.jsx'

const streakLabel = (s) => (s.type ? `${s.len}${s.type}` : '—')

export function StatsBar({ bets }) {
  const st = overallStats(bets)
  const streaks = computeStreaks(bets)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile
          label="Profit net"
          value={`${st.profit >= 0 ? '+' : ''}${st.profit.toFixed(2)} RON`}
          accent={st.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <StatTile
          label="ROI"
          value={`${st.roi >= 0 ? '+' : ''}${st.roi.toFixed(1)}%`}
          accent={st.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <StatTile label="Rată câștig" value={`${st.winRate.toFixed(0)}%`} />
        <StatTile label="Record" value={`${st.wonCount}W - ${st.lostCount}L - ${st.pendingCount}P`} />
        <StatTile label="Miză decisă" value={`${st.staked.toFixed(0)} RON`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile
          label="Serie curentă"
          value={streakLabel(streaks.current)}
          accent={streaks.current.type === 'W' ? 'text-emerald-400' : streaks.current.type === 'L' ? 'text-rose-400' : 'text-slate-500'}
          sub={`best: ${streaks.bestWin}W · worst: ${streaks.worstLoss}L`}
        />
        <StatTile label="Cotă medie" value={st.avgOdds ? `@${st.avgOdds.toFixed(2)}` : '—'} />
        <StatTile label="Miză medie" value={st.avgStake ? `${st.avgStake.toFixed(0)} RON` : '—'} />
        <StatTile
          label="Cel mai mare câștig"
          value={st.biggestWin > 0 ? `+${st.biggestWin.toFixed(2)}` : '—'}
          accent="text-emerald-400"
        />
        <StatTile
          label="Cea mai mare pierdere"
          value={st.biggestLoss < 0 ? st.biggestLoss.toFixed(2) : '—'}
          accent="text-rose-400"
        />
      </div>
      <ProfitChart bets={bets} />
    </div>
  )
}
