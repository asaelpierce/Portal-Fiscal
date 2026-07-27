import React, { useMemo } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LineChart, Line,
} from 'recharts'
import { Card, Panel, Tag, Btn } from '../components/UI.jsx'
import { brl, brlK, int, dBR, isZero, SITUACOES, sitDe } from '../config.js'

/*
  Classificação analítica dos TOPs.
  Movimentações INTERNAS, PRODUCAO e REMESSA têm saldo líquido zero
  e NÃO deveriam gerar lançamento contábil — não são divergências reais.
  
  O analista de custos precisa focar em:
  1. COMPRAS sem contabilização (impacto real no balanço)
  2. VENDAS/SAÍDAS sem baixa contábil (subavaliação do CMV)
  3. REMESSAS com saldo aberto (aguardando retorno — risco de inconsistência)
  4. COMODATO (verificar política contábil)
*/

const NATUREZA_CTB = new Set(['COMPRA', 'VENDA', 'DEVOLUCAO', 'COMODATO'])

// Esses TOPs são movimentações internas que se anulam — não são problema
const TOPS_INTERNOS = new Set([
  '1402','1400','1403','1410','1411',
  '3301','3302','3303','3304',
  '1600','1605',
  '1102','1100','1101','1105',
])

// Remessas aguardando retorno — monitorar mas não é erro imediato
const TOPS_REMESSA = new Set(['3203','3225','2207'])

function classificarTOP(cod_top) {
  if (TOPS_INTERNOS.has(cod_top)) return 'interna'
  if (TOPS_REMESSA.has(cod_top)) return 'remessa'
  return 'pendente' // compras, vendas, comodatos = problema real
}

function DicaCustom({ active, payload, label, moeda }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:6, padding:'8px 12px', fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,.1)' }}>
      <strong>{label || payload[0].name}</strong>
      <div>{moeda ? `R$ ${brl(payload[0].value)}` : int(payload[0].value)}</div>
    </div>
  )
}

