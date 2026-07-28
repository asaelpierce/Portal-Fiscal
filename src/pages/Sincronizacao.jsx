import React, { useState, useEffect } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl, int, dBR } from '../config.js'

const SYNC_URL  = `${SUPABASE_URL}/functions/v1`
const SYNC_KEY  = 'kb2026sync!'
const HDR_REST  = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
const HDR_SYNC  = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'x-api-key': SYNC_KEY }

async function restPost(tabela, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: { ...HDR_REST, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Supabase ${tabela}: ${JSON.stringify(data).slice(0,200)}`)
  if (!Array.isArray(data) || !data[0]?.id) throw new Error(`${tabela}: resposta inesperada — ${JSON.stringify(data).slice(0,200)}`)
  return data[0]
}

async function syncPost(endpoint, body) {
  const res = await fetch(`${SYNC_URL}/${endpoint}`, {
    method: 'POST', headers: HDR_SYNC, body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || (!data.ok && data.total_estoque === undefined))
    throw new Error(data.erro || `HTTP ${res.status}`)
  return data
}

function Passo({ status, titulo, mensagem, detalhe }) {
  const cores = {
    ok:      { bg:'#D1FAE5', cor:'#12805C', ic:'✓' },
    erro:    { bg:'#FEE2E2', cor:'#B42318', ic:'✗' },
    rodando: { bg:'#DBEAFE', cor:'#1D5BBF', ic:'↻' },
    idle:    { bg:'#F3F4F6', cor:'#9CA3AF', ic:'○' },
  }
  const c = cores[status] || cores.idle
  return (
    <div style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid #F3F4F6' }}>
      <div style={{ width:26, height:26, borderRadius:'50%', background:c.bg, color:c.cor,
        display:'grid', placeItems:'center', fontWeight:700, fontSize:12, flexShrink:0,
        animation: status==='rodando' ? 'spin 1s linear infinite' : 'none' }}>{c.ic}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color: status==='idle'?'#374151':c.cor }}>{titulo}</div>
        {mensagem && <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{mensagem}</div>}
        {detalhe  && <div style={{ fontSize:11.5, color:'#9CA3AF', marginTop:1, fontVariantNumeric:'tabular-nums' }}>{detalhe}</div>}
      </div>
    </div>
  )
}

function PeriodosDisponiveis({ refresh }) {
  const [concil, setConcil] = useState([])
  const [razao,  setRazao]  = useState([])
  const [fech,   setFech]   = useState([])

  useEffect(() => {
    sbFetch('importacoes?select=id,periodo_inicio,periodo_fim,total_linhas&order=periodo_inicio.desc').then(r=>setConcil(r||[])).catch(()=>{})
    sbFetch('razao_importacoes?select=id,periodo_inicio,periodo_fim,total_movimentos,status&order=periodo_inicio.desc').then(r=>setRazao(r||[])).catch(()=>{})
    sbFetch('fechamento_saldos?select=data_posicao&order=data_posicao.desc').then(r=>setFech([...new Set((r||[]).map(x=>x.data_posicao))])).catch(()=>{})
  }, [refresh])

  const fmt = s => { const [y,m,d]=String(s).slice(0,10).split('-'); return `${d}/${m}/${y}` }
  const fmtP = (i,f) => `${fmt(i)} → ${fmt(f)}`

  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'18px 22px' }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Períodos disponíveis no banco</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:20 }}>
        {[
          { label:'Conciliação (Dash × Razão)', items: concil.map(i=>({ k:i.id, txt:fmtP(i.periodo_inicio,i.periodo_fim), sub:`${int(i.total_linhas)} lançamentos` })) },
          { label:'Razão analítico',            items: razao.map(i=>({ k:i.id, txt:fmtP(i.periodo_inicio,i.periodo_fim), sub:`${int(i.total_movimentos)} movimentos · ${i.status}` })) },
          { label:'Fechamento',                 items: fech.map(d=>({ k:d, txt:`Posição em ${fmt(d)}`, sub:'✓ disponível' })) },
        ].map(col => (
          <div key={col.label}>
            <div style={{ fontSize:10.5, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>{col.label}</div>
            {col.items.length ? col.items.map(i=>(
              <div key={i.k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #F9FAFB', fontSize:12.5 }}>
                <span>{i.txt}</span>
                <span style={{ color:'#9CA3AF', fontSize:11.5 }}>{i.sub}</span>
              </div>
            )) : <div style={{ fontSize:12, color:'#9CA3AF' }}>Nenhum período importado</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Sincronizacao() {
  const [ano,     setAno]     = useState(new Date().getFullYear())
  const [mes,     setMes]     = useState(new Date().getMonth() + 1)
  const [fase,    setFase]    = useState('idle')
  const [log,     setLog]     = useState([])
  const [refresh, setRefresh] = useState(0)

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const anos  = [2024,2025,2026,2027]
  const pad   = n => String(n).padStart(2,'0')
  const ultimoDia = (m,a) => new Date(a,m,0).getDate()
  const dtIni = `01/${pad(mes)}/${ano}`
  const dtFim = `${ultimoDia(mes,ano)}/${pad(mes)}/${ano}`

  const upd = (id, status, titulo, mensagem='', detalhe='') =>
    setLog(prev => {
      const item = { id, status, titulo, mensagem, detalhe }
      const idx  = prev.findIndex(p=>p.id===id)
      if (idx>=0) { const n=[...prev]; n[idx]=item; return n }
      return [...prev, item]
    })

  const rodar = async () => {
    setFase('rodando'); setLog([])
    const p = (id,s,t,m='',d='') => upd(id,s,t,m,d)

    try {
      // 1 — cria importação de conciliação
      p('imp','rodando','Criando importação de conciliação…')
      const imp = await restPost('importacoes', {
        periodo_inicio: `${ano}-${pad(mes)}-01`,
        periodo_fim:    `${ano}-${pad(mes)}-${ultimoDia(mes,ano)}`,
        total_linhas:   0,
        criado_por:     'portal',
      })
      const impId = imp.id
      p('imp','ok','Importação criada', `ID: ${impId}`)

      // 2 — conciliação por semanas
      const semanas = []
      for (let dia=1; dia<=ultimoDia(mes,ano); dia+=7) {
        const fim = Math.min(dia+6, ultimoDia(mes,ano))
        semanas.push({ ini:`${pad(dia)}/${pad(mes)}/${ano}`, fim:`${pad(fim)}/${pad(mes)}/${ano}` })
      }
      let totalLanc = 0
      for (let i=0; i<semanas.length; i++) {
        const s = semanas[i]
        p('concil','rodando',`Conciliação — semana ${i+1}/${semanas.length}`, `${s.ini} a ${s.fim}`)
        const r = await syncPost('conciliacao-sync', { periodo_inicio:s.ini, periodo_fim:s.fim, importacao_id:impId })
        totalLanc += r.inseridos || 0
      }
      p('concil','ok','Conciliação importada', `${int(totalLanc)} lançamentos`)

      // 3 — cria importação do razão
      p('rimp','rodando','Criando importação do razão…')
      const rimp = await restPost('razao_importacoes', {
        periodo_inicio: `${ano}-${pad(mes)}-01`,
        periodo_fim:    `${ano}-${pad(mes)}-${ultimoDia(mes,ano)}`,
        status:         'processando',
      })
      const rimpId = rimp.id
      p('rimp','ok','Importação do razão criada')

      // 4 — movimentos
      p('mov','rodando','Importando movimentos do razão…')
      const rMov = await syncPost('razao-sync-movimentos', { periodo_inicio:dtIni, periodo_fim:dtFim, importacao_id:rimpId })
      p('mov','ok','Movimentos importados', `${int(rMov.total_movimentos)} movimentos`)

      // 5 — saldo inicial
      p('saldo','rodando','Calculando saldo inicial…', 'posição acumulada antes do período')
      const rSaldo = await syncPost('razao-sync-saldo', { periodo_inicio:dtIni, importacao_id:rimpId })
      p('saldo','ok','Saldo inicial calculado', `${int(rSaldo.total_produtos)} produtos com saldo histórico`)

      // 6 — lançamentos contábeis
      p('ctb','rodando','Importando lançamentos contábeis do razão…')
      const rCtb = await syncPost('razao-sync-ctb', { periodo_inicio:dtIni, periodo_fim:dtFim, importacao_id:rimpId })
      p('ctb','ok','Lançamentos contábeis importados', `${int(rCtb.total_lancamentos_ctb)} lançamentos`)

      // finaliza razão
      await fetch(`${SUPABASE_URL}/rest/v1/razao_importacoes?id=eq.${rimpId}`, {
        method:'PATCH', headers:HDR_REST,
        body: JSON.stringify({ status:'pronto', total_movimentos: rMov.total_movimentos, concluido_em: new Date().toISOString() }),
      })

      // 7 — fechamento
      p('fech','rodando','Calculando fechamento…', `posição em ${dtFim}`)
      const rFech = await syncPost('fechamento-sync', { data_posicao:dtFim })
      p('fech','ok','Fechamento calculado',
        `Estoque: R$ ${brl(rFech.total_estoque)} · Contábil: R$ ${brl(rFech.total_contabil)}`,
        `Diferença: R$ ${brl(rFech.diferenca)} (${rFech.contas} contas)`)

      setFase('pronto')
      setRefresh(r=>r+1)
    } catch(err) {
      // marca o último passo como erro
      setLog(prev => {
        const n = [...prev]
        const ultimo = n.findLastIndex?.(p=>p.status==='rodando') ?? n.length-1
        if (n[ultimo]) n[ultimo] = { ...n[ultimo], status:'erro', detalhe: String(err?.message??err) }
        return n
      })
      setFase('erro')
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Seletor */}
      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'20px 22px' }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Importar período</div>
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500, display:'block', marginBottom:5 }}>Mês</label>
            <select value={mes} onChange={e=>setMes(Number(e.target.value))} disabled={fase==='rodando'} style={{
              fontFamily:'inherit', fontSize:13, padding:'8px 12px', border:'1px solid #E5E7EB', borderRadius:6, background:'#fff', minWidth:140,
            }}>
              {meses.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500, display:'block', marginBottom:5 }}>Ano</label>
            <select value={ano} onChange={e=>setAno(Number(e.target.value))} disabled={fase==='rodando'} style={{
              fontFamily:'inherit', fontSize:13, padding:'8px 12px', border:'1px solid #E5E7EB', borderRadius:6, background:'#fff',
            }}>
              {anos.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11.5, color:'#9CA3AF', marginBottom:6 }}>{dtIni} a {dtFim}</div>
            <button onClick={rodar} disabled={fase==='rodando'} style={{
              padding:'9px 22px', background:fase==='rodando'?'#9CA3AF':'#101828',
              color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:600,
              cursor:fase==='rodando'?'default':'pointer', fontFamily:'inherit',
            }}>
              {fase==='rodando' ? '↻ Importando…' : '▶ Importar período'}
            </button>
          </div>
        </div>

        <div style={{ marginTop:14, padding:'10px 14px', background:'#F9FAFB', borderRadius:6, fontSize:12, color:'#6B7280', lineHeight:1.6 }}>
          <strong>O que será importado:</strong> Conciliação (Dash × Razão) · Razão analítico · Fechamento (posição do último dia do mês).
          Cada passo aparece abaixo em tempo real. Ao concluir, clique <strong>Atualizar dados</strong> no topo.
        </div>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'18px 22px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700 }}>
              {fase==='rodando' ? '↻ Em andamento…' : fase==='pronto' ? '✅ Concluído com sucesso' : '✗ Erro — verifique abaixo'}
            </div>
            <span style={{ fontSize:12, color:'#9CA3AF' }}>{meses[mes-1]} / {ano}</span>
          </div>
          {log.map(p => <Passo key={p.id} {...p} />)}
          {fase==='pronto' && (
            <div style={{ marginTop:14, padding:'12px 16px', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:6, fontSize:13, color:'#166534' }}>
              ✅ Tudo importado. Clique <strong>↻ Atualizar dados</strong> no topo para ver os novos dados.
            </div>
          )}
        </div>
      )}

      <PeriodosDisponiveis refresh={refresh} />
    </div>
  )
}
