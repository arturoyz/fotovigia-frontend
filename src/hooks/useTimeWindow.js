import { useMemo } from 'react'

// Slice `data` to the last `rangeMs` relative to the newest point, and
// downsample so no chart ever renders more than `maxPoints` (avoids saturation
// when the WebSocket delivers many points per second).
export function useTimeWindow(data, rangeMs, maxPoints = 300) {
  return useMemo(() => {
    if (!data.length) return []
    const newest = data[data.length - 1].timestamp
    const cutoff = newest - rangeMs
    const win = data.filter(d => d.timestamp >= cutoff)
    if (win.length <= maxPoints) return win

    const stride = Math.ceil(win.length / maxPoints)
    const out = win.filter((_, i) => i % stride === 0)
    const last = win[win.length - 1]
    if (out[out.length - 1] !== last) out.push(last)  // always keep the freshest point
    return out
  }, [data, rangeMs, maxPoints])
}
