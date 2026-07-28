import React, { useState, useEffect } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl, int, dBR } from '../config.js'

const SYNC_URL = `${SUPABASE_URL}/functions/v1`
const SYNC_KEY = 'kb2026sync!'
const HDR_REST = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
const HDR_SYNC = { ...HDR_REST, 'x-api-key': SYNC_KEY }

async function restPost(tabela, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
    method: 'POST', headers: { ...HDR_REST, Prefer: 'return=representation' }, body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`${tabela}: ${JSON.stringify(data).slice(0,200)}`)
  if (!data[0]?.id) throw new Error(`${tabela}: ID não retornado — ${JSON.stringify(data).slice(0,200)}`)
  return data[0]
}

async function syncPost(endpoint, body) {
  const res = await fetch(`${SYNC_URL}/${endpoint}`, { method:'POST', headers:HDR_SYNC, body:JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok || (!data.ok && data.total_estoque===undefined)) throw new Error(data.erro || `HTTP ${res.status}`)
  return data
}

// converte YYYY-MM-DD → DD/MM/YYYY
function isoParaBR(s) {
  const [y,m,d] = s.split('-')
  return `${d}/${m}/${y}`
}
// converte YYYY-MM-DD → Date obj
function parseISO(s) { return new Date(s + 'T00:00:00') }

// gera semanas de 7 dias entre dtIni e dtFim (formato DD/MM/YYYY)
function gerarSemanas(dtIniBR, dtFimBR) {
  const [di, mi, ai] = dtIniBR.split('/')
  const [df, mf, af] = dtFimBR.split('/')
  const inicio = new Date(`${ai}-${mi}-${di}T00:00:00`)
  const fim    = new Date(`${af}-${mf}-${df}T00:00:00`)
  const semanas = []
  let cur = new Date(inicio)
  while (cur <= fim) {
    const iniSem = new Date(cur)
    const fimSem = new Date(cur)
    fimSem.setDate(fimSem.getDate() + 6)
    if (fimSem > fim) fimSem.setTime(fim.getTime())
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    semanas.push({ ini: fmt(iniSem), fim: fmt(fimSem) })
    cur.setDate(cur.getDate() + 7)
  }
  return semanas
}

function Passo({ status, titulo, mensagem, detalhe }) {
  const C = { ok:{bg:'#D1FAE5',cor:'#12805C',ic:'✓'}, erro:{bg:'#FEE2E2',cor:'#B42318',ic:'✗'}, rodando:{bg:'#DBEAFE',cor:'#1D5BBF',ic:'↻'}, idle:{bg:'#F3F4F6',cor:'#9CA3AF',ic:'○'} }
  const c = C[status] || C.idle
  return (
    <div style={{display:'flex',gap:12,padding:'9px 0',borderBottom:'1px solid #F3F4F6'}}>
      <div style={{width:26,height:26,borderRadius:'50%',background:c.bg,color:c.cor,
        display:'grid',placeItems:'center',fontWeight:700,fontSize:12,flexShrink:0,
        animation:status==='rodando'?'spin 1s linear infinite':'none'}}>{c.ic}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:status==='idle'?'#374151':c.cor}}>{titulo}</div>
        {mensagem&&<div style={{fontSize:12,color:'#6B7280',marginTop:2}}>{mensagem}</div>}
        {detalhe &&<div style={{fontSize:11.5,color:'#9CA3AF',marginTop:1,fontVariantNumeric:'tabular-nums'}}>{detalhe}</div>}
      </div>
    </div>
  )
}

