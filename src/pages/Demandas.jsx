import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch } from '../config.js'
import { Spinner, EmptyState, Btn } from '../components/UI.jsx'

const PAPEL = '#FBFAF8'
const TINTA = '#1A1A18'
const TRACO = '#E4E1DC'
const SUAVE = '#6E6A64'

const FLUXO = ['Nova', 'Em análise', 'Aprovada', 'Em execução', 'Entregue', 'Recusada']
const COR = {
  'Nova':        { cor: '#1F60A8', fundo: '#EAF1FA' },
  'Em análise':  { cor: '#A2600F', fundo: '#FDF3E7' },
  'Aprovada':    { cor: '#6D28D9', fundo: '#F1EBFD' },
  'Em execução': { cor: '#0E7490', fundo: '#E7F5F8' },
  'Entregue':    { cor: '#12805C', fundo: '#E9F7F1' },
  'Recusada':    { cor: '#B42318', fundo: '#FDECEA' },
}

const nf = (v, d = 1) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const ni = (v) => Number(v ?? 0).toLocaleString('pt-BR')
const num = { fontVariantNumeric: 'tabular-nums' }
const dtBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—')

export default function Demandas() {
  const [lista, setLista] = useState([])
  const [resumo, setResumo] = useState(null)
  const [token, setToken] = useState('')
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [aberta, setAberta] = useState(null)
  const [filtro, setFiltro] = useState('abertas')
  const [copiado, setCopiado] = useState(false)
  const [salvando, setSalvando] = useState(null)

  const carregar = async () => {
    setErro('')
    try {
      const [d, r, c] = await Promise.all([
        sbFetch('demanda_lista?select=*'),
        sbFetch('demanda_resumo?select=*'),
        sbFetch('automacao_config?select=valor&chave=eq.demanda_token'),
      ])
      setLista(d || []); setResumo(r?.[0] || null); setToken(c?.[0]?.valor || '')
      setFase('pronto')
    } catch (e) { setErro(e.message); setFase('erro') }
  }
  useEffect(() => { carregar() }, [])

  const link = token ? `${window.location.origin}/?solicitar=${token}` : ''

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true); setTimeout(() => setCopiado(false), 2200)
    } catch { setErro('Não consegui copiar. Selecione o link e copie na mão.') }
  }

  const mudarStatus = async (d, status) => {
    setSalvando(d.id)
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/demanda?id=eq.${d.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status, atualizado_em: new Date().toISOString() }),
      })
      await carregar()
    } catch (e) { setErro(e.message) } finally { setSalvando(null) }
  }

  const visiveis = useMemo(() => {
    if (filtro === 'todas') return lista
    if (filtro === 'abertas') return lista.filter((d) => !['Entregue', 'Recusada'].includes(d.status))
    return lista.filter((d) => d.status === filtro)
  }, [lista, filtro])

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return <EmptyState title="Não foi possível carregar" text={erro}>
      <Btn primary onClick={carregar}>Tentar de novo</Btn>
    </EmptyState>
  }

  return (
    <div style={{ background: PAPEL, margin: '-22px -26px -60px', padding: '30px 26px 56px', minHeight: '100%' }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TINTA }}>Demandas</h2>
      <p style={{ margin: '6px 0 20px', fontSize: 12.5, color: SUAVE, maxWidth: 680, lineHeight: 1.55 }}>
        Pedidos que chegam pelo link. Quem solicita já informa quanto tempo gasta hoje — esse número
        vira o <em>antes</em> quando a automação for medida, fechando o ciclo pedido → entrega → medição.
      </p>

      <div style={{
        background: '#fff', border: `1px solid ${TRACO}`, padding: '14px 18px', marginBottom: 22,
        display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 380px', minWidth: 280 }}>
          <div style={{ fontSize: 11, color: SUAVE, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
            Link para enviar às áreas
          </div>
          <code style={{
            fontSize: 12, color: TINTA, background: '#F4F2EE', padding: '6px 9px',
            display: 'block', overflowX: 'auto', whiteSpace: 'nowrap', borderRadius: 2,
          }}>{link || 'token não configurado'}</code>
        </div>
        <button onClick={copiar} disabled={!link} style={{
          fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '7px 14px',
          border: 'none', background: copiado ? '#12805C' : TINTA, color: '#fff', borderRadius: 3,
        }}>{copiado ? '✓ Copiado' : 'Copiar link'}</button>
      </div>

      {resumo && (
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            ['Novas', ni(resumo.novas)],
            ['Em análise', ni(resumo.em_analise)],
            ['Em execução', ni(resumo.em_execucao)],
            ['Entregues', ni(resumo.entregues)],
            ['Prometido na fila', `${nf(resumo.horas_mes_na_fila)} h/mês`],
          ].map(([r, v]) => (
            <div key={r}>
              <div style={{ fontSize: 11.5, color: SUAVE, marginBottom: 5 }}>{r}</div>
              <div style={{ ...num, fontSize: 22, color: TINTA, lineHeight: 1 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['abertas', 'todas', ...FLUXO].map((k) => (
          <button key={k} onClick={() => setFiltro(k)} style={{
            fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '5px 11px',
            border: `1px solid ${filtro === k ? TINTA : TRACO}`,
            background: filtro === k ? TINTA : 'transparent',
            color: filtro === k ? PAPEL : SUAVE, borderRadius: 2,
          }}>{k === 'abertas' ? 'Em aberto' : k === 'todas' ? 'Todas' : k}</button>
        ))}
      </div>

      {!visiveis.length ? (
        <div style={{
          background: '#fff', border: `1px solid ${TRACO}`, padding: '28px 20px',
          textAlign: 'center', fontSize: 13, color: SUAVE,
        }}>
          Nenhuma demanda {filtro === 'abertas' ? 'em aberto' : 'com esse filtro'}.
          {!lista.length && ' Envie o link acima para as áreas começarem a solicitar.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visiveis.map((d) => {
            const c = COR[d.status] || COR['Nova']
            const open = aberta === d.id
            return (
              <div key={d.id} style={{ background: '#fff', border: `1px solid ${TRACO}` }}>
                <button onClick={() => setAberta(open ? null : d.id)} aria-expanded={open}
                  style={{
                    width: '100%', display: 'grid', gridTemplateColumns: '16px 1fr 130px 120px 110px',
                    gap: 14, alignItems: 'center', padding: '12px 16px', background: 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <span style={{
                    fontSize: 10, color: SUAVE, lineHeight: 1,
                    transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease',
                  }}>▶</span>
                  <span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: TINTA }}>{d.titulo}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: SUAVE, marginTop: 3 }}>
                      <span style={{ ...num }}>{d.protocolo}</span> · {d.solicitante}
                      {d.area ? ` · ${d.area}` : d.setor_texto ? ` · ${d.setor_texto}` : ''}
                    </span>
                  </span>
                  <span style={{ ...num, fontSize: 12.5, color: TINTA }}>
                    {d.horas_mes_estimadas > 0 ? `${nf(d.horas_mes_estimadas)} h/mês` : '—'}
                    <span style={{ display: 'block', fontSize: 10.5, color: SUAVE }}>estimado</span>
                  </span>
                  <span style={{ fontSize: 11.5, color: SUAVE }}>{dtBR(d.criado_em)}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: c.cor, background: c.fundo,
                    padding: '3px 8px', borderRadius: 2, textAlign: 'center',
                  }}>{d.status}</span>
                </button>

                {open && (
                  <div style={{ borderTop: `1px solid ${TRACO}`, padding: '14px 16px' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20,
                    }}>
                      {[['Objetivo', d.objetivo], ['Como é feito hoje', d.processo_atual],
                        ['O que muda na área', d.o_que_muda]].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 11, color: SUAVE, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{k}</div>
                          <div style={{ fontSize: 12.5, color: '#4A4741', lineHeight: 1.6 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {(d.min_por_ocorrencia || d.ocorrencias_mes) && (
                      <div style={{ ...num, fontSize: 12.5, color: TINTA, marginTop: 14 }}>
                        Declarado no pedido: <strong>{nf(d.min_por_ocorrencia, 0)} min</strong> por vez,{' '}
                        <strong>{nf(d.ocorrencias_mes, 0)}</strong> vezes por mês
                        {d.pessoas_envolvidas ? `, ${ni(d.pessoas_envolvidas)} pessoa(s)` : ''}
                      </div>
                    )}
                    {d.nome_projeto && (
                      <div style={{ fontSize: 12, color: SUAVE, marginTop: 8 }}>
                        Vinculada a <strong style={{ color: TINTA }}>{d.nome_projeto}</strong>
                        {d.modulo_nome ? ` · módulo ${d.modulo_nome}` : ''}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 16 }}>
                      {FLUXO.map((k) => {
                        const ativo = d.status === k
                        const cc = COR[k]
                        return (
                          <button key={k} disabled={salvando === d.id || ativo}
                            onClick={() => mudarStatus(d, k)}
                            style={{
                              fontFamily: 'inherit', fontSize: 11, cursor: ativo ? 'default' : 'pointer',
                              padding: '4px 9px', borderRadius: 2,
                              border: `1px solid ${ativo ? cc.cor : TRACO}`,
                              background: ativo ? cc.fundo : '#fff',
                              color: ativo ? cc.cor : SUAVE, fontWeight: ativo ? 700 : 400,
                              opacity: salvando === d.id ? .5 : 1,
                            }}>{k}</button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
