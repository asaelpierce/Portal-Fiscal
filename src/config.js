export const SUPABASE_URL = 'https://sqsrvhlpvnojatlqnred.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxc3J2aGxwdm5vamF0bHFucmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjAzMzQsImV4cCI6MjEwMDczNjMzNH0.Bc9GLwNe5BSv0qg3n0lBQVNJqpGmyneWrmom8ThlUss'

export async function sbFetch(path) {
  const PAGE = 1000 // o projeto tem "Max Rows" = 1000 no Data API; paginamos por baixo disso
  let offset = 0
  let todos = []

  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Range: `${offset}-${offset + PAGE - 1}`,
        Prefer: 'count=exact',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${path.split('?')[0]}`)
    const pagina = await res.json()
    todos = todos.concat(pagina)

    // Content-Range: 0-999/2205 -> extrai o total real de linhas
    const contentRange = res.headers.get('content-range') || ''
    const total = parseInt(contentRange.split('/')[1], 10)

    if (!pagina.length || pagina.length < PAGE || (Number.isFinite(total) && todos.length >= total)) {
      break
    }
    offset += PAGE
  }

  return todos
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
export const isZero = (n) => Math.abs(Number(n) || 0) < 0.005

export const dBR = (d) => {
  if (!d) return '—'
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d)
}

// Classificações calculadas no banco — fonte única de verdade
export const CLASSES = {
  OK: { cor: '#12805C', bg: '#D1FAE5', rot: 'Conciliado', icone: '✓' },
  INVESTIGAR: { cor: '#B54708', bg: '#FEF3C7', rot: 'Investigar', icone: '⚠' },
  AJUSTE_CUSTO:{ cor: '#6B7280', bg: '#F3F4F6', rot: 'Ajuste de custo', icone: '⚙' },
  CRITICO: { cor: '#B42318', bg: '#FEE2E2', rot: 'Crítico', icone: '🔴' },
  REMESSA: { cor: '#1D5BBF', bg: '#DBEAFE', rot: 'Remessa aberta', icone: '⏳' },
  JUSTIFICADO: { cor: '#12805C', bg: '#ECFDF5', rot: 'Justificado', icone: '📋' },
}

export const classeDe = (c) => CLASSES[c] || CLASSES.INVESTIGAR

// Situação legível para o analista (usa classe_divergencia do banco, não o motivo bruto do Oracle)
export const situacaoLabel = (row) => {
  if (!row) return '—'
  switch (row.classe_divergencia) {
    case 'OK': return row.motivo_calculado || 'Conciliado'
    case 'INVESTIGAR': return row.motivo_calculado || 'Investigar'
    case 'AJUSTE_CUSTO': return row.motivo_calculado || 'Ajuste de custo médio'
    case 'CRITICO': return row.motivo_calculado || 'Crítico'
    case 'REMESSA': return row.motivo_calculado || 'Remessa em aberto'
    case 'JUSTIFICADO': return row.motivo_calculado || 'Justificado'
    default: return row.motivo_calculado || row.motivo_divergencia || '—'
  }
}

// ─── Link direto para a nota dentro do Sankhya ──────────────────────────────
// Descoberto a partir de uma URL real do Sankhya (Central de Notas de Compra):
//   .../mge/system.jsp#app/<base64(classe)>/<base64(json)>&pk-refresh=<timestamp>
// onde <json> = {"NUNOTA":119207,"TIPMOV":"C","ehPedidoW":false,
//                "CODTIPOPER":2114,"TIPOPORTAL":"PC","forceNewHash":<timestamp>}
//
// OBS: só foi confirmado testando com uma nota de Compra (TIPMOV="C"). Usamos
// a mesma tela/classe pra qualquer tipo por enquanto (melhor esforço) — se
// abrir a tela errada pra Venda/Transferência/etc., me manda a URL certa
// daquele tipo (abra a nota manualmente no Sankhya e copia o endereço) que eu
// ajusto o mapeamento por TIPMOV.
const SANKHYA_BASE_URL = 'https://snkbrp01667.ativy.com'
const SANKHYA_CLASSE_CENTRAL_NOTAS = 'br.com.sankhya.com.mov.CentralNotas_COMPRA'

function b64json(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
}
function b64str(s) {
  return btoa(unescape(encodeURIComponent(s)))
}

// nunota: obrigatório. tipmov: código do Sankhya (C, V, T, D, F...) — se não
// vier, assume "C" (compra), que é o único confirmado até agora.
// codtipoper: o TOP da nota (cod_top no nosso banco).
export function linkSankhyaNota({ nunota, tipmov, codtipoper }) {
  if (!nunota) return null
  const agora = Date.now()
  const params = {
    NUNOTA: Number(nunota),
    TIPMOV: tipmov || 'C',
    ehPedidoW: false,
    CODTIPOPER: Number(codtipoper) || 0,
    TIPOPORTAL: 'PC',
    forceNewHash: agora,
  }
  return `${SANKHYA_BASE_URL}/mge/system.jsp#app/${b64str(SANKHYA_CLASSE_CENTRAL_NOTAS)}/${b64json(params)}&pk-refresh=${agora}`
}
