import { useState } from 'react'

// Notificări scurte (max 4 vizibile), cu acțiune opțională — ex. „Anulează"
export function useToasts() {
  const [toasts, setToasts] = useState([])

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const push = (text, { type = 'info', actionLabel, onAction, ttl } = {}) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev.slice(-3), { id, text, type, actionLabel, onAction, ttl }])
    return id
  }

  return { toasts, push, dismiss }
}
