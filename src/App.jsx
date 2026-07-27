import React, { useEffect, useState, useCallback } from 'react'
import { sbFetch, brl, int, dBR, isZero, sitDe } from './config.js'
import { Spinner, EmptyState, Btn, Drawer } from './components/UI.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Pendencias from './pages/Pendencias.jsx'
import Lancamentos from './pages/Lancamentos.jsx'
import { Contas, Historico } from './pages/ContasHistorico.jsx'
import Razao from './pages/Razao.jsx'
import Fechamento from './pages/Fechamento.jsx'

const MENU = [
  { id: 'fechamento', label: 'Fechamento',           icon: '⚖' },
  { id: 'dashboard',  label: 'Visão geral',          icon: '▦' },
  { id: 'pendencias', label: 'Pendências',           icon: '⚠', badge: true },
  { id: 'lancamentos',label: 'Lançamentos',          icon: '≡' },
  { id: 'razao',      label: 'Razão de estoque',     icon: '📋' },
  { id: 'contas',     label: 'Contas contábeis',     icon: '⊞' },
  { id: 'historico',  label: 'Histórico',            icon: '⊙' },
]

// TOPs internos que NÃO são pendências reais
const TOPS_SEM_CTB = new Set([
  '1402','1400','1403','1410','1411','3301','3302','3303','3304',
  '1600','1605','1102','1100','1101','1105',
])

export default function App() {
  const [pagina,     setPagina]     = useState('fechamento')
  const [fase,       setFase]       = useState('carregando') // carregando | vazio | pronto | erro
  const [erro,       setErro]       = useState('')
  const [lancamentos,setLancamentos]= useState([])
  const [resumos,    setResumos]    = useState([])
  const [ultima,     setUltima]     = useState(null)
  const [atualizando,setAtualizando]= useState(false)
  const [detalhe,    setDetalhe]    = useState(null)
  const [lancFiltro, setLancFiltro] = useState(null) // conta pré-filtrada vinda de Contas

  const carregar = useCallback(async () => {
    try {
      const rs = await sbFetch('resumo_analitico?select=*&order=criado_em.asc')
      setResumos(rs || [])
      if (!rs?.length) return setFase('vazio')
      const ult = rs[rs.length - 1]
      setUltima(ult)
      const rows = await sbFetch(`lancamentos_conciliacao?importacao_id=eq.${ult.importacao_id}&select=*&order=prioridade.asc`)
      setLancamentos(rows || [])
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

  const irParaDivergencias = (pag) => setPagina(pag === 'divergencias' ? 'pendencias' : pag)

  const irParaLancamentosComConta = (conta) => {
    setLancFiltro(conta)
    setPagina('lancamentos')
  }

  // Pendências reais = "só no custo" E não é movimentação interna
  // Badge conta só críticos — calculado no banco, sem lógica aqui
  const pendCount = lancamentos.filter(r =>
    ['CRITICO','AJUSTE_CUSTO','INVESTIGAR'].includes(r.classe_divergencia)).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F4F6F8' }}>

      {/* ── Menu lateral ── */}
      <aside style={{
        width: 234, flexShrink: 0, background: '#fff',
        borderRight: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        {/* Logo / marca */}
        <div style={{ padding: '20px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: '#101828', color: '#fff',
            display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}>KB</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Conciliação</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>Fiscal &amp; Financeiro</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          {MENU.map(({ id, label, icon }) => (
            <button key={id} onClick={() => { setPagina(id); setLancFiltro(null) }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 11px', background: pagina === id ? '#EBF2FC' : 'none',
              border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', fontSize: 13.5,
              color: pagina === id ? '#1D5BBF' : '#374151',
              fontWeight: pagina === id ? 600 : 400,
              transition: 'background .12s, color .12s',
            }}
              onMouseOver={e => { if (pagina !== id) e.currentTarget.style.background = '#F9FAFB' }}
              onMouseOut={e => { if (pagina !== id) e.currentTarget.style.background = 'none' }}
            >
              <span style={{ width: 18, textAlign: 'center', fontSize: 14, opacity: .7 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {id === 'pendencias' && pendCount > 0 && fase === 'pronto' && (
                <span style={{ background: '#B42318', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 9, minWidth: 20, textAlign: 'center' }}>
                  {pendCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Status */}
        {ultima && fase === 'pronto' && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid #F3F4F6', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#12805C', marginBottom: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#12805C', flexShrink: 0 }} />
              <strong>Sincronizado</strong>
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 11 }}>
              {new Date(ultima.criado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
            </div>
            <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>
              {int(lancamentos.length)} lançamentos
            </div>
          </div>
        )}
      </aside>

      {/* ── Área principal ── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 16, padding: '18px 28px', background: '#fff', borderBottom: '1px solid #E5E7EB',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em' }}>
              {MENU.find(m => m.id === pagina)?.label}
            </h1>
            {ultima && (
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#9CA3AF' }}>
                Período {dBR(ultima.periodo_inicio)} a {dBR(ultima.periodo_fim)}
              </p>
            )}
          </div>
          <Btn primary onClick={atualizar} disabled={atualizando || fase === 'carregando'}>
            {atualizando ? '↻ Atualizando…' : '↻ Atualizar dados'}
          </Btn>
        </header>

        {/* Conteúdo */}
        <div style={{ flex: 1, padding: '24px 28px 60px', overflowY: 'auto' }}>

          {fase === 'carregando' && <Spinner />}

          {fase === 'erro' && (
            <EmptyState title="Erro ao carregar dados" text={erro}>
              <Btn primary onClick={carregar}>Tentar novamente</Btn>
            </EmptyState>
          )}

          {fase === 'vazio' && (
            <EmptyState
              title="Nenhuma sincronização encontrada"
              text="O banco está vazio. A função conciliacao-sync ainda não rodou, ou os dados ainda não chegaram."
            >
              <Btn primary onClick={carregar}>Verificar de novo</Btn>
            </EmptyState>
          )}

          {fase === 'pronto' && (
            <>
              {pagina === 'dashboard' && (
                <Dashboard
                  lancamentos={lancamentos}
                  resumos={resumos}
                  onIrPara={irParaDivergencias}
                  onDetalhe={setDetalhe}
                />
              )}
              {pagina === 'pendencias' && (
                <Pendencias
                  lancamentos={lancamentos}
                  onDetalhe={setDetalhe}
                />
              )}
              {pagina === 'lancamentos' && (
                <Lancamentos
                  lancamentos={lancamentos}
                  contaInicial={lancFiltro}
                />
              )}
              {pagina === 'contas' && (
                <Contas
                  lancamentos={lancamentos}
                  onFiltrarConta={irParaLancamentosComConta}
                />
              )}
              {pagina === 'fechamento' && (
                <Fechamento />
              )}

              {pagina === 'razao' && <Razao />}

              {pagina === 'historico' && (
                <Historico resumos={resumos} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Drawer de detalhe */}
      <Drawer
        linha={detalhe}
        onClose={() => setDetalhe(null)}
        brl={brl}
        dBR={dBR}
        sitDe={sitDe}
        isZero={isZero}
      />
    </div>
  )
}
