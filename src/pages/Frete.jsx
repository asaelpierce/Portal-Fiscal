import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

// ============================================================================
// Apropriação de Frete
//
// Compara o VLRFRETE lançado em cada nota com o rateio correto do CT-e.
// O rateio é proporcional ao valor dos itens de cada nota dentro do CT-e,
// como manda o cálculo da contabilidade — não divisão igual.
//
// POR ENQUANTO SÓ MOSTRA. A gravação no Sankhya existe (a tela de nota usa
// CACSP.salvarFreteExtraNota), mas só entra depois que os números daqui forem
// conferidos à mão. Se o cálculo estiver errado e a gravação já estiver
// ligada, o erro vai para dentro do ERP em dezenas de notas de uma vez.
//
// JANELA: só a competência anterior à corrente. Mês fechado não se mexe.
// ============================================================================

const PAPEL = '#FBFAF8', TINTA = '#1A1A18', TRACO = '#E4E1DC', SUAVE = '#6E6A64'
const VERDE = '#12805C', VERM = '#B42318', AMBAR = '#B45309', AZUL = '#1F60A8'

const SIT = {
  'ok':              { rot: 'Confere',          cor: VERDE, bg: '#E9F7F1' },
  'sem lancar':      { rot: 'Sem lançar',       cor: VERM,  bg: '#FDECEA' },
  'lancado a maior': { rot: 'Lançado a maior',  cor: AMBAR, bg: '#FDF3E7' },
  'lancado a menor': { rot: 'Lançado a menor',  cor: AMBAR, bg: '#FDF3E7' },
}

const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dBR = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

