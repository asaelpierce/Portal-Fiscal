import React, { useEffect, useState, useCallback } from 'react'
import { sbFetch, brl, int, dBR, isZero } from './config.js'
import { Spinner, EmptyState, Btn } from './components/UI.jsx'
import DrawerDetalhe from './components/DrawerDetalhe.jsx'
import Login from './components/Login.jsx'
import VIsaoGeral from './pages/VIsaoGeral.jsx'
import Fechamento from './pages/Fechamento.jsx'
import Razao from './pages/Razao.jsx'
import { Contas, Historico } from './pages/ContasHistorico.jsx'
import Sincronizacao from './pages/Sincronizacao.jsx'
import Dashboard from './pages/Dashboard.jsx'
import FluxoCaixa from './pages/FluxoCaixa.jsx'
import ConferenciaFaturamento from './pages/ConferenciaFaturamento.jsx'
import ConferenciaFiscal from './pages/ConferenciaFiscal.jsx'
import Divergencias from './pages/Divergencias.jsx'
import RateioCompras from './pages/RateioCompras.jsx'

const MENU_COMPLETO = [
  { id: 'visao', label: 'Visão geral', icon: '▦' },
  { id: 'divergencias',label: 'Divergências', icon: '⚠', badge: true },
  { id: 'painel', label: 'Dashboard', icon: '📊' },
  { id: 'fluxocaixa', label: 'Fluxo de Caixa', icon: '💰' },
  { id: 'compfiscal', label: 'Comp Fiscal', icon: '🧾' },
  { id: 'confiscal', label: 'Conferência Fiscal', icon: '📑' },
  { id: 'fechamento', label: 'Comp. Saldo de Estoque', icon: '⚖' },
  { id: 'razao', label: 'Movimentos', icon: '📋' },
  { id: 'rateio', label: 'Rateio de Compras', icon: '➗' },
  { id: 'contas', label: 'Contas contábeis', icon: '⊞' },
  { id: 'historico', label: 'Histórico', icon: '⊙' },
  { id: 'sync', label: 'Importar período', icon: '↻' },
]

function carregarSessaoSalva() {
  try {
    const raw = localStorage.getItem('kb_sessao')
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s?.access_token || !s?.expira_em || Date.now() > s.expira_em) {
      localStorage.removeItem('kb_sessao')
      return null
    }
    return s
  } catch { return null }
}

export default function App() {
  const [sessao, setSessao] = useState(carregarSessaoSalva)

  if (!sessao) {
    return <Login onLogin={setSessao} />
  }

  return <AppAutenticado sessao={sessao} onLogout={() => {
    localStorage.removeItem('kb_sessao')
    setSessao(null)
  }} />
}

