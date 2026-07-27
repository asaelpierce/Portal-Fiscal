import React, { useMemo, useState } from 'react'
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

// Agrupa críticos por TOP para mostrar o padrão
function GrupoCriticos({ items }) {
  const grupos = useMemo(() => {
    const g = {}
    items.forEach(r => {
      const k = r.cod_top || 'outro'
      if (!g[k]) g[k] = { cod: k, descr: r.descr_top, items: [], valorTotal: 0 }
      g[k].items.push(r)
      g[k].valorTotal += Math.abs(Number(r.diferenca) || 0)
    })
    return Object.values(g).sort((a,b) => b.valorTotal - a.valorTotal)
  }, [items])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {grupos.map(g => (
        <div key={g.cod} style={{ border:'1px solid #FECACA', borderRadius:8, overflow:'hidden' }}>
          {/* Cabeçalho do grupo */}
          <div style={{ background:'#FEF2F2', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <span style={{ fontSize:11, fontWeight:700, color:'#991B1B', textTransform:'uppercase', letterSpacing:'.06em' }}>
                TOP {g.cod}
              </span>
              <span style={{ fontSize:13, fontWeight:600, color:'#7F1D1D', marginLeft:8 }}>{g.descr}</span>
            </div>
            <div style={{ textAlign:'right' }}>
              <span style={{ fontSize:12, color:'#991B1B' }}>{g.items.length} lançamento{g.items.length > 1 ? 's' : ''} · </span>
              <span style={{ fontSize:13, fontWeight:700, color:'#B42318' }}>R$ {brl(g.valorTotal)}</span>
            </div>
          </div>
          {/* Linhas do grupo */}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr style={{ background:'#FFF5F5' }}>
                {['Nota','Conta','Local','Data','Custo','Contábil','Diferença','Diagnóstico'].map(h => (
                  <th key={h} style={{
                    padding:'6px 12px', textAlign:['Custo','Contábil','Diferença'].includes(h)?'right':'left',
                    fontSize:10.5, fontWeight:600, color:'#9CA3AF', borderBottom:'1px solid #FECACA',
                    textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.items.map((r,i) => (
                <tr key={r.id||i} style={{ borderBottom:'1px solid #FEF2F2' }}>
                  <td style={TD2}><strong>{r.nota_fiscal}</strong></td>
                  <td style={{ ...TD2, fontVariantNumeric:'tabular-nums' }}>{r.conta_contabil}</td>
                  <td style={{ ...TD2, color:'#6B7280', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.descr_local}</td>
                  <td style={{ ...TD2, color:'#9CA3AF', whiteSpace:'nowrap' }}>{dBR(r.data_entrada_saida)}</td>
                  <td style={{ ...TD2, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(r.saldo_dash)}</td>
                  <td style={{ ...TD2, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(r.saldo_contabil)}</td>
                  <td style={{ ...TD2, textAlign:'right', fontWeight:700, color:'#B42318', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>
                    R$ {brl(r.diferenca)}
                  </td>
                  <td style={{ ...TD2, fontSize:11, color:'#6B7280', maxWidth:200 }}>{r.motivo_calculado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

const TD2 = { padding:'7px 12px', fontSize:12.5 }

export default function Dashboard({ lancamentos, resumos, onIrPara, onDetalhe }) {
  const [verTodosInv, setVerTodosInv] = useState(false)

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
      valorCritico:   criticos.reduce((s,r)=>s+Math.abs(Number(r.diferenca)||0),0),
      valorInvestigar:investigar.reduce((s,r)=>s+Math.abs(Number(r.diferenca)||0),0),
      totalCusto: lancamentos.reduce((s,r)=>s+Number(r.saldo_dash||0),0),
      totalCtb:   lancamentos.reduce((s,r)=>s+Number(r.saldo_contabil||0),0),
      diff:       lancamentos.reduce((s,r)=>s+Number(r.diferenca||0),0),
    }
  }, [lancamentos])

  const criticos = useMemo(() =>
    lancamentos.filter(r=>r.classe_divergencia==='CRITICO')
      .sort((a,b)=>Math.abs(Number(b.diferenca)||0)-Math.abs(Number(a.diferenca)||0))
  , [lancamentos])

  const investigar = useMemo(() =>
    lancamentos.filter(r=>r.classe_divergencia==='INVESTIGAR')
      .sort((a,b)=>Math.abs(Number(b.diferenca)||0)-Math.abs(Number(a.diferenca)||0))
  , [lancamentos])

  // Arredondamentos — agrupados para não poluir
  const arredAgrupado = useMemo(() => {
    const g = {}
    lancamentos.filter(r=>r.classe_divergencia==='ARREDONDAMENTO').forEach(r => {
      const k = r.cod_top||'outro'
      if (!g[k]) g[k] = { descr: r.descr_top, qtd:0, total:0 }
      g[k].qtd++
      g[k].total += Math.abs(Number(r.diferenca)||0)
    })
    return Object.values(g).sort((a,b)=>b.total-a.total)
  }, [lancamentos])

  const porConta = useMemo(() => {
    const g = {}
    lancamentos.filter(r=>['CRITICO','INVESTIGAR'].includes(r.classe_divergencia)).forEach(r=>{
      const k = r.conta_contabil||'sem conta'
      if(!g[k]) g[k]={conta:k,valor:0,qtd:0,criticos:0}
      g[k].valor += Number(r.saldo_dash||0)
      g[k].qtd++
      if(r.classe_divergencia==='CRITICO') g[k].criticos++
    })
    return Object.values(g).sort((a,b)=>Math.abs(b.valor)-Math.abs(a.valor)).slice(0,8)
  }, [lancamentos])

  const pizza = Object.entries(CLASSES)
    .map(([k,v])=>({name:v.rot, value:lancamentos.filter(r=>r.classe_divergencia===k).length, cor:v.cor}))
    .filter(x=>x.value>0)

  const tendencia = resumos.map(r=>({
    dia: new Date(r.criado_em).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
    diferenca: Number(r.diferenca_total||r.total_diferenca||0),
  }))

  const EIXO = { fill:'#9CA3AF', fontSize:11 }

  const alertaCor = kpi.criticos>0
    ? {bg:'#FEF2F2',border:'#FECACA',texto:'#991B1B'}
    : kpi.investigar>0
      ? {bg:'#FFFBEB',border:'#FDE68A',texto:'#92400E'}
      : {bg:'#F0FDF4',border:'#BBF7D0',texto:'#166534'}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>

      {/* ═══ SALDO PRINCIPAL ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr 1px 1fr',background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'18px 24px',gap:0}}>
        <div>
          <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Custo apurado · estoque</div>
          <div style={{fontSize:26,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(kpi.totalCusto)}</div>
        </div>
        <div style={{background:'#E5E7EB'}}/>
        <div style={{paddingLeft:24}}>
          <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Saldo contábil · lançamentos</div>
          <div style={{fontSize:26,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(kpi.totalCtb)}</div>
        </div>
        <div style={{background:'#E5E7EB'}}/>
        <div style={{paddingLeft:24}}>
          <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Diferença total</div>
          <div style={{fontSize:26,fontWeight:700,fontVariantNumeric:'tabular-nums',
            color:isZero(kpi.diff)?'#12805C':kpi.diff>0?'#B42318':'#1D5BBF'}}>
            {kpi.diff>0?'+':''}R$ {brl(kpi.diff)}
          </div>
          <div style={{fontSize:12,color:'#9CA3AF',marginTop:2}}>
            {isZero(kpi.diff)?'Totalmente conciliado':kpi.diff>0?'Custo acima do contábil':'Contábil acima do custo'}
          </div>
        </div>
      </div>

      {/* ═══ ALERTA + KPIs ═══ */}
      <div style={{background:alertaCor.bg,border:`1px solid ${alertaCor.border}`,borderRadius:8,padding:'10px 16px',fontSize:13,color:alertaCor.texto,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <span>
          {kpi.criticos>0
            ? `🔴 ${kpi.criticos} críticos · R$ ${brl(kpi.valorCritico)} em risco imediato`
            : kpi.investigar>0
              ? `⚠ ${kpi.investigar} para investigar (R$ ${brl(kpi.valorInvestigar)}). Nenhum crítico.`
              : '✅ Nenhum crítico ou investigar. Mês controlado.'}
        </span>
        <span style={{fontSize:12,opacity:.8}}>Taxa real (excl. internos): <strong>{kpi.taxaReal.toFixed(1)}%</strong> · {int(kpi.ok)} de {int(lancamentos.filter(r=>r.classe_divergencia!=='INTERNO').length)} conciliados</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12}}>
        <Card title="🔴 Críticos"        value={int(kpi.criticos)}  sub={`R$ ${brl(kpi.valorCritico)}`}   color="red"/>
        <Card title="⚠ Investigar"       value={int(kpi.investigar)} sub={`R$ ${brl(kpi.valorInvestigar)}`} color="orange"/>
        <Card title="~ Arredondamento"   value={int(kpi.arred)}      sub="aceitos automaticamente"          color="gray"/>
        <Card title="↔ Internos (ruído)" value={int(kpi.interno)}    sub="transferências/requisições"       color="gray"/>
        <Card title="✓ Conciliados"      value={`${kpi.taxaReal.toFixed(1)}%`} sub={`${int(kpi.ok)} lançamentos`} color={kpi.taxaReal>=95?'green':'orange'}/>
      </div>

      {/* ═══ CRÍTICOS — DETALHADO NA TELA ═══ */}
      {criticos.length > 0 && (
        <Panel title={`🔴 Críticos — ${criticos.length} lançamentos · R$ ${brl(kpi.valorCritico)}`}
          action={<Btn small onClick={()=>onIrPara('pendencias')}>ver na fila →</Btn>}>
          <GrupoCriticos items={criticos} />
        </Panel>
      )}

      {/* ═══ INVESTIGAR — DETALHADO NA TELA ═══ */}
      {investigar.length > 0 && (
        <Panel title={`⚠ Para investigar — ${investigar.length} lançamentos · R$ ${brl(kpi.valorInvestigar)}`}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
              <thead>
                <tr style={{background:'#FFFBEB'}}>
                  {['Nota','Conta','Local','Data','Custo','Contábil','Diferença','Diagnóstico'].map(h=>(
                    <th key={h} style={{padding:'7px 12px',textAlign:['Custo','Contábil','Diferença'].includes(h)?'right':'left',
                      fontSize:10.5,fontWeight:600,color:'#9CA3AF',borderBottom:'1px solid #FDE68A',
                      textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(verTodosInv ? investigar : investigar.slice(0,10)).map((r,i)=>(
                  <tr key={r.id||i} onClick={()=>onDetalhe(r)} style={{cursor:'pointer',borderBottom:'1px solid #FFFBEB'}}
                    onMouseOver={e=>e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='#FFFBEB')}
                    onMouseOut={e=>e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='')}
                  >
                    <td style={{...TD2,fontWeight:600}}>{r.nota_fiscal}</td>
                    <td style={{...TD2,fontVariantNumeric:'tabular-nums'}}>{r.conta_contabil}</td>
                    <td style={{...TD2,color:'#6B7280',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.descr_local}</td>
                    <td style={{...TD2,color:'#9CA3AF',whiteSpace:'nowrap'}}>{dBR(r.data_entrada_saida)}</td>
                    <td style={{...TD2,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(r.saldo_dash)}</td>
                    <td style={{...TD2,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(r.saldo_contabil)}</td>
                    <td style={{...TD2,textAlign:'right',fontWeight:700,color:'#B54708',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>R$ {brl(r.diferenca)}</td>
                    <td style={{...TD2,fontSize:11,color:'#6B7280',maxWidth:200}}>{r.motivo_calculado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {investigar.length>10 && (
              <button onClick={()=>setVerTodosInv(!verTodosInv)} style={{
                width:'100%',padding:'10px',background:'none',border:'none',
                borderTop:'1px solid #FDE68A',color:'#B54708',fontSize:12.5,cursor:'pointer',fontFamily:'inherit'
              }}>
                {verTodosInv ? '▲ Mostrar menos' : `▼ Ver mais ${investigar.length-10} registros`}
              </button>
            )}
          </div>
        </Panel>
      )}

      {/* ═══ ARREDONDAMENTOS — RESUMO AGRUPADO ═══ */}
      {arredAgrupado.length > 0 && (
        <Panel title={`~ Arredondamentos aceitos — ${kpi.arred} lançamentos (classificados automaticamente)`}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10}}>
            {arredAgrupado.map((g,i)=>(
              <div key={i} style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:6,padding:'10px 12px'}}>
                <div style={{fontSize:12.5,fontWeight:500,marginBottom:4}}>{g.descr}</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#9CA3AF'}}>
                  <span>{int(g.qtd)} lançamentos</span>
                  <span>total desvio: <strong style={{color:'#374151'}}>R$ {brl(g.total)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ═══ GRÁFICOS ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <Panel title="Composição">
          <div style={{display:'flex',alignItems:'center',gap:18,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:160}}>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={pizza} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {pizza.map((e,i)=><Cell key={i} fill={e.cor}/>)}
                  </Pie>
                  <Tooltip content={<Dica/>}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul style={{listStyle:'none',margin:0,padding:0,display:'flex',flexDirection:'column',gap:7}}>
              {Object.entries(CLASSES).map(([k,v])=>{
                const n=lancamentos.filter(r=>r.classe_divergencia===k).length
                const val=lancamentos.filter(r=>r.classe_divergencia===k).reduce((s,r)=>s+Math.abs(Number(r.diferenca)||0),0)
                return(
                  <li key={k} style={{opacity:n?1:0.3}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:v.cor,flexShrink:0}}/>
                      <span style={{flex:1,fontSize:12,color:'#374151'}}>{v.icone} {v.rot}</span>
                      <span style={{fontWeight:700,fontSize:12.5,fontVariantNumeric:'tabular-nums'}}>{int(n)}</span>
                    </div>
                    {n>0 && val>0.01 && (
                      <div style={{paddingLeft:15,fontSize:11,color:'#9CA3AF',fontVariantNumeric:'tabular-nums'}}>R$ {brl(val)}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </Panel>

        <Panel title="Impacto por conta" action={<span style={{fontSize:11.5,color:'#9CA3AF'}}>críticos + investigar</span>}>
          {porConta.length?(
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porConta} layout="vertical" margin={{left:8,right:22,top:4,bottom:4}}>
                <CartesianGrid stroke="#F3F4F6" horizontal={false}/>
                <XAxis type="number" tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="conta" width={64} tick={EIXO} axisLine={false} tickLine={false}/>
                <Tooltip content={<Dica moeda/>} cursor={{fill:'#F9FAFB'}}/>
                <Bar dataKey="valor" radius={[0,3,3,0]} barSize={12}>
                  {porConta.map((c,i)=><Cell key={i} fill={isZero(c.valor)?'#12805C':c.valor>0?'#B42318':'#1D5BBF'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ):(
            <p style={{textAlign:'center',color:'#9CA3AF',padding:'50px 0',margin:0}}>Nenhum crítico ou investigar. ✓</p>
          )}
        </Panel>
      </div>

      {/* Tendência */}
      {tendencia.length>1&&(
        <Panel title="Evolução da diferença total (sincronizações)">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={tendencia} margin={{left:0,right:12,top:8,bottom:4}}>
              <CartesianGrid stroke="#F3F4F6" vertical={false}/>
              <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} width={58}/>
              <Tooltip content={<Dica moeda/>}/>
              <Line type="monotone" dataKey="diferenca" name="Diferença" stroke="#1D5BBF" strokeWidth={2}
                dot={{r:3,fill:'#1D5BBF',strokeWidth:0}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

    </div>
  )
}
