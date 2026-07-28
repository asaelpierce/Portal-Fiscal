import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { sbFetch, brl, brlK, int, dBR, classeDe, CLASSES } from '../config.js'
import { Panel, Spinner } from '../components/UI.jsx'

const MESES_BR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const fmtMes = iso => { const [y,m] = String(iso).slice(0,7).split('-'); return `${MESES_BR[parseInt(m)-1]}/${y.slice(2)}` }
const fmtData = iso => { const [y,m,d] = String(iso).slice(0,10).split('-'); return `${d}/${m}` }

function TooltipCard({ active, payload, label, moeda, pct }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px',
      fontSize:12.5, boxShadow:'0 8px 24px rgba(16,24,40,.12)' }}>
      <div style={{ fontWeight:700, marginBottom:6 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:16, color:p.color }}>
          <span>{p.name}</span>
          <strong>{moeda ? `R$ ${brl(p.value)}` : pct ? `${p.value}%` : int(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [evolucao, setEvolucao] = useState([])
  const [fechamentos, setFechamentos] = useState([])
  const [topContas, setTopContas] = useState([])

  useEffect(() => {
    Promise.all([
      sbFetch('dashboard_evolucao_mensal?select=*'),
      sbFetch('dashboard_fechamento_evolucao?select=*'),
      sbFetch('dashboard_top_contas?select=*&order=soma_diferenca.asc'),
    ])
    .then(([ev, fc, tc]) => {
      setEvolucao(ev || [])
      setFechamentos(fc || [])
      setTopContas(tc || [])
      setFase('pronto')
    })
    .catch(e => { setErro(e.message); setFase('erro') })
  }, [])

  const dadosEvolucao = useMemo(() => evolucao.map(e => ({
    mes: fmtMes(e.periodo_fim),
    taxa: Number(e.taxa_conciliacao),
    ok: Number(e.qtd_ok),
    investigar: Number(e.qtd_investigar) + Number(e.qtd_critico),
    ajuste: Number(e.qtd_ajuste),
    custo: Number(e.custo_total),
    ctb: Number(e.ctb_total),
    dif: Number(e.dif_total),
    valorInvestigar: Number(e.valor_investigar || 0),
  })), [evolucao])

  const dadosFechamento = useMemo(() => fechamentos.map(f => ({
    data: dBR(f.data_posicao).slice(0,5),
    estoque: Number(f.total_estoque),
    contabil: Number(f.total_contabil),
    diferenca: Number(f.diferenca),
    contas: Number(f.qtd_contas),
    conferem: Number(f.contas_conferem),
  })), [fechamentos])

  const ultimoMes = dadosEvolucao[dadosEvolucao.length - 1]
  const ultimoFechamento = dadosFechamento[dadosFechamento.length - 1]

  const kpis = useMemo(() => {
    const totalLanc = evolucao.reduce((s,e) => s + Number(e.total), 0)
    const totalOk   = evolucao.reduce((s,e) => s + Number(e.qtd_ok), 0)
    const totalInv  = evolucao.reduce((s,e) => s + Number(e.qtd_investigar) + Number(e.qtd_critico), 0)
    const valorInv  = evolucao.reduce((s,e) => s + Number(e.valor_investigar || 0), 0)
    const taxaMedia = evolucao.length ? evolucao.reduce((s,e) => s + Number(e.taxa_conciliacao), 0) / evolucao.length : 0
    return { totalLanc, totalOk, totalInv, valorInv, taxaMedia }
  }, [evolucao])

  const pizzaUltimoMes = ultimoMes ? [
    { name: 'Conciliado', value: ultimoMes.ok, cor: '#12805C' },
    { name: 'Ajuste de custo', value: ultimoMes.ajuste, cor: '#9CA3AF' },
    { name: 'Investigar', value: ultimoMes.investigar, cor: '#B54708' },
  ].filter(x => x.value > 0) : []

  const contasComProblema = useMemo(() =>
    topContas.filter(c => Math.abs(Number(c.soma_diferenca)) > 1)
      .sort((a,b) => Math.abs(Number(b.soma_diferenca)) - Math.abs(Number(a.soma_diferenca)))
      .slice(0, 8)
      .map(c => ({ conta: c.conta_contabil, valor: Number(c.soma_diferenca), investigar: Number(c.valor_investigar || 0) }))
  , [topContas])

  if (fase === 'carregando') return <Spinner/>
  if (fase === 'erro') return (
    <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:16, color:'#B42318' }}>
      Erro: {erro}
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* KPIs principais */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {[
          { label:'Taxa de conciliação média', valor:`${kpis.taxaMedia.toFixed(1)}%`,
            sub:`${evolucao.length} meses analisados`, cor: kpis.taxaMedia >= 95 ? '#12805C' : '#B54708' },
          { label:'Lançamentos processados', valor: int(kpis.totalLanc),
            sub:`${int(kpis.totalOk)} conciliados`, cor:'#101828' },
          { label:'Para investigar (acumulado)', valor: int(kpis.totalInv),
            sub:`R$ ${brl(kpis.valorInv)} em risco`, cor: kpis.totalInv > 0 ? '#B54708' : '#12805C' },
          { label:'Último fechamento', valor: ultimoFechamento ? `R$ ${brl(Math.abs(ultimoFechamento.diferenca))}` : '—',
            sub: ultimoFechamento ? `${ultimoFechamento.conferem}/${ultimoFechamento.contas} contas conferem` : '',
            cor: ultimoFechamento && Math.abs(ultimoFechamento.diferenca) < 100 ? '#12805C' : '#B54708' },
        ].map((k,i) => (
          <div key={i} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'16px 18px' }}>
            <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
              {k.label}
            </div>
            <div style={{ fontSize:24, fontWeight:800, color:k.cor, fontVariantNumeric:'tabular-nums' }}>{k.valor}</div>
            <div style={{ fontSize:11.5, color:'#9CA3AF', marginTop:4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Linha: Taxa de conciliação + Composição do último mês */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <Panel title="Taxa de conciliação por mês">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dadosEvolucao} margin={{ top:10, right:20, left:0, bottom:0 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false}/>
              <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`}/>
              <Tooltip content={<TooltipCard pct/>}/>
              <Line type="monotone" dataKey="taxa" name="Taxa de conciliação" stroke="#1D5BBF" strokeWidth={2.5}
                dot={{ r:4, fill:'#1D5BBF' }} activeDot={{ r:6 }}/>
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={`Composição — ${ultimoMes?.mes || 'último mês'}`}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pizzaUltimoMes} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {pizzaUltimoMes.map((e,i) => <Cell key={i} fill={e.cor}/>)}
              </Pie>
              <Tooltip content={<TooltipCard/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
            {pizzaUltimoMes.map((e,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12 }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:e.cor, flexShrink:0 }}/>
                <span style={{ flex:1, color:'#374151' }}>{e.name}</span>
                <span style={{ fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{int(e.value)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Custo apurado x Contábil — barras comparativas por mês */}
      <Panel title="Custo apurado × Saldo contábil — fluxo mensal">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dadosEvolucao} margin={{ top:10, right:20, left:0, bottom:0 }}>
            <CartesianGrid stroke="#F3F4F6" vertical={false}/>
            <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={brlK}/>
            <Tooltip content={<TooltipCard moeda/>}/>
            <Legend wrapperStyle={{ fontSize:12 }}/>
            <Bar dataKey="custo" name="Custo apurado" fill="#1D5BBF" radius={[4,4,0,0]}/>
            <Bar dataKey="ctb"   name="Saldo contábil" fill="#9CA3AF" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Evolução do Fechamento (saldo acumulado) */}
      <Panel title="Fechamento — Estoque × Contabilidade (posição acumulada)">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dadosFechamento} margin={{ top:10, right:20, left:0, bottom:0 }}>
            <defs>
              <linearGradient id="gEst" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1D5BBF" stopOpacity={0.25}/>
                <stop offset="100%" stopColor="#1D5BBF" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gCtb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9CA3AF" stopOpacity={0.2}/>
                <stop offset="100%" stopColor="#9CA3AF" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#F3F4F6" vertical={false}/>
            <XAxis dataKey="data" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={brlK}/>
            <Tooltip content={<TooltipCard moeda/>}/>
            <Legend wrapperStyle={{ fontSize:12 }}/>
            <Area type="monotone" dataKey="estoque"  name="Estoque"    stroke="#1D5BBF" fill="url(#gEst)" strokeWidth={2.5}/>
            <Area type="monotone" dataKey="contabil" name="Contábil"   stroke="#9CA3AF" fill="url(#gCtb)" strokeWidth={2.5}/>
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Linha: Quantidade por classe + Contas com maior desvio */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Panel title="Lançamentos por situação — evolução mensal">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dadosEvolucao} margin={{ top:10, right:20, left:0, bottom:0 }} stackOffset="sign">
              <CartesianGrid stroke="#F3F4F6" vertical={false}/>
              <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<TooltipCard/>}/>
              <Legend wrapperStyle={{ fontSize:11 }}/>
              <Bar dataKey="ok"         name="Conciliado"      stackId="a" fill="#12805C" radius={[0,0,0,0]}/>
              <Bar dataKey="ajuste"     name="Ajuste de custo" stackId="a" fill="#D1D5DB"/>
              <Bar dataKey="investigar" name="Investigar"      stackId="a" fill="#B54708" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Contas com maior desvio acumulado (todos os meses)">
          {contasComProblema.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={contasComProblema} layout="vertical" margin={{ top:10, right:30, left:10, bottom:0 }}>
                <CartesianGrid stroke="#F3F4F6" horizontal={false}/>
                <XAxis type="number" tick={{ fontSize:11, fill:'#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={brlK}/>
                <YAxis type="category" dataKey="conta" tick={{ fontSize:11.5, fill:'#374151' }} axisLine={false} tickLine={false} width={70}/>
                <Tooltip content={<TooltipCard moeda/>}/>
                <Bar dataKey="valor" name="Diferença" radius={[0,4,4,0]}>
                  {contasComProblema.map((c,i) => (
                    <Cell key={i} fill={c.valor >= 0 ? '#1D5BBF' : '#B54708'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding:'60px 20px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>
              Nenhuma conta com desvio relevante.
            </div>
          )}
        </Panel>
      </div>

      {/* Tabela resumo mensal */}
      <Panel title="Resumo por mês">
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr>
                {['Mês','Lançamentos','Conciliado','Investigar','Ajuste','Taxa','Custo apurado','Saldo contábil','Diferença'].map(h => (
                  <th key={h} style={{
                    padding:'9px 12px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB',
                    textAlign:['Lançamentos','Conciliado','Investigar','Ajuste','Taxa','Custo apurado','Saldo contábil','Diferença'].includes(h) ? 'right' : 'left',
                    fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dadosEvolucao.map((e,i) => (
                <tr key={i} style={{ borderBottom:'1px solid #F9FAFB' }}>
                  <td style={{ padding:'9px 12px', fontWeight:600 }}>{e.mes}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{int(e.ok + e.investigar + e.ajuste)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', color:'#12805C', fontVariantNumeric:'tabular-nums' }}>{int(e.ok)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', color: e.investigar > 0 ? '#B54708' : '#9CA3AF', fontVariantNumeric:'tabular-nums' }}>{int(e.investigar)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', color:'#9CA3AF', fontVariantNumeric:'tabular-nums' }}>{int(e.ajuste)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700, color: e.taxa >= 95 ? '#12805C' : '#B54708', fontVariantNumeric:'tabular-nums' }}>{e.taxa}%</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(e.custo)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(e.ctb)}</td>
                  <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums',
                    color: Math.abs(e.dif) < 10 ? '#12805C' : '#B54708' }}>
                    {e.dif > 0 ? '+' : ''}R$ {brl(e.dif)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
