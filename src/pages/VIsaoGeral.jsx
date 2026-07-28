import React, { useMemo } from 'react'
import { brl, int, dBR, isZero, classeDe, CLASSES } from '../config.js'

// ─── mini componente de badge ────────────────────────────────────────────────
function Badge({ cls, n }) {
  const c = classeDe(cls)
  if (!n) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: c.bg, color: c.cor, whiteSpace: 'nowrap' }}>
      {c.icone} {c.rot}: {int(n)}
    </span>
  )
}

// ─── bloco de saldo (fechamento) ─────────────────────────────────────────────
function BlocoFechamento({ fechamento }) {
  if (!fechamento) return null
  const ok = Math.abs(fechamento.diferenca) < 0.10

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
      {/* cabeçalho */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {ok ? '✅ Estoque conciliado' : '⚙ Estoque com diferença'}
          </div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>
            Posição em {dBR(fechamento.data)} · saldo do estoque × razão contábil
          </div>
        </div>
        <div style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>Diferença geral</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: ok ? '#12805C' : '#B54708' }}>
            R$ {brl(fechamento.diferenca)}
          </div>
        </div>
      </div>
      {/* contas */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Conta', 'Local', 'Estoque', 'Contábil', 'Diferença', 'Situação'].map(h => (
                <th key={h} style={{
                  padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                  textAlign: ['Estoque','Contábil','Diferença'].includes(h) ? 'right' : 'left',
                  fontSize: 10.5, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: '.04em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fechamento.linhas.map(l => (
              <tr key={l.grupo}>
                <td style={TD}><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{l.contas}</strong></td>
                <td style={{ ...TD, color: '#6B7280' }}>{l.descr_conta}</td>
                <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>R$ {brl(l.saldo_estoque)}</td>
                <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>R$ {brl(l.saldo_contabil)}</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: l.confere ? '#12805C' : '#B54708' }}>
                  {Number(l.diferenca) > 0 ? '+' : ''}R$ {brl(l.diferenca)}
                </td>
                <td style={TD}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: l.confere ? '#D1FAE5' : '#FEF3C7',
                    color: l.confere ? '#12805C' : '#B54708' }}>
                    {l.confere ? '✓ Confere' : l.acao}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: '#F9FAFB' }}>
              <td style={{ ...TD, borderTop: '2px solid #E5E7EB' }} colSpan={2}>TOTAL</td>
              <td style={{ ...TD, borderTop: '2px solid #E5E7EB', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                R$ {brl(fechamento.linhas.reduce((s,l) => s + Number(l.saldo_estoque||0), 0))}
              </td>
              <td style={{ ...TD, borderTop: '2px solid #E5E7EB', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                R$ {brl(fechamento.linhas.reduce((s,l) => s + Number(l.saldo_contabil||0), 0))}
              </td>
              <td style={{ ...TD, borderTop: '2px solid #E5E7EB', textAlign: 'right', fontWeight: 700,
                fontVariantNumeric: 'tabular-nums', color: ok ? '#12805C' : '#B54708' }}>
                R$ {brl(fechamento.diferenca)}
              </td>
              <td style={{ ...TD, borderTop: '2px solid #E5E7EB' }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── bloco de notas com diferença ────────────────────────────────────────────
function BlocoNotas({ lancamentos, onDetalhe }) {
  const investigar  = lancamentos.filter(r => r.classe_divergencia === 'INVESTIGAR')
  const ajustesCusto = lancamentos.filter(r => r.classe_divergencia === 'AJUSTE_CUSTO')

  // agrupa ajustes de custo por par de notas (mesma NF, contas opostas)
  const ajustesGrupo = useMemo(() => {
    const g = {}
    ajustesCusto.forEach(r => {
      const k = r.nota_fiscal
      if (!g[k]) g[k] = { nf: k, linhas: [], desvio: 0, descr_top: r.descr_top, data: r.data_entrada_saida }
      g[k].linhas.push(r)
      g[k].desvio = Math.max(g[k].desvio, Math.abs(Number(r.diferenca)||0))
    })
    return Object.values(g).sort((a,b) => b.desvio - a.desvio)
  }, [ajustesCusto])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Notas para investigar */}
      {investigar.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#92400E' }}>
              ⚠ {investigar.length} nota{investigar.length > 1 ? 's' : ''} para investigar
            </span>
            <span style={{ fontSize: 12, color: '#92400E' }}>
              diferença de custo de entrada · verificar TGFCUSITE no Sankhya
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Nota', 'Conta', 'Local', 'Data', 'Operação', 'Custo', 'Contábil', 'Diferença'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', background: '#FFFDF7', borderBottom: '1px solid #FDE68A',
                    textAlign: ['Custo','Contábil','Diferença'].includes(h) ? 'right' : 'left',
                    fontSize: 10.5, fontWeight: 600, color: '#92400E', textTransform: 'uppercase', letterSpacing: '.04em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investigar.map((r, i) => (
                <tr key={r.id||i} onClick={() => onDetalhe(r)} style={{ cursor: 'pointer' }}
                  onMouseOver={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '#FFFBEB')}
                  onMouseOut={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                  <td style={{ ...TD, fontWeight: 700 }}>{r.nota_fiscal}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{r.conta_contabil}</td>
                  <td style={{ ...TD, color: '#6B7280' }}>{r.descr_local}</td>
                  <td style={{ ...TD, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{dBR(r.data_entrada_saida)}</td>
                  <td style={{ ...TD, color: '#6B7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descr_top}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>R$ {brl(r.saldo_dash)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>R$ {brl(r.saldo_contabil)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#B54708', fontVariantNumeric: 'tabular-nums' }}>R$ {brl(r.diferenca)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 18px', background: '#FFFBEB', borderTop: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
            💡 Causa provável: custo de entrada diverge do lançamento contábil. Verificar TGFCUSITE vs lançamento.
          </div>
        </div>
      )}

      {/* Ajustes de custo — explicados, não alarmantes */}
      {ajustesGrupo.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              ⚙ {ajustesCusto.length} lançamentos com ajuste de custo médio
            </span>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              fecham no saldo da conta · já estão refletidos no fechamento acima
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                {['Nota', 'Operação', 'Data', 'Lançamentos', 'Desvio unitário', 'Motivo'].map(h => (
                  <th key={h} style={{
                    padding: '8px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                    textAlign: h === 'Desvio unitário' ? 'right' : 'left',
                    fontSize: 10.5, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ajustesGrupo.map(g => (
                <tr key={g.nf}>
                  <td style={{ ...TD, fontWeight: 700 }}>{g.nf}</td>
                  <td style={{ ...TD, color: '#6B7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.descr_top}</td>
                  <td style={{ ...TD, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{dBR(g.data)}</td>
                  <td style={{ ...TD }}>{g.linhas.length} conta{g.linhas.length > 1 ? 's' : ''}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6B7280' }}>R$ {brl(g.desvio)}</td>
                  <td style={{ ...TD, fontSize: 11.5, color: '#9CA3AF' }}>Custo médio recalculado retroativamente pelo Sankhya — par de lançamentos se anula no saldo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {investigar.length === 0 && ajustesGrupo.length === 0 && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '18px 20px',
          fontSize: 13, color: '#166534', textAlign: 'center' }}>
          ✅ Nenhuma nota com diferença real no período.
        </div>
      )}
    </div>
  )
}

const TD = { padding: '9px 14px', borderBottom: '1px solid #F9FAFB', fontSize: 12.5 }

export default function VIsaoGeral({ lancamentos, fechamento, onDetalhe }) {
  const total = lancamentos.length
  const ok    = lancamentos.filter(r => r.classe_divergencia === 'OK').length
  const inv   = lancamentos.filter(r => r.classe_divergencia === 'INVESTIGAR').length
  const adj   = lancamentos.filter(r => r.classe_divergencia === 'AJUSTE_CUSTO').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Seção 1: Fechamento */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
          letterSpacing: '.1em', marginBottom: 10 }}>
          FECHAMENTO — SALDO DE ESTOQUE × CONTABILIDADE
        </div>
        <BlocoFechamento fechamento={fechamento} />
      </section>

      {/* Seção 2: Resumo das notas */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            DETALHE DAS NOTAS — {int(total)} movimentações do período
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Badge cls="OK"           n={ok} />
            <Badge cls="INVESTIGAR"   n={inv} />
            <Badge cls="AJUSTE_CUSTO" n={adj} />
          </div>
        </div>
        <BlocoNotas lancamentos={lancamentos} onDetalhe={onDetalhe} />
      </section>

    </div>
  )
}
