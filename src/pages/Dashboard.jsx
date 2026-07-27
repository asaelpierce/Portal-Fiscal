import React, { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LineChart, Line, PieChart, Pie,
} from 'recharts'
import { Card, Panel, Btn } from '../components/UI.jsx'
import { brl, brlK, int, dBR, isZero, classeDe, CLASSES } from '../config.js'

function Dica({ active, payload, label, moeda }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:6, padding:'8px 12px', fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,.1)' }}>
      <strong>{label || payload[0].name}</strong>
      <div>{moeda ? `R$ ${brl(payload[0].value)}` : int(payload[0].value)}</div>
    </div>
  )
}

export default function Dashboard({ lancamentos, resumos, onIrPara, onDetalhe }) {

  // KPIs vêm direto da classe_divergencia calculada no banco — sem lógica aqui
  const kpi = useMemo(() => {
    const porClasse = (c) => lancamentos.filter(r => r.classe_divergencia === c)
    const criticos    = porClasse('CRITICO')
    const investigar  = porClasse('INVESTIGAR')
    const arred       = porClasse('ARREDONDAMENTO')
    const interno     = porClasse('INTERNO')
    const ok          = porClasse('OK')
    const relevantes  = lancamentos.filter(r => r.classe_divergencia !== 'INTERNO')
    const taxaReal    = relevantes.length ? (ok.length / relevantes.length * 100) : 100

    return {
      total: lancamentos.length,
      ok: ok.length,
      criticos: criticos.length,
      investigar: investigar.length,
      arred: arred.length,
      interno: interno.length,
      taxaReal,
      valorCritico:   criticos.reduce((s,r) => s + Math.abs(Number(r.diferenca)||0), 0),
      valorInvestigar:investigar.reduce((s,r) => s + Math.abs(Number(r.diferenca)||0), 0),
      totalCusto: lancamentos.reduce((s,r) => s + Number(r.saldo_dash||0), 0),
      totalCtb:   lancamentos.reduce((s,r) => s + Number(r.saldo_contabil||0), 0),
      diff:       lancamentos.reduce((s,r) => s + Number(r.diferenca||0), 0),
    }
  }, [lancamentos])

  // Maiores críticos para fila de ação
  const criticos = useMemo(() =>
    lancamentos
      .filter(r => r.classe_divergencia === 'CRITICO')
      .sort((a,b) => Math.abs(Number(b.diferenca)||0) - Math.abs(Number(a.diferenca)||0))
  , [lancamentos])

  // Investigar em aberto
  const investigar = useMemo(() =>
    lancamentos
      .filter(r => r.classe_divergencia === 'INVESTIGAR')
      .sort((a,b) => Math.abs(Number(b.diferenca)||0) - Math.abs(Number(a.diferenca)||0))
  , [lancamentos])

  // Por conta — apenas críticos e investigar
  const porConta = useMemo(() => {
    const g = {}
    lancamentos
      .filter(r => ['CRITICO','INVESTIGAR'].includes(r.classe_divergencia))
      .forEach(r => {
        const k = r.conta_contabil || 'sem conta'
        if (!g[k]) g[k] = { conta: k, valor: 0, qtd: 0 }
        g[k].valor += Number(r.saldo_dash||0)
        g[k].qtd++
      })
    return Object.values(g).sort((a,b) => Math.abs(b.valor)-Math.abs(a.valor)).slice(0,8)
  }, [lancamentos])

  // Pizza de composição
  const pizza = Object.entries(CLASSES)
    .map(([k, v]) => ({ name: v.rot, value: lancamentos.filter(r => r.classe_divergencia === k).length, cor: v.cor }))
    .filter(x => x.value > 0)

  // Tendência
  const tendencia = resumos.map(r => ({
    dia: new Date(r.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
    diferenca: Number(r.diferenca_total||r.total_diferenca||0),
  }))

  const EIXO = { fill:'#9CA3AF', fontSize:11 }

  const alertaTexto = kpi.criticos > 0
    ? `🔴 ${kpi.criticos} lançamentos críticos somam R$ ${brl(kpi.valorCritico)} — requerem ação imediata.`
    : kpi.investigar > 0
      ? `⚠ ${kpi.investigar} lançamentos para investigar (R$ ${brl(kpi.valorInvestigar)}). Críticos: nenhum.`
      : '✅ Nenhum crítico ou investigar no período. Mês controlado.'

  const alertaCor = kpi.criticos > 0
    ? { bg:'#FEF2F2', border:'#FECACA', texto:'#991B1B' }
    : kpi.investigar > 0
      ? { bg:'#FFFBEB', border:'#FDE68A', texto:'#92400E' }
      : { bg:'#F0FDF4', border:'#BBF7D0', texto:'#166534' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Saldo custo x contábil */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1px 1fr 1px 1fr', background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'18px 24px', gap:0 }}>
        <div>
          <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Custo apurado · estoque</div>
          <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>R$ {brl(kpi.totalCusto)}</div>
        </div>
        <div style={{ background:'#E5E7EB' }} />
        <div style={{ paddingLeft:24 }}>
          <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Saldo contábil · lançamentos</div>
          <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>R$ {brl(kpi.totalCtb)}</div>
        </div>
        <div style={{ background:'#E5E7EB' }} />
        <div style={{ paddingLeft:24 }}>
          <div style={{ fontSize:11, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Diferença</div>
          <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums',
            color: isZero(kpi.diff) ? '#12805C' : kpi.diff > 0 ? '#B42318' : '#1D5BBF' }}>
            {kpi.diff > 0 ? '+' : ''}R$ {brl(kpi.diff)}
          </div>
          <div style={{ fontSize:11.5, color:'#9CA3AF', marginTop:3 }}>
            {isZero(kpi.diff) ? 'Totalmente conciliado' : kpi.diff > 0 ? 'Custo acima do contábil' : 'Contábil acima do custo'}
          </div>
        </div>
      </div>

      {/* Alerta situacional */}
      <div style={{ background:alertaCor.bg, border:`1px solid ${alertaCor.border}`, borderRadius:8, padding:'12px 16px', fontSize:13, color:alertaCor.texto }}>
        {alertaTexto}
        <span style={{ opacity:.7, marginLeft:8, fontSize:12 }}>
          Taxa real (excl. internos): <strong>{kpi.taxaReal.toFixed(1)}%</strong>
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:14 }}>
        <Card title="🔴 Críticos"         value={int(kpi.criticos)}  sub={`R$ ${brl(kpi.valorCritico)}`}   color="red" />
        <Card title="⚠ Investigar"        value={int(kpi.investigar)} sub={`R$ ${brl(kpi.valorInvestigar)}`} color="orange" />
        <Card title="~ Arredondamento"    value={int(kpi.arred)}      sub="aceitos automaticamente"          color="gray" />
        <Card title="↔ Internos (ruído)"  value={int(kpi.interno)}    sub="transferências/requisições"       color="gray" />
        <Card title="✓ Conciliados"       value={`${kpi.taxaReal.toFixed(1)}%`} sub={`${int(kpi.ok)} de ${int(lancamentos.filter(r=>r.classe_divergencia!=='INTERNO').length)}`} color={kpi.taxaReal>=95?'green':'orange'} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

        {/* Composição */}
        <Panel title="Composição dos lançamentos">
          <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:160 }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pizza} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>
                    {pizza.map((e,i) => <Cell key={i} fill={e.cor} />)}
                  </Pie>
                  <Tooltip content={<Dica />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:7 }}>
              {Object.entries(CLASSES).map(([k, v]) => {
                const n = lancamentos.filter(r => r.classe_divergencia === k).length
                return (
                  <li key={k} style={{ display:'flex', alignItems:'center', gap:8, opacity:n?1:0.35 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:v.cor, flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:12.5, color:'#374151' }}>{v.rot}</span>
                    <span style={{ fontWeight:700, fontSize:13, fontVariantNumeric:'tabular-nums' }}>{int(n)}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </Panel>

        {/* Barras por conta — só críticos+investigar */}
        <Panel title="Impacto por conta contábil" action={<span style={{ fontSize:11.5, color:'#9CA3AF' }}>críticos + investigar</span>}>
          {porConta.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porConta} layout="vertical" margin={{ left:8, right:22, top:4, bottom:4 }}>
                <CartesianGrid stroke="#F3F4F6" horizontal={false} />
                <XAxis type="number" tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="conta" width={64} tick={EIXO} axisLine={false} tickLine={false} />
                <Tooltip content={<Dica moeda />} cursor={{ fill:'#F9FAFB' }} />
                <Bar dataKey="valor" radius={[0,3,3,0]} barSize={12}>
                  {porConta.map((c,i) => <Cell key={i} fill={isZero(c.valor)?'#12805C':c.valor>0?'#B42318':'#1D5BBF'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign:'center', color:'#9CA3AF', padding:'40px 0', margin:0 }}>Nenhum crítico ou investigar. ✓</p>
          )}
        </Panel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

        {/* Fila de ação imediata */}
        <Panel title={`🔴 Ação imediata — ${int(criticos.length)}`}
          action={criticos.length > 7 ? <Btn small onClick={() => onIrPara('pendencias')}>ver todas →</Btn> : null}>
          <div>
            {criticos.slice(0,7).map((r,i) => (
              <button key={r.id||i} onClick={() => onDetalhe(r)} style={{
                display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 4px',
                background:'none', border:'none', borderBottom:'1px solid #F3F4F6',
                cursor:'pointer', textAlign:'left', fontFamily:'inherit',
              }}>
                <span style={{ fontSize:11, color:'#9CA3AF', width:18, flexShrink:0 }}>{i+1}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600 }}>NF {r.nota_fiscal}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.motivo_calculado || r.descr_top}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#B42318', fontVariantNumeric:'tabular-nums' }}>R$ {brl(r.diferenca)}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>{dBR(r.data_entrada_saida)}</div>
                </div>
              </button>
            ))}
            {!criticos.length && <p style={{ color:'#9CA3AF', textAlign:'center', padding:'24px 0', margin:0 }}>Nenhum crítico. ✓</p>}
          </div>
        </Panel>

        {/* Para investigar */}
        <Panel title={`⚠ Para investigar — ${int(investigar.length)}`}>
          <div>
            {investigar.slice(0,7).map((r,i) => (
              <button key={r.id||i} onClick={() => onDetalhe(r)} style={{
                display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 4px',
                background:'none', border:'none', borderBottom:'1px solid #F3F4F6',
                cursor:'pointer', textAlign:'left', fontFamily:'inherit',
              }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600 }}>NF {r.nota_fiscal} · {r.conta_contabil}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.motivo_calculado || r.descr_top}</div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'#B54708', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>R$ {brl(r.diferenca)}</div>
              </button>
            ))}
            {!investigar.length && <p style={{ color:'#9CA3AF', textAlign:'center', padding:'24px 0', margin:0 }}>Nada para investigar. ✓</p>}
          </div>
        </Panel>
      </div>

      {/* Tendência */}
      {tendencia.length > 1 && (
        <Panel title="Evolução da diferença total">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tendencia} margin={{ left:0, right:12, top:8, bottom:4 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<Dica moeda />} />
              <Line type="monotone" dataKey="diferenca" stroke="#1D5BBF" strokeWidth={2}
                dot={{ r:3, fill:'#1D5BBF', strokeWidth:0 }} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

    </div>
  )
}
