import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, brl, int, dBR } from '../config.js'
import { Panel, Btn, Spinner, SearchInput } from '../components/UI.jsx'

const SYNC_KEY = 'kb2026sync!'

async function buscarConferencia(dataInicio) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/conferencia-fiscal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ _key: SYNC_KEY, data_inicio: dataInicio || undefined }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.erro || 'Erro ao buscar conferência fiscal')
  return data
}

export default function ConferenciaFiscal() {
  const hoje = new Date()
  const primeiroDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes)
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState([])
  const [meta, setMeta] = useState(null)
  const [filtro, setFiltro] = useState('todos') // todos | vinculados | pendentes | remessas
  const [busca, setBusca] = useState('')

  const carregar = (dtIni) => {
    setFase('carregando'); setErro('')
    buscarConferencia(dtIni ?? dataInicio)
      .then(d => { setDados(d.dados || []); setMeta(d); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }

  useEffect(() => { carregar(primeiroDiaMes) }, [])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(d => {
      if (filtro === 'vinculados' && !d.vinculado) return false
      if (filtro === 'pendentes' && (d.vinculado || d.remessa)) return false
      if (filtro === 'remessas' && !d.remessa) return false
      if (q) {
        const h = `${d.nf_xml} ${d.nf_compras || ''} ${d.fornecedor} ${d.chave_acesso} ${d.cfop || ''}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dados, filtro, busca])

  const exportar = () => {
    const cols = ['arquivo_xml','nf_xml','nf_compras','chave_acesso','fornecedor','dh_emissao','cfop','natureza_operacao','remessa','nunota','dt_neg','vinculado']
    const csv = [cols.join(';'), ...filtrados.map(d => cols.map(c => String(d[c] ?? '').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `conferencia-fiscal-${dataInicio}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const temFiltro = filtro !== 'todos' || busca

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <p style={{ margin: 0, fontSize: 13, color: '#6B7280', maxWidth: 680, lineHeight: 1.6 }}>
        XMLs recebidos no Portal do Contribuinte que ainda não foram vinculados a uma nota de entrada no Sankhya
        (compras). Notas com CFOP de "outras entradas/saídas" (remessa, consignação, venda à ordem etc.) são
        identificadas automaticamente e separadas — elas não geram obrigação de compra, então não contam como
        pendência real. A data de início é sempre o primeiro dia do mês atual por padrão.
      </p>

      {/* Seletor de data */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 5 }}>
            XMLs importados a partir de
          </label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6 }} />
        </div>
        <Btn primary onClick={() => carregar(dataInicio)} disabled={fase === 'carregando'}>
          {fase === 'carregando' ? '↻ Consultando…' : '🔍 Consultar'}
        </Btn>
        <Btn onClick={() => { setDataInicio(primeiroDiaMes); carregar(primeiroDiaMes) }}>
          ↺ Mês atual
        </Btn>
      </div>

      {fase === 'carregando' && <Spinner />}
      {fase === 'erro' && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: 16, color: '#B42318', fontSize: 13 }}>
          Erro: {erro}
        </div>
      )}

      {fase === 'pronto' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { label: 'Total de XMLs pendentes', valor: int(meta.total), sub: `desde ${dBR(meta.data_inicio)}`, cor: '#101828' },
              { label: 'Já vinculados a compras', valor: int(meta.vinculados), sub: 'nota de entrada encontrada', cor: '#12805C' },
              { label: 'Remessa / outras saídas', valor: int(meta.remessas), sub: 'não gera obrigação de compra', cor: '#6B7280' },
              { label: 'Pendente real', valor: int(meta.pendentes_reais), sub: meta.pendentes_reais > 0 ? 'precisa lançar/verificar' : 'tudo em dia', cor: meta.pendentes_reais > 0 ? '#B54708' : '#12805C' },
            ].map((k, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.cor, fontVariantNumeric: 'tabular-nums' }}>{k.valor}</div>
                <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 4 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <Panel
            title={`${int(filtrados.length)} de ${int(dados.length)} XMLs`}
            action={
              <div style={{ display: 'flex', gap: 8 }}>
                {temFiltro && <Btn small onClick={() => { setFiltro('todos'); setBusca('') }}>✕ Limpar</Btn>}
                <Btn small onClick={exportar}>↓ CSV</Btn>
              </div>
            }
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'todos', label: `Todos (${dados.length})` },
                  { id: 'pendentes', label: `Pendente real (${dados.filter(d => !d.vinculado && !d.remessa).length})`, cor: '#B54708' },
                  { id: 'vinculados', label: `Vinculados (${dados.filter(d => d.vinculado).length})`, cor: '#12805C' },
                  { id: 'remessas', label: `Remessa (${dados.filter(d => d.remessa).length})`, cor: '#6B7280' },
                ].map(f => (
                  <button key={f.id} onClick={() => setFiltro(f.id)} style={{
                    padding: '7px 13px', fontSize: 12.5, borderRadius: 6,
                    border: `1px solid ${filtro === f.id ? (f.cor || '#1D5BBF') : '#E5E7EB'}`,
                    background: filtro === f.id ? (f.cor || '#1D5BBF') : '#fff',
                    color: filtro === f.id ? '#fff' : (f.cor || '#374151'),
                    fontWeight: filtro === f.id ? 700 : 400,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{f.label}</button>
                ))}
              </div>
              <SearchInput value={busca} onChange={setBusca} placeholder="NF, fornecedor, chave…" />
            </div>

            <div style={{ maxHeight: 560, overflowY: 'auto', overflowX: 'auto', margin: '0 -18px -16px', borderTop: '1px solid #F3F4F6' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {['Arq. XML', 'NF (XML)', 'NF (Compras)', 'Fornecedor', 'CFOP / Natureza', 'Emissão', 'Status', 'Chave de acesso'].map(h => (
                      <th key={h} style={{
                        position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1,
                        padding: '9px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#6B7280',
                        textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((d, i) => (
                    <tr key={i} style={{ background: d.remessa ? '#F9FAFB' : d.vinculado ? '#F0FDF4' : '#FFFBEB' }}>
                      <td style={{ padding: '8px 12px', color: '#9CA3AF' }}>{d.arquivo_xml}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>{d.nf_xml}</td>
                      <td style={{ padding: '8px 12px', color: d.nf_compras ? '#374151' : '#9CA3AF', fontWeight: d.nf_compras ? 700 : 400 }}>
                        {d.nf_compras || '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#6B7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.fornecedor}>
                        {d.fornecedor}
                      </td>
                      <td style={{ padding: '8px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.natureza_operacao}>
                        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.cfop || '—'}</span>
                        <span style={{ color: '#9CA3AF', marginLeft: 6, fontSize: 11.5 }}>{d.natureza_operacao}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{dBR(d.dh_emissao)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {d.remessa ? (
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#F3F4F6', color: '#6B7280' }}>
                            Remessa
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: d.vinculado ? '#D1FAE5' : '#FEF3C7',
                            color: d.vinculado ? '#12805C' : '#B54708',
                          }}>
                            {d.vinculado ? '✓ Vinculado' : 'Pendente'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#9CA3AF', fontSize: 11, fontFamily: 'monospace' }}>{d.chave_acesso}</td>
                    </tr>
                  ))}
                  {!filtrados.length && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                      Nenhum XML encontrado nesse período/filtro.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
