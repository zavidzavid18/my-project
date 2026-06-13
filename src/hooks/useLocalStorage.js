import { useEffect, useRef, useState } from 'react'

// Stare persistată în localStorage — sursa unică pentru bilete, statistici, setări
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw == null ? initial : (JSON.parse(raw) ?? initial)
    } catch {
      return initial
    }
  })

  // sărim scrierea de la montare: valoarea citită e deja în localStorage, iar
  // o re-scriere ar putea suprascrie ce a salvat între timp un alt tab deschis
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}
