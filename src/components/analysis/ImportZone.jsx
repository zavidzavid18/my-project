import { Card } from '../ui.jsx'

export function ImportZone({ rawText, setRawText, onProcess, onLoadReal, onLoadDemo, loadingReal, importMsg }) {
  return (
    <Card title="Zona de Import" icon="📥">
      <p className="mb-2 text-xs text-slate-400">
        Acceptă: <code className="rounded bg-slate-800 px-1 text-slate-300">Echipa1 vs Echipa2 | Piață | Cotă | sport</code>,
        {' '}bilete copiate din <span className="font-semibold text-slate-300">Betano</span> sau liste din{' '}
        <span className="font-semibold text-slate-300">Superbet</span> (lipește direct, exact cum apar).
        Sporturi: fotbal, tenis, baschet, baseball.
      </p>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={9}
        spellCheck={false}
        className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        placeholder="Lipește aici meciurile și cotele tale..."
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={onProcess}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98]"
        >
          ⚡ Procesează
        </button>
        <button
          onClick={onLoadReal}
          disabled={loadingReal}
          title="Încarcă următoarele meciuri oficiale din WC 2026 (cotele sunt orientative — pune-le pe cele de la Betano)"
          className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:from-sky-500 hover:to-sky-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loadingReal ? '⏳ Încarc...' : '📡 Meciuri reale'}
        </button>
      </div>
      {onLoadDemo && (
        <button
          onClick={onLoadDemo}
          title="Încarcă meciuri demo (Hurkacz, Griekspoor + WC) ca să vezi instant motorul calculând +EV. Nu îți atinge biletele salvate."
          className="mt-2 w-full rounded-xl border border-violet-700/60 bg-violet-600/10 px-4 py-2 text-sm font-semibold text-violet-300 transition hover:bg-violet-600/20 active:scale-[0.98]"
        >
          🎓 Încarcă exemple (tenis +1.5 set / Total game-uri · WC Poisson)
        </button>
      )}
      {importMsg && <p className="mt-2 text-xs text-slate-400">{importMsg}</p>}
    </Card>
  )
}
