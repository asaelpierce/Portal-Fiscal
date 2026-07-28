import React, { useMemo, useState } from 'react'
import { brl, int, dBR, classeDe, situacaoLabel } from '../config.js'
import { Panel, Select, SearchInput, Btn } from '../components/UI.jsx'

const COLS = [
  { k: 'conta_contabil',    r: 'Conta' },
  { k: 'nota_fiscal',       r: 'Nota' },
  { k: 'descr_local',       r: 'Local' },
  { k: 'data_entrada_saida',r: 'Data' },
  { k: 'saldo_dash',        r: 'Custo',    num: true },
  { k: 'saldo_contabil',    r: 'Contábil', num: true },
  { k: 'diferenca',         r: 'Diferença',num: true },
  { k: 'classe_divergencia',r: 'Situação' },
  { k: 'descr_top',         r: 'Operação' },
]

export default function Lancamentos({ lancamentos, onDetalhe }) {
  const [fConta,  setFConta]  = useState('')
  const [fClasse, setFClasse] = useState('')
  const [fLocal,  setFLocal]  = useState('')
  const [busca,   setBusca]   = useState('')
  const [ordem,   setOrdem]   = useState({ col: null, dir: 1 })

  const opcoes = useMemo(() => {
    const u = k => [...new Set(lancamentos.map(r => r[k]).filter(Boolean))].sort()
    return {
      contas:   u('conta_contabil'),
      classes:  ['OK','INVESTIGAR','AJUSTE_CUSTO','CRITICO','REMESSA','JUSTIFICADO'],
      locais:   u('descr_local'),
    }
  }, [lancamentos])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lancamentos.filter(r => {
      if (fConta  && r.conta_contabil    !== fConta)  return false
      if (fClasse && r.classe_divergencia !== fClasse) return false
      if (fLocal  && r.descr_local       !== fLocal)  return false
      if (q) {
        const h = `${r.nunota} ${r.nota_fiscal} ${r.descr_local} ${r.conta_contabil} ${r.descr_top}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [lancamentos, fConta, fClasse, fLocal, busca])

  const ordenadas = useMemo(() => {
    const a = [...filtradas]
    if (ordem.col) {
      a.sort((x, y) => {
        const xv = x[ordem.col], yv = y[ordem.col]
        const xn = Number(xv), yn = Number(yv)
        if (!isNaN(xn) && !isNaN(yn) && xv !== null && yv !== null)
          return (xn - yn) * ordem.dir
        return String(xv ?? '').localeCompare(String(yv ?? ''), 'pt-BR') * ordem.dir
      })
    } else {
      a.sort((x, y) => {
        // ordem: investigar > ajuste_custo > ok
        const ordem_cls = { INVESTIGAR: 0, CRITICO: 0, AJUSTE_CUSTO: 1, OK: 2, REMESSA: 1, JUSTIFICADO: 2 }
        const ox = ordem_cls[x.classe_divergencia] ?? 1
        const oy = ordem_cls[y.classe_divergencia] ?? 1
        if (ox !== oy) return ox - oy
        return Math.abs(Number(y.diferenca)||0) - Math.abs(Number(x.diferenca)||0)
      })
    }
    return a
  }, [filtradas, ordem])

  const exportarCSV = () => {
    const cols = ['conta_contabil','nota_fiscal','descr_local','data_entrada_saida','saldo_dash','saldo_contabil','diferenca','classe_divergencia','motivo_calculado','descr_top']
    const csv  = [cols.join(';'), ...ordenadas.map(r => cols.map(c => String(r[c] ?? '').replace(/;/g, ',')).join(';'))].join('\n')
    const url  = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a    = document.createElement('a')
    a.href = url; a.download = `lancamentos-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const ord = col => setOrdem(p => p.col === col ? { col, dir: p.dir * -1 } : { col, dir: 1 })
  const temFiltro = fConta || fClasse || fLocal || busca

  return (
    <Panel
      title={`${int(filtradas.length)} de ${int(lancamentos.length)} movimentações`}
      action={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {temFiltro && <Btn small onClick={() => { setFConta(''); setFClasse(''); setFLocal(''); setBusca('') }}>✕ Limpar</Btn>}
          <Btn small onClick={exportarCSV}>↓ CSV</Btn>
        </div>
      }
    >
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Select label="Conta"    value={fConta}  onChange={setFConta}  options={opcoes.contas} />
        <Select label="Situação" value={fClasse} onChange={setFClasse} options={opcoes.classes}
          placeholder="Todas" />
        <Select label="Local"    value={fLocal}  onChange={setFLocal}  options={opcoes.locais} />
        <SearchInput value={busca} onChange={setBusca} placeholder="nota, conta, operação…" />
      </div>

      {/* Tabela */}
      <div style={{ maxHeight: 600, overflowY: 'auto', margin: '0 -18px -16px', borderTop: '1px solid #F3F4F6' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {COLS.map(c => (
                <th key={c.k} onClick={() => ord(c.k)} style={{
                  position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1,
                  padding: '9px 12px', textAlign: c.num ? 'right' : 'left',
                  fontSize: 10.5, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase',
                  letterSpacing: '.04em', borderBottom: '1px solid #E5E7EB',
                  cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
                }}>
                  {c.r} {ordem.col === c.k ? (ordem.dir > 0 ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.slice(0, 500).map((r, i) => {
              const cls = classeDe(r.classe_divergencia)
              const dif = Number(r.diferenca) || 0
              const isOk = r.classe_divergencia === 'OK'
              return (
                <tr key={r.id || i} style={{ background: isOk ? '#fff' : '#FFFEF5' }}>
                  <td style={TD}>{r.conta_contabil ?? '—'}</td>
                  <td style={{ ...TD, fontWeight: 600 }}>{r.nota_fiscal ?? '—'}</td>
                  <td style={{ ...TD, color: '#6B7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.descr_local ?? '—'}
                  </td>
                  <td style={{ ...TD, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{dBR(r.data_entrada_saida)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(r.saldo_dash)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(r.saldo_contabil)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: dif !== 0 ? 700 : 400,
                    fontVariantNumeric: 'tabular-nums',
                    color: Math.abs(dif) < 0.005 ? '#12805C' : Math.abs(dif) < 0.10 ? '#6B7280' : cls.cor }}>
                    {dif !== 0 ? `${dif > 0 ? '+' : ''}${brl(dif)}` : '—'}
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: cls.bg, color: cls.cor, whiteSpace: 'nowrap',
                      }}>{cls.icone} {cls.rot}</span>
                      {r.motivo_calculado && r.classe_divergencia !== 'OK' && (
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>{r.motivo_calculado}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...TD, color: '#6B7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.descr_top ?? '—'}
                  </td>
                </tr>
              )
            })}
            {!ordenadas.length && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                Nenhum registro com esses filtros.
              </td></tr>
            )}
            {ordenadas.length > 500 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '12px', color: '#9CA3AF', fontSize: 12 }}>
                Mostrando 500 de {int(ordenadas.length)} — refine os filtros ou exporte o CSV.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

const TD = { padding: '8px 12px', borderBottom: '1px solid #F9FAFB', fontSize: 12.5, verticalAlign: 'middle' }