export default function Frete({ sessao }) {
  const [linhas, setLinhas] = useState([])
  const [competencia, setCompetencia] = useState('')
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [foco, setFoco] = useState('corrigir')
  const [tipo, setTipo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(null)
  const [enviando, setEnviando] = useState(null)      // chave em andamento
  const [resultados, setResultados] = useState({})    // chave -> resultado
  const [emLote, setEmLote] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [sincronizadoEm, setSincronizadoEm] = useState(null)
  const [historico, setHistorico] = useState([])
  const [verHistorico, setVerHistorico] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const d = await sbFetch('frete_diagnostico?select=*&order=cte_data.desc,cte_nunota')
        setLinhas(d || [])
        const maisNovo = (d || []).reduce((m, x) =>
          !m || String(x.sincronizado_em) > m ? String(x.sincronizado_em) : m, null)
        setSincronizadoEm(maisNovo)
        const ed = (d || []).find(x => x.editavel)
        setCompetencia(ed?.competencia || (d || [])[0]?.competencia || '')
        setHistorico(await sbFetch('frete_historico?select=*&limit=200') || [])
        setFase('pronto')
      } catch (e) { setErro(String(e?.message ?? e)); setFase('erro') }
    })()
  }, [])

  // Sem isto a tela mostra o que o Sankhya tinha na ultima carga, nao o
  // de agora. Um frete lancado a mao no ERP nao aparece aqui ate alguem
  // sincronizar, e a conferencia fica em cima de dado velho.
  const sincronizar = async () => {
    setSincronizando(true)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/sankhya-frete-cte-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'kb2026sync!',
                   apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ desde: '2026-07-01' }),
      })
      const d = await sbFetch('frete_diagnostico?select=*&order=cte_data.desc,cte_nunota')
      setLinhas(d || [])
      setResultados({})
      const maisNovo = (d || []).reduce((m, x) =>
        !m || String(x.sincronizado_em) > m ? String(x.sincronizado_em) : m, null)
      setSincronizadoEm(maisNovo)
    } catch (e) { setErro(String(e?.message ?? e)) }
    setSincronizando(false)
  }

  const lancar = async (l) => {
    const chave = `${l.cte_nunota}-${l.nf_nunota}`
    setEnviando(chave)
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/sankhya-frete-lancar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY,
                   Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          cte_nunota: l.cte_nunota, nf_nunota: l.nf_nunota,
          usuario: sessao?.email || '',
        }),
      })
      const d = await r.json()
      setResultados(v => ({ ...v, [chave]: d }))
      sbFetch('frete_historico?select=*&limit=200').then(h => setHistorico(h || [])).catch(() => {})
      if (d.ok) {
        // usa o valor que o ERP confirmou na releitura, nao o que pedimos
        const confirmado = d.confirmado_no_erp ?? d.valor_novo
        setLinhas(ls => ls.map(x =>
          x.cte_nunota === l.cte_nunota && x.nf_nunota === l.nf_nunota
            ? { ...x, nf_frete_lancado: confirmado, situacao: 'ok', diferenca: 0 } : x))
      }
      return d
    } catch (e) {
      const d = { ok: false, erro: String(e?.message ?? e) }
      setResultados(v => ({ ...v, [chave]: d }))
      return d
    } finally { setEnviando(null) }
  }

  // envia um a um, em sequência: o Sankhya recusa chamadas simultâneas
  // na mesma sessão de tela
  const lancarTodos = async (lista) => {
    setEmLote(true)
    for (const l of lista) {
      if (l.situacao === 'ok') continue
      await lancar(l)
    }
    setEmLote(false)
  }

  const comps = useMemo(
    () => [...new Set(linhas.map(l => l.competencia))].sort().reverse(), [linhas])

  const doMes = useMemo(
    () => linhas.filter(l => l.competencia === competencia), [linhas, competencia])

  // Editável é decidido por NOTA, não pelo CT-e: um CT-e de setembro pode
  // amarrar nota de agosto, e mês fechado não se altera.
  const temEditavel = doMes.some(l => l.editavel)
  const editavel = temEditavel

  const vistas = useMemo(() => doMes
    .filter(l => foco === 'todos' || (foco === 'corrigir' ? l.situacao !== 'ok' : l.situacao === 'ok'))
    .filter(l => tipo === 'todos' ? true
               : tipo === 'compra' ? l.e_compra
               : tipo === 'um' ? l.um_para_um : !l.um_para_um)
    .filter(l => !busca || `${l.cte_numnota} ${l.nf_numnota} ${l.transportador || ''} ${l.cte_nunota} ${l.nf_nunota}`
      .toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => Math.abs(Number(b.diferenca) || 0) - Math.abs(Number(a.diferenca) || 0)),
  [doMes, foco, tipo, busca])

  const tot = useMemo(() => {
    const corrigir = doMes.filter(l => l.situacao !== 'ok')
    return {
      vinculos: doMes.length,
      ctes: new Set(doMes.map(l => l.cte_nunota)).size,
      ok: doMes.filter(l => l.situacao === 'ok').length,
      corrigir: corrigir.length,
      valor: corrigir.reduce((s, l) => s + Math.abs(Number(l.diferenca) || 0), 0),
      um: corrigir.filter(l => l.um_para_um).length,
      rateado: corrigir.filter(l => !l.um_para_um).length,
      compra: corrigir.filter(l => l.e_compra).length,
      podeLancar: corrigir.filter(l => l.editavel).length,
    }
  }, [doMes])

  // agrupa por CT-e, que é como a conferência acontece na prática
  const porCte = useMemo(() => {
    const m = new Map()
    vistas.forEach(l => {
      if (!m.has(l.cte_nunota)) m.set(l.cte_nunota, { cte: l.cte_nunota, cab: l, notas: [] })
      m.get(l.cte_nunota).notas.push(l)
    })
    return [...m.values()]
  }, [vistas])

  if (fase === 'carregando') {
    return <div style={{ padding: 40, color: SUAVE, fontSize: 13 }}>Carregando a conferência de frete…</div>
  }
  if (fase === 'erro') {
    return (
      <div style={{ padding: 20, fontSize: 13, color: VERM, lineHeight: 1.6 }}>
        Não consegui carregar.
        <div style={{ fontSize: 12, color: SUAVE, marginTop: 6, fontFamily: 'monospace' }}>{erro}</div>
      </div>
    )
  }

  return (
    <div style={{ background: PAPEL,
                  margin: 'calc(var(--pad-y) * -1) calc(var(--pad-x) * -1) calc(var(--pad-b) * -1)',
                  padding: 'calc(var(--pad-y) + 8px) var(--pad-x) calc(var(--pad-b) - 4px)',
                  minHeight: '100%' }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TINTA }}>Apropriação de Frete</h2>
      <p style={{ margin: '6px 0 16px', fontSize: 12.5, color: SUAVE, maxWidth: 760, lineHeight: 1.6 }}>
        Confere o frete lançado em cada nota contra o rateio correto do CT-e. O rateio é
        proporcional ao valor dos itens de cada nota dentro do CT-e, não divisão igual entre elas.
      </p>

      <div style={{ background: '#EAF1FA', border: `1px solid #C9DCF0`, borderRadius: 8,
                    padding: '12px 15px', marginBottom: 18, fontSize: 12.5, color: '#19477F', lineHeight: 1.6 }}>
        O botão <strong>Lançar</strong> grava o frete direto no Sankhya, na Central de Notas. Antes
        de gravar, o sistema confere se alguém alterou a nota desde a última sincronização, e depois
        relê para confirmar que só o frete mudou. Cada lançamento fica registrado com quem mandou,
        valor anterior e novo.
        <div style={{ marginTop: 6, color: '#4A4741' }}>
          Nota que o Sankhya recusar aparece com o motivo dele ao lado — há casos em que o ERP não
          permite alterar o frete, e a mensagem diz qual é.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={competencia} onChange={e => setCompetencia(e.target.value)}
          style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 11px',
                   border: `1px solid ${TRACO}`, borderRadius: 6, background: '#fff', color: TINTA }}>
          {comps.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 5,
                       color: editavel ? VERDE : SUAVE, background: editavel ? '#E9F7F1' : '#F0EEEA' }}>
          {editavel ? 'competência liberada' : 'mês fechado · só consulta'}
        </span>

        <button onClick={sincronizar} disabled={sincronizando || emLote || !!enviando}
          style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                   cursor: sincronizando ? 'default' : 'pointer', padding: '7px 14px',
                   border: `1px solid ${TRACO}`, borderRadius: 6, background: '#fff',
                   color: sincronizando ? SUAVE : TINTA }}>
          {sincronizando ? 'Buscando no Sankhya…' : '↻ Atualizar do Sankhya'}
        </button>
        {sincronizadoEm && (
          <span style={{ fontSize: 11, color: SUAVE }}>
            dados de {new Date(sincronizadoEm).toLocaleString('pt-BR',
              { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button onClick={() => setVerHistorico(v => !v)}
          style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '7px 13px',
                   border: `1px solid ${verHistorico ? TINTA : TRACO}`, borderRadius: 6,
                   background: verHistorico ? TINTA : '#fff', color: verHistorico ? PAPEL : SUAVE,
                   marginLeft: 'auto' }}>
          Registros{historico.length ? ` (${historico.length})` : ''}
        </button>
      </div>

      {verHistorico && (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, marginBottom: 18 }}>
          <div style={{ padding: '11px 15px', borderBottom: `1px solid ${TRACO}`,
                        fontSize: 12, color: SUAVE, lineHeight: 1.55 }}>
            Tudo que o portal mandou para o Sankhya, inclusive o que falhou e o motivo.
            Nenhum lancamento acontece sem passar por aqui.
          </div>
          {historico.length === 0 ? (
            <div style={{ padding: '20px 15px', fontSize: 13, color: SUAVE }}>
              Nenhum lançamento feito ainda.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 420 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    {['Quando', 'Quem', 'CT-e', 'Nota', 'De', 'Para', 'Resultado', 'Observação'].map((h, i) => (
                      <th key={h} style={{ padding: '9px 12px', fontSize: 10.5, fontWeight: 600,
                        color: '#9A958E', textAlign: i >= 4 && i <= 5 ? 'right' : 'left',
                        borderBottom: `1px solid ${TRACO}`, position: 'sticky', top: 0,
                        background: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historico.map(h => {
                    const deu = h.resultado === 'ok'
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid #F0EEEA' }}>
                        <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE, whiteSpace: 'nowrap' }}>
                          {new Date(h.feito_em).toLocaleString('pt-BR',
                            { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE }}>
                          {String(h.feito_por || '').split('@')[0]}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: TINTA,
                                     fontVariantNumeric: 'tabular-nums' }}>{h.cte_numnota || h.cte_nunota}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: TINTA, fontWeight: 600,
                                     fontVariantNumeric: 'tabular-nums' }}>{h.nf_numnota || h.nf_nunota}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right',
                                     color: SUAVE, fontVariantNumeric: 'tabular-nums' }}>
                          {brl(h.valor_anterior)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right',
                                     color: TINTA, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {brl(h.valor_novo)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                                         color: deu ? VERDE : VERM, background: deu ? '#E9F7F1' : '#FDECEA' }}>
                            {deu ? 'gravado' : 'recusado'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: SUAVE, maxWidth: 300,
                                     lineHeight: 1.4 }}>{h.mensagem || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
                    gap: 18, marginBottom: 20 }}>
        {[
          ['CT-e no mês', String(tot.ctes)],
          ['Notas vinculadas', String(tot.vinculos)],
          ['Conferem', String(tot.ok), VERDE],
          ['A corrigir', String(tot.corrigir), tot.corrigir ? VERM : VERDE],
          ['Dá para lançar', String(tot.podeLancar), tot.podeLancar ? AZUL : SUAVE],
          ['Valor em jogo', `R$ ${brl(tot.valor)}`, tot.valor ? VERM : SUAVE],
        ].map(([r, v, c]) => (
          <div key={r}>
            <div style={{ fontSize: 11.5, color: SUAVE, marginBottom: 5 }}>{r}</div>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 21, color: c || TINTA, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {[['corrigir', `A corrigir (${tot.corrigir})`], ['ok', `Conferem (${tot.ok})`], ['todos', 'Todos']].map(([k, r]) => (
          <button key={k} onClick={() => setFoco(k)} style={{
            fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '6px 13px', borderRadius: 5,
            border: `1px solid ${foco === k ? TINTA : TRACO}`,
            background: foco === k ? TINTA : '#fff', color: foco === k ? PAPEL : SUAVE,
            fontWeight: foco === k ? 600 : 400,
          }}>{r}</button>
        ))}
        <span style={{ width: 1, height: 20, background: TRACO, margin: '0 3px' }} />
        {[['todos', 'Todos'], ['compra', `Só compra (${tot.compra})`],
          ['um', `Um-para-um (${tot.um})`], ['rateado', `Rateado (${tot.rateado})`]].map(([k, r]) => (
          <button key={k} onClick={() => setTipo(k)} style={{
            fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '5px 11px', borderRadius: 5,
            border: `1px solid ${tipo === k ? AZUL : TRACO}`,
            background: tipo === k ? '#EAF1FA' : '#fff', color: tipo === k ? AZUL : SUAVE,
            fontWeight: tipo === k ? 600 : 400,
          }}>{r}</button>
        ))}
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="CT-e ou nota…"
          style={{ fontFamily: 'inherit', fontSize: 12.5, padding: '6px 10px',
                   border: `1px solid ${TRACO}`, borderRadius: 6, width: 170 }} />
      </div>

      {porCte.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '28px 20px',
                      textAlign: 'center', fontSize: 13, color: SUAVE }}>
          Nada nesse filtro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {porCte.map(g => {
            const c = g.cab
            const ab = aberto === g.cte
            const somaDif = g.notas.reduce((s, l) => s + Math.abs(Number(l.diferenca) || 0), 0)
            return (
              <div key={g.cte} style={{ background: '#fff', border: `1px solid ${TRACO}` }}>
                <button onClick={() => setAberto(ab ? null : g.cte)} aria-expanded={ab}
                  style={{ width: '100%', display: 'grid',
                           gridTemplateColumns: '16px 130px 1fr 110px 90px 120px',
                           gap: 12, alignItems: 'center', padding: '12px 15px',
                           background: 'transparent', border: 'none', cursor: 'pointer',
                           fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 10, color: SUAVE,
                                 transform: ab ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}>▶</span>
                  <span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TINTA, fontVariantNumeric: 'tabular-nums' }}>
                      CT-e {c.cte_numnota}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#9A958E' }}>{dBR(c.cte_data)}</div>
                  </span>
                  <span style={{ fontSize: 12, color: SUAVE, overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.transportador}
                  </span>
                  <span style={{ fontSize: 12.5, color: TINTA, textAlign: 'right',
                                 fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    R$ {brl(c.cte_valor)}
                  </span>
                  <span style={{ fontSize: 11.5, color: c.um_para_um ? SUAVE : AZUL, textAlign: 'center' }}>
                    {c.um_para_um ? '1 nota' : `${c.nfs_no_cte} notas`}
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    {somaDif > 0.005 ? (
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: VERM,
                                     fontVariantNumeric: 'tabular-nums' }}>
                        R$ {brl(somaDif)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11.5, color: VERDE, fontWeight: 600 }}>confere</span>
                    )}
                  </span>
                </button>

                {(() => {
                  const podem = g.notas.filter(x => x.situacao !== 'ok' && x.editavel)
                  const travadas = g.notas.filter(x => x.situacao !== 'ok' && !x.editavel)
                  if (!podem.length && !travadas.length) return null
                  return (
                    <div style={{ padding: '0 15px 11px', display: 'flex', gap: 10,
                                  alignItems: 'center', flexWrap: 'wrap' }}>
                      {podem.length > 0 && (
                        <button onClick={(ev) => { ev.stopPropagation(); lancarTodos(podem) }}
                          disabled={emLote || !!enviando}
                          style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                                   cursor: emLote ? 'default' : 'pointer', padding: '6px 14px',
                                   border: 'none', borderRadius: 5,
                                   background: emLote ? SUAVE : TINTA, color: PAPEL }}>
                          {emLote ? 'Lançando…' : `Lançar ${podem.length} nota${podem.length > 1 ? 's' : ''}`}
                        </button>
                      )}
                      {travadas.length > 0 && (
                        <span style={{ fontSize: 11.5, color: AMBAR }}>
                          {travadas.length} fora do alcance:{' '}
                          {[...new Set(travadas.map(x => x.motivo_bloqueio === 'nota de venda'
                            ? 'nota de venda' : `nota de ${x.competencia_nf}`))].join(' · ')}
                        </span>
                      )}
                      {podem.length > 0 && <span style={{ fontSize: 11, color: SUAVE }}>uma por vez</span>}
                    </div>
                  )
                })()}

                {ab && (
                  <div style={{ borderTop: `1px solid ${TRACO}`, background: '#FDFCFA' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                        <thead>
                          <tr>
                            {['Nota', 'Data', 'Valor da nota', 'Base de itens', 'Frete lançado',
                              'Frete correto', 'Diferença', 'Situação', ''].map((h, i) => (
                              <th key={h} style={{ padding: '8px 12px', fontSize: 10.5, fontWeight: 600,
                                color: '#9A958E', textAlign: i >= 2 && i <= 6 ? 'right' : 'left',
                                borderBottom: `1px solid ${TRACO}`, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.notas.map(l => {
                            const s = SIT[l.situacao] || SIT.ok
                            return (
                              <tr key={l.nf_nunota} style={{ borderBottom: `1px solid #F0EEEA` }}>
                                <td style={{ padding: '9px 12px', fontSize: 12.5, fontWeight: 600,
                                             color: TINTA, fontVariantNumeric: 'tabular-nums' }}>
                                  {l.nf_numnota}
                                  <div style={{ fontSize: 10, color: '#9A958E', fontWeight: 400 }}>
                                    nº único {l.nf_nunota}
                                  </div>
                                </td>
                                <td style={{ padding: '9px 12px', fontSize: 11.5,
                                             color: l.nota_de_outro_mes ? AMBAR : SUAVE,
                                             fontWeight: l.nota_de_outro_mes ? 600 : 400 }}>
                                  {dBR(l.nf_data)}
                                  {l.nota_de_outro_mes && <span title="Nota de mês diferente do CT-e"> ⚠</span>}
                                </td>
                                <td style={{ padding: '9px 12px', fontSize: 12, textAlign: 'right',
                                             color: SUAVE, fontVariantNumeric: 'tabular-nums' }}>
                                  {brl(l.nf_valor)}</td>
                                <td style={{ padding: '9px 12px', fontSize: 11.5, textAlign: 'right',
                                             color: '#9A958E', fontVariantNumeric: 'tabular-nums' }}
                                    title="Soma de quantidade × valor unitário dos itens. É o peso do rateio.">
                                  {brl(l.base_itens)}
                                  {!l.um_para_um && l.base_itens_cte > 0 && (
                                    <div style={{ fontSize: 10 }}>
                                      {((l.base_itens / l.base_itens_cte) * 100).toFixed(1)}% do CT-e
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '9px 12px', fontSize: 12.5, textAlign: 'right',
                                             color: TINTA, fontVariantNumeric: 'tabular-nums' }}>
                                  {brl(l.nf_frete_lancado)}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12.5, textAlign: 'right',
                                             color: VERDE, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                  {brl(l.frete_correto)}</td>
                                <td style={{ padding: '9px 12px', fontSize: 12.5, textAlign: 'right',
                                             fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                                             color: Math.abs(l.diferenca) < 0.01 ? '#9A958E' : VERM }}>
                                  {l.diferenca > 0 ? '+' : ''}{brl(l.diferenca)}</td>
                                <td style={{ padding: '9px 12px' }}>
                                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px',
                                                 borderRadius: 4, color: s.cor, background: s.bg,
                                                 whiteSpace: 'nowrap' }}>{s.rot}</span>
                                </td>
                                <td style={{ padding: '9px 12px', minWidth: 190 }}>
                                  {(() => {
                                    const chave = `${l.cte_nunota}-${l.nf_nunota}`
                                    const res = resultados[chave]
                                    const indo = enviando === chave
                                    if (l.situacao === 'ok' && !res) return null
                                    if (indo) return <span style={{ fontSize: 11.5, color: SUAVE }}>enviando…</span>
                                    if (res?.ok) return (
                                      <span style={{ fontSize: 11.5, color: VERDE, fontWeight: 600 }}>
                                        ✓ lançado R$ {brl(res.valor_novo)}
                                      </span>
                                    )
                                    return (
                                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {l.editavel ? (
                                          <button onClick={() => lancar(l)} disabled={emLote}
                                            style={{ fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                                                     cursor: emLote ? 'default' : 'pointer',
                                                     padding: '5px 12px', border: `1px solid ${TINTA}`,
                                                     borderRadius: 5, background: '#fff', color: TINTA }}>
                                            Lançar
                                          </button>
                                        ) : (
                                          <span style={{ fontSize: 10.5, color: AMBAR, lineHeight: 1.35 }}
                                                title={l.motivo_bloqueio === 'nota de venda'
                                                  ? `TOP ${l.nf_top}: ${l.nf_top_nome || 'venda'}. O Sankhya só aceita alterar frete em nota de compra.`
                                                  : `Nota de ${l.competencia_nf}; só ${competencia} está liberada`}>
                                            {l.motivo_bloqueio === 'nota de venda'
                                              ? 'nota de venda'
                                              : `nota de ${l.competencia_nf} · mês fechado`}
                                          </span>
                                        )}
                                        {res && !res.ok && (
                                          <span style={{ fontSize: 10.5, color: VERM, maxWidth: 230, lineHeight: 1.4 }}
                                                title={res.erro}>
                                            {res.erro}
                                          </span>
                                        )}
                                      </span>
                                    )
                                  })()}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {!c.um_para_um && (
                      <div style={{ padding: '10px 15px', fontSize: 11, color: SUAVE, lineHeight: 1.5,
                                    borderTop: `1px solid #F0EEEA` }}>
                        Rateio proporcional: cada nota recebe a fatia do frete equivalente ao peso
                        dos seus itens no total do CT-e. A soma das colunas de frete correto fecha
                        com o valor do CT-e.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 11, color: SUAVE, marginTop: 16, lineHeight: 1.55, maxWidth: 760 }}>
        Clique no CT-e para ver as notas. A conferência vale só para a competência anterior à
        corrente — meses mais antigos estão fechados e aparecem apenas para consulta.
      </div>
    </div>
  )
}
