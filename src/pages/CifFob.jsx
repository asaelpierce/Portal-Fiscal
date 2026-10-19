import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

// ============================================================================
// Tipo de Frete — pedidos pendentes
//
// Troca CIF_FOB de F para C nos pedidos de venda que estão pendentes, para
// fechar as pendências. Regra fixa na Edge Function, não aqui: TIPMOV=P,
// PENDENTE=S, CIF_FOB=F, 2021 a 2025.
//
// ESCRITA EM ANO FECHADO. Por isso a tela trabalha em lotes pequenos, por
// ano, e mostra o histórico do que já foi feito com o valor anterior — se
// algo precisar voltar, há registro de qual era.
// ============================================================================

const PAPEL = '#FBFAF8', TINTA = '#1A1A18', TRACO = '#E4E1DC', SUAVE = '#6E6A64'
const VERDE = '#12805C', VERM = '#B42318', AMBAR = '#B45309', AZUL = '#1F60A8'

const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const int = (v) => Number(v ?? 0).toLocaleString('pt-BR')
const dBR = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
const dh = (v) => v ? new Date(v).toLocaleString('pt-BR',
  { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export default function CifFob({ sessao }) {
  const [pedidos, setPedidos] = useState([])
  const [porOperacao, setPorOperacao] = useState([])
  const [historico, setHistorico] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [anoSel, setAnoSel] = useState('')
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [verHistorico, setVerHistorico] = useState(false)
  const [lote, setLote] = useState(10)

  const carregar = async () => {
    try {
      const [p, op, h] = await Promise.all([
        sbFetch('cif_fob_pedido?select=*&order=dt_neg.desc'),
        sbFetch('cif_fob_por_operacao?select=*'),
        sbFetch('cif_fob_historico?select=*&limit=400'),
      ])
      setPedidos(p || []); setPorOperacao(op || []); setHistorico(h || [])
      setFase('pronto')
    } catch (e) { setErro(String(e?.message ?? e)); setFase('erro') }
  }
  useEffect(() => { carregar() }, [])

  const chamar = async (corpo) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/sankhya-cif-fob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY,
                 Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ ...corpo, usuario: sessao?.email || '' }),
    })
    return r.json()
  }

  const atualizarLista = async () => {
    setRodando(true); setResultado(null)
    try {
      const d = await chamar({ modo: 'listar' })
      setResultado(d); await carregar()
    } catch (e) { setResultado({ ok: false, erro: String(e?.message ?? e) }) }
    setRodando(false)
  }

  const aplicar = async () => {
    setConfirmando(false); setRodando(true); setResultado(null)
    try {
      const d = await chamar({ modo: 'aplicar', ano: anoSel ? Number(anoSel) : null, limite: lote })
      setResultado(d); await carregar()
    } catch (e) { setResultado({ ok: false, erro: String(e?.message ?? e) }) }
    setRodando(false)
  }

  const anos = useMemo(() => [...new Set(pedidos.map(p => p.ano))].sort((a, b) => b - a), [pedidos])

  const tot = useMemo(() => {
    const base = anoSel ? pedidos.filter(p => String(p.ano) === String(anoSel)) : pedidos
    return {
      total: base.length,
      aFazer: base.filter(p => !p.resultado).length,
      feitos: base.filter(p => p.resultado === 'ok').length,
      erros: base.filter(p => p.resultado === 'erro').length,
      valor: base.reduce((s, p) => s + (Number(p.vlr_nota) || 0), 0),
    }
  }, [pedidos, anoSel])

  const fila = useMemo(() => pedidos
    .filter(p => !p.resultado)
    .filter(p => !anoSel || String(p.ano) === String(anoSel))
    .slice(0, 200), [pedidos, anoSel])

  if (fase === 'carregando') return <div style={{ padding: 40, color: SUAVE, fontSize: 13 }}>Carregando…</div>
  if (fase === 'erro') {
    return <div style={{ padding: 20, fontSize: 13, color: VERM }}>Não consegui carregar.
      <div style={{ fontSize: 12, color: SUAVE, marginTop: 6, fontFamily: 'monospace' }}>{erro}</div></div>
  }

  return (
    <div style={{ background: PAPEL,
                  margin: 'calc(var(--pad-y) * -1) calc(var(--pad-x) * -1) calc(var(--pad-b) * -1)',
                  padding: 'calc(var(--pad-y) + 8px) var(--pad-x) calc(var(--pad-b) - 4px)',
                  minHeight: '100%' }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TINTA }}>Tipo de Frete — pedidos pendentes</h2>
      <p style={{ margin: '6px 0 16px', fontSize: 12.5, color: SUAVE, maxWidth: 820, lineHeight: 1.6 }}>
        Troca o tipo de frete de <b>F</b> para <b>C</b> nos pedidos de venda que estão pendentes,
        para fechar as pendências. Só entram pedidos de 2021 a 2025 com pendente marcado e frete F.
      </p>

      <div style={{ background: '#FDF3E7', border: '1px solid #F5D9B0', borderRadius: 8,
                    padding: '12px 15px', marginBottom: 18, fontSize: 12.5, color: '#7A4A12', lineHeight: 1.6 }}>
        <strong>Isto altera pedidos de anos fechados no Sankhya.</strong> Por isso trabalha em lotes:
        você escolhe o ano e quantos por vez, confirma, e cada alteração fica registrada com o valor
        anterior. Antes de gravar, o sistema relê o pedido — se já não estiver como F, ele pula.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))',
                    gap: 18, marginBottom: 20 }}>
        {[
          ['Pedidos na regra', int(tot.total)],
          ['A alterar', int(tot.aFazer), tot.aFazer ? AMBAR : VERDE],
          ['Já alterados', int(tot.feitos), VERDE],
          ['Com erro', int(tot.erros), tot.erros ? VERM : SUAVE],
          ['Valor envolvido', `R$ ${brl(tot.valor)}`],
        ].map(([r, v, c]) => (
          <div key={r}>
            <div style={{ fontSize: 11.5, color: SUAVE, marginBottom: 5 }}>{r}</div>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 21, color: c || TINTA, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={anoSel} onChange={e => setAnoSel(e.target.value)}
          style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 11px',
                   border: `1px solid ${TRACO}`, borderRadius: 6, background: '#fff', color: TINTA }}>
          <option value="">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <label style={{ fontSize: 12.5, color: SUAVE, display: 'flex', alignItems: 'center', gap: 6 }}>
          por vez
          <select value={lote} onChange={e => setLote(Number(e.target.value))}
            style={{ fontFamily: 'inherit', fontSize: 13, padding: '7px 10px',
                     border: `1px solid ${TRACO}`, borderRadius: 6, background: '#fff' }}>
            {[5, 10, 20, 40, 60].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        {!confirmando ? (
          <button onClick={() => setConfirmando(true)} disabled={rodando || tot.aFazer === 0}
            style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                     cursor: rodando || !tot.aFazer ? 'default' : 'pointer', padding: '8px 16px',
                     border: 'none', borderRadius: 6,
                     background: rodando || !tot.aFazer ? SUAVE : TINTA, color: PAPEL }}>
            {rodando ? 'Alterando…' : `Alterar ${Math.min(lote, tot.aFazer)} pedido${Math.min(lote, tot.aFazer) > 1 ? 's' : ''}`}
          </button>
        ) : (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#FDECEA',
                         padding: '7px 12px', borderRadius: 6 }}>
            <span style={{ fontSize: 12.5, color: VERM }}>
              Alterar {Math.min(lote, tot.aFazer)} pedido(s){anoSel ? ` de ${anoSel}` : ''} no Sankhya?
            </span>
            <button onClick={aplicar}
              style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                       padding: '6px 14px', border: 'none', borderRadius: 5, background: VERM, color: '#fff' }}>
              Sim, alterar
            </button>
            <button onClick={() => setConfirmando(false)}
              style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '6px 10px',
                       border: 'none', background: 'none', color: SUAVE }}>cancelar</button>
          </span>
        )}

        <button onClick={atualizarLista} disabled={rodando}
          style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: rodando ? 'default' : 'pointer',
                   padding: '8px 14px', border: `1px solid ${TRACO}`, borderRadius: 6,
                   background: '#fff', color: TINTA }}>↻ Atualizar lista</button>

        <button onClick={() => setVerHistorico(v => !v)}
          style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '8px 13px',
                   border: `1px solid ${verHistorico ? TINTA : TRACO}`, borderRadius: 6,
                   background: verHistorico ? TINTA : '#fff', color: verHistorico ? PAPEL : SUAVE,
                   marginLeft: 'auto' }}>
          Histórico{historico.length ? ` (${historico.length})` : ''}
        </button>
      </div>

      {resultado && (
        <div style={{ background: resultado.ok ? '#E9F7F1' : '#FDECEA',
                      border: `1px solid ${resultado.ok ? '#B6E3CE' : '#F5C6C0'}`, borderRadius: 8,
                      padding: '12px 15px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.6,
                      color: resultado.ok ? '#0C6349' : '#8A1C14' }}>
          {resultado.ok
            ? (resultado.modo === 'listar'
                ? `Lista atualizada: ${resultado.encontrados} pedidos na regra.`
                : resultado.nada_a_fazer
                  ? 'Nada a alterar nesse filtro.'
                  : `${resultado.sucesso} alterado(s), ${resultado.erros} com erro.`)
            : `Falhou: ${resultado.erro}`}
          {resultado.detalhe?.some(d => !d.ok) && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {resultado.detalhe.filter(d => !d.ok).slice(0, 6).map((d, i) => (
                <li key={i} style={{ fontSize: 11.5 }}>Pedido {d.pedido}: {d.erro || `ficou ${d.para}`}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {verHistorico && (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, marginBottom: 18 }}>
          <div style={{ padding: '11px 15px', borderBottom: `1px solid ${TRACO}`,
                        fontSize: 12, color: SUAVE, lineHeight: 1.55 }}>
            Tudo que foi alterado, com valor anterior, quem mandou e quando. Erros ficam registrados
            com a mensagem do Sankhya.
          </div>
          {historico.length === 0 ? (
            <div style={{ padding: '20px 15px', fontSize: 13, color: SUAVE }}>Nenhuma alteração feita ainda.</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 420 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr>
                    {['Quando', 'Quem', 'Pedido', 'Data', 'Cliente', 'De', 'Para', 'Resultado', 'Observação'].map((h, i) => (
                      <th key={h} style={{ padding: '9px 12px', fontSize: 10.5, fontWeight: 600, color: '#9A958E',
                        textAlign: 'left', borderBottom: `1px solid ${TRACO}`, position: 'sticky', top: 0,
                        background: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historico.map(h => {
                    const ok = h.resultado === 'ok'
                    return (
                      <tr key={h.nunota} style={{ borderBottom: '1px solid #F0EEEA' }}>
                        <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE, whiteSpace: 'nowrap' }}>{dh(h.alterado_em)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE }}>{String(h.alterado_por || '').split('@')[0]}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: TINTA,
                                     fontVariantNumeric: 'tabular-nums' }}>{h.num_pedido}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE }}>{dBR(h.dt_neg)}</td>
                        <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE, maxWidth: 200,
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.cliente}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: SUAVE }}>{h.cif_fob_atual}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: TINTA }}>{h.cif_fob_alvo}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                                         color: ok ? VERDE : VERM, background: ok ? '#E9F7F1' : '#FDECEA' }}>
                            {ok ? 'alterado' : 'erro'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: SUAVE, maxWidth: 260, lineHeight: 1.4 }}>
                          {h.mensagem || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: '10px 15px', borderTop: `1px solid ${TRACO}`, display: 'flex',
                        justifyContent: 'flex-end' }}>
            <button onClick={() => {
              const cab = ['Alterado em','Por','Pedido','Nº único','Data','Ano','Cliente','Operação','Valor','De','Para','Resultado','Observação']
              const linhas = historico.map(h => [dh(h.alterado_em), h.alterado_por, h.num_pedido, h.nunota,
                dBR(h.dt_neg), h.ano, h.cliente, h.top_nome, h.vlr_nota, h.cif_fob_atual, h.cif_fob_alvo,
                h.resultado, h.mensagem || ''])
              const csv = [cab, ...linhas].map(l => l.map(c => `"${String(c ?? '').replace(/"/g,'""')}"`).join(';')).join('\n')
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
              a.download = `tipo_frete_alteracoes_${new Date().toISOString().slice(0,10)}.csv`
              a.click()
            }} style={{ fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '6px 13px',
                        border: `1px solid ${TRACO}`, borderRadius: 5, background: '#fff', color: TINTA }}>
              Baixar relatório (CSV)
            </button>
          </div>
        </div>
      )}

      {porOperacao.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, marginBottom: 18 }}>
          <div style={{ padding: '11px 15px', borderBottom: `1px solid ${TRACO}`, fontSize: 11,
                        color: SUAVE, fontWeight: 600 }}>POR TIPO DE OPERAÇÃO</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FBFAF8' }}>
                {['TOP', 'Operação', 'Pedidos', 'A fazer', 'Alterados', 'Erro', 'Valor'].map((h, i) => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: 10.5, fontWeight: 600, color: '#9A958E',
                    textAlign: i >= 2 ? 'right' : 'left', borderBottom: `1px solid ${TRACO}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porOperacao.map(o => (
                <tr key={o.cod_tipoper} style={{ borderBottom: '1px solid #F0EEEA' }}>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: SUAVE }}>{o.cod_tipoper}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12.5, color: TINTA }}>{o.operacao}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{int(o.pedidos)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', color: AMBAR, fontVariantNumeric: 'tabular-nums' }}>{int(o.a_fazer)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', color: VERDE, fontVariantNumeric: 'tabular-nums' }}>{int(o.alterados)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', color: o.com_erro ? VERM : SUAVE, fontVariantNumeric: 'tabular-nums' }}>{int(o.com_erro)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>R$ {brl(o.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${TRACO}` }}>
        <div style={{ padding: '11px 15px', borderBottom: `1px solid ${TRACO}`, fontSize: 11,
                      color: SUAVE, fontWeight: 600 }}>
          FILA — {int(fila.length)} PEDIDO(S) AGUARDANDO{anoSel ? ` · ${anoSel}` : ''}
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 520 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
            <thead>
              <tr>
                {['Pedido', 'Data', 'Cliente', 'Operação', 'Valor', 'De', 'Para'].map((h, i) => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: 10.5, fontWeight: 600, color: '#9A958E',
                    textAlign: i === 4 ? 'right' : 'left', borderBottom: `1px solid ${TRACO}`,
                    position: 'sticky', top: 0, background: '#fff', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fila.map(p => (
                <tr key={p.nunota} style={{ borderBottom: '1px solid #F0EEEA' }}>
                  <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: TINTA,
                               fontVariantNumeric: 'tabular-nums' }}>
                    {p.num_pedido}
                    <div style={{ fontSize: 10, color: '#9A958E', fontWeight: 400 }}>nº único {p.nunota}</div>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE }}>{dBR(p.dt_neg)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: SUAVE, maxWidth: 220,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11.5, color: SUAVE, maxWidth: 200,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.top_nome}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, textAlign: 'right', color: TINTA,
                               fontVariantNumeric: 'tabular-nums' }}>R$ {brl(p.vlr_nota)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: AMBAR, fontWeight: 600 }}>{p.cif_fob_atual}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: VERDE, fontWeight: 600 }}>{p.cif_fob_alvo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {fila.length === 0 && (
          <div style={{ padding: '24px 15px', fontSize: 13, color: VERDE, textAlign: 'center' }}>
            Nada na fila{anoSel ? ` em ${anoSel}` : ''} — tudo alterado.
          </div>
        )}
      </div>
    </div>
  )
}
