import React, { useEffect, useState, useCallback } from 'react'
import { sbFetch, brl, int, dBR, isZero } from './config.js'
import { Spinner, EmptyState, Btn } from './components/UI.jsx'
import DrawerDetalhe from './components/DrawerDetalhe.jsx'
import VIsaoGeral from './pages/VIsaoGeral.jsx'
import Lancamentos from './pages/Lancamentos.jsx'
import Fechamento from './pages/Fechamento.jsx'
import Razao from './pages/Razao.jsx'
import { Contas, Historico } from './pages/ContasHistorico.jsx'
import Sincronizacao from './pages/Sincronizacao.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Divergencias from './pages/Divergencias.jsx'

const MENU = [
  { id: 'visao',      label: 'Visão geral',         icon: '▦' },
  { id: 'divergencias',label: 'Divergências',         icon: '⚠', badge: true },
  { id: 'lancamentos',label: 'Lançamentos',          icon: '≡' },
  { id: 'painel',     label: 'Dashboard',            icon: '📊' },
  { id: 'fechamento', label: 'Comp. Saldo de Estoque', icon: '⚖' },
  { id: 'razao',      label: 'Razão de estoque',     icon: '📋' },
  { id: 'contas',     label: 'Contas contábeis',     icon: '⊞' },
  { id: 'historico',  label: 'Histórico',            icon: '⊙' },
  { id: 'sync',       label: 'Importar período',      icon: '↻' },
]

export default function App() {
  const [pagina,      setPagina]      = useState('visao')
  const [fase,        setFase]        = useState('carregando')
  const [erro,        setErro]        = useState('')
  const [lancamentos, setLancamentos] = useState([])
  const [resumos,     setResumos]     = useState([])
  const [ultima,      setUltima]      = useState(null)
  const [fechamento,  setFechamento]  = useState(null)
  const [atualizando, setAtualizando] = useState(false)
  const [detalhe,     setDetalhe]     = useState(null)
  const [lancFiltro,  setLancFiltro]  = useState(null)

  const carregar = useCallback(async () => {
    try {
      // 1. importações
      const rs = await sbFetch('resumo_analitico?select=*&order=criado_em.asc')
      setResumos(rs || [])
      if (!rs?.length) return setFase('vazio')

      // pega a mais recente
      const ult = rs[rs.length - 1]
      setUltima(ult)

      // 2. lançamentos da importação mais recente
      const rows = await sbFetch(
        `lancamentos_conciliacao?importacao_id=eq.${ult.importacao_id}&select=*&order=prioridade.asc`
      )
      setLancamentos(rows || [])

      // 3. fechamento mais recente (se existir)
      try {
        const fds = await sbFetch(
          'fechamento_analitico?select=*&order=data_posicao.desc'
        )
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

  const atualizar = async () => {
    setAtualizando(true)
    setFase('carregando')
    await carregar()
    setAtualizando(false)
  }

  // badge: só investigar + críticos (ajuste de custo fecha no saldo, não é pendência)
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
            {ultima && pagina !== 'fechamento' && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9CA3AF' }}>
                Período {dBR(ultima.periodo_inicio)} a {dBR(ultima.periodo_fim)}
              </p>
            )}
          </div>
          <Btn primary onClick={atualizar} disabled={atualizando || fase === 'carregando'}>
            {atualizando ? '↻ Atualizando…' : '↻ Atualizar dados'}
          </Btn>
        </header>

        <div style={{ flex: 1, padding: '22px 26px 60px', overflowY: 'auto' }}>
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
              {pagina === 'lancamentos' && (
                <Lancamentos lancamentos={lancamentos} onDetalhe={setDetalhe} />
              )}
              {pagina === 'painel'     && <Dashboard />}
              {pagina === 'fechamento' && <Fechamento />}
              {pagina === 'razao'      && <Razao />}
              {pagina === 'contas'     && (
                <Contas lancamentos={lancamentos}
                  onFiltrarConta={conta => { setLancFiltro(conta); setPagina('lancamentos') }} />
              )}
              {pagina === 'historico'  && <Historico resumos={resumos} />}
              {pagina === 'sync'        && <Sincronizacao />}
            </>
          )}
        </div>
      </main>

      <DrawerDetalhe nota={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  )
}
