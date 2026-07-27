import React, { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell,
} from 'recharts'
import { Panel } from '../components/UI.jsx'
import { brl, brlK, int, dBR, isZero } from '../config.js'

function Dica({ active, payload, label, moeda }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:6, padding:'8px 12px', fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,.1)' }}>
      <strong>{label || payload[0].name}</strong>
      {payload.map((p,i) => (
        <div key={i} style={{ color: p.color || '#374151' }}>
          {p.name}: {moeda ? `R$ ${brl(p.value)}` : int(p.value)}
        </div>
      ))}
    </div>
  )
}

export function Contas({ lancamentos, onFiltrarConta }) {
  const porConta = useMemo(() => {
    const g = {}
    lancamentos.forEach(r => {
      const k = r.conta_contabil || 'sem conta'
      if (!g[k]) g[k] = { conta: k, n: 0, custo: 0, ctb: 0, divergentes: 0, criticos: 0 }
      g[k].n++
      g[k].custo += Number(r.saldo_dash || 0)
      g[k].ctb   += Number(r.saldo_contabil || 0)
      if (r.classe_divergencia === 'CRITICO')    g[k].criticos++
      if (['CRITICO','INVESTIGAR'].includes(r.classe_divergencia)) g[k].divergentes++
    })
    return Object.values(g).map(x => ({ ...x, diff: x.custo - x.ctb }))
      .sort((a,b) => Math.abs(b.diff) - Math.abs(a.diff))
  }, [lancamentos])

  const max = Math.max(1, ...porConta.map(c => Math.abs(c.diff)))

  return (
    <Panel title={`${porConta.length} contas no período`}
      action={<span style={{ fontSize:11.5, color:'#9CA3AF' }}>clique para filtrar lançamentos</span>}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:12 }}>
        {porConta.map(c => (
          <button key={c.conta} onClick={() => onFiltrarConta(c.conta)} style={{
            background: c.criticos > 0 ? '#FEF2F2' : '#F9FAFB',
            border: `1px solid ${c.criticos > 0 ? '#FECACA' : '#E5E7EB'}`,
            borderRadius:8, padding:'14px 15px', cursor:'pointer', textAlign:'left', fontFamily:'inherit',
          }}
            onMouseOver={e => e.currentTarget.style.borderColor = '#9CA3AF'}
            onMouseOut={e => e.currentTarget.style.borderColor = c.criticos > 0 ? '#FECACA' : '#E5E7EB'}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:10, marginBottom:8 }}>
              <span style={{ fontWeight:700, fontSize:14, fontVariantNumeric:'tabular-nums' }}>{c.conta}</span>
              <span style={{ fontWeight:700, fontSize:13, fontVariantNumeric:'tabular-nums',
                color: isZero(c.diff) ? '#12805C' : '#B42318' }}>
                {c.diff >= 0 ? '+' : '−'} R$ {brl(Math.abs(c.diff))}
              </span>
            </div>
            {/* Barra de divergência */}
            <div style={{ height:5, background:'#E5E7EB', borderRadius:3, overflow:'hidden', marginBottom:10 }}>
              <div style={{
                height:'100%', borderRadius:3,
                width:`${(Math.abs(c.diff)/max)*100}%`,
                background: isZero(c.diff) ? '#12805C' : c.diff > 0 ? '#B42318' : '#1D5BBF',
              }} />
            </div>
            {/* Saldos */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8, padding:'8px', background:'rgba(0,0,0,.03)', borderRadius:6 }}>
              <div>
                <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:2 }}>Custo apurado</div>
                <div style={{ fontSize:12.5, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>R$ {brlK(c.custo)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:2 }}>Saldo contábil</div>
                <div style={{ fontSize:12.5, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>R$ {brlK(c.ctb)}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:12, fontSize:11.5, color:'#9CA3AF', flexWrap:'wrap' }}>
              <span>{int(c.n)} lançamentos</span>
              {c.criticos > 0 && <span style={{ color:'#B42318', fontWeight:600 }}>🔴 {c.criticos} críticos</span>}
              {c.divergentes > 0 && c.criticos === 0 && <span style={{ color:'#B54708' }}>⚠ {c.divergentes} divergentes</span>}
              {c.divergentes === 0 && <span style={{ color:'#12805C' }}>✓ conciliado</span>}
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}

