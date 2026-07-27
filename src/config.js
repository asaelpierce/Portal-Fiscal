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

export const int = (n) => (Number(n) || 0).toLocaleString('pt-BR')

export const dBR = (d) => {
  if (!d) return '—'
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d)
}

export const isZero = (n) => Math.abs(Number(n) || 0) < 0.005

export const SITUACOES = [
  { p: '1', k: 'ok',     rot: 'Confere',               cor: '#12805C', bg: '#D1FAE5' },
  { p: '2', k: 'soCtb',  rot: 'Só na contabilidade',   cor: '#1D5BBF', bg: '#DBEAFE' },
  { p: '3', k: 'soCusto',rot: 'Só no custo',           cor: '#B54708', bg: '#FEF3C7' },
  { p: '4', k: 'valor',  rot: 'Divergência de valor',  cor: '#B42318', bg: '#FEE2E2' },
]

export const sitDe = (m) =>
  SITUACOES.find((s) => String(m || '').startsWith(s.p)) ||
  { k: 'outro', rot: 'Não classificado', cor: '#667085', bg: '#F3F4F6' }
