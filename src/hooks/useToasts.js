import { useCallback, useState } from 'react'

// Notificări scurte (max 4 vizibile), cu acțiune opțională — ex. „Anulează".
// `dismiss`/`push` au identitate stabilă (useCallback) ca să fie sigure în
// dependențele efectelor din Toast.
export function useToasts() {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(
    (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  )

  const push = useCallback((text, { type = 'info', actionLabel, onAction, ttl } = {}) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-3), { id, text, type, actionLabel, onAction, ttl }])
    return id
  }, [])

  return { toasts, push, dismiss }
}
