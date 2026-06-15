export const MODOS = {
  0: { label: 'MPP',         cls: 'mpp',         color: '#3fb950' },
  1: { label: 'Curtailment', cls: 'curtailment',  color: '#d29922' },
  2: { label: 'Drop 1',      cls: 'drop1',        color: '#db6d28' },
  3: { label: 'Drop 2',      cls: 'drop2',        color: '#f85149' },
}

export function getModo(value) {
  return MODOS[value] ?? { label: '—', cls: 'unknown', color: '#7d8590' }
}
