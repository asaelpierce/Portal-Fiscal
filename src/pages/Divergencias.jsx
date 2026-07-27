import React, { useMemo } from 'react'
import { Card, Panel, Tag } from '../components/UI.jsx'
import { brl, int, dBR, isZero, sitDe } from '../config.js'

export default function Divergencias({ lancamentos, onDetalhe }) {
  const divergentes = useMemo(() =>
    lancamentos
      .filter(r => !String(r.motivo_divergencia || '').startsWith('1'))
      .sort((a, b) => Math.abs(Number(b.diferenca) || 0) - Math.abs(Number(a.diferenca) || 0))
  , [lancamentos])

  const risco = divergentes.reduce((s, r) => s + Math.abs(Number(r.diferenca) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <Card title="Lançamentos divergentes" value={int(divergentes.length)} sub="exigem análise" color="red" />
        <Card title="Valor em aberto" value={`R$ ${brl(risco)}`} sub="soma das diferenças absolutas" color="red" />
        <Card
          title="Maior desvio individual"
          value={divergentes.length ? `R$ ${brl(Math.abs(divergentes[0].diferenca))}` : '—'}
          sub={divergentes.length ? `NF ${divergentes[0].nota_fiscal}` : 'sem divergências'}
          color="orange"
        />
      </div>

      <Panel title="Fila de análise" action={<span style={{ fontSize: 11.5, color: '#9CA3AF' }}>maior desvio primeiro</span>}>
        <div>
          {divergentes.map((r, i) => {
            const sit = sitDe(r.motivo_divergencia)
            return (
              <button key={r.id || i} onClick={() => onDetalhe(r)} style={{
                display: 'grid',
                gridTemplateColumns: '28px 140px 90px 1fr auto 110px 18px',
                alignItems: 'center', gap: 12, padding: '11px 8px', width: '100%',
                background: 'none', border: 'none', borderBottom: '1px solid #F3F4F6',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 11.5, color: '#9CA3AF', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <Tag sit={sit} />
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>NF {r.nota_fiscal}</span>
                <span style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  conta {r.conta_contabil} · {r.descr_local} · {dBR(r.data_entrada_saida)}
                </span>
                <span style={{ display: 'flex', gap: 14, fontSize: 11.5, color: '#9CA3AF', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  <span>custo <strong style={{ color: '#374151' }}>{brl(r.saldo_dash)}</strong></span>
                  <span>contábil <strong style={{ color: '#374151' }}>{brl(r.saldo_contabil)}</strong></span>
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#B42318', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  R$ {brl(r.diferenca)}
                </span>
                <svg width="14" height="14" fill="none" stroke="#D1D5DB" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )
          })}
          {!divergentes.length && (
            <p style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', margin: 0 }}>
              ✓ Nenhuma divergência no período. Todos os lançamentos conferem.
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}
