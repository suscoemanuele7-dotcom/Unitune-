/**
 * Colore dominante di una copertina, per i gradienti "alla Spotify".
 * Le thumbnail di i.ytimg.com supportano CORS, quindi si possono leggere su
 * un canvas; in caso di errore si usa un colore derivato dall'URL.
 */
const cache = new Map<string, string>()

function hashColor(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0
  const hue = Math.abs(h) % 360
  return `hsl(${hue} 45% 32%)`
}

function toHsl(r: number, g: number, b: number): string {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
  }
  // Saturazione e luminosità "da sfondo": leggibile con testo bianco.
  const sat = Math.min(70, Math.max(25, s * 100 + 10))
  const light = Math.min(38, Math.max(22, l * 100))
  return `hsl(${Math.round(h)} ${Math.round(sat)}% ${Math.round(light)}%)`
}

export function dominantColor(url: string): Promise<string> {
  const cached = cache.get(url)
  if (cached) return Promise.resolve(cached)
  const fallback = hashColor(url)
  if (!url) return Promise.resolve(fallback)

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('canvas non disponibile')
        // Le thumbnail hq hanno bande nere sopra/sotto: prendiamo il centro.
        ctx.drawImage(img, 0, img.height * 0.125, img.width, img.height * 0.75, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i] ?? 0
          const pg = data[i + 1] ?? 0
          const pb = data[i + 2] ?? 0
          const max = Math.max(pr, pg, pb)
          const min = Math.min(pr, pg, pb)
          // Pesa di più i pixel saturi, ignora quasi-neri e quasi-bianchi.
          if (max < 24 || min > 235) continue
          const w = 1 + (max - min) / 32
          r += pr * w
          g += pg * w
          b += pb * w
          n += w
        }
        const color = n > 0 ? toHsl(r / n, g / n, b / n) : fallback
        cache.set(url, color)
        resolve(color)
      } catch {
        resolve(fallback)
      }
    }
    img.onerror = () => {
      resolve(fallback)
    }
    img.src = url
  })
}
