import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, brl, int, dBR } from '../config.js'
import { Panel, Select, SearchInput, Spinner, Btn } from '../components/UI.jsx'

export default function Razao() {
  const [fase, setFase]             = useState('idle') // idle | carregando | pronto | erro
  const [erro, setErro]             = useState('')
  const [importacoes, setImportacoes] = useState([])
  const [importacaoId, setImportacaoId] = useState('')
  const [dados, setDados]           = useState([])
  const [fProd, setFProd]           = useState('')
  const [fLocal, setFLocal]         = useState('')
  const [busca, setBusca]           = useState('')

  useEffect(() => {
    sbFetch('razao_importacoes?select=*&order=criado_em.desc')
      .then(r => { setImportacoes(r || []) })
      .catch(() => {})
  }, [])

  const carregar = async (id) => {
    if (!id) return
    setFase('carregando'); setDados([])
    try {
      const rows = await sbFetch(
        `razao_analitico?importacao_id=eq.${id}&select=*&order=data_mov.asc,nunota.asc,sequencia.asc`
      )
      setDados(rows || [])
      setFase('pronto')
    } catch(e) {
      setErro(e.message); setFase('erro')
    }
  }

  const opcoes = useMemo(() => {
    const u = k => [...new Set(dados.map(r => r[k]).filter(Boolean))].sort()
    return { prods: u('codprod'), locais: u('codlocal') }
  }, [dados])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(r => {
      if (fProd  && r.codprod  !== fProd)  return false
      if (fLocal && r.codlocal !== fLocal) return false
      if (q) {
        const h = `${r.codprod} ${r.descrprod} ${r.numnota} ${r.nomeparc} ${r.descroper}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dados, fProd, fLocal, busca])

  const exportarCSV = () => {
    const cols = ['codprod','descrprod','codlocal','descrlocal','numnota','data_mov','tipo','descroper',
                  'nomeparc','qtdneg','custo_unitario','custototal',
                  'saldo_antes_qtd','saldo_antes_vlr','saldo_apos_qtd','saldo_apos_vlr',
                  'conta_contabil','lote','lancamento']
    const csv = [cols.join(';'), ...filtrados.map(r =>
      cols.map(c => String(r[c] ?? '').replace(/;/g, ',')).join(';')
    )].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `razao-${importacaoId}-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Seleção de importação */}
      <Panel title="Selecionar período">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, color: '#6B7280' }}>Período</label>
            <select
              value={importacaoId}
              onChange={e => { setImportacaoId(e.target.value); carregar(e.target.value) }}
              style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, minWidth: 280 }}
            >
              <option value="">Selecione uma importação…</option>
              {importacoes.map(i => (
                <option key={i.id} value={i.id}>
                  {(() => {
                    const d = String(i.periodo_inicio).slice(0,10)
                    const f = String(i.periodo_fim).slice(0,10)
                    const fmt = s => { const [y,m,d2]=s.split('-'); return d2+'/'+m+'/'+y }
                    return fmt(d) + ' a ' + fmt(f)
                  })()}
                  {i.status !== 'pronto' ? ` (${i.status})` : ''}
                </option>
              ))}
            </select>
          </div>
          {fase === 'pronto' && (
            <Btn small onClick={exportarCSV}>↓ CSV</Btn>
          )}
        </div>
      </Panel>

      {fase === 'carregando' && <Spinner />}
      {fase === 'erro' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 16, color: '#B42318' }}>
          Erro: {erro}
        </div>
      )}

      {fase === 'pronto' && (
        <Panel
          title={`${int(filtrados.length)} de ${int(dados.length)} movimentos`}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11.5, color: '#9CA3AF', alignSelf: 'center' }}>
                {[...new Set(filtrados.map(r => r.codprod))].length} produtos · {[...new Set(filtrados.map(r => r.codlocal))].length} locais
              </span>
            </div>
          }
        >
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <Select label="Produto" value={fProd} onChange={setFProd}
              options={opcoes.prods.map(p => {
                const d = dados.find(r => r.codprod === p)
                return p + (d?.descrprod ? ' — ' + d.descrprod.slice(0,40) : '')
              })}
            />
            <Select label="Local" value={fLocal} onChange={setFLocal} options={opcoes.locais} />
            <SearchInput value={busca} onChange={setBusca} placeholder="produto, nota, parceiro…" />
            {(fProd || fLocal || busca) && (
              <button
                onClick={() => { setFProd(''); setFLocal(''); setBusca('') }}
                style={{ alignSelf: 'flex-end', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >✕ Limpar</button>
            )}
          </div>

          {/* Tabela */}
          <div style={{ overflowX: 'auto', margin: '0 -18px -16px', borderTop: '1px solid #F3F4F6', maxHeight: 640 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    ['Data',         false], ['Produto',      false], ['Local',       false],
                    ['Nota',         false], ['Tipo',         false], ['Operação',    false],
                    ['Parceiro',     false], ['Qtd. mov',     true ], ['Custo unit.', true ],
                    ['Valor mov.',   true ], ['Saldo ant. Qtd', true], ['Saldo ant. R$', true],
                    ['Saldo aps. Qtd', true], ['Saldo aps. R$', true],
                    ['Conta CTB',    false], ['Lote',         false],
                  ].map(([h, num]) => (
                    <th key={h} style={{
                      position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1,
                      padding: '9px 12px', textAlign: num ? 'right' : 'left',
                      fontSize: 10.5, fontWeight: 600, color: '#6B7280',
                      textTransform: 'uppercase', letterSpacing: '.04em',
                      borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 1000).map((r, i) => {
                  const isEntrada = r.tipo === 'ENTRADA'
                  const saldoNeg  = Number(r.saldo_apos_qtd) < 0
                  return (
                    <tr key={r.id || i}
                      style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}
                    >
                      <td style={TD}>{dBR(r.data_mov)}</td>
                      <td style={TD}>
                        <div style={{ fontWeight: 600, fontSize: 11.5 }}>{r.codprod}</div>
                        <div style={{ color: '#9CA3AF', fontSize: 10.5, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descrprod}>{r.descrprod}</div>
                      </td>
                      <td style={TD}><span style={{ fontSize: 11 }}>{r.codlocal}<br /><span style={{ color: '#9CA3AF' }}>{r.descrlocal}</span></span></td>
                      <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.numnota}</td>
                      <td style={TD}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: isEntrada ? '#D1FAE5' : '#FEE2E2',
                          color: isEntrada ? '#065F46' : '#991B1B',
                        }}>{r.tipo}</span>
                      </td>
                      <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6B7280' }} title={r.descroper}>{r.descroper}</td>
                      <td style={{ ...TD, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6B7280' }}>{r.nomeparc}</td>
                      <td style={{ ...TD, textAlign: 'right', color: isEntrada ? '#12805C' : '#B42318', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {Number(r.qtdneg) > 0 ? '+' : ''}{Number(r.qtdneg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(r.custo_unitario)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isEntrada ? '#12805C' : '#B42318' }}>
                        {Number(r.custototal) > 0 ? '+' : ''}R$ {brl(r.custototal)}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6B7280' }}>
                        {Number(r.saldo_antes_qtd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6B7280' }}>
                        R$ {brl(r.saldo_antes_vlr)}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: saldoNeg ? '#B42318' : '#101828' }}>
                        {Number(r.saldo_apos_qtd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: Number(r.saldo_apos_vlr) < 0 ? '#B42318' : '#101828' }}>
                        R$ {brl(r.saldo_apos_vlr)}
                      </td>
                      <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', fontSize: 11.5, color: '#374151' }}>{r.conta_contabil}</td>
                      <td style={{ ...TD, color: '#9CA3AF', fontSize: 11 }}>{r.lote}</td>
                    </tr>
                  )
                })}
                {filtrados.length > 1000 && (
                  <tr><td colSpan={16} style={{ textAlign: 'center', padding: '14px', color: '#9CA3AF', fontSize: 12 }}>
                    Mostrando 1.000 de {int(filtrados.length)} — refine os filtros ou exporte o CSV.
                  </td></tr>
                )}
                {!filtrados.length && (
                  <tr><td colSpan={16} style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                    Nenhum registro com esses filtros.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}

const TD = {
  padding: '8px 12px',
  borderBottom: '1px solid #F3F4F6',
  verticalAlign: 'top',
  fontSize: 12,
}
