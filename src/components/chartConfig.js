// Per-chart time-window options. MW signals (fast, 1/s) use short windows so the
// trace stays readable; SOC moves slowly so it tolerates longer windows.
export const MW_RANGES = [
  { label: '1 min',  ms: 60 * 1000 },
  { label: '5 min',  ms: 5 * 60 * 1000 },
  { label: '15 min', ms: 15 * 60 * 1000 },
]

export const SOC_RANGES = [
  { label: '10 min', ms: 10 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '1 H',    ms: 60 * 60 * 1000 },
]

export const MAX_POINTS = 300

export const tooltipCursor = { stroke: '#8192a8', strokeDasharray: '3 3', strokeWidth: 1 }
