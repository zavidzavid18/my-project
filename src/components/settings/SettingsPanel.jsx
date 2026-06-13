import { useState } from 'react'
import { DEFAULT_BANKROLL_START, DEFAULT_KELLY_DIVISOR, KELLY_PROFILES } from '../../lib/bankroll.js'
import { Card } from '../ui.jsx'

const BACKUP_VERSION = 2

export function SettingsPanel({ settings, onSave, bets, teamStats, onImportBackup }) {
  const [apiFootballKey, setApiFootballKey] = useState(settings.apiFootballKey ?? '')
  const [bankrollStart, setBankrollStart] = useState(settings.bankrollStart ?? DEFAULT_BANKROLL_START)
  const [kellyDivisor, setKellyDivisor] = useState(settings.kellyDivisor ?? DEFAULT_KELLY_DIVISOR)
  const [saved, setSaved] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  const handleSave = () => {
    onSave({
      ...settings,
      apiFootballKey: apiFootballKey.trim(),
      bankrollStart: Math.max(1, Number(bankrollStart) || DEFAULT_BANKROLL_START),
      kellyDivisor: Number(kellyDivisor) || DEFAULT_KELLY_DIVISOR,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = () => {
    const backup = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      bets,
      teamStats,
      settings,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `analizor-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5">
      <Card title="Bancă & Staking" icon="💰" accent="border-amber-900/60">
        <p className="mb-3 text-xs text-slate-500">
          Banca actuală se calculează singură: banca de start + profitul net al biletelor decise.
          Miza sugerată pe bilete folosește criteriul Kelly fracționat, plafonat la 5% din bancă.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs text-slate-400">
            Bancă de start (RON)
            <input
              type="number"
              min="1"
              value={bankrollStart}
              onChange={(e) => setBankrollStart(e.target.value)}
              className="mt-1 block w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-200 outline-none focus:border-amber-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            Profil de risc (Kelly)
            <select
              value={kellyDivisor}
              onChange={(e) => setKellyDivisor(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-amber-500"
            >
              {KELLY_PROFILES.map((p) => (
                <option key={p.divisor} value={p.divisor}>{p.label}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card title="Setări API" icon="⚙️">
        <p className="mb-3 text-xs text-slate-500">Cheile rămân doar în browserul tău — nu sunt trimise nicăieri altundeva.</p>
        <label className="block max-w-md text-xs text-slate-400">
          Cheie API-Football (rezultate fotbal extinse) — gratuit de la dashboard.api-football.com
          <input
            type="password"
            value={apiFootballKey}
            onChange={(e) => setApiFootballKey(e.target.value)}
            placeholder="opțional"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-emerald-500"
          />
        </label>
      </Card>

      <button
        onClick={handleSave}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 active:scale-95"
      >
        {saved ? '✓ Salvat' : '💾 Salvează setările'}
      </button>

      <Card title="Backup & Restaurare" icon="🗄️">
        <p className="mb-2 text-xs text-slate-500">
          Toate datele (bilete, statistici echipe, setări) există doar în acest browser.
          Exportă periodic un backup complet — și folosește-l ca să muți totul pe alt dispozitiv.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            ⬇️ Exportă tot ({bets.length} bilete, {Object.keys(teamStats).length} echipe)
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800">
            ⬆️ Importă din backup
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = () => {
                  try {
                    const data = JSON.parse(reader.result)
                    const summary = onImportBackup(data)
                    setImportMsg(summary ?? '⚠️ Fișierul nu pare un backup valid.')
                  } catch {
                    setImportMsg('⚠️ Fișier JSON invalid.')
                  }
                }
                reader.readAsText(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {importMsg && <p className="mt-2 text-xs text-slate-400">{importMsg}</p>}
        <p className="mt-2 text-[11px] text-slate-600">
          Sunt acceptate și backup-urile vechi (doar lista de bilete).
        </p>
      </Card>
    </div>
  )
}
