import React, { useMemo, useState } from 'react'
import { Panel, Tag, Btn, Select, SearchInput } from '../components/UI.jsx'
import { brl, int, dBR, isZero, sitDe } from '../config.js'

const COLS = [
  { k: 'conta_contabil',    r: 'Conta' },
  { k: 'nota_fiscal',       r: 'Nota' },
  { k: 'descr_local',       r: 'Local' },
  { k: 'data_entrada_saida',r: 'Data' },
  { k: 'saldo_dash',        r: 'Custo',    num: true },
  { k: 'saldo_contabil',    r: 'Contábil', num: true },
  { k: 'diferenca',         r: 'Diferença',num: true },
  { k: 'motivo_divergencia',r: 'Situação' },
  { k: 'descr_top',         r: 'Operação' },
]

export default function Lancamentos({ lancamentos }) {
  const [fConta,  setFConta]  = useState('')
  const [fSit,    setFSit]    = useState('')
  const [fLocal,  setFLocal]  = useState('')
  const [busca,   setBusca]   = useState('')
  const [ordem,   setOrdem]   = useState({ col: null, dir: 1 })

  const opcoes = useMemo(() => {
    const u = k => [...new Set(lancamentos.map(r => r[k]).filter(Boolean))].sort()
    return { contas: u('conta_contabil'), sits: u('motivo_divergencia'), locais: u('descr_local') }
  }, [lancamentos])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lancamentos.filter(r => {
      if (fConta && r.conta_contabil !== fConta) return false
      if (fSit   && r.motivo_divergencia !== fSit)  return false
      if (fLocal && r.descr_local !== fLocal) return false
      if (q) {
        const h = `${r.nunota} ${r.nota_fiscal} ${r.descr_local} ${r.conta_contabil} ${r.descr_top}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [lancamentos, fConta, fSit, fLocal, busca])

  const ordenadas = useMemo(() => {
    const a = [...filtradas]
    if (ordem.col) {
      a.sort((x, y) => {
        const xv = x[ordem.col], yv = y[ordem.col]
        const xn = Number(xv), yn = Number(yv)
        if (!isNaN(xn) && !isNaN(yn) && xv !== null && yv !== null && xv !== '' && yv !== '')
          return (xn - yn) * ordem.dir
        return String(xv ?? '').localeCompare(String(yv ?? ''), 'pt-BR') * ordem.dir
      })
    } else {
      a.sort((x, y) => Math.abs(Number(y.diferenca) || 0) - Math.abs(Number(x.diferenca) || 0))
    }
    return a
  }, [filtradas, ordem])

  const visiveis = ordenadas.slice(0, 500)
  const temFiltro = fConta || fSit || fLocal || busca

  const exportarCSV = () => {
    const cols = ['conta_contabil','nunota','nota_fiscal','descr_local','data_entrada_saida','saldo_dash','saldo_contabil','diferenca','motivo_divergencia','descr_top']
    const csv  = [cols.join(';'), ...ordenadas.map(r => cols.map(c => String(r[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n')
    const url  = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a    = document.createElement('a')
    a.href = url; a.download = `conciliacao-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const ord = col => setOrdem(p => p.col === col ? { col, dir: p.dir * -1 } : { col, dir: 1 })

  return (
    <Panel
      title={`${int(filtradas.length)} de ${int(lancamentos.length)} lançamentos`}
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {temFiltro && <Btn small onClick={() => { setFConta(''); setFSit(''); setFLocal(''); setBusca('') }}>✕ Limpar filtros</Btn>}
          <Btn small onClick={exportarCSV}>↓ CSV</Btn>
        </div>
      }
    >
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Select label="Conta"    value={fConta}  onChange={setFConta}  options={opcoes.contas} />
        <Select label="Situação" value={fSit}    onChange={setFSit}    options={opcoes.sits} />
        <Select label="Local"    value={fLocal}  onChange={setFLocal}  options={opcoes.locais} />
        <SearchInput value={busca} onChange={setBusca} placeholder="nota, conta, operação…" />
      </div>

      {/* Tabela */}
      <div style={{ maxHeight: 580, overflowY: 'auto', margin: '0 -18px -16px', borderTop: '1px solid #F3F4F6' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {COLS.map(c => (
                <th key={c.k} onClick={() => ord(c.k)} style={{
                  position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1,
                  padding: '10px 14px', textAlign: c.num ? 'right' : 'left',
                  fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: '.04em', borderBottom: '1px solid #E5E7EB', cursor: 'pointer',
                  whiteSpace: 'nowrap', userSelect: 'none',
                }}>
                  {c.r} {ordem.col === c.k ? (ordem.dir > 0 ? '↑' : '↓') : ''}
                </th>
              ))}
              <th style={{ position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1, width: 30, borderBottom: '1px solid #E5E7EB' }} />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r, i) => {
              const sit = sitDe(r.motivo_divergencia)
              return (
                <tr key={r.id || i} style={{ cursor: 'default' }}>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{r.conta_contabil ?? '—'}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{r.nota_fiscal ?? '—'}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }} title={r.descr_local || ''}>{r.descr_local ?? '—'}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', color: '#9CA3AF', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{dBR(r.data_entrada_saida)}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{brl(r.saldo_dash)}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{brl(r.saldo_contabil)}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: isZero(r.diferenca) ? '#12805C' : '#B42318' }}>{brl(r.diferenca)}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB' }}><Tag sit={sit} /></td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', color: '#9CA3AF', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5 }} title={r.descr_top || ''}>{r.descr_top ?? '—'}</td>
                  <td style={{ padding: '9px 14px', borderBottom: '1px solid #F9FAFB', color: '#D1D5DB' }}>›</td>
                </tr>
              )
            })}
            {!visiveis.length && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF', fontSize: 13 }}>Nenhum lançamento com esses filtros.</td></tr>
            )}
            {ordenadas.length > 500 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '14px', color: '#9CA3AF', fontSize: 12 }}>
                Mostrando 500 de {int(ordenadas.length)} — refine os filtros ou exporte o CSV.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