export default function Dashboard({ lancamentos, resumos, onIrPara, onDetalhe }) {

  const analise = useMemo(() => {
    const pendentes  = [] // compras/vendas SEM contabilização = ação necessária
    const remessas   = [] // remessas abertas = monitorar
    const internas   = [] // movimentações internas = ruído, ignorar
    const ok         = [] // já conciliados
    const divergValor = [] // contabilizado mas com valor diferente

    lancamentos.forEach(r => {
      const mot = String(r.motivo_divergencia || '')
      if (mot.startsWith('1'))      { ok.push(r); return }
      if (mot.startsWith('4'))      { divergValor.push(r); return }
      // mot '3' = só no custo
      const cls = classificarTOP(r.cod_top || '')
      if (cls === 'interna')        internas.push(r)
      else if (cls === 'remessa')   remessas.push(r)
      else                          pendentes.push(r)
    })

    const somarDash = arr => arr.reduce((s, r) => s + Number(r.saldo_dash || 0), 0)

    return {
      pendentes, remessas, internas, ok, divergValor,
      valorPendente: pendentes.reduce((s, r) => s + Math.abs(Number(r.saldo_dash || 0)), 0),
      saldoRemessa: somarDash(remessas),
      total: lancamentos.length,
    }
  }, [lancamentos])

  // Agrupamento dos PENDENTES por tipo de operação
  const pendentesGrupo = useMemo(() => {
    const g = {}
    analise.pendentes.forEach(r => {
      const k = r.descr_top || 'Sem operação'
      if (!g[k]) g[k] = { descr: k, cod: r.cod_top, qtd: 0, valor: 0 }
      g[k].qtd++
      g[k].valor += Number(r.saldo_dash || 0)
    })
    return Object.values(g).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
  }, [analise.pendentes])

  // Maiores pendentes individuais
  const maioresPendentes = useMemo(() =>
    [...analise.pendentes].sort((a, b) => Math.abs(Number(b.saldo_dash) || 0) - Math.abs(Number(a.saldo_dash) || 0)).slice(0, 8)
  , [analise.pendentes])

  // Contas com maior impacto pendente
  const contasPendentes = useMemo(() => {
    const g = {}
    analise.pendentes.forEach(r => {
      const k = r.conta_contabil || 'sem conta'
      if (!g[k]) g[k] = { conta: k, valor: 0, qtd: 0 }
      g[k].valor += Number(r.saldo_dash || 0)
      g[k].qtd++
    })
    return Object.values(g).map(x => ({ ...x, absValor: Math.abs(x.valor) }))
      .sort((a, b) => b.absValor - a.absValor).slice(0, 8)
  }, [analise.pendentes])

  const tendencia = resumos.map(r => ({
    dia: new Date(r.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
    diferenca: Number(r.total_diferenca) || 0,
  }))

  const EIXO = { fill:'#9CA3AF', fontSize:11 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Alerta de contexto */}
      <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#92400E', display:'flex', gap:10, alignItems:'flex-start' }}>
        <span style={{ fontSize:16, flexShrink:0 }}>📊</span>
        <div>
          <strong>Leitura analítica:</strong> Das {int(analise.total)} movimentações do período, <strong>{int(analise.internas.length + analise.pendentes.length + analise.remessas.length)}</strong> aparecem "só no custo" — mas{' '}
          <strong>{int(analise.internas.length)} são movimentações internas</strong> (transferências, requisições, apontamentos) que se anulam e <em>não deveriam ter lançamento contábil</em>. O real problema está nas{' '}
          <strong style={{ color:'#B42318' }}>{int(analise.pendentes.length)} operações de compra/venda/comodato</strong> sem contabilização: <strong style={{ color:'#B42318' }}>R$ {brl(analise.valorPendente)}</strong>.
        </div>
      </div>

      {/* KPIs principais */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:14 }}>
        <Card
          title="⚠ Compras sem CTB"
          value={`R$ ${brl(analise.pendentes.filter(r => ['2050','2305','2103','2122','2413'].includes(r.cod_top)).reduce((s,r) => s + Number(r.saldo_dash||0), 0))}`}
          sub={`${int(analise.pendentes.filter(r => ['2050','2305','2103','2122','2413'].includes(r.cod_top)).length)} notas · impacto direto no ativo`}
          color="red"
        />
        <Card
          title="⚠ Vendas sem baixa CTB"
          value={`R$ ${brl(Math.abs(analise.pendentes.filter(r => ['3214','3200','3201'].includes(r.cod_top)).reduce((s,r) => s + Number(r.saldo_dash||0), 0)))}`}
          sub={`${int(analise.pendentes.filter(r => ['3214','3200','3201'].includes(r.cod_top)).length)} saídas · CMV subavaliado`}
          color="orange"
        />
        <Card
          title="⏳ Remessas em aberto"
          value={`R$ ${brl(Math.abs(analise.saldoRemessa))}`}
          sub={`${int(analise.remessas.length)} NFs · aguardando retorno`}
          color="blue"
        />
        <Card
          title="✓ Conciliados"
          value={`${analise.total > 0 ? ((analise.ok.length / analise.total) * 100).toFixed(1) : 0}%`}
          sub={`${int(analise.ok.length)} de ${int(analise.total)} lançamentos`}
          color={analise.ok.length / analise.total >= 0.95 ? 'green' : 'gray'}
        />
        <Card
          title="↔ Ruído (internas)"
          value={int(analise.internas.length)}
          sub="transf./req./apontamentos — não investigar"
          color="gray"
        />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

        {/* Pendentes por tipo de operação */}
        <Panel title="Pendências por tipo de operação" action={<span style={{ fontSize:11.5, color:'#9CA3AF' }}>compras, vendas, comodatos</span>}>
          {pendentesGrupo.length === 0
            ? <p style={{ color:'#9CA3AF', textAlign:'center', padding:'28px 0', margin:0 }}>Nenhuma pendência real. ✓</p>
            : (
              <div>
                {pendentesGrupo.map((g, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px', borderBottom:'1px solid #F3F4F6' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12.5, fontWeight:500 }}>{g.descr}</div>
                      <div style={{ fontSize:11.5, color:'#9CA3AF' }}>TOP {g.cod} · {g.qtd} lançamento{g.qtd > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      <div style={{ fontSize:13, fontWeight:700, color: g.valor >= 0 ? '#B42318' : '#1D5BBF' }}>
                        {g.valor >= 0 ? '' : '−'} R$ {brl(Math.abs(g.valor))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Panel>

        {/* Contas com maior impacto */}
        <Panel title="Contas contábeis com maior impacto" action={<span style={{ fontSize:11.5, color:'#9CA3AF' }}>só pendências reais</span>}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={contasPendentes} layout="vertical" margin={{ left:8, right:22, top:4, bottom:4 }}>
              <CartesianGrid stroke="#F3F4F6" horizontal={false} />
              <XAxis type="number" tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="conta" width={64} tick={EIXO} axisLine={false} tickLine={false} />
              <Tooltip content={<DicaCustom moeda />} cursor={{ fill:'#F9FAFB' }} />
              <Bar dataKey="valor" radius={[0,3,3,0]} barSize={12}>
                {contasPendentes.map((c, i) => <Cell key={i} fill={c.valor >= 0 ? '#B42318' : '#1D5BBF'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>

        {/* Fila de ação imediata */}
        <Panel
          title={`🔴 Ação imediata — ${int(maioresPendentes.length)} maiores`}
          action={<Btn small onClick={() => onIrPara('pendencias')}>ver todas →</Btn>}
        >
          <div>
            {maioresPendentes.map((r, i) => {
              const sit = sitDe(r.motivo_divergencia)
              return (
                <button key={r.id || i} onClick={() => onDetalhe(r)} style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 4px',
                  background:'none', border:'none', borderBottom:'1px solid #F3F4F6',
                  cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                }}>
                  <span style={{ fontSize:11, color:'#9CA3AF', width:18, textAlign:'right', flexShrink:0 }}>{i+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600 }}>NF {r.nota_fiscal}</div>
                    <div style={{ fontSize:11.5, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.descr_top} · {r.descr_local}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color: Number(r.saldo_dash) >= 0 ? '#B42318' : '#1D5BBF', fontVariantNumeric:'tabular-nums' }}>
                      R$ {brl(r.saldo_dash)}
                    </div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{dBR(r.data_entrada_saida)}</div>
                  </div>
                </button>
              )
            })}
            {!maioresPendentes.length && <p style={{ color:'#9CA3AF', textAlign:'center', padding:'20px 0', margin:0 }}>Sem pendências. ✓</p>}
          </div>
        </Panel>

        {/* Remessas em aberto */}
        <Panel title={`⏳ Remessas em aberto — ${int(analise.remessas.length)}`}>
          <div>
            {analise.remessas
              .sort((a,b) => Math.abs(Number(b.saldo_dash)||0) - Math.abs(Number(a.saldo_dash)||0))
              .slice(0, 8)
              .map((r, i) => (
                <button key={r.id || i} onClick={() => onDetalhe(r)} style={{
                  display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 4px',
                  background:'none', border:'none', borderBottom:'1px solid #F3F4F6',
                  cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12.5, fontWeight:600 }}>NF {r.nota_fiscal}</div>
                    <div style={{ fontSize:11.5, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.descr_top} · {r.descr_local}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1D5BBF', fontVariantNumeric:'tabular-nums' }}>
                      R$ {brl(r.saldo_dash)}
                    </div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{dBR(r.data_entrada_saida)}</div>
                  </div>
                </button>
              ))}
            {!analise.remessas.length && <p style={{ color:'#9CA3AF', textAlign:'center', padding:'20px 0', margin:0 }}>Nenhuma remessa em aberto. ✓</p>}
          </div>
        </Panel>
      </div>

      {/* Tendência */}
      {tendencia.length > 1 && (
        <Panel title="Evolução da diferença total (sincronizações)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tendencia} margin={{ left:0, right:12, top:8, bottom:4 }}>
              <CartesianGrid stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<DicaCustom moeda />} />
              <Line type="monotone" dataKey="diferenca" stroke="#1D5BBF" strokeWidth={2}
                dot={{ r:3, fill:'#1D5BBF', strokeWidth:0 }} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

    </div>
  )
}
