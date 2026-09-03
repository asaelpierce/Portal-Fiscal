import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl, int, dBR } from '../config.js'
import { Panel, Btn, Spinner, SearchInput } from '../components/UI.jsx'

const SYNC_KEY = 'kb2026sync!'
async function chamar(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/requisicao-almox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ ...payload, _key: SYNC_KEY }),
  })
  return res.json()
}
const dtBR = iso => iso ? new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'

export default function RequisicaoAlmox({ sessao }) {
  const [dados, setDados] = useState(null)
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [sel, setSel] = useState(new Set())
  const [busca, setBusca] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [executando, setExecutando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [historico, setHistorico] = useState([])

  const carregar = async () => {
    setFase('carregando'); setErro(''); setResultado(null); setSel(new Set())
    try {
      const d = await chamar({ confirmar: false })
      if (!d.ok) throw new Error(d.erro)
      setDados(d); setFase('pronto')
    } catch (e) { setErro(e.message); setFase('erro') }
  }
  const carregarHist = () => sbFetch('requisicao_almox_historico?select=*&order=executado_em.desc&limit=20')
    .then(r => setHistorico(r||[])).catch(()=>{})
  useEffect(() => { carregar(); carregarHist() }, [])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (dados?.pedidos || []).filter(p => !q ||
      `${p.numnota} ${p.nunota} ${p.solicitante||''} ${p.centro_resultado||''}`.toLowerCase().includes(q))
  }, [dados, busca])

  const elegiveis = lista.filter(p => p.elegivel)
  const alternar = n => setSel(s => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x })
  const todos = () => setSel(sel.size === elegiveis.length ? new Set() : new Set(elegiveis.map(p=>p.nunota)))

  const executar = async () => {
    setExecutando(true); setConfirmando(false)
    try {
      const d = await chamar({ confirmar: true, nunotas: [...sel], executado_por: sessao?.email || 'manual' })
      setResultado(d)
      if (d.ok) { await carregar(); carregarHist() }
    } catch (e) { setResultado({ ok:false, erro: e.message }) }
    finally { setExecutando(false) }
  }

  const selecionados = (dados?.pedidos || []).filter(p => sel.has(p.nunota))
  const vlrSel = selecionados.reduce((s,p) => s + Number(p.valor||0), 0)
  const cel = { padding:'8px 12px', whiteSpace:'nowrap' }
  const th = a => ({ padding:'8px 12px', background:'#F9FAFB', textAlign:a||'left', fontSize:10.5,
    fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em',
    borderBottom:'1px solid #E5E7EB', position:'sticky', top:0 })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'14px 18px', fontSize:12.5, color:'#92400E', lineHeight:1.6 }}>
        <strong>⚠ Isso confirma requisições de verdade no Sankhya</strong> e baixa o estoque. O portal converte o
        Pedido de Requisição (TOP 1000) em Requisição de Almoxarifado (TOP 1100) e confirma — o mesmo que fazer
        pela Central. Só ficam elegíveis as requisições com <strong>todos os itens no local {dados?.local_exigido || '1003'}</strong>.
      </div>

      <Panel
        title={`Requisições pendentes${dados?.data_corte ? ` — a partir de ${dados.data_corte}` : ''}`}
        action={<Btn small onClick={carregar} disabled={executando}>↻ Atualizar</Btn>}
      >
        {fase === 'carregando' && <Spinner/>}
        {fase === 'erro' && <div style={{ color:'#B42318', fontSize:13 }}>Erro: {erro}</div>}
        {fase === 'pronto' && dados && (
          <>
            <div style={{ display:'flex', gap:12, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
              <SearchInput value={busca} onChange={setBusca} placeholder="Nº, solicitante, centro…" />
              <span style={{ fontSize:12.5, color:'#6B7280' }}>
                {int(dados.total)} pendente(s) · <strong style={{ color:'#12805C' }}>{int(dados.elegiveis)} elegível(is)</strong>
              </span>
              {elegiveis.length > 0 && (
                <Btn small onClick={todos}>{sel.size === elegiveis.length ? 'Desmarcar todas' : 'Marcar todas elegíveis'}</Btn>
              )}
            </div>

            {!dados.pedidos.length ? (
              <div style={{ padding:24, textAlign:'center', color:'#12805C', fontWeight:600, fontSize:13 }}>
                ✓ Nenhuma requisição pendente no período.
              </div>
            ) : (
              <div style={{ maxHeight:460, overflow:'auto', border:'1px solid #F3F4F6', borderRadius:8 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead><tr>
                    <th style={{ ...th(), width:34 }} />
                    <th style={th()}>Requisição</th><th style={th()}>Data</th>
                    <th style={th()}>Solicitante</th><th style={th()}>Centro de resultado</th>
                    <th style={th('right')}>Itens</th><th style={th('right')}>Valor</th><th style={th()}>Situação</th>
                  </tr></thead>
                  <tbody>
                    {lista.map(p => (
                      <tr key={p.nunota} style={{ borderTop:'1px solid #F9FAFB', background: p.elegivel ? (sel.has(p.nunota) ? '#F0F9FF' : 'transparent') : '#FFFBEB' }}>
                        <td style={cel}>
                          <input type="checkbox" disabled={!p.elegivel || executando}
                            checked={sel.has(p.nunota)} onChange={() => alternar(p.nunota)} />
                        </td>
                        <td style={{ ...cel, fontWeight:600 }}>{p.numnota}</td>
                        <td style={{ ...cel, color:'#6B7280' }}>{dBR(p.data)}</td>
                        <td style={cel}>{p.solicitante}</td>
                        <td style={{ ...cel, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis' }} title={p.centro_resultado}>{p.centro_resultado}</td>
                        <td style={{ ...cel, textAlign:'right' }}>{p.qtd_itens}</td>
                        <td style={{ ...cel, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(p.valor)}</td>
                        <td style={cel}>
                          {p.elegivel
                            ? <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5, background:'#D1FAE5', color:'#12805C' }}>pronta</span>
                            : <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5, background:'#FEF3C7', color:'#B54708' }} title={p.motivo_bloqueio}>{p.motivo_bloqueio}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sel.size > 0 && (
              <div style={{ marginTop:14 }}>
                {!confirmando ? (
                  <Btn primary onClick={() => setConfirmando(true)} disabled={executando}>
                    Confirmar {sel.size} requisição(ões) — R$ {brl(vlrSel)}
                  </Btn>
                ) : (
                  <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:14 }}>
                    <p style={{ margin:'0 0 10px', fontSize:13, color:'#B42318', fontWeight:600 }}>
                      Confirmar {sel.size} requisição(ões), R$ {brl(vlrSel)}? Isso baixa o estoque no Sankhya.
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn primary onClick={executar} disabled={executando}>{executando ? '↻ Confirmando…' : '✓ Sim, confirmar'}</Btn>
                      <Btn onClick={() => setConfirmando(false)} disabled={executando}>Cancelar</Btn>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Panel>

      {resultado && (
        <Panel title="Resultado">
          {!resultado.ok ? <div style={{ color:'#B42318', fontSize:13 }}>❌ {resultado.erro}</div> : (
            <>
              <div style={{ fontSize:13, marginBottom:10 }}>
                {int(resultado.sucesso)} de {int(resultado.processados)} confirmada(s) com sucesso.
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                <thead><tr><th style={th()}>Pedido</th><th style={th()}>Requisição gerada</th><th style={th()}>Resultado</th></tr></thead>
                <tbody>
                  {(resultado.resultados||[]).map((r,i) => (
                    <tr key={i} style={{ borderTop:'1px solid #F9FAFB' }}>
                      <td style={cel}>{r.numnota_pedido}</td>
                      <td style={cel}>{r.numnota_gerada || '—'}</td>
                      <td style={{ ...cel, color: r.confirmada ? '#12805C' : '#B42318' }}>
                        {r.confirmada ? '✓ confirmada' : (r.erro || r.mensagem || 'falhou')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Panel>
      )}

      {historico.length > 0 && (
        <Panel title="Histórico">
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr>
              <th style={th()}>Data/Hora</th><th style={th()}>Pedido</th><th style={th()}>Gerada</th>
              <th style={th('right')}>Valor</th><th style={th()}>Status</th><th style={th()}>Por</th>
            </tr></thead>
            <tbody>
              {historico.map(h => (
                <tr key={h.id} style={{ borderTop:'1px solid #F9FAFB' }}>
                  <td style={{ ...cel, color:'#6B7280' }}>{dtBR(h.executado_em)}</td>
                  <td style={cel}>{h.numnota_pedido}</td>
                  <td style={cel}>{h.numnota_gerada || '—'}</td>
                  <td style={{ ...cel, textAlign:'right' }}>{h.valor ? `R$ ${brl(h.valor)}` : '—'}</td>
                  <td style={cel}>
                    <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5,
                      background: h.status==='ok' ? '#D1FAE5' : '#FEE2E2', color: h.status==='ok' ? '#12805C' : '#B42318' }}>
                      {h.status==='ok' ? 'Confirmada' : 'Erro'}
                    </span>
                  </td>
                  <td style={{ ...cel, color:'#9CA3AF', fontSize:11.5 }}>{h.executado_por}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}
