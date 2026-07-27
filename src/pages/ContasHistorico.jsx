import React, { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Panel } from '../components/UI.jsx'
import { brl, brlK, int, dBR, isZero } from '../config.js'

export function Contas({ lancamentos, onFiltrarConta }) {
  const porConta = useMemo(() => {
    const g = {}
    lancamentos.forEach(r => {
      const k = r.conta_contabil || 'sem conta'
      if (!g[k]) g[k] = { conta: k, n: 0, custo: 0, ctb: 0, divergentes: 0 }
      g[k].n++
      g[k].custo += Number(r.saldo_dash || 0)
      g[k].ctb   += Number(r.saldo_contabil || 0)
      if (!String(r.motivo_divergencia || '').startsWith('1')) g[k].divergentes++
    })
    return Object.values(g).map(x => ({ ...x, diff: x.custo - x.ctb }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  }, [lancamentos])

  const max = Math.max(1, ...porConta.map(c => Math.abs(c.diff)))

  return (
    <Panel title={`${porConta.length} contas no período`} action={<span style={{ fontSize: 11.5, color: '#9CA3AF' }}>clique para filtrar lançamentos</span>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
        {porConta.map(c => (
          <button key={c.conta} onClick={() => onFiltrarConta(c.conta)} style={{
            background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
            padding: '14px 15px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            transition: 'border-color .12s',
          }}
            onMouseOver={e => e.currentTarget.style.borderColor = '#9CA3AF'}
            onMouseOut={e => e.currentTarget.style.borderColor = '#E5E7EB'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{c.conta}</span>
              <span style={{ fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: isZero(c.diff) ? '#12805C' : '#B42318' }}>
                {c.diff >= 0 ? '+' : '−'} R$ {brl(Math.abs(c.diff))}
              </span>
            </div>
            <div style={{ height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${(Math.abs(c.diff) / max) * 100}%`,
                background: isZero(c.diff) ? '#12805C' : c.diff > 0 ? '#B42318' : '#1D5BBF',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: '#9CA3AF', flexWrap: 'wrap' }}>
              <span>{int(c.n)} lançamentos</span>
              <span>{int(c.divergentes)} divergentes</span>
              <span>custo R$ {brlK(c.custo)}</span>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}

export function Historico({ resumos }) {
  const dados  = [...resumos].reverse()
  const grafico = resumos.map(r => ({
    dia: new Date(r.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    diferenca: Number(r.total_diferenca) || 0,
  }))
  const EIXO = { fill: '#9CA3AF', fontSize: 11 }

  function DicaCustom({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
        <strong>{label}</strong>
        <div>R$ {brl(payload[0].value)}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Panel title="Diferença total por sincronização">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={grafico} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid stroke="#F3F4F6" vertical={false} />
            <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={brlK} tick={EIXO} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<DicaCustom />} />
            <Line type="monotone" dataKey="diferenca" stroke="#1D5BBF" strokeWidth={2}
              dot={{ r: 3, fill: '#1D5BBF', strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Sincronizações registradas">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Data/Hora','Período','Lançamentos','Confere','Só no custo','Divergência valor','Diferença total'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h.includes('total') || h.includes('Confere') || h.includes('custo') || h.includes('valor') || h.includes('ntos') ? 'right' : 'left', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.map(r => {
                const div = (r.total_so_dashboard || 0) + (r.total_divergencia_valor || 0)
                return (
                  <tr key={r.importacao_id}>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {new Date(r.criado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                      {dBR(r.periodo_inicio)} — {dBR(r.periodo_fim)}
                    </td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{int(r.total_lancamentos)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', fontWeight: 600, color: '#12805C', fontVariantNumeric: 'tabular-nums' }}>{int(r.total_ok)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', color: '#B54708', fontVariantNumeric: 'tabular-nums' }}>{int(r.total_so_dashboard)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', color: '#B42318', fontVariantNumeric: 'tabular-nums' }}>{int(r.total_divergencia_valor)}</td>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isZero(r.total_diferenca) ? '#12805C' : '#B42318' }}>
                      R$ {brl(r.total_diferenca)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
