import { useEffect, useRef } from 'react'

/**
 * Normalised document scroll, 0 at the top to 1 at the bottom.
 *
 * Returns a ref rather than state on purpose: this updates every scroll event,
 * and re-rendering React 60+ times a second to drive a three.js value would be
 * pure waste. The render loop reads `.current` directly inside useFrame.
 */
export function useScrollProgress() {
  const progress = useRef(0)

  useEffect(() => {
    const read = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      progress.current = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0
    }

    read()
    window.addEventListener('scroll', read, { passive: true })
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
    }
  }, [])

  return progress
}
