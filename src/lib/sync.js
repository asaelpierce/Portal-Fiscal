import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

const SYNC_URL = `${SUPABASE_URL}/functions/v1`
const SYNC_KEY = 'kb2026sync!'
const HDR_REST = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
const HDR_SYNC = { ...HDR_REST, 'x-api-key': SYNC_KEY }

async function restPost(tabela, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
    method: 'POST', headers: { ...HDR_REST, Prefer: 'return=representation' }, body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${tabela}: ${JSON.stringify(data).slice(0, 200)}`)
  if (!data[0]?.id) throw new Error(`${tabela}: ID não retornado — ${JSON.stringify(data).slice(0, 200)}`)
  return data[0]
}

async function restPatch(tabela, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, { method: 'PATCH', headers: HDR_REST, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${tabela} (patch): HTTP ${res.status}`)
}

async function syncPost(endpoint, body) {
  const res = await fetch(`${SYNC_URL}/${endpoint}`, { method: 'POST', headers: HDR_SYNC, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok || (!data.ok && data.total_estoque === undefined)) throw new Error(data.erro || `HTTP ${res.status}`)
  return data
}

function isoParaBR(s) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }

// Gera semanas de 7 dias entre duas datas (formato DD/MM/YYYY) — evita
// timeout do Sankhya em períodos longos, sincronizando aos pedaços.
export function gerarSemanas(dtIniBR, dtFimBR) {
  const [di, mi, ai] = dtIniBR.split('/')
  const [df, mf, af] = dtFimBR.split('/')
  const inicio = new Date(`${ai}-${mi}-${di}T00:00:00`)
  const fim = new Date(`${af}-${mf}-${df}T00:00:00`)
  const semanas = []
  let cur = new Date(inicio)
  while (cur <= fim) {
    const iniSem = new Date(cur)
    const fimSem = new Date(cur)
    fimSem.setDate(fimSem.getDate() + 6)
    if (fimSem > fim) fimSem.setTime(fim.getTime())
    const fmt = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    semanas.push({ ini: fmt(iniSem), fim: fmt(fimSem) })
    cur.setDate(cur.getDate() + 7)
  }
  return semanas
}

// Cria o registro em "importacoes" e sincroniza semana a semana. Usado
// tanto pelos seletores automáticos (calendário livre) quanto — no futuro —
// pela tela manual "Importar período".
export async function sincronizarConciliacao(dtIniISO, dtFimISO) {
  const dtIniBR = isoParaBR(dtIniISO), dtFimBR = isoParaBR(dtFimISO)
  const imp = await restPost('importacoes', { periodo_inicio: dtIniISO, periodo_fim: dtFimISO, total_linhas: 0, criado_por: 'portal' })
  let total = 0
  for (const s of gerarSemanas(dtIniBR, dtFimBR)) {
    const r = await syncPost('conciliacao-sync', { periodo_inicio: s.ini, periodo_fim: s.fim, importacao_id: imp.id })
    total += r.inseridos || 0
  }
  return { importacao_id: imp.id, periodo_inicio: dtIniISO, periodo_fim: dtFimISO, criado_em: new Date().toISOString(), total_linhas: total }
}

// Cria o registro em "razao_importacoes" e roda os 3 passos do razão
// (movimentos, saldo inicial, contábil), igual a tela manual faz.
export async function sincronizarRazao(dtIniISO, dtFimISO) {
  const dtIniBR = isoParaBR(dtIniISO), dtFimBR = isoParaBR(dtFimISO)
  const rimp = await restPost('razao_importacoes', { periodo_inicio: dtIniISO, periodo_fim: dtFimISO, status: 'processando' })
  const rMov = await syncPost('razao-sync-movimentos', { periodo_inicio: dtIniBR, periodo_fim: dtFimBR, importacao_id: rimp.id })
  await syncPost('razao-sync-saldo', { periodo_inicio: dtIniBR, importacao_id: rimp.id })
  await syncPost('razao-sync-ctb', { periodo_inicio: dtIniBR, periodo_fim: dtFimBR, importacao_id: rimp.id })
  await restPatch('razao_importacoes', rimp.id, { status: 'pronto', total_movimentos: rMov.total_movimentos, concluido_em: new Date().toISOString() })
  return { id: rimp.id, periodo_inicio: dtIniISO, periodo_fim: dtFimISO, total_movimentos: rMov.total_movimentos, status: 'pronto' }
}