function AppAutenticado({ sessao, onLogout }) {
  // Menu filtrado só com as páginas liberadas para esse usuário
  const MENU = MENU_COMPLETO.filter(m => sessao.paginas.includes(m.id))

  const [pagina, setPagina] = useState(MENU[0]?.id || 'visao')
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [lancamentos, setLancamentos] = useState([])
  const [resumos, setResumos] = useState([])
  const [ultima, setUltima] = useState(null)
  const [periodoId, setPeriodoId] = useState(null)
  const [fechamento, setFechamento] = useState(null)
  const [atualizando, setAtualizando] = useState(false)
  const [detalhe, setDetalhe] = useState(null)

  const periodoAtual = resumos.find(r => r.importacao_id === periodoId) || ultima

  const carregar = useCallback(async () => {
    try {
      const rs = await sbFetch('resumo_analitico?select=*&order=periodo_fim.asc,criado_em.asc')
      setResumos(rs || [])
      if (!rs?.length) return setFase('vazio')

      const ult = [...rs].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))[0]
      setUltima(ult)
      setPeriodoId(prev => prev && rs.some(r => r.importacao_id === prev) ? prev : ult.importacao_id)

      try {
        const fds = await sbFetch('fechamento_analitico?select=*&order=data_posicao.desc')
        if (fds?.length) {
          const dataMaisRecente = fds[0].data_posicao
          const linhas = fds.filter(f => f.data_posicao === dataMaisRecente)
          const tot = linhas.reduce((s, l) => s + Number(l.diferenca || 0), 0)
          setFechamento({ data: dataMaisRecente, linhas, diferenca: Math.round(tot * 100) / 100 })
        }
      } catch { /* fechamento opcional */ }

      setFase('pronto')
    } catch (e) {
      setErro(e.message || String(e))
      setFase('erro')
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!periodoId) return
    sbFetch(`lancamentos_conciliacao?importacao_id=eq.${periodoId}&select=*&order=prioridade.asc`)
      .then(rows => setLancamentos(rows || []))
      .catch(e => { setErro(e.message || String(e)); setFase('erro') })
  }, [periodoId])

  const atualizar = async () => {
    setAtualizando(true)
    setFase('carregando')
    await carregar()
    setAtualizando(false)
  }

  const badgeCount = lancamentos.filter(r => r.classe_divergencia === 'INVESTIGAR').length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F8' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 230, flexShrink: 0, background: '#fff', borderRight: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '18px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#101828', color: '#fff',
            display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>KB</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Conciliação</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>Fiscal & Financeiro</div>
          </div>
        </div>

        <nav style={{ padding: '10px 8px', flex: 1 }}>
          {MENU.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setPagina(id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 10px',
              background: pagina === id ? '#EBF2FC' : 'none',
              border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', fontSize: 13.5,
              color: pagina === id ? '#1D5BBF' : '#374151',
              fontWeight: pagina === id ? 600 : 400,
            }}
              onMouseOver={e => { if (pagina !== id) e.currentTarget.style.background = '#F9FAFB' }}
              onMouseOut={e => { if (pagina !== id) e.currentTarget.style.background = 'none' }}
            >
              <span style={{ width: 18, textAlign: 'center', fontSize: 14, opacity: .7 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {id === 'divergencias' && badgeCount > 0 && fase === 'pronto' && (
                <span style={{ background: '#B54708', color: '#fff', fontSize: 10.5, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 9 }}>{badgeCount}</span>
              )}
            </button>
          ))}
        </nav>

        {ultima && fase === 'pronto' && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#12805C', marginBottom: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#12805C' }} />
              <strong>Sincronizado</strong>
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 11 }}>
              {new Date(ultima.criado_em).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              })}
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 1 }}>
              {dBR(ultima.periodo_inicio)} a {dBR(ultima.periodo_fim)}
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 1 }}>
              {int(lancamentos.length)} lançamentos
            </div>
          </div>
        )}

        {/* Usuário logado + sair */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 11.5, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={sessao.email}>
            {sessao.email}
          </div>
          <button onClick={onLogout} style={{
            fontSize: 11, color: '#B42318', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0, fontWeight: 600,
          }}>
            Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          padding: '16px 26px', background: '#fff', borderBottom: '1px solid #E5E7EB',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {MENU.find(m => m.id === pagina)?.label}
            </h1>
            {periodoAtual && !['fechamento', 'razao', 'historico', 'painel', 'sync', 'fluxocaixa', 'compfiscal', 'confiscal', 'rateio'].includes(pagina) && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9CA3AF' }}>
                Período {dBR(periodoAtual.periodo_inicio)} a {dBR(periodoAtual.periodo_fim)}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {resumos.length > 1 && !['fechamento', 'razao', 'sync', 'fluxocaixa', 'compfiscal', 'confiscal', 'rateio'].includes(pagina) && (
              <select
                value={periodoId || ''}
                onChange={e => setPeriodoId(e.target.value)}
                style={{
                  fontFamily: 'inherit', fontSize: 13, padding: '7px 10px',
                  border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', color: '#374151',
                }}
              >
                {[...resumos].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).map(r => (
                  <option key={r.importacao_id} value={r.importacao_id}>
                    {dBR(r.periodo_inicio)} a {dBR(r.periodo_fim)}
                  </option>
                ))}
              </select>
            )}
            {pagina !== 'rateio' && (
              <Btn primary onClick={atualizar} disabled={atualizando || fase === 'carregando'}>
                {atualizando ? '↻ Atualizando…' : '↻ Atualizar dados'}
              </Btn>
            )}
          </div>
        </header>

        <div style={{ flex: 1, padding: '22px 26px 60px', overflowY: 'auto' }}>
          {/* Rateio de Compras não depende de nenhuma sincronização de período
              — funciona direto com upload de PDF + chamada de API, então fica
              disponível mesmo antes da primeira sincronização (fase !== 'pronto'). */}
          {pagina === 'rateio' ? (
            <RateioCompras />
          ) : (
            <>
              {fase === 'carregando' && <Spinner />}
              {fase === 'erro' && (
                <EmptyState title="Erro ao carregar" text={erro}>
                  <Btn primary onClick={carregar}>Tentar novamente</Btn>
                </EmptyState>
              )}
              {fase === 'vazio' && (
                <EmptyState title="Nenhuma sincronização" text="Rode a função conciliacao-sync para importar dados.">
                  <Btn primary onClick={carregar}>Verificar de novo</Btn>
                </EmptyState>
              )}

              {fase === 'pronto' && (
                <>
                  {pagina === 'visao' && (
                    <VIsaoGeral
                      lancamentos={lancamentos}
                      fechamento={fechamento}
                      onDetalhe={setDetalhe}
                    />
                  )}
                  {pagina === 'divergencias' && <Divergencias lancamentos={lancamentos} />}
                  {pagina === 'painel' && <Dashboard />}
                  {pagina === 'fluxocaixa' && <FluxoCaixa />}
                  {pagina === 'compfiscal' && <ConferenciaFaturamento />}
                  {pagina === 'confiscal' && <ConferenciaFiscal />}
                  {pagina === 'fechamento' && <Fechamento />}
                  {pagina === 'razao' && <Razao />}
                  {pagina === 'contas' && (
                    <Contas lancamentos={lancamentos}
                      onFiltrarConta={() => setPagina('razao')} />
                  )}
                  {pagina === 'historico' && <Historico resumos={resumos} />}
                  {pagina === 'sync' && <Sincronizacao />}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <DrawerDetalhe nota={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  )
}
