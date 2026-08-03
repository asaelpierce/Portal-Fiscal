import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'
import { sbFetch, brl, brlK, int, dBR } from '../config.js'
import { Panel, Select, SearchInput, Spinner, Btn } from '../components/UI.jsx'

const MESES_BR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const fmtMesAno = (yyyyMM) => { const [y,m] = yyyyMM.split('-'); return `${MESES_BR[parseInt(m)-1]}/${y.slice(2)}` }

function TooltipCard({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px',
      fontSize:12.5, boxShadow:'0 8px 24px rgba(16,24,40,.12)' }}>
      <div style={{ fontWeight:700, marginBottom:6 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:16, color:p.color }}>
          <span>{p.name}</span>
          <strong>R$ {brl(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function FluxoCaixa() {
  const [fase,   setFase]   = useState('carregando')
  const [erro,   setErro]   = useState('')
  const [dados,  setDados]  = useState([])
  const [porMes, setPorMes] = useState([])
  const [fFornecedor, setFFornecedor] = useState('')
  const [fFonte, setFFonte] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [busca,  setBusca]  = useState('')
  const [dtIni,  setDtIni]  = useState('')
  const [dtFim,  setDtFim]  = useState('')
  const [ordem,  setOrdem]  = useState({ col:'data_prevista', dir:1 })
  const tabelaRef = React.useRef(null)

  const clicarBarra = (mesISO, status) => {
    const [y, m] = mesISO.split('-')
    const ultimoDia = new Date(Number(y), Number(m), 0).getDate()
    setDtIni(`${y}-${m}-01`)
    setDtFim(`${y}-${m}-${String(ultimoDia).padStart(2,'0')}`)
    setFStatus(status)
    setFFornecedor(''); setFFonte(''); setBusca('')
    tabelaRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
  }

  const carregar = () => {
    setFase('carregando')
    Promise.all([
      sbFetch('fluxo_caixa_previsto?select=*&order=data_prevista.asc'),
      sbFetch('fluxo_caixa_por_mes?select=*'),
    ]).then(([d, m]) => {
      setDados(d || []); setPorMes(m || []); setFase('pronto')
    }).catch(e => { setErro(e.message); setFase('erro') })
  }

  useEffect(() => { carregar() }, [])

  const opcoes = useMemo(() => ({
    fornecedores: [...new Set(dados.map(r => r.fornecedor).filter(Boolean))].sort(),
  }), [dados])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(r => {
      if (fFornecedor && r.fornecedor !== fFornecedor) return false
      if (fFonte && r.fonte !== fFonte) return false
      if (fStatus && r.status_pagamento !== fStatus) return false
      if (dtIni && r.data_prevista < dtIni) return false
      if (dtFim && r.data_prevista > dtFim) return false
      if (q) {
        const h = `${r.numnota_oc} ${r.nf_entrada||''} ${r.fornecedor} ${r.descr_tipvenda}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dados, fFornecedor, fFonte, fStatus, dtIni, dtFim, busca])

  const ordenados = useMemo(() => {
    const a = [...filtrados]
    a.sort((x,y) => {
      const xv = x[ordem.col], yv = y[ordem.col]
      const xn = Number(xv), yn = Number(yv)
      if (!isNaN(xn) && !isNaN(yn) && xv !== null) return (xn - yn) * ordem.dir
      return String(xv ?? '').localeCompare(String(yv ?? ''), 'pt-BR') * ordem.dir
    })
    return a
  }, [filtrados, ordem])

  const kpi = useMemo(() => ({
    total: filtrados.reduce((s,r) => s + Number(r.valor_parcela||0), 0),
    pago: filtrados.filter(r => r.status_pagamento==='PAGO').reduce((s,r) => s + Number(r.valor_parcela||0), 0),
    aberto: filtrados.filter(r => r.status_pagamento==='ABERTO').reduce((s,r) => s + Number(r.valor_parcela||0), 0),
    semNf: filtrados.filter(r => r.fonte==='EMBARQUE').reduce((s,r) => s + Number(r.valor_parcela||0), 0),
    qtd: filtrados.length,
    qtdPago: filtrados.filter(r => r.status_pagamento==='PAGO').length,
    fornecedores: new Set(filtrados.map(r=>r.fornecedor)).size,
  }), [filtrados])

  const dadosGrafico = useMemo(() => porMes.map(m => ({
    mesISO: m.mes,
    mes: fmtMesAno(m.mes),
    pago: Number(m.total_pago||0),
    aberto: Number(m.total_aberto||0),
  })), [porMes])

  const exportar = () => {
    const cols = ['numnota_oc','nf_entrada','fornecedor','descr_tipvenda','sequencia_parcela',
                  'prazo_dias','percentual','valor_parcela','data_referencia','data_prevista','fonte',
                  'status_pagamento','data_pagamento','valor_pago']
    const csv = [cols.join(';'), ...ordenados.map(r=>cols.map(c=>String(r[c]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a = document.createElement('a'); a.href=url; a.download='fluxo-caixa-previsto.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const ord = col => setOrdem(p => p.col===col ? {col,dir:p.dir*-1} : {col,dir:1})
  const temFiltro = fFornecedor || fFonte || fStatus || dtIni || dtFim || busca

  if (fase === 'carregando') return <Spinner/>
  if (fase === 'erro') return (
    <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:16, color:'#B42318' }}>
      Erro: {erro}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {[
          { label:'Total previsto', valor:`R$ ${brl(kpi.total)}`, sub:`${int(kpi.qtd)} parcelas`, cor:'#101828' },
          { label:'Já pago', valor:`R$ ${brl(kpi.pago)}`, sub:`${int(kpi.qtdPago)} parcelas baixadas`, cor:'#12805C' },
          { label:'Em aberto', valor:`R$ ${brl(kpi.aberto)}`, sub:'ainda não pago', cor:'#B54708' },
          { label:'Fornecedores', valor: int(kpi.fornecedores), sub:'no período filtrado', cor:'#101828' },
        ].map((k,i) => (
          <div key={i} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'16px 18px' }}>
            <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:k.cor, fontVariantNumeric:'tabular-nums' }}>{k.valor}</div>
            <div style={{ fontSize:11.5, color:'#9CA3AF', marginTop:4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Gráfico mensal */}
      <Panel title="Previsão de pagamentos por mês">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dadosGrafico} margin={{ top:10, right:20, left:0, bottom:0 }}>
            <CartesianGrid stroke="#F3F4F6" vertical={false}/>
            <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={brlK}/>
            <Tooltip content={<TooltipCard/>}/>
            <Bar dataKey="pago" name="Já pago" stackId="a" fill="#12805C" radius={[0,0,0,0]}
              cursor="pointer" onClick={(d)=>clicarBarra(d.mesISO,'PAGO')}/>
            <Bar dataKey="aberto" name="Em aberto" stackId="a" fill="#B54708" radius={[4,4,0,0]}
              cursor="pointer" onClick={(d)=>clicarBarra(d.mesISO,'ABERTO')}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:'flex', gap:16, marginTop:10, fontSize:12, color:'#6B7280' }}>
          <span><span style={{display:'inline-block',width:9,height:9,background:'#12805C',borderRadius:2,marginRight:5}}/>Já pago — baixado no financeiro (TGFFIN)</span>
          <span><span style={{display:'inline-block',width:9,height:9,background:'#B54708',borderRadius:2,marginRight:5}}/>Em aberto — ainda não pago</span>
          <span style={{ color:'#9CA3AF' }}>· clique numa barra para ver as parcelas do mês</span>
        </div>
      </Panel>

      {/* Tabela detalhada */}
      <div ref={tabelaRef}>
      <Panel
        title={`${int(ordenados.length)} de ${int(dados.length)} parcelas`}
        action={
          <div style={{ display:'flex', gap:8 }}>
            {temFiltro && <Btn small onClick={()=>{setFFornecedor('');setFFonte('');setFStatus('');setDtIni('');setDtFim('');setBusca('')}}>✕ Limpar</Btn>}
            <Btn small onClick={carregar}>↻ Atualizar</Btn>
            <Btn small onClick={exportar}>↓ CSV</Btn>
          </div>
        }
      >
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:14, alignItems:'flex-end' }}>
          <Select label="Fornecedor" value={fFornecedor} onChange={setFFornecedor} options={opcoes.fornecedores}/>
          <Select label="Origem" value={fFonte} onChange={setFFonte} options={['NF','EMBARQUE']} placeholder="Todas"/>
          <Select label="Status" value={fStatus} onChange={setFStatus} options={['PAGO','ABERTO']} placeholder="Todos"/>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500, display:'block', marginBottom:5 }}>De</label>
            <input type="date" value={dtIni} onChange={e=>setDtIni(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500, display:'block', marginBottom:5 }}>Até</label>
            <input type="date" value={dtFim} onChange={e=>setDtFim(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }}/>
          </div>
          <SearchInput value={busca} onChange={setBusca} placeholder="pedido, NF, fornecedor…"/>
        </div>

        <div style={{ maxHeight:560, overflowY:'auto', overflowX:'auto', margin:'0 -18px -16px', borderTop:'1px solid #F3F4F6' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr>
                {[
                  ['numnota_oc','Pedido'], ['nf_entrada','NF'], ['fornecedor','Fornecedor'],
                  ['descr_tipvenda','Condição pgto'], ['sequencia_parcela','Parc.'],
                  ['valor_parcela','Valor',true], ['data_prevista','Prev. pagamento'],
                  ['status_pagamento','Status'], ['data_pagamento','Data pgto'],
                ].map(([k,label,num]) => (
                  <th key={k} onClick={()=>ord(k)} style={{
                    position:'sticky', top:0, background:'#F9FAFB', zIndex:1,
                    padding:'8px 12px', textAlign:num?'right':'left',
                    fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase',
                    letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap',
                    cursor:'pointer', userSelect:'none',
                  }}>
                    {label} {ordem.col===k ? (ordem.dir>0?'↑':'↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenados.slice(0,500).map((r,i) => (
                <tr key={r.id||i} style={{ background: r.status_pagamento==='PAGO' ? '#F0FDF4' : '#fff' }}>
                  <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.numnota_oc}</td>
                  <td style={{ padding:'8px 12px', color: r.nf_entrada ? '#374151' : '#9CA3AF' }}>{r.nf_entrada || '—'}</td>
                  <td style={{ padding:'8px 12px', color:'#6B7280', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.fornecedor}>{r.fornecedor}</td>
                  <td style={{ padding:'8px 12px', color:'#6B7280', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.descr_tipvenda}>{r.descr_tipvenda}</td>
                  <td style={{ padding:'8px 12px', textAlign:'center' }}>{r.sequencia_parcela}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>R$ {brl(r.valor_parcela)}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600, whiteSpace:'nowrap' }}>{dBR(r.data_prevista)}</td>
                  <td style={{ padding:'8px 12px' }}>
                    <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:4,
                      background: r.status_pagamento==='PAGO' ? '#D1FAE5' : '#FEF3C7',
                      color: r.status_pagamento==='PAGO' ? '#12805C' : '#B54708' }}>
                      {r.status_pagamento==='PAGO' ? '✓ Pago' : 'Aberto'}
                    </span>
                  </td>
                  <td style={{ padding:'8px 12px', color:'#9CA3AF', whiteSpace:'nowrap' }}>{r.data_pagamento ? dBR(r.data_pagamento) : '—'}</td>
                </tr>
              ))}
              {!ordenados.length && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:'28px', color:'#9CA3AF' }}>Nenhum registro.</td></tr>
              )}
              {ordenados.length > 500 && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:'12px', color:'#9CA3AF', fontSize:12 }}>
                  Mostrando 500 de {int(ordenados.length)} — refine os filtros ou exporte o CSV.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      </div>

      <p style={{ fontSize:12, color:'#9CA3AF', margin:0, lineHeight:1.6 }}>
        <strong>Como funciona:</strong> parcelas calculadas a partir dos pedidos de compra e sua condição de pagamento.
        Pedidos que já têm nota fiscal de entrada usam a data da NF como referência; pedidos ainda sem NF usam a data
        de embarque prevista. Dados a partir de janeiro/2026. Pedidos sem NF com embarque previsto ha mais de 60 dias sao ignorados (provavelmente ja resolvidos ou cancelados).
      </p>
    </div>
  )
}
