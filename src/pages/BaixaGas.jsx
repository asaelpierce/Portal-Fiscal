import React, { useEffect, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl, int } from '../config.js'
import { Panel, Btn, Spinner } from '../components/UI.jsx'

const SYNC_KEY = 'kb2026sync!'

async function chamar(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/baixa-gas-executar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ ...payload, _key: SYNC_KEY }),
  })
  return res.json()
}

function dataHoraBR(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function BaixaGas() {
  const [previa, setPrevia] = useState(null)
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [executando, setExecutando] = useState(false)
  const [resultadoExecucao, setResultadoExecucao] = useState(null)
  const [confirmando, setConfirmando] = useState(false)
  const [historico, setHistorico] = useState([])

  const carregarPrevia = async () => {
    setFase('carregando'); setErro(''); setResultadoExecucao(null)
    try {
      const d = await chamar({ confirmar: false })
      if (!d.ok) throw new Error(d.erro)
      setPrevia(d)
      setFase('pronto')
    } catch (e) {
      setErro(e.message); setFase('erro')
    }
  }

  const carregarHistorico = () => {
    sbFetch('baixa_gas_historico?select=*&order=executado_em.desc&limit=15')
      .then(r => setHistorico(r || []))
      .catch(() => {})
  }

  useEffect(() => { carregarPrevia(); carregarHistorico() }, [])

  const executar = async () => {
    setExecutando(true); setConfirmando(false)
    try {
      const d = await chamar({ confirmar: true, executado_por: 'portal-manual' })
      setResultadoExecucao(d)
      if (d.ok) { await carregarPrevia(); carregarHistorico() }
    } catch (e) {
      setResultadoExecucao({ ok:false, erro: e.message })
    } finally {
      setExecutando(false)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'14px 18px', fontSize:12.5, color:'#92400E', lineHeight:1.6 }}>
        <strong>⚠ Isso grava uma nota de verdade no Sankhya.</strong> O processo nativo de baixa automática de gás
        (Caldeiraria - Maçarico) não está funcionando, então essa tela consulta o saldo atual dos produtos do grupo
        "Gases Industriais" no local 1003 e, quando você confirmar, lança uma Movimentação Interna zerando esse saldo —
        exatamente o mesmo processo que seria feito manualmente pela tela de Central de Notas.
      </div>

      <Panel title="Prévia — o que seria baixado agora" action={<Btn small onClick={carregarPrevia}>↻ Atualizar</Btn>}>
        {fase === 'carregando' && <Spinner/>}
        {fase === 'erro' && <div style={{ color:'#B42318', fontSize:13 }}>Erro: {erro}</div>}
        {fase === 'pronto' && previa && (
          <>
            {previa.itens.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', color:'#12805C', fontSize:13, fontWeight:600 }}>
                ✓ Nenhum item com saldo pendente no momento — nada a baixar.
              </div>
            ) : (
              <>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, marginBottom:14 }}>
                  <thead>
                    <tr>
                      {['Produto','Qtd. no estoque','Custo unit.','Valor total'].map((h,i) => (
                        <th key={h} style={{
                          padding:'8px 12px', background:'#F9FAFB', textAlign:i>=1?'right':'left',
                          fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase',
                          letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previa.itens.map(it => (
                      <tr key={it.codprod} style={{ borderTop:'1px solid #F9FAFB' }}>
                        <td style={{ padding:'8px 12px' }}>
                          <div style={{ fontWeight:600 }}>{it.descricao}</div>
                          <div style={{ fontSize:11, color:'#9CA3AF' }}>Cód. {it.codprod}</div>
                        </td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{it.qtd} {it.codvol}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(it.custo)}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums' }}>R$ {brl(it.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:'2px solid #E5E7EB' }}>
                      <td colSpan={3} style={{ padding:'8px 12px', fontWeight:700 }}>Total</td>
                      <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700 }}>R$ {brl(previa.valor_total)}</td>
                    </tr>
                  </tfoot>
                </table>

                {!confirmando ? (
                  <Btn primary onClick={() => setConfirmando(true)} disabled={executando}>
                    Lançar essa baixa no Sankhya
                  </Btn>
                ) : (
                  <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:14 }}>
                    <p style={{ margin:'0 0 10px', fontSize:13, color:'#B42318', fontWeight:600 }}>
                      Confirma o lançamento de {previa.qtd_itens} item(ns), R$ {brl(previa.valor_total)}? Isso cria
                      uma nota real no Sankhya e não pode ser desfeito por aqui.
                    </p>
                    <div style={{ display:'flex', gap:8 }}>
                      <Btn primary onClick={executar} disabled={executando}>
                        {executando ? '↻ Lançando…' : '✓ Sim, confirmar e lançar'}
                      </Btn>
                      <Btn onClick={() => setConfirmando(false)} disabled={executando}>Cancelar</Btn>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Panel>

      {resultadoExecucao && (
        <div style={{
          background: resultadoExecucao.ok ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${resultadoExecucao.ok ? '#BBF7D0' : '#FECACA'}`,
          borderRadius:8, padding:14, fontSize:13,
        }}>
          {resultadoExecucao.ok
            ? <>✅ Baixa lançada com sucesso! Nota <strong>{resultadoExecucao.nunota}</strong> criada no Sankhya, R$ {brl(resultadoExecucao.valor_total)}.</>
            : <>❌ Erro ao lançar: {resultadoExecucao.erro}</>}
        </div>
      )}

      {historico.length > 0 && (
        <Panel title="Histórico de baixas lançadas">
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr>
                {['Data/Hora','Nota gerada','Itens','Valor','Status'].map(h => (
                  <th key={h} style={{
                    padding:'8px 12px', background:'#F9FAFB', textAlign:'left',
                    fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase',
                    letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map(h => (
                <tr key={h.id} style={{ borderTop:'1px solid #F9FAFB' }}>
                  <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>{dataHoraBR(h.executado_em)}</td>
                  <td style={{ padding:'8px 12px' }}>{h.nunota_gerado || '—'}</td>
                  <td style={{ padding:'8px 12px' }}>{h.itens?.length ?? 0}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{h.valor_total ? `R$ ${brl(h.valor_total)}` : '—'}</td>
                  <td style={{ padding:'8px 12px' }}>
                    <span style={{
                      padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:600,
                      color: h.status==='ok' ? '#12805C' : '#B42318',
                      background: h.status==='ok' ? '#D1FAE5' : '#FEE2E2',
                    }}>{h.status==='ok' ? 'Sucesso' : 'Erro'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}
