import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch } from '../config.js'
import { Spinner, EmptyState, Btn } from '../components/UI.jsx'

const PAPEL = '#FBFAF8'
const TINTA = '#1A1A18'
const TRACO = '#E4E1DC'
const SUAVE = '#6E6A64'

/* Status de tela. Ordem importa: é a progressão do trabalho. */
const STATUS = {
  'A fazer':            { cor: '#9A958E', fundo: '#F1EFEB' },
  'Em desenvolvimento': { cor: '#1F60A8', fundo: '#EAF1FA' },
  'Em teste':           { cor: '#A2600F', fundo: '#FDF3E7' },
  'Em produção':        { cor: '#12805C', fundo: '#E9F7F1' },
  'Pausado':            { cor: '#B42318', fundo: '#FDECEA' },
}
const ORDEM = Object.keys(STATUS)

const ni = (v) => Number(v ?? 0).toLocaleString('pt-BR')
const num = { fontVariantNumeric: 'tabular-nums' }
const dBR = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR') : null)

export default function Modulos() {
  const [modulos, setModulos] = useState([])
  const [telas, setTelas] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null)
  const [projeto, setProjeto] = useState('todos')
  const [salvando, setSalvando] = useState(null)

  const carregar = async () => {
    setErro('')
    try {
      const [m, t] = await Promise.all([
        sbFetch('portal_modulo_resumo?select=*'),
        sbFetch('portal_tela_lista?select=*'),
      ])
      setModulos(m || []); setTelas(t || []); setFase('pronto')
    } catch (e) { setErro(e.message); setFase('erro') }
  }
  useEffect(() => { carregar() }, [])

  const trocarStatus = async (tela, status) => {
    setSalvando(tela.id)
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/portal_tela?id=eq.${tela.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          status,
          // entrar em produção carimba a data da entrega; sair dela limpa
          entregue_em: status === 'Em produção'
            ? (tela.entregue_em || new Date().toISOString().slice(0, 10))
            : null,
          atualizado_em: new Date().toISOString(),
        }),
      })
      await carregar()
    } catch (e) { setErro(e.message) } finally { setSalvando(null) }
  }

  const projetos = useMemo(
    () => ['todos', ...Array.from(new Set(modulos.map((m) => m.nome_projeto)))],
    [modulos],
  )
  const lista = useMemo(
    () => (projeto === 'todos' ? modulos : modulos.filter((m) => m.nome_projeto === projeto)),
    [modulos, projeto],
  )
  const total = useMemo(() => ({
    telas: lista.reduce((s, m) => s + Number(m.telas || 0), 0),
    prontas: lista.reduce((s, m) => s + Number(m.em_producao || 0), 0),
  }), [lista])

  const recentes = useMemo(
    () => telas.filter((t) => t.entregue_em)
      .sort((a, b) => b.entregue_em.localeCompare(a.entregue_em)).slice(0, 6),
    [telas],
  )

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return <EmptyState title="Não foi possível carregar" text={erro}>
      <Btn primary onClick={carregar}>Tentar de novo</Btn>
    </EmptyState>
  }
  if (!modulos.length) {
    return <EmptyState title="Nenhum módulo cadastrado"
      text="Os portais ainda não foram quebrados em módulos." />
  }

  return (
    <div style={{ background: PAPEL, margin: '-22px -26px -60px', padding: '30px 26px 56px', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 26, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TINTA }}>Módulos e telas</h2>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: SUAVE, maxWidth: 620, lineHeight: 1.55 }}>
            Portal inteiro não cabe numa reunião semanal. Aqui cada módulo é uma conversa e cada
            tela é uma entrega. Clique num módulo para ver as telas e trocar o status.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <div>
          <div style={{ fontSize: 11.5, color: SUAVE, marginBottom: 5 }}>Telas em produção</div>
          <div style={{ ...num, fontSize: 26, color: TINTA, lineHeight: 1 }}>
            {ni(total.prontas)}<span style={{ color: SUAVE, fontSize: 16 }}> / {ni(total.telas)}</span>
          </div>
        </div>
        <select value={projeto} onChange={(e) => setProjeto(e.target.value)}
          style={{
            fontFamily: 'inherit', fontSize: 12.5, padding: '6px 10px',
            border: `1px solid ${TRACO}`, borderRadius: 3, background: '#fff', color: TINTA,
          }}>
          {projetos.map((p) => <option key={p} value={p}>{p === 'todos' ? 'Todos os portais' : p}</option>)}
        </select>
      </div>

      {recentes.length > 0 && (
        <div style={{
          background: '#fff', border: `1px solid ${TRACO}`, padding: '12px 16px', marginBottom: 22,
        }}>
          <div style={{ fontSize: 11, color: SUAVE, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Últimas entregas
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {recentes.map((t) => (
              <span key={t.id} style={{ fontSize: 12.5, color: TINTA }}>
                {t.nome}
                <span style={{ color: SUAVE, marginLeft: 6 }}>{dBR(t.entregue_em)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map((m) => {
          const abertoAqui = aberto === m.modulo_id
          const minhas = telas.filter((t) => t.modulo_codigo === m.codigo && t.nome_projeto === m.nome_projeto)
          const pct = Number(m.pct_pronto) || 0
          return (
            <div key={m.modulo_id} style={{ background: '#fff', border: `1px solid ${TRACO}` }}>
              <button onClick={() => setAberto(abertoAqui ? null : m.modulo_id)}
                aria-expanded={abertoAqui}
                style={{
                  width: '100%', display: 'grid', gridTemplateColumns: '16px 1fr 180px 130px',
                  gap: 16, alignItems: 'center', padding: '14px 18px', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <span style={{
                  fontSize: 10, color: SUAVE, lineHeight: 1,
                  transform: abertoAqui ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease',
                }}>▶</span>
                <span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: TINTA }}>
                    <span style={{ ...num, color: SUAVE, marginRight: 8 }}>{m.codigo}</span>
                    {m.nome}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: SUAVE, marginTop: 3 }}>
                    {m.nome_projeto}
                  </span>
                </span>
                <span>
                  <span style={{ display: 'block', height: 7, background: '#F1EFEB' }}>
                    <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: '#12805C' }} />
                  </span>
                  <span style={{ ...num, fontSize: 11, color: SUAVE, marginTop: 4, display: 'block' }}>
                    {pct}% em produção
                  </span>
                </span>
                <span style={{ ...num, fontSize: 13, color: TINTA, textAlign: 'right' }}>
                  {ni(m.em_producao)} / {ni(m.telas)} telas
                </span>
              </button>

              {abertoAqui && (
                <div style={{ borderTop: `1px solid ${TRACO}`, padding: '4px 18px 14px' }}>
                  {m.descricao && (
                    <p style={{ fontSize: 12.5, color: '#4A4741', lineHeight: 1.6, margin: '12px 0 14px', maxWidth: 820 }}>
                      {m.descricao}
                    </p>
                  )}
                  {minhas.map((t) => {
                    const st = STATUS[t.status] || STATUS['A fazer']
                    return (
                      <div key={t.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16,
                        alignItems: 'start', padding: '10px 0', borderTop: `1px solid ${TRACO}`,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, color: TINTA, fontWeight: t.destaque ? 600 : 400 }}>
                            <span style={{ ...num, color: SUAVE, marginRight: 8 }}>{t.codigo}</span>
                            {t.nome}
                            {t.destaque && (
                              <span title="Tela âncora do módulo" style={{
                                fontSize: 9.5, fontWeight: 700, color: '#A2600F', background: '#FDF3E7',
                                padding: '2px 6px', borderRadius: 2, marginLeft: 8, letterSpacing: '.04em',
                              }}>DESTAQUE</span>
                            )}
                          </div>
                          {t.descricao && (
                            <div style={{ fontSize: 11.5, color: SUAVE, marginTop: 4, lineHeight: 1.55, maxWidth: 720 }}>
                              {t.descricao}
                            </div>
                          )}
                          {t.entregue_em && (
                            <div style={{ fontSize: 11, color: '#12805C', marginTop: 4 }}>
                              entregue em {dBR(t.entregue_em)}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {ORDEM.map((k) => {
                            const ativo = t.status === k
                            const c = STATUS[k]
                            return (
                              <button key={k} disabled={salvando === t.id}
                                onClick={() => !ativo && trocarStatus(t, k)}
                                title={k}
                                style={{
                                  fontFamily: 'inherit', fontSize: 10.5,
                                  cursor: ativo ? 'default' : 'pointer',
                                  padding: '4px 8px', borderRadius: 2,
                                  border: `1px solid ${ativo ? c.cor : TRACO}`,
                                  background: ativo ? c.fundo : '#fff',
                                  color: ativo ? c.cor : SUAVE,
                                  fontWeight: ativo ? 700 : 400,
                                  opacity: salvando === t.id ? .5 : 1,
                                }}>
                                {k}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
