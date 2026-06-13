import { useEffect, useState } from 'react'
import { STATUS_STYLES } from '../ui.jsx'

// Banner „🎫 Bilet pregătit" — apare când textul lipit arată ca un bilet real
export function TicketBanner({ meta, analyzed, onImport }) {
  const [miza, setMiza] = useState(meta?.stake ?? 50)
  const [status, setStatus] = useState(meta?.status ?? 'În așteptare')
  useEffect(() => {
    setMiza(meta?.stake ?? 50)
    setStatus(meta?.status ?? 'În așteptare')
  }, [meta])

  if (analyzed.length === 0) return null
  // lista mare de cote din ofertă nu e un bilet — bannerul apare doar la
  // bilete reale (meta detectat) sau la selecții puține
  if (!meta && analyzed.length > 20) return null

  const cotaTotala = meta?.totalOdds ?? analyzed.reduce((a, s) => a * s.odds, 1)
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-3 text-sm text-slate-300">
        🎫 <span className="font-semibold">Bilet pregătit:</span> {analyzed.length} selecții
        {' '}· cotă totală <span className="font-mono font-bold text-slate-100">@{cotaTotala.toFixed(2)}</span>
        {' '}· câștig potențial{' '}
        <span className="font-mono font-bold text-amber-400">{(miza * cotaTotala).toFixed(2)} RON</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Miză (RON)
          <input
            type="number"
            min="1"
            value={miza}
            onChange={(e) => setMiza(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 block w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-200 outline-none focus:border-amber-500"
          />
        </label>
        <label className="text-xs text-slate-400">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`mt-1 block rounded-lg border bg-slate-950 px-2 py-1.5 text-sm font-semibold outline-none ${STATUS_STYLES[status]}`}
          >
            <option>În așteptare</option>
            <option>Câștigat</option>
            <option>Pierdut</option>
          </select>
        </label>
        <button
          onClick={() => onImport(miza, status, cotaTotala)}
          className="rounded-lg bg-amber-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 active:scale-95"
        >
          💾 Salvează biletul
        </button>
      </div>
    </div>
  )
}
