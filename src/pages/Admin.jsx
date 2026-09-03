import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, int } from '../config.js'
import { Panel, Btn, Spinner, SearchInput, Select } from '../components/UI.jsx'

// Precisa espelhar o MENU_COMPLETO do App.jsx
export const PAGINAS = [
  { id:'visao', label:'Visão geral' }, { id:'divergencias', label:'Divergências' },
  { id:'painel', label:'Dashboard' }, { id:'fluxocaixa', label:'Fluxo de Caixa' },
  { id:'compfiscal', label:'Comp Fiscal' }, { id:'confiscal', label:'Conferência Fiscal' },
  { id:'fechamento', label:'Comp. Saldo de Estoque' }, { id:'razao', label:'Movimentos' },
  { id:'rateio', label:'Rateio de Compras' }, { id:'auditoria', label:'Auditoria de Modificações' },
  { id:'baixagas', label:'Baixa Automática Gás' }, { id:'vinculofrete', label:'Vínculo NF × CT-e' },
  { id:'contas', label:'Contas contábeis' }, { id:'historico', label:'Histórico' },
  { id:'sync', label:'Importar período' }, { id:'admin', label:'Administração' },
]

const HDR = {
  'Content-Type':'application/json', apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}
async function api(metodo, caminho, corpo) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: metodo, headers: HDR, body: corpo ? JSON.stringify(corpo) : undefined,
  })
  if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.message || `HTTP ${res.status}`)
}
export async function registrarAuditoria(email, acao, pagina, detalhe) {
  try { await api('POST', 'portal_auditoria', { email, acao, pagina, detalhe }) } catch {}
}
function dataHoraBR(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function Usuarios({ emailAtual }) {
  const [lista, setLista] = useState([])
  const [fase, setFase] = useState('carregando')
  const [novoEmail, setNovoEmail] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [msg, setMsg] = useState('')

  const carregar = () => {
    setFase('carregando')
    sbFetch('permissoes_usuario?select=*&order=email')
      .then(r => { setLista(r || []); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }
  useEffect(() => { carregar() }, [])

  const acao = async (fn, descricao) => {
    setSalvando(true); setErro(''); setMsg('')
    try {
      await fn()
      await registrarAuditoria(emailAtual, 'permissao_alterada', 'admin', { descricao })
      setMsg(`✓ ${descricao}`)
      carregar()
    } catch (e) { setErro(e.message) }
    finally { setSalvando(false) }
  }

  const alternarPagina = (u, paginaId) => {
    const tem = (u.paginas || []).includes(paginaId)
    const novas = tem ? u.paginas.filter(p => p !== paginaId) : [...(u.paginas||[]), paginaId]
    acao(() => api('PATCH', `permissoes_usuario?id=eq.${u.id}`, { paginas: novas }),
      `${tem ? 'Removido' : 'Liberado'} "${paginaId}" para ${u.email}`)
  }
  const criar = () => {
    const email = novoEmail.trim().toLowerCase()
    if (!email.includes('@')) { setErro('E-mail inválido'); return }
    acao(async () => {
      await api('POST', 'permissoes_usuario', { email, paginas: ['visao'] })
      setNovoEmail('')
    }, `Usuário ${email} criado`)
  }
  const remover = (u) => {
    if (u.email === emailAtual) { setErro('Você não pode remover o próprio acesso.'); return }
    if (!window.confirm(`Remover o acesso de ${u.email} ao portal?`)) return
    acao(() => api('DELETE', `permissoes_usuario?id=eq.${u.id}`), `Usuário ${u.email} removido`)
  }
  const marcarTodas = (u, marcar) => {
    acao(() => api('PATCH', `permissoes_usuario?id=eq.${u.id}`,
      { paginas: marcar ? PAGINAS.map(p => p.id) : ['visao'] }),
      `${marcar ? 'Liberadas todas as abas' : 'Acesso mínimo'} para ${u.email}`)
  }

  if (fase === 'carregando') return <Spinner/>

  return (
    <>
      {erro && <div style={{ color:'#B42318', fontSize:12.5, marginBottom:10 }}>⚠ {erro}</div>}
      {msg && <div style={{ color:'#12805C', fontSize:12.5, marginBottom:10 }}>{msg}</div>}

      <div style={{ display:'flex', gap:8, marginBottom:18, alignItems:'center' }}>
        <input value={novoEmail} onChange={e=>setNovoEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && criar()}
          placeholder="novo.usuario@kalenborn.com.br"
          style={{ fontFamily:'inherit', fontSize:13, padding:'8px 12px', border:'1px solid #E5E7EB', borderRadius:6, width:300 }} />
        <Btn primary onClick={criar} disabled={salvando || !novoEmail.trim()}>+ Criar usuário</Btn>
        <span style={{ fontSize:11.5, color:'#9CA3AF' }}>começa só com "Visão geral"</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {lista.map(u => (
          <div key={u.id} style={{ border:'1px solid #E5E7EB', borderRadius:8, padding:'14px 16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
              <div style={{ fontWeight:600, fontSize:13.5 }}>
                {u.email}
                {u.email === emailAtual && <span style={{ marginLeft:8, fontSize:10.5, fontWeight:600, padding:'2px 7px', borderRadius:4, background:'#DBEAFE', color:'#1D5BBF' }}>você</span>}
                <span style={{ marginLeft:8, fontSize:11.5, color:'#9CA3AF', fontWeight:400 }}>
                  {int((u.paginas||[]).length)} de {PAGINAS.length} abas
                </span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <Btn small onClick={() => marcarTodas(u, true)} disabled={salvando}>Liberar todas</Btn>
                <Btn small onClick={() => marcarTodas(u, false)} disabled={salvando}>Acesso mínimo</Btn>
                <button onClick={() => remover(u)} disabled={salvando || u.email === emailAtual}
                  style={{ border:'1px solid #FECACA', background:'#fff', borderRadius:5, padding:'3px 10px',
                           cursor: u.email === emailAtual ? 'not-allowed' : 'pointer', fontFamily:'inherit',
                           fontSize:12, color:'#B42318', opacity: u.email === emailAtual ? .4 : 1 }}>
                  Remover
                </button>
              </div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {PAGINAS.map(p => {
                const tem = (u.paginas || []).includes(p.id)
                return (
                  <button key={p.id} onClick={() => alternarPagina(u, p.id)} disabled={salvando}
                    style={{
                      fontSize:11.5, padding:'4px 10px', borderRadius:14, cursor:'pointer', fontFamily:'inherit',
                      border: `1px solid ${tem ? '#BBF7D0' : '#E5E7EB'}`,
                      background: tem ? '#F0FDF4' : '#fff',
                      color: tem ? '#12805C' : '#9CA3AF',
                      fontWeight: tem ? 600 : 400,
                    }}>
                    {tem ? '✓ ' : ''}{p.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function TrilhaAuditoria() {
  const [lista, setLista] = useState([])
  const [fase, setFase] = useState('carregando')
  const [busca, setBusca] = useState('')
  const [fAcao, setFAcao] = useState('')

  useEffect(() => {
    sbFetch('portal_auditoria?select=*&order=criado_em.desc&limit=500')
      .then(r => { setLista(r || []); setFase('pronto') })
      .catch(() => setFase('pronto'))
  }, [])

  const opcoesAcao = useMemo(() => [...new Set(lista.map(l => l.acao).filter(Boolean))].sort(), [lista])
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter(l => {
      if (fAcao && l.acao !== fAcao) return false
      if (q && !`${l.email} ${l.acao} ${l.pagina||''} ${JSON.stringify(l.detalhe||{})}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [lista, busca, fAcao])

  if (fase === 'carregando') return <Spinner/>

  const th = { padding:'8px 12px', background:'#F9FAFB', textAlign:'left', fontSize:10.5, fontWeight:600,
    color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB', position:'sticky', top:0 }

  return (
    <>
      <div style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-end' }}>
        <SearchInput value={busca} onChange={setBusca} placeholder="Usuário, ação, detalhe…" />
        <Select label="Ação" value={fAcao} onChange={setFAcao} options={opcoesAcao} placeholder="Todas" />
      </div>
      <div style={{ maxHeight:480, overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr><th style={th}>Data/Hora</th><th style={th}>Usuário</th><th style={th}>Ação</th><th style={th}>Detalhe</th></tr></thead>
          <tbody>
            {filtrados.map(l => (
              <tr key={l.id} style={{ borderTop:'1px solid #F9FAFB' }}>
                <td style={{ padding:'7px 12px', whiteSpace:'nowrap', color:'#6B7280' }}>{dataHoraBR(l.criado_em)}</td>
                <td style={{ padding:'7px 12px', fontWeight:600 }}>{l.email}</td>
                <td style={{ padding:'7px 12px' }}>
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5, background:'#F3F4F6', color:'#374151' }}>{l.acao}</span>
                </td>
                <td style={{ padding:'7px 12px', color:'#6B7280' }}>
                  {l.detalhe?.descricao || (l.detalhe ? JSON.stringify(l.detalhe) : '—')}
                </td>
              </tr>
            ))}
            {!filtrados.length && <tr><td colSpan={4} style={{ textAlign:'center', padding:28, color:'#9CA3AF' }}>
              Nenhum registro ainda. As ações passam a ser gravadas a partir de agora.
            </td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Admin({ sessao }) {
  const [aba, setAba] = useState('usuarios')
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', gap:8 }}>
        {[['usuarios','👤 Usuários e acessos'],['trilha','📜 Trilha de auditoria']].map(([id,rot]) => (
          <button key={id} onClick={()=>setAba(id)} style={{
            fontSize:13, padding:'8px 16px', borderRadius:6, cursor:'pointer', fontFamily:'inherit',
            border:`1px solid ${aba===id ? '#1D5BBF' : '#E5E7EB'}`,
            background: aba===id ? '#1D5BBF' : '#fff', color: aba===id ? '#fff' : '#374151',
            fontWeight: aba===id ? 600 : 400,
          }}>{rot}</button>
        ))}
      </div>

      {aba === 'usuarios' ? (
        <Panel title="Usuários e permissões de acesso">
          <p style={{ margin:'0 0 14px', fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
            Clique nas abas para liberar ou bloquear. As mudanças valem no próximo login da pessoa —
            se ela estiver com a sessão aberta, precisa sair e entrar de novo.
          </p>
          <Usuarios emailAtual={sessao?.email} />
        </Panel>
      ) : (
        <Panel title="Trilha de auditoria do portal">
          <p style={{ margin:'0 0 14px', fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
            Registro do que foi feito <strong>dentro do portal</strong> — quem entrou, quem mudou permissão,
            quem disparou sincronização ou baixa. Diferente da aba "Auditoria de Modificações", que mostra
            alterações feitas no Sankhya.
          </p>
          <TrilhaAuditoria />
        </Panel>
      )}
    </div>
  )
}
