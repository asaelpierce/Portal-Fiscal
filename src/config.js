export const SUPABASE_URL = 'https://sqsrvhlpvnojatlqnred.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxc3J2aGxwdm5vamF0bHFucmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjAzMzQsImV4cCI6MjEwMDczNjMzNH0.Bc9GLwNe5BSv0qg3n0lBQVNJqpGmyneWrmom8ThlUss'

export async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Range: '0-29999',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path.split('?')[0]}`)
  return res.json()
}

export const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const brlK = (n) => {
  const v = Number(n) || 0, a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(0)}k`
  return `${s}${a.toFixed(0)}`
}

export const int  = (n) => (Number(n) || 0).toLocaleString('pt-BR')
export const isZero = (n) => Math.abs(Number(n) || 0) < 0.005

export const dBR = (d) => {
  if (!d) return '—'
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d)
}

// Classificações calculadas no banco — fonte única de verdade
export const CLASSES = {
  OK:          { cor: '#12805C', bg: '#D1FAE5', rot: 'Conciliado',      icone: '✓' },
  INVESTIGAR:  { cor: '#B54708', bg: '#FEF3C7', rot: 'Investigar',      icone: '⚠' },
  AJUSTE_CUSTO:{ cor: '#6B7280', bg: '#F3F4F6', rot: 'Ajuste de custo', icone: '⚙' },
  CRITICO:     { cor: '#B42318', bg: '#FEE2E2', rot: 'Crítico',         icone: '🔴' },
  REMESSA:     { cor: '#1D5BBF', bg: '#DBEAFE', rot: 'Remessa aberta',  icone: '⏳' },
  JUSTIFICADO: { cor: '#12805C', bg: '#ECFDF5', rot: 'Justificado',     icone: '📋' },
}

export const classeDe = (c) => CLASSES[c] || CLASSES.INVESTIGAR

// Situação legível para o analista (usa classe_divergencia do banco, não o motivo bruto do Oracle)
export const situacaoLabel = (row) => {
  if (!row) return '—'
  switch (row.classe_divergencia) {
    case 'OK':           return row.motivo_calculado || 'Conciliado'
    case 'INVESTIGAR':   return row.motivo_calculado || 'Investigar'
    case 'AJUSTE_CUSTO': return row.motivo_calculado || 'Ajuste de custo médio'
    case 'CRITICO':      return row.motivo_calculado || 'Crítico'
    case 'REMESSA':      return row.motivo_calculado || 'Remessa em aberto'
    case 'JUSTIFICADO':  return row.motivo_calculado || 'Justificado'
    default:             return row.motivo_calculado || row.motivo_divergencia || '—'
  }
}
