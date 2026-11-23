import { useEffect, useState } from 'react'
import { dominantColor } from '../lib/dominantColor'

export function useDominantColor(url: string | undefined, fallback = 'hsl(250 30% 22%)'): string {
  const [state, setState] = useState<{ url: string | undefined; color: string }>({ url: undefined, color: fallback })
  useEffect(() => {
    if (!url) return
    let active = true
    void dominantColor(url).then((color) => {
      if (active) setState({ url, color })
    })
    return () => {
      active = false
    }
  }, [url])
  return state.url === url ? state.color : fallback
}