export function Historico({ resumos }) {
  // resumos vem de resumo_analitico — campos corretos
  const dados = [...resumos].reverse()
  const EIXO = { fill:'#9CA3AF', fontSize:11 }

  const graficoDiff = resumos.map(r => ({
    dia: new Date(r.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
    diferenca: Number(r.diferenca_total || 0),
  }))

  const graficoSaldo = resumos.map(r => ({
    dia: new Date(r.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
    custo:   Number(r.total_custo || 0),
    contabil:Number(r.total_ctb   || 0),
  }))

  const graficoClasses = resumos.map(r => ({
    dia:   new Date(r.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
    ok:          Number(r.qtd_ok || 0),
    critico:     Number(r.qtd_critico || 0),
    investigar:  Number(r.qtd_investigar || 0),
    arredond:    Number(r.qtd_arredondamento || 0),
    interno:     Number(r.qtd_interno || 0),
  }))

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Evolução custo x contábil */}
      <Panel title="Custo apurado × Saldo contábil por sincronização">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={graficoSaldo} margin={{ left:0, right:12, top:8, bottom:4 }}>
            <CartesianGrid stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} width={58} />
            <Tooltip content={<Dica moeda />} />
            <Line type="monotone" dataKey="custo"    name="Custo"    stroke="#1D5BBF" strokeWidth={2} dot={{ r:3, fill:'#1D5BBF', strokeWidth:0 }} />
            <Line type="monotone" dataKey="contabil" name="Contábil" stroke="#12805C" strokeWidth={2} dot={{ r:3, fill:'#12805C', strokeWidth:0 }} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display:'flex', gap:18, marginTop:8, fontSize:12, color:'#6B7280' }}>
          <span><span style={{ display:'inline-block', width:20, height:2, background:'#1D5BBF', verticalAlign:'middle', marginRight:6 }}/>Custo apurado</span>
          <span><span style={{ display:'inline-block', width:20, height:2, background:'#12805C', verticalAlign:'middle', marginRight:6, borderTop:'2px dashed #12805C' }}/>Saldo contábil</span>
        </div>
      </Panel>

      {/* Evolução da diferença */}
      <Panel title="Diferença total por sincronização">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={graficoDiff} margin={{ left:0, right:12, top:8, bottom:4 }}>
            <CartesianGrid stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} width={58} />
            <Tooltip content={<Dica moeda />} />
            <Line type="monotone" dataKey="diferenca" name="Diferença" stroke="#B42318" strokeWidth={2}
              dot={{ r:3, fill:'#B42318', strokeWidth:0 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* Composição por classe ao longo do tempo */}
      <Panel title="Composição por classe — evolução">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={graficoClasses} margin={{ left:0, right:12, top:4, bottom:4 }}>
            <CartesianGrid stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
            <YAxis tick={EIXO} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<Dica />} />
            <Bar dataKey="ok"         name="Conciliado"    stackId="a" fill="#12805C" />
            <Bar dataKey="arredond"   name="Arredondamento" stackId="a" fill="#D1D5DB" />
            <Bar dataKey="interno"    name="Interno"        stackId="a" fill="#E5E7EB" />
            <Bar dataKey="investigar" name="Investigar"     stackId="a" fill="#F59E0B" />
            <Bar dataKey="critico"    name="Crítico"        stackId="a" fill="#B42318" />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display:'flex', gap:14, marginTop:8, fontSize:11.5, color:'#6B7280', flexWrap:'wrap' }}>
          {[['#12805C','Conciliado'],['#D1D5DB','Arredondamento'],['#E5E7EB','Interno'],['#F59E0B','Investigar'],['#B42318','Crítico']].map(([c,l]) => (
            <span key={l}><span style={{ display:'inline-block', width:10, height:10, background:c, borderRadius:2, verticalAlign:'middle', marginRight:4 }}/>{l}</span>
          ))}
        </div>
      </Panel>

      {/* Tabela detalhada */}
      <Panel title="Sincronizações registradas">
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {['Data/Hora','Período','Total','OK','Críticos','Investigar','Arred.','Custo apurado','Saldo contábil','Diferença','Taxa real'].map(h => (
                  <th key={h} style={{
                    padding:'9px 12px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB',
                    textAlign:['Custo apurado','Saldo contábil','Diferença','Total','OK','Críticos','Investigar','Arred.','Taxa real'].includes(h)?'right':'left',
                    fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.map(r => (
                <tr key={r.importacao_id}>
                  <td style={TD}>
                    {new Date(r.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
                  </td>
                  <td style={{ ...TD, color:'#9CA3AF', whiteSpace:'nowrap' }}>
                    {dBR(r.periodo_inicio)} — {dBR(r.periodo_fim)}
                  </td>
                  <td style={{ ...TD, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{int(r.total)}</td>
                  <td style={{ ...TD, textAlign:'right', fontWeight:600, color:'#12805C', fontVariantNumeric:'tabular-nums' }}>{int(r.qtd_ok)}</td>
                  <td style={{ ...TD, textAlign:'right', fontWeight:600, color: r.qtd_critico > 0 ? '#B42318' : '#9CA3AF', fontVariantNumeric:'tabular-nums' }}>{int(r.qtd_critico)}</td>
                  <td style={{ ...TD, textAlign:'right', color: r.qtd_investigar > 0 ? '#B54708' : '#9CA3AF', fontVariantNumeric:'tabular-nums' }}>{int(r.qtd_investigar)}</td>
                  <td style={{ ...TD, textAlign:'right', color:'#9CA3AF', fontVariantNumeric:'tabular-nums' }}>{int(r.qtd_arredondamento)}</td>
                  <td style={{ ...TD, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(r.total_custo)}</td>
                  <td style={{ ...TD, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(r.total_ctb)}</td>
                  <td style={{ ...TD, textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums',
                    color: isZero(r.diferenca_total) ? '#12805C' : Math.abs(Number(r.diferenca_total)) > 10000 ? '#B42318' : '#B54708' }}>
                    R$ {brl(r.diferenca_total)}
                  </td>
                  <td style={{ ...TD, textAlign:'right', fontWeight:600,
                    color: Number(r.taxa_conciliacao_real) >= 95 ? '#12805C' : Number(r.taxa_conciliacao_real) >= 80 ? '#B54708' : '#B42318' }}>
                    {Number(r.taxa_conciliacao_real || 0).toFixed(1)}%
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

const TD = { padding:'9px 12px', borderBottom:'1px solid #F9FAFB', fontSize:13, whiteSpace:'nowrap' }