function PeriodosDisponiveis({ refresh }) {
  const [concil,setConcil]=useState([])
  const [razao,setRazao]=useState([])
  const [fech,setFech]=useState([])
  useEffect(()=>{
    sbFetch('importacoes?select=id,periodo_inicio,periodo_fim,total_linhas&order=periodo_inicio.desc').then(r=>setConcil(r||[])).catch(()=>{})
    sbFetch('razao_importacoes?select=id,periodo_inicio,periodo_fim,total_movimentos,status&order=periodo_inicio.desc').then(r=>setRazao(r||[])).catch(()=>{})
    sbFetch('fechamento_saldos?select=data_posicao&order=data_posicao.desc').then(r=>setFech([...new Set((r||[]).map(x=>x.data_posicao))])).catch(()=>{})
  },[refresh])
  const fmt = s => { const [y,m,d]=String(s).slice(0,10).split('-'); return `${d}/${m}/${y}` }
  const fmtP = (i,f) => `${fmt(i)} → ${fmt(f)}`
  return (
    <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'18px 22px'}}>
      <div style={{fontSize:13,fontWeight:600,marginBottom:14}}>Períodos disponíveis no banco</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:20}}>
        {[
          {label:'Conciliação',items:concil.map(i=>({k:i.id,txt:fmtP(i.periodo_inicio,i.periodo_fim),sub:`${int(i.total_linhas)} lançamentos`}))},
          {label:'Razão analítico',items:razao.map(i=>({k:i.id,txt:fmtP(i.periodo_inicio,i.periodo_fim),sub:`${int(i.total_movimentos)} movimentos · ${i.status}`}))},
          {label:'Fechamento',items:fech.map(d=>({k:d,txt:`Posição em ${fmt(d)}`,sub:'✓ disponível'}))},
        ].map(col=>(
          <div key={col.label}>
            <div style={{fontSize:10.5,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>{col.label}</div>
            {col.items.length
              ? col.items.map(i=>(
                <div key={i.k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #F9FAFB',fontSize:12.5}}>
                  <span>{i.txt}</span><span style={{color:'#9CA3AF',fontSize:11.5}}>{i.sub}</span>
                </div>))
              : <div style={{fontSize:12,color:'#9CA3AF'}}>Nenhum período importado</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Sincronizacao() {
  // hoje e primeiro dia do mês como padrão
  const hoje     = new Date()
  const primDia  = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fmtInput = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const [dtIniISO, setDtIniISO] = useState(fmtInput(primDia))
  const [dtFimISO, setDtFimISO] = useState(fmtInput(hoje))
  const [inclRazao, setInclRazao] = useState(true)
  const [inclFech,  setInclFech]  = useState(true)
  const [fase,    setFase]    = useState('idle')
  const [log,     setLog]     = useState([])
  const [refresh, setRefresh] = useState(0)

  const dtIniBR = isoParaBR(dtIniISO)
  const dtFimBR = isoParaBR(dtFimISO)
  const dtValida = dtIniISO && dtFimISO && dtIniISO <= dtFimISO

  const upd = (id,s,t,m='',d='') =>
    setLog(prev => {
      const item={id,status:s,titulo:t,mensagem:m,detalhe:d}
      const idx=prev.findIndex(p=>p.id===id)
      if(idx>=0){const n=[...prev];n[idx]=item;return n}
      return [...prev,item]
    })

  const rodar = async () => {
    if (!dtValida) return
    setFase('rodando'); setLog([])
    try {
      // ── 1. Importação de conciliação ──────────────────────────────────
      upd('imp','rodando','Criando registro de conciliação…')
      const imp = await restPost('importacoes',{
        periodo_inicio: dtIniISO, periodo_fim: dtFimISO, total_linhas:0, criado_por:'portal'
      })
      upd('imp','ok','Registro criado',`ID: ${imp.id}`)

      // ── 2. Sincroniza semana a semana ─────────────────────────────────
      const semanas = gerarSemanas(dtIniBR, dtFimBR)
      let totalLanc = 0
      for (let i=0; i<semanas.length; i++) {
        const s = semanas[i]
        upd('concil','rodando',`Conciliação — semana ${i+1}/${semanas.length}`,`${s.ini} a ${s.fim}`)
        const r = await syncPost('conciliacao-sync',{periodo_inicio:s.ini,periodo_fim:s.fim,importacao_id:imp.id})
        totalLanc += r.inseridos || 0
      }
      upd('concil','ok','Conciliação importada',`${int(totalLanc)} lançamentos`)

      // ── 3. Razão (opcional) ───────────────────────────────────────────
      if (inclRazao) {
        upd('rimp','rodando','Criando registro do razão…')
        const rimp = await restPost('razao_importacoes',{
          periodo_inicio:dtIniISO, periodo_fim:dtFimISO, status:'processando'
        })
        upd('rimp','ok','Registro do razão criado')

        upd('mov','rodando','Importando movimentos…')
        const rMov = await syncPost('razao-sync-movimentos',{periodo_inicio:dtIniBR,periodo_fim:dtFimBR,importacao_id:rimp.id})
        upd('mov','ok','Movimentos importados',`${int(rMov.total_movimentos)} movimentos`)

        upd('saldo','rodando','Calculando saldo inicial…','posição acumulada antes do período')
        const rSaldo = await syncPost('razao-sync-saldo',{periodo_inicio:dtIniBR,importacao_id:rimp.id})
        upd('saldo','ok','Saldo inicial calculado',`${int(rSaldo.total_produtos)} produtos`)

        upd('ctb','rodando','Importando lançamentos contábeis…')
        const rCtb = await syncPost('razao-sync-ctb',{periodo_inicio:dtIniBR,periodo_fim:dtFimBR,importacao_id:rimp.id})
        upd('ctb','ok','Lançamentos contábeis importados',`${int(rCtb.total_lancamentos_ctb)} lançamentos`)

        await fetch(`${SUPABASE_URL}/rest/v1/razao_importacoes?id=eq.${rimp.id}`,{
          method:'PATCH',headers:HDR_REST,
          body:JSON.stringify({status:'pronto',total_movimentos:rMov.total_movimentos,concluido_em:new Date().toISOString()})
        })
      }

      // ── 4. Fechamento (opcional) ──────────────────────────────────────
      if (inclFech) {
        upd('fech','rodando','Calculando fechamento…',`posição em ${dtFimBR}`)
        const rFech = await syncPost('fechamento-sync',{data_posicao:dtFimBR})
        upd('fech','ok','Fechamento calculado',
          `Estoque R$ ${brl(rFech.total_estoque)} · Contábil R$ ${brl(rFech.total_contabil)}`,
          `Diferença R$ ${brl(rFech.diferenca)} · ${rFech.contas} contas`)
      }

      setFase('pronto'); setRefresh(r=>r+1)
    } catch(err) {
      setLog(prev=>{
        const n=[...prev]
        const idx=n.findLastIndex?.(p=>p.status==='rodando')??n.length-1
        if(n[idx]) n[idx]={...n[idx],status:'erro',detalhe:String(err?.message??err)}
        return n
      })
      setFase('erro')
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Seletor de período ── */}
      <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'20px 22px'}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:18}}>Selecionar período</div>

        <div style={{display:'flex',gap:14,alignItems:'flex-end',flexWrap:'wrap'}}>
          {/* De */}
          <div>
            <label style={{fontSize:11,color:'#6B7280',fontWeight:500,display:'block',marginBottom:5}}>De</label>
            <input type="date" value={dtIniISO} onChange={e=>setDtIniISO(e.target.value)}
              disabled={fase==='rodando'}
              style={{fontFamily:'inherit',fontSize:13,padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:6,background:'#fff',color:'#101828'}}/>
          </div>

          <div style={{fontSize:18,color:'#9CA3AF',paddingBottom:8}}>→</div>

          {/* Até */}
          <div>
            <label style={{fontSize:11,color:'#6B7280',fontWeight:500,display:'block',marginBottom:5}}>Até</label>
            <input type="date" value={dtFimISO} onChange={e=>setDtFimISO(e.target.value)}
              disabled={fase==='rodando'}
              style={{fontFamily:'inherit',fontSize:13,padding:'8px 12px',border:'1px solid #E5E7EB',borderRadius:6,background:'#fff',color:'#101828'}}/>
          </div>

          {/* Atalhos rápidos */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:11,color:'#6B7280',fontWeight:500}}>Atalhos</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {[
                {l:'Mês atual', fn:()=>{ const h=new Date(); setDtIniISO(fmtInput(new Date(h.getFullYear(),h.getMonth(),1))); setDtFimISO(fmtInput(new Date(h.getFullYear(),h.getMonth()+1,0))) }},
                {l:'Mês ant.',  fn:()=>{ const h=new Date(); setDtIniISO(fmtInput(new Date(h.getFullYear(),h.getMonth()-1,1))); setDtFimISO(fmtInput(new Date(h.getFullYear(),h.getMonth(),0))) }},
                {l:'Jun/26',   fn:()=>{ setDtIniISO('2026-06-01'); setDtFimISO('2026-06-30') }},
                {l:'Jul/26',   fn:()=>{ setDtIniISO('2026-07-01'); setDtFimISO('2026-07-31') }},
              ].map(({l,fn})=>(
                <button key={l} onClick={fn} disabled={fase==='rodando'} style={{
                  padding:'5px 10px',fontSize:11.5,border:'1px solid #E5E7EB',borderRadius:5,
                  background:'#F9FAFB',cursor:'pointer',fontFamily:'inherit',color:'#374151',
                }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Opções */}
        <div style={{display:'flex',gap:20,marginTop:16,flexWrap:'wrap'}}>
          <label style={{display:'flex',alignItems:'center',gap:7,fontSize:13,cursor:'pointer'}}>
            <input type="checkbox" checked={inclRazao} onChange={e=>setInclRazao(e.target.checked)} disabled={fase==='rodando'}/>
            Importar razão analítico de estoque
          </label>
          <label style={{display:'flex',alignItems:'center',gap:7,fontSize:13,cursor:'pointer'}}>
            <input type="checkbox" checked={inclFech} onChange={e=>setInclFech(e.target.checked)} disabled={fase==='rodando'}/>
            Calcular fechamento (posição em {dtFimBR})
          </label>
        </div>

        {!dtValida && dtIniISO && dtFimISO && (
          <div style={{marginTop:10,fontSize:12.5,color:'#B42318'}}>⚠ Data inicial deve ser menor ou igual à data final.</div>
        )}

        <div style={{marginTop:16}}>
          <button onClick={rodar} disabled={fase==='rodando'||!dtValida} style={{
            padding:'10px 24px',background:(!dtValida||fase==='rodando')?'#9CA3AF':'#101828',
            color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:600,
            cursor:(!dtValida||fase==='rodando')?'default':'pointer',fontFamily:'inherit',
          }}>
            {fase==='rodando'?'↻ Importando…':'▶ Importar período'}
          </button>

          {dtValida && fase==='idle' && (
            <span style={{marginLeft:14,fontSize:12.5,color:'#9CA3AF'}}>
              {dtIniBR} a {dtFimBR} · {gerarSemanas(dtIniBR,dtFimBR).length} semana(s)
              {inclRazao?' · razão':''}
              {inclFech?' · fechamento':''}
            </span>
          )}
        </div>
      </div>

      {/* ── Log de execução ── */}
      {log.length>0 && (
        <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'18px 22px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700}}>
              {fase==='rodando'?'↻ Em andamento…':fase==='pronto'?'✅ Concluído':' ✗ Erro'}
            </div>
            <span style={{fontSize:12,color:'#9CA3AF'}}>{dtIniBR} a {dtFimBR}</span>
          </div>
          {log.map(p=><Passo key={p.id} {...p}/>)}
          {fase==='pronto'&&(
            <div style={{marginTop:14,padding:'12px 16px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:6,fontSize:13,color:'#166534'}}>
              ✅ Importação concluída. Clique <strong>↻ Atualizar dados</strong> no topo para ver os novos dados em todas as telas.
            </div>
          )}
        </div>
      )}

      <PeriodosDisponiveis refresh={refresh}/>
    </div>
  )
}
