import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, int, dBR } from '../config.js'
import { Panel, Btn, Spinner, SearchInput, Select } from '../components/UI.jsx'

const STATUS = ['A iniciar','Em desenvolvimento','Em teste','Implantação','Ajustes Finais','Em produção','Concluído','Pausado','Cancelado']
const COR = {
  'Concluído':'#12805C', 'Em produção':'#12805C', 'Em desenvolvimento':'#1D5BBF',
  'Em teste':'#7C3AED', 'Implantação':'#0891B2', 'Ajustes Finais':'#B54708',
  'A iniciar':'#6B7280', 'Pausado':'#92400E', 'Cancelado':'#B42318',
}
const PRIORIDADES = ['Altíssima','Alta','Média','Baixa']
const TIPOS = ['Plataforma','Automação','Entrega','Consulta/SQL']
// Plataforma tem peso visual maior: é o que a diretoria enxerga como projeto
const TIPO_ESTILO = {
  'Plataforma':   { bg:'#09090b', fg:'#facc15', ic:'🏗' },
  'Automação':    { bg:'#1D5BBF', fg:'#fff',    ic:'⚙' },
  'Entrega':      { bg:'#E5E7EB', fg:'#374151', ic:'📦' },
  'Consulta/SQL': { bg:'#F3F4F6', fg:'#9CA3AF', ic:'🔎' },
}
const CONCLUIDOS = ['Concluído','Em produção']

const HDR = { 'Content-Type':'application/json', apikey: SUPABASE_ANON_KEY, Authorization:`Bearer ${SUPABASE_ANON_KEY}` }
async function api(metodo, caminho, corpo) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: metodo, headers: HDR, body: corpo ? JSON.stringify(corpo) : undefined })
  if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.message || `HTTP ${res.status}`)
}
const vazio = { nome_projeto:'', setor:'', solicitante:'', resumo:'', data_pedido:'', data_inicio:'',
  prev_encerramento:'', data_encerramento:'', status:'A iniciar', prioridade:'Média', obs:'', beneficio:'',
  repositorio:'', stack:'', tipo:'Entrega', projeto_pai_id:null }

function Form({ inicial, onSalvar, onCancelar, salvando }) {
  const [f, setF] = useState({ ...vazio, ...inicial,
    data_pedido: inicial?.data_pedido || '', data_inicio: inicial?.data_inicio || '',
    prev_encerramento: inicial?.prev_encerramento || '', data_encerramento: inicial?.data_encerramento || '' })
  const set = (k,v) => setF(s => ({ ...s, [k]: v }))
  const inp = { width:'100%', fontFamily:'inherit', fontSize:13, padding:'8px 10px',
    border:'1px solid #E5E7EB', borderRadius:6, boxSizing:'border-box', marginTop:4 }
  const lbl = { fontSize:11, color:'#6B7280', fontWeight:600, display:'block' }

  return (
    <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:10, padding:18, marginBottom:18 }}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:12 }}>
        <label style={lbl}>Nome do projeto *
          <input style={inp} value={f.nome_projeto} onChange={e=>set('nome_projeto',e.target.value)} autoFocus /></label>
        <label style={lbl}>Setor
          <input style={inp} value={f.setor||''} onChange={e=>set('setor',e.target.value)} placeholder="Ex: Comercial" /></label>
        <label style={lbl}>Quem pediu
          <input style={inp} value={f.solicitante||''} onChange={e=>set('solicitante',e.target.value)} /></label>
      </div>
      <label style={lbl}>Resumo do projeto
        <textarea style={{ ...inp, resize:'vertical', minHeight:56 }} value={f.resumo||''} onChange={e=>set('resumo',e.target.value)} /></label>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, margin:'12px 0' }}>
        <label style={lbl}>Data do pedido
          <input type="date" style={inp} value={f.data_pedido||''} onChange={e=>set('data_pedido',e.target.value)} /></label>
        <label style={lbl}>Data início
          <input type="date" style={inp} value={f.data_inicio||''} onChange={e=>set('data_inicio',e.target.value)} /></label>
        <label style={lbl}>Prev. encerramento
          <input type="date" style={inp} value={f.prev_encerramento||''} onChange={e=>set('prev_encerramento',e.target.value)} /></label>
        <label style={lbl}>Encerramento (real)
          <input type="date" style={inp} value={f.data_encerramento||''} onChange={e=>set('data_encerramento',e.target.value)} /></label>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr', gap:12, marginBottom:12 }}>
        <label style={lbl}>Status
          <select style={inp} value={f.status} onChange={e=>set('status',e.target.value)}>
            {STATUS.map(s => <option key={s}>{s}</option>)}</select></label>
        <label style={lbl}>Prioridade
          <select style={inp} value={f.prioridade||'Média'} onChange={e=>set('prioridade',e.target.value)}>
            {PRIORIDADES.map(s => <option key={s}>{s}</option>)}</select></label>
        <label style={lbl}>Tipo
          <select style={inp} value={f.tipo||'Entrega'} onChange={e=>set('tipo',e.target.value)}>
            {TIPOS.map(s => <option key={s}>{s}</option>)}</select></label>
        <label style={lbl}>Benefício / impacto
          <input style={inp} value={f.beneficio||''} onChange={e=>set('beneficio',e.target.value)} /></label>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12, marginBottom:12 }}>
        <label style={lbl}>Repositório
          <input style={inp} value={f.repositorio||''} onChange={e=>set('repositorio',e.target.value)} placeholder="nome-do-repo" /></label>
        <label style={lbl}>Stack / tecnologia
          <input style={inp} value={f.stack||''} onChange={e=>set('stack',e.target.value)} placeholder="React + Vite · Supabase · Sankhya" /></label>
      </div>
      <label style={lbl}>Observações
        <textarea style={{ ...inp, resize:'vertical', minHeight:44 }} value={f.obs||''} onChange={e=>set('obs',e.target.value)} /></label>
      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <Btn primary onClick={() => onSalvar(f)} disabled={salvando || !f.nome_projeto.trim()}>
          {salvando ? 'Salvando…' : 'Salvar'}</Btn>
        <Btn onClick={onCancelar} disabled={salvando}>Cancelar</Btn>
      </div>
    </div>
  )
}

export default function Automacoes() {
  const [dados, setDados] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fSetor, setFSetor] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [editando, setEditando] = useState(null)  // objeto ou 'novo'
  const [salvando, setSalvando] = useState(false)
  const [aba, setAba] = useState('lista')
  const [economia, setEconomia] = useState([])
  const [cfg, setCfg] = useState({})
  const [editEco, setEditEco] = useState(null)
  const [saude, setSaude] = useState([])
  const [detalhe, setDetalhe] = useState(null)

  const carregar = () => {
    setFase('carregando')
    sbFetch('automacao_projetos?select=*&order=tipo,nome_projeto')
      .then(r => { setDados(r||[]); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }
  const carregarEconomia = () => {
    sbFetch('automacao_economia?select=*&order=horas_reais.desc').then(r=>setEconomia(r||[])).catch(()=>{})
    sbFetch('automacao_saude?select=*').then(r=>setSaude(r||[])).catch(()=>{})
    sbFetch('automacao_config?select=*').then(r => {
      const o = {}; (r||[]).forEach(c => { o[c.chave] = c.valor }); setCfg(o)
    }).catch(()=>{})
  }
  useEffect(() => { carregar(); carregarEconomia() }, [])

  const salvar = async (f) => {
    setSalvando(true); setErro('')
    const limpo = { ...f }
    ;['data_pedido','data_inicio','prev_encerramento','data_encerramento'].forEach(k => { if (!limpo[k]) limpo[k] = null })
    delete limpo.id; delete limpo.criado_em
    limpo.atualizado_em = new Date().toISOString()
    try {
      if (editando === 'novo') await api('POST','automacao_projetos', limpo)
      else await api('PATCH',`automacao_projetos?id=eq.${editando.id}`, limpo)
      setEditando(null); carregar()
    } catch (e) { setErro(e.message) }
    finally { setSalvando(false) }
  }
  const remover = async (p) => {
    if (!window.confirm(`Remover "${p.nome_projeto}" do controle?`)) return
    try { await api('DELETE',`automacao_projetos?id=eq.${p.id}`); carregar() }
    catch (e) { setErro(e.message) }
  }

  const setores = useMemo(() => [...new Set(dados.map(d=>d.setor).filter(Boolean))].sort(), [dados])
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(d => {
      if (fStatus && d.status !== fStatus) return false
      if (fSetor && d.setor !== fSetor) return false
      if (fTipo && d.tipo !== fTipo) return false
      if (q && !`${d.nome_projeto} ${d.setor||''} ${d.resumo||''} ${d.solicitante||''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [dados, busca, fStatus, fSetor, fTipo])

  const kpi = useMemo(() => ({
    total: dados.length,
    concluidos: dados.filter(d => CONCLUIDOS.includes(d.status)).length,
    andamento: dados.filter(d => ['Em desenvolvimento','Em teste','Implantação','Ajustes Finais'].includes(d.status)).length,
    cancelados: dados.filter(d => d.status === 'Cancelado').length,
  }), [dados])

  const porStatus = useMemo(() => {
    const m = new Map()
    dados.forEach(d => m.set(d.status, (m.get(d.status)||0)+1))
    return [...m.entries()].map(([nome,qtd]) => ({ nome, qtd })).sort((a,b)=>b.qtd-a.qtd)
  }, [dados])
  // Entregas concluidas agrupadas por mes, para mostrar ritmo de entrega
  const porMes = useMemo(() => {
    const m = new Map()
    dados.filter(d => d.data_encerramento).forEach(d => {
      const k = String(d.data_encerramento).slice(0,7)
      m.set(k, (m.get(k)||0)+1)
    })
    const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
    return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([k,qtd]) => ({ mes: `${MES[Number(k.slice(5,7))-1]}/${k.slice(2,4)}`, qtd }))
  }, [dados])

  const porSetor = useMemo(() => {
    const m = new Map()
    dados.forEach(d => { const s = d.setor||'—'; m.set(s,(m.get(s)||0)+1) })
    return [...m.entries()].map(([nome,qtd]) => ({ nome, qtd })).sort((a,b)=>b.qtd-a.qtd)
  }, [dados])

  const exportarCsv = () => {
    const cab = ['Data do pedido','Nome do projeto','Setor','Quem pediu','Resumo','Data início','Prev. encerramento','Encerramento','Status','Prioridade','Benefício','Obs']
    const linhas = lista.map(d => [dBR(d.data_pedido), d.nome_projeto, d.setor, d.solicitante, d.resumo,
      dBR(d.data_inicio), dBR(d.prev_encerramento), dBR(d.data_encerramento), d.status, d.prioridade, d.beneficio, d.obs]
      .map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';'))
    const url = URL.createObjectURL(new Blob(['\ufeff'+[cab.join(';'),...linhas].join('\n')], { type:'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url
    a.download = `automacoes_${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const th = a => ({ position:'sticky', top:0, background:'#F9FAFB', padding:'8px 10px', textAlign:a||'left',
    fontSize:10, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em',
    borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' })
  const cel = { padding:'8px 10px', verticalAlign:'top' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Faixa de abertura - identidade Kalenborn (preto + amarelo) */}
      <div style={{ background:'#09090b', borderRadius:16, padding:'26px 30px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, right:-40, width:260, height:260,
          background:'#facc15', opacity:.07, borderRadius:'50%', filter:'blur(60px)' }} />
        <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:24, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.22em', color:'#facc15', textTransform:'uppercase', marginBottom:10 }}>
              Centro de Automações
            </div>
            <div style={{ fontSize:26, fontWeight:800, color:'#fff', letterSpacing:'-.02em', lineHeight:1.2 }}>
              {int(kpi.concluidos)} entregas em produção
            </div>
            <div style={{ fontSize:13, color:'#a1a1aa', marginTop:8, maxWidth:560, lineHeight:1.6 }}>
              Automações construídas internamente em Comercial, Engenharia, RH, Qualidade, Fiscal e Almoxarifado —
              com integração direta ao Sankhya e retenção do conhecimento técnico na casa.
            </div>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            {[['Iniciativas', int(kpi.total)], ['Em curso', int(kpi.andamento)]].map(([l,v]) => (
              <div key={l} style={{ background:'#18181b', border:'1px solid #27272a', borderRadius:12, padding:'14px 20px', textAlign:'center', minWidth:96 }}>
                <div style={{ fontSize:22, fontWeight:800, color:'#fff' }}>{v}</div>
                <div style={{ fontSize:9, fontWeight:800, letterSpacing:'.16em', color:'#71717a', textTransform:'uppercase', marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:6, background:'#F3F4F6', padding:5, borderRadius:12, width:'fit-content' }}>
        {[['lista','📋 Controle semanal'],['saude','🩺 Saúde das automações'],['painel','📊 Visão executiva'],['economia','💰 Impacto financeiro']].map(([id,rot]) => (
          <button key={id} onClick={()=>setAba(id)} style={{
            fontSize:12.5, padding:'9px 18px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
            border:'none', background: aba===id?'#09090b':'transparent',
            color: aba===id?'#facc15':'#6B7280', fontWeight: aba===id?700:500,
            transition:'all .15s' }}>{rot}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {[
          { l:'Plataformas', v:int(dados.filter(d=>d.tipo==='Plataforma').length), c:'#09090b', ic:'🏗' },
          { l:'Concluídos / produção', v:int(kpi.concluidos), c:'#12805C', ic:'✅' },
          { l:'Em andamento', v:int(kpi.andamento), c:'#1D5BBF', ic:'⚡' },
          { l:'Cancelados', v:int(kpi.cancelados), c:'#B42318', ic:'✕' },
        ].map((k,i) => (
          <div key={i} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14,
            padding:'20px 22px', boxShadow:'0 1px 3px rgba(16,24,40,.04)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:k.c+'14', display:'flex',
                alignItems:'center', justifyContent:'center', fontSize:16 }}>{k.ic}</div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:'.14em', color:'#9CA3AF', textTransform:'uppercase', textAlign:'right', maxWidth:80, lineHeight:1.4 }}>{k.l}</div>
            </div>
            <div style={{ fontSize:34, fontWeight:800, color:k.c, letterSpacing:'-.03em', lineHeight:1 }}>{k.v}</div>
          </div>
        ))}
      </div>

      {erro && <div style={{ color:'#B42318', fontSize:13 }}>⚠ {erro}</div>}
      {fase === 'carregando' && <Spinner/>}

      {fase === 'pronto' && aba === 'saude' && (() => {
        const problemas = saude.filter(x => ['rotina parada','sem dados'].includes(x.situacao))
        const semPend = saude.filter(x => x.situacao === 'sem pendências')
        return (
          <>
            <div style={{ background: problemas.length ? '#7f1d1d' : '#052e1f', borderRadius:16, padding:'26px 30px' }}>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.22em',
                color: problemas.length ? '#fca5a5' : '#34d399', textTransform:'uppercase', marginBottom:10 }}>
                {problemas.length ? 'Atenção necessária' : 'Tudo rodando'}
              </div>
              <div style={{ fontSize:26, fontWeight:800, color:'#fff', letterSpacing:'-.02em' }}>
                {problemas.length
                  ? `${problemas.length} rotina(s) parada(s)`
                  : `${saude.length} automações em dia`}
              </div>
              <div style={{ fontSize:12.5, color: problemas.length ? '#fecaca' : '#6ee7b7', marginTop:8, lineHeight:1.6, maxWidth:640 }}>
                {semPend.length > 0
                  ? <>Rotinas rodando normalmente. {semPend.length} não produziram resultado recente porque
                     <strong> não havia pendência a tratar</strong> — o que é o comportamento esperado, não uma falha.</>
                  : <>A verificação separa <strong>rodar</strong> de <strong>produzir resultado</strong>: uma rotina
                     em dia sem nada a fazer não é problema. Só acende quando a rotina em si para.</>}
              </div>
            </div>

            <Panel title="Última execução com resultado">
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                <thead><tr>
                  {['Automação','Frequência','Último resultado','Há quanto tempo','Situação'].map((h,i)=>(
                    <th key={h} style={{ padding:'8px 12px', background:'#F9FAFB', textAlign: i===3?'right':'left',
                      fontSize:10, fontWeight:600, color:'#6B7280', textTransform:'uppercase',
                      letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {saude.map((x,i) => {
                    const grave = ['rotina parada','sem dados'].includes(x.situacao)
                    const neutro = ['sem pendências','sem uso recente'].includes(x.situacao)
                    const ok = !grave && !neutro
                    return (
                      <tr key={i} style={{ borderTop:'1px solid #F9FAFB', background: grave ? '#FEF2F2' : 'transparent' }}>
                        <td style={{ padding:'9px 12px', fontWeight:600 }}>{x.automacao}</td>
                        <td style={{ padding:'9px 12px', color:'#6B7280' }}>{x.frequencia}</td>
                        <td style={{ padding:'9px 12px', color:'#6B7280', whiteSpace:'nowrap' }}>
                          {x.ultimo ? new Date(x.ultimo).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}
                        </td>
                        <td style={{ padding:'9px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums',
                          color: grave ? '#B42318' : '#6B7280', fontWeight: grave ? 700 : 400 }}>
                          {x.horas_atras != null ? `${Number(x.horas_atras).toFixed(0)}h` : '—'}
                        </td>
                        <td style={{ padding:'9px 12px' }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:5,
                            color: grave ? '#B42318' : (neutro ? '#6B7280' : '#12805C'),
                            background: grave ? '#FEE2E2' : (neutro ? '#F3F4F6' : '#D1FAE5') }}>
                            {grave ? '⚠ ' : (neutro ? '' : '✓ ')}{x.situacao === 'ok' ? 'em dia' : x.situacao}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p style={{ margin:'14px 0 0', fontSize:11.5, color:'#9CA3AF', lineHeight:1.6 }}>
                <strong>Em dia</strong>: rodou e produziu resultado. <strong>Sem pendências</strong>: a rotina
                rodou, mas não havia nada a processar — normal. <strong>Rotina parada</strong>: o agendamento
                deixou de executar, aí sim precisa olhar. Diárias são cobradas em 26h; as sob demanda, em 14 dias.
              </p>
            </Panel>
          </>
        )
      })()}

      {fase === 'pronto' && aba === 'painel' && (
        <>
        <div style={{ background:'#09090b', borderRadius:16, padding:'26px 30px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', bottom:-70, left:-30, width:240, height:240,
            background:'#facc15', opacity:.06, borderRadius:'50%', filter:'blur(60px)' }} />
          <div style={{ position:'relative' }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.22em', color:'#facc15', textTransform:'uppercase', marginBottom:16 }}>
              Infraestrutura construída
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16 }}>
              {[
                { n: int(dados.filter(d=>d.repositorio).length), l:'Repositórios', d:'código versionado' },
                { n: 7, l:'Bases Supabase', d:'Postgres + Edge Functions' },
                { n: '60+', l:'Integrações ERP', d:'Edge Functions Sankhya' },
                { n: int(new Set(dados.map(d=>d.setor).filter(Boolean)).size), l:'Setores atendidos', d:'da fábrica à diretoria' },
                { n: int(dados.filter(d=>(d.stack||'').includes('Sankhya')).length), l:'Integrados ao ERP', d:'leitura e gravação' },
              ].map((x,i) => (
                <div key={i}>
                  <div style={{ fontSize:30, fontWeight:800, color:'#fff', letterSpacing:'-.03em', lineHeight:1 }}>{x.n}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#facc15', textTransform:'uppercase', letterSpacing:'.1em', marginTop:8 }}>{x.l}</div>
                  <div style={{ fontSize:11, color:'#71717a', marginTop:3 }}>{x.d}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:'#a1a1aa', marginTop:20, lineHeight:1.7, maxWidth:760, borderTop:'1px solid #27272a', paddingTop:16 }}>
              Só o Sistema de Industrialização tem <strong style={{ color:'#fff' }}>60 Edge Functions</strong> em
              produção — funções de backend que conectam o portal ao Sankhya em tempo real ou por sincronização
              programada, sem servidor dedicado. Cobrem remessas, retornos, ordens de produção, saldo de
              almoxarifado, qualidade e manutenção preventiva. É essa camada que transforma os portais em
              plataforma: cada nova demanda reaproveita a integração existente em vez de recomeçar do zero.
            </div>
          </div>
        </div>

        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:'20px 24px' }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.16em', color:'#9CA3AF', textTransform:'uppercase', marginBottom:4 }}>
            Ritmo de entrega
          </div>
          <div style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:14 }}>Projetos concluídos por mês</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porMes} margin={{ top:6, right:10, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
              <Bar dataKey="qtd" fill="#facc15" radius={[6,6,0,0]} name="Entregas" barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:'20px 22px' }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.16em', color:'#9CA3AF', textTransform:'uppercase', marginBottom:4 }}>
              Distribuição
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:14 }}>Por status</div>
            <div style={{ position:'relative' }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={porStatus} dataKey="qtd" nameKey="nome" cx="50%" cy="46%" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
                    {porStatus.map((p,i) => <Cell key={i} fill={COR[p.nome] || '#9CA3AF'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize:12, borderRadius:10, border:'1px solid #E5E7EB' }} />
                  <Legend wrapperStyle={{ fontSize:11 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position:'absolute', top:'40%', left:0, right:0, textAlign:'center',
                transform:'translateY(-50%)', pointerEvents:'none' }}>
                <div style={{ fontSize:32, fontWeight:800, color:'#111827', lineHeight:1 }}>{int(kpi.total)}</div>
                <div style={{ fontSize:9.5, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.12em', marginTop:3 }}>projetos</div>
              </div>
            </div>
          </div>
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:'20px 22px' }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.16em', color:'#9CA3AF', textTransform:'uppercase', marginBottom:4 }}>
              Alcance
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:'#111827', marginBottom:14 }}>Por setor</div>
            <ResponsiveContainer width="100%" height={Math.max(250, porSetor.length*30)}>
              <BarChart data={porSetor} layout="vertical" margin={{ left:8, right:16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize:11, fill:'#374151' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize:12, borderRadius:8 }} />
                <Bar dataKey="qtd" fill="#09090b" radius={[0,6,6,0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </>
      )}

      {fase === 'pronto' && aba === 'economia' && (
        <Economia economia={economia} cfg={cfg} onMudou={carregarEconomia}
          editando={editEco} setEditando={setEditEco} />
      )}

      {detalhe && <DetalheProjeto p={detalhe} onFechar={()=>setDetalhe(null)} />}

      {fase === 'pronto' && aba === 'lista' && (
        <Panel
          title={`Projetos — ${int(lista.length)} de ${int(dados.length)}`}
          action={<div style={{ display:'flex', gap:8 }}>
            <Btn small onClick={exportarCsv}>↓ CSV</Btn>
            <Btn small primary onClick={()=>setEditando('novo')}>+ Novo projeto</Btn>
          </div>}
        >
          {editando && (
            <Form inicial={editando === 'novo' ? null : editando}
              onSalvar={salvar} onCancelar={()=>setEditando(null)} salvando={salvando} />
          )}

          <div style={{ display:'flex', gap:12, marginBottom:12, alignItems:'flex-end', flexWrap:'wrap' }}>
            <SearchInput value={busca} onChange={setBusca} placeholder="Projeto, setor, resumo…" />
            <Select label="Status" value={fStatus} onChange={setFStatus} options={STATUS} placeholder="Todos" />
            <Select label="Tipo" value={fTipo} onChange={setFTipo} options={TIPOS} placeholder="Todos" />
            <Select label="Setor" value={fSetor} onChange={setFSetor} options={setores} placeholder="Todos" />
          </div>

          <div style={{ overflowX:'auto', maxHeight:600, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>
                <th style={th()}>Pedido</th><th style={th()}>Projeto</th><th style={th()}>Setor / quem</th>
                <th style={th()}>Resumo</th><th style={th()}>Início</th><th style={th()}>Prev. enc.</th>
                <th style={th()}>Encerrou</th><th style={th()}>Status</th><th style={th()}>Obs</th><th style={th('right')}></th>
              </tr></thead>
              <tbody>
                {lista.map(p => (
                  <tr key={p.id} style={{ borderTop:'1px solid #F9FAFB' }}>
                    <td style={{ ...cel, whiteSpace:'nowrap', color:'#6B7280' }}>{dBR(p.data_pedido)}</td>
                    <td style={{ ...cel, fontWeight:600, minWidth:170,
                      borderLeft: p.tipo==='Plataforma' ? '3px solid #facc15' : '3px solid transparent' }}>
                      {p.tipo && (
                        <div style={{ display:'inline-block', fontSize:9, fontWeight:800, padding:'2px 7px',
                          borderRadius:4, marginBottom:4, letterSpacing:'.06em',
                          background:(TIPO_ESTILO[p.tipo]||{}).bg, color:(TIPO_ESTILO[p.tipo]||{}).fg }}>
                          {(TIPO_ESTILO[p.tipo]||{}).ic} {p.tipo.toUpperCase()}
                        </div>
                      )}
                      {p.projeto_pai_id && (() => {
                        const pai = dados.find(x => x.id === p.projeto_pai_id)
                        return pai ? <div style={{ fontSize:9.5, color:'#9CA3AF', marginBottom:2 }}>↳ dentro de {pai.nome_projeto}</div> : null
                      })()}
                      <div><span onClick={()=>setDetalhe(p)} style={{ cursor:'pointer', color:'#1D5BBF',
                        fontSize: p.tipo==='Plataforma' ? 14 : 12.5, fontWeight: p.tipo==='Plataforma' ? 700 : 600 }}>
                        {p.nome_projeto}
                        {p.detalhe && <span style={{ marginLeft:6, fontSize:9.5, fontWeight:700, padding:'1px 6px',
                          borderRadius:4, background:'#DBEAFE', color:'#1D5BBF', verticalAlign:'middle' }}>detalhe</span>}
                      </span></div>
                      {p.stack && <div style={{ fontSize:10, color:'#9CA3AF', fontWeight:400, marginTop:2, maxWidth:220 }}>{p.stack}</div>}
                      {p.prioridade && <div style={{ fontSize:10, fontWeight:600, color:'#9CA3AF' }}>{p.prioridade}</div>}
                    </td>
                    <td style={{ ...cel, whiteSpace:'nowrap' }}>
                      {p.setor}{p.solicitante && <div style={{ fontSize:10.5, color:'#9CA3AF' }}>{p.solicitante}</div>}
                    </td>
                    <td style={{ ...cel, maxWidth:240, color:'#6B7280' }}>{p.resumo}</td>
                    <td style={{ ...cel, whiteSpace:'nowrap', color:'#6B7280' }}>{dBR(p.data_inicio)}</td>
                    <td style={{ ...cel, whiteSpace:'nowrap', color:'#6B7280' }}>{dBR(p.prev_encerramento)}</td>
                    <td style={{ ...cel, whiteSpace:'nowrap', color: p.data_encerramento ? '#12805C' : '#9CA3AF', fontWeight: p.data_encerramento ? 600 : 400 }}>
                      {dBR(p.data_encerramento)}</td>
                    <td style={cel}>
                      <span style={{ fontSize:10.5, fontWeight:600, padding:'2px 8px', borderRadius:5, whiteSpace:'nowrap',
                        color: COR[p.status] || '#6B7280', background: (COR[p.status] || '#6B7280') + '18' }}>{p.status}</span>
                    </td>
                    <td style={{ ...cel, maxWidth:180, color:'#9CA3AF', fontSize:11 }}>{p.obs}</td>
                    <td style={{ ...cel, textAlign:'right', whiteSpace:'nowrap' }}>
                      <button onClick={()=>setEditando(p)} style={{ border:'none', background:'none', cursor:'pointer', color:'#1D5BBF', fontSize:11.5, marginRight:8 }}>editar</button>
                      <button onClick={()=>remover(p)} style={{ border:'none', background:'none', cursor:'pointer', color:'#B42318', fontSize:11.5 }}>remover</button>
                    </td>
                  </tr>
                ))}
                {!lista.length && <tr><td colSpan={10} style={{ textAlign:'center', padding:28, color:'#9CA3AF' }}>Nenhum projeto no filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}


const brl = n => new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL', maximumFractionDigits:0 }).format(Number(n)||0)
const brl2 = n => new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL' }).format(Number(n)||0)

// Duas leituras do mesmo trabalho: o custo real de desenvolvimento interno
// e o que a consultoria cobraria se cada demanda virasse um chamado isolado
// (ha um minimo de horas por chamado, entao demandas pequenas custam caro).
function Economia({ economia, cfg, onMudou, editando, setEditando }) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const taxa = Number(cfg.valor_hora_consultoria || 240)
  const minimo = Number(cfg.minimo_horas_chamado || 4)

  const tot = useMemo(() => {
    const hr = economia.reduce((s,e) => s + Number(e.horas_reais||0), 0)
    const ha = economia.reduce((s,e) => s + Number(e.horas_avulso||0), 0)
    return { hr, ha, vr: hr*taxa, va: ha*taxa }
  }, [economia, taxa])

  const hb = Number(cfg.horas_backend_portfolio||0), hf = Number(cfg.horas_frontend_portfolio||0)
  const vb = hb * Number(cfg.valor_hora_backend||0), vf = hf * Number(cfg.valor_hora_frontend||0)
  const ia = Number(cfg.investimento_ia_mensal||0)

  const salvarItem = async (f) => {
    setSalvando(true); setErro('')
    const corpo = { demanda:f.demanda, prioridade:f.prioridade, faixa_tempo:f.faixa_tempo,
      horas_reais:Number(f.horas_reais)||0, horas_avulso:Number(f.horas_avulso)||0, observacao:f.observacao }
    try {
      if (editando === 'novo') await api('POST','automacao_economia', corpo)
      else await api('PATCH',`automacao_economia?id=eq.${editando.id}`, corpo)
      setEditando(null); onMudou()
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }
  const removerItem = async (e2) => {
    if (!window.confirm(`Remover "${e2.demanda}"?`)) return
    try { await api('DELETE',`automacao_economia?id=eq.${e2.id}`); onMudou() } catch (e) { setErro(e.message) }
  }

  const th = a => ({ padding:'8px 10px', background:'#F9FAFB', textAlign:a||'left', fontSize:10,
    fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em',
    borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' })
  const cel = { padding:'7px 10px' }
  const inp = { width:'100%', fontFamily:'inherit', fontSize:12.5, padding:'6px 8px',
    border:'1px solid #E5E7EB', borderRadius:5, boxSizing:'border-box' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {erro && <div style={{ color:'#B42318', fontSize:13 }}>⚠ {erro}</div>}

      {/* Comparativo em destaque: o que custou x o que custaria */}
      <div style={{ background:'#09090b', borderRadius:16, padding:'30px 34px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-70, right:-30, width:280, height:280,
          background:'#10b981', opacity:.09, borderRadius:'50%', filter:'blur(70px)' }} />
        <div style={{ position:'relative' }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.22em', color:'#facc15', textTransform:'uppercase', marginBottom:20 }}>
            Economia gerada
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:36, flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:11, color:'#71717a', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>
                Custaria na consultoria
              </div>
              <div style={{ fontSize:38, fontWeight:800, color:'#71717a', letterSpacing:'-.03em', lineHeight:1, textDecoration:'line-through', textDecorationThickness:2 }}>
                {brl(tot.va)}
              </div>
              <div style={{ fontSize:11.5, color:'#52525b', marginTop:8 }}>{tot.ha}h · mínimo {minimo}h por chamado</div>
            </div>
            <div style={{ fontSize:26, color:'#3f3f46', marginBottom:14 }}>→</div>
            <div>
              <div style={{ fontSize:11, color:'#34d399', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>
                Custo real interno
              </div>
              <div style={{ fontSize:48, fontWeight:800, color:'#fff', letterSpacing:'-.035em', lineHeight:1 }}>
                {brl(tot.vr)}
              </div>
              <div style={{ fontSize:11.5, color:'#71717a', marginTop:8 }}>{tot.hr}h reais × {brl2(taxa)}/h</div>
            </div>
            <div style={{ marginLeft:'auto', background:'#052e1f', border:'1px solid #065f46',
              borderRadius:14, padding:'18px 26px', textAlign:'center' }}>
              <div style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.16em', color:'#34d399', textTransform:'uppercase', marginBottom:8 }}>
                Deixou de gastar
              </div>
              <div style={{ fontSize:34, fontWeight:800, color:'#34d399', letterSpacing:'-.03em', lineHeight:1 }}>
                {brl(tot.va - tot.vr)}
              </div>
              <div style={{ fontSize:10.5, color:'#059669', marginTop:6 }}>
                {tot.va > 0 ? Math.round((1 - tot.vr/tot.va)*100) : 0}% abaixo do orçamento externo
              </div>
            </div>
          </div>
        </div>
      </div>

      <Panel title={`Demandas Sankhya — ${int(economia.length)}`}
        action={<Btn small primary onClick={()=>setEditando('novo')}>+ Nova demanda</Btn>}>
        <p style={{ margin:'0 0 12px', fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
          Cada linha é uma demanda que teria virado chamado na consultoria. A coluna <strong>horas reais</strong> é
          o tempo efetivamente gasto; a <strong>avulso</strong> aplica o mínimo de {minimo}h por chamado, que é
          como a cobrança funcionaria na prática.
        </p>

        {editando && (
          <FormEco inicial={editando === 'novo' ? null : editando}
            onSalvar={salvarItem} onCancelar={()=>setEditando(null)} salvando={salvando} />
        )}

        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr>
              <th style={th()}>Demanda</th><th style={th()}>Prioridade</th><th style={th()}>Faixa estimada</th>
              <th style={th('right')}>Horas reais</th><th style={th('right')}>Custo real</th>
              <th style={th('right')}>Horas avulso</th><th style={th('right')}>Custo avulso</th><th style={th('right')}></th>
            </tr></thead>
            <tbody>
              {economia.map(e => (
                <tr key={e.id} style={{ borderTop:'1px solid #F9FAFB' }}>
                  <td style={{ ...cel, fontWeight:600 }}>{e.demanda}</td>
                  <td style={cel}><span style={{ fontSize:10.5, fontWeight:600, padding:'2px 7px', borderRadius:4,
                    background:'#F3F4F6', color:'#374151' }}>{e.prioridade}</span></td>
                  <td style={{ ...cel, color:'#9CA3AF' }}>{e.faixa_tempo}</td>
                  <td style={{ ...cel, textAlign:'right', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{e.horas_reais}h</td>
                  <td style={{ ...cel, textAlign:'right', color:'#12805C', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{brl2(e.horas_reais*taxa)}</td>
                  <td style={{ ...cel, textAlign:'right', color:'#6B7280', fontVariantNumeric:'tabular-nums' }}>{e.horas_avulso}h</td>
                  <td style={{ ...cel, textAlign:'right', color:'#6B7280', fontVariantNumeric:'tabular-nums' }}>{brl2(e.horas_avulso*taxa)}</td>
                  <td style={{ ...cel, textAlign:'right', whiteSpace:'nowrap' }}>
                    <button onClick={()=>setEditando(e)} style={{ border:'none', background:'none', cursor:'pointer', color:'#1D5BBF', fontSize:11.5, marginRight:8 }}>editar</button>
                    <button onClick={()=>removerItem(e)} style={{ border:'none', background:'none', cursor:'pointer', color:'#B42318', fontSize:11.5 }}>remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ borderTop:'2px solid #E5E7EB', background:'#F9FAFB' }}>
              <td colSpan={3} style={{ ...cel, fontWeight:700 }}>Total</td>
              <td style={{ ...cel, textAlign:'right', fontWeight:700 }}>{tot.hr}h</td>
              <td style={{ ...cel, textAlign:'right', fontWeight:700, color:'#12805C' }}>{brl(tot.vr)}</td>
              <td style={{ ...cel, textAlign:'right', fontWeight:700 }}>{tot.ha}h</td>
              <td style={{ ...cel, textAlign:'right', fontWeight:700, color:'#6B7280' }}>{brl(tot.va)}</td>
              <td/></tr></tfoot>
          </table>
        </div>
      </Panel>

      <Panel title="Estimativa do portfólio completo">
        <p style={{ margin:'0 0 14px', fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
          Diferente do quadro acima: aqui é uma <strong>ordem de grandeza</strong> do esforço total de todos os
          projetos, calculada por porte, não por hora cronometrada. Serve pra dimensionar o tamanho do que foi
          entregue — não como valor de cobrança.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {[
            { l:'Back-end / integrações', h:hb, v:vb, t:`${brl2(cfg.valor_hora_backend||0)}/h`, c:'#1D5BBF' },
            { l:'Front-end / UX', h:hf, v:vf, t:`${brl2(cfg.valor_hora_frontend||0)}/h`, c:'#7C3AED' },
            { l:'Total estimado', h:hb+hf, v:vb+vf, t:'ordem de grandeza', c:'#101828' },
          ].map((k,i) => (
            <div key={i} style={{
              background: i===2 ? '#facc15' : (i===0 ? '#09090b' : '#F3F4F6'),
              borderRadius:14, padding:'20px 22px',
              border: i===1 ? '1px solid #E5E7EB' : 'none' }}>
              <div style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.16em', textTransform:'uppercase', marginBottom:10,
                color: i===2 ? '#78350f' : (i===0 ? '#71717a' : '#6B7280') }}>{k.l}</div>
              <div style={{ fontSize:32, fontWeight:800, letterSpacing:'-.03em', lineHeight:1,
                color: i===2 ? '#422006' : (i===0 ? '#fff' : '#111827') }}>~{k.h}h</div>
              <div style={{ fontSize:15, fontWeight:700, marginTop:8,
                color: i===2 ? '#78350f' : (i===0 ? '#d4d4d8' : '#374151') }}>{brl(k.v)}</div>
              <div style={{ fontSize:10.5, marginTop:4,
                color: i===2 ? '#92400e' : (i===0 ? '#52525b' : '#9CA3AF') }}>{k.t}</div>
            </div>
          ))}
        </div>
      </Panel>

      {ia > 0 && (
        <div style={{ background:'#fff', border:'1px dashed #D1D5DB', borderRadius:10, padding:'16px 20px', fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
          <strong style={{ color:'#374151' }}>Nota de transparência:</strong> as ferramentas de IA usadas para
          construir estas automações são custeadas pelo próprio analista — {brl2(ia)}/mês. Esse valor não está
          descontado dos números acima, que refletem apenas horas de desenvolvimento que a empresa deixou de contratar.
        </div>
      )}
    </div>
  )
}

function FormEco({ inicial, onSalvar, onCancelar, salvando }) {
  const [f, setF] = useState({ demanda:'', prioridade:'Média', faixa_tempo:'', horas_reais:'', horas_avulso:'', observacao:'', ...inicial })
  const set = (k,v) => setF(s => ({ ...s, [k]: v }))
  const inp = { width:'100%', fontFamily:'inherit', fontSize:13, padding:'8px 10px',
    border:'1px solid #E5E7EB', borderRadius:6, boxSizing:'border-box', marginTop:4 }
  const lbl = { fontSize:11, color:'#6B7280', fontWeight:600, display:'block' }
  return (
    <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:10, padding:16, marginBottom:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:12 }}>
        <label style={lbl}>Demanda *<input style={inp} value={f.demanda} onChange={e=>set('demanda',e.target.value)} autoFocus /></label>
        <label style={lbl}>Prioridade
          <select style={inp} value={f.prioridade||'Média'} onChange={e=>set('prioridade',e.target.value)}>
            {['Altíssima','Alta','Média-Alta','Média','Baixa'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label style={lbl}>Faixa estimada<input style={inp} value={f.faixa_tempo||''} onChange={e=>set('faixa_tempo',e.target.value)} placeholder="2h a 3h" /></label>
        <label style={lbl}>Horas reais<input type="number" step="0.25" style={inp} value={f.horas_reais} onChange={e=>set('horas_reais',e.target.value)} /></label>
        <label style={lbl}>Horas avulso<input type="number" step="0.25" style={inp} value={f.horas_avulso} onChange={e=>set('horas_avulso',e.target.value)} /></label>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:14 }}>
        <Btn primary onClick={()=>onSalvar(f)} disabled={salvando || !f.demanda.trim()}>{salvando?'Salvando…':'Salvar'}</Btn>
        <Btn onClick={onCancelar} disabled={salvando}>Cancelar</Btn>
      </div>
    </div>
  )
}


// Painel lateral com tudo que se sabe do projeto: metricas, modulos,
// integracoes e pendencias. Alimentado pelo campo `detalhe` (jsonb).
function DetalheProjeto({ p, onFechar }) {
  const d = p.detalhe || {}
  const [vista, setVista] = useState('inventario')
  const [ganhos, setGanhos] = useState([])
  const [aceites, setAceites] = useState([])
  const recarregar = () => {
    sbFetch(`automacao_ganhos?select=*&projeto_id=eq.${p.id}&order=criado_em`).then(r=>setGanhos(r||[])).catch(()=>{})
    sbFetch(`automacao_aceite?select=*&projeto_id=eq.${p.id}&order=assinado_em.desc`).then(r=>setAceites(r||[])).catch(()=>{})
  }
  useEffect(() => { recarregar() }, [p.id])
  const linha = (l, v) => v ? (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.14em', color:'#71717a', textTransform:'uppercase', marginBottom:4 }}>{l}</div>
      <div style={{ fontSize:13, color:'#e4e4e7', lineHeight:1.6 }}>{v}</div>
    </div>
  ) : null

  return (
    <>
      <div onClick={onFechar} style={{ position:'fixed', inset:0, background:'rgba(9,9,11,.6)', zIndex:70 }} />
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'min(720px,94vw)', background:'#09090b',
        zIndex:71, overflowY:'auto', boxShadow:'-20px 0 60px rgba(0,0,0,.4)' }}>

        <div style={{ position:'sticky', top:0, background:'#09090b', borderBottom:'1px solid #27272a',
          padding:'22px 28px', zIndex:2 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
            <div>
              <div style={{ fontSize:9.5, fontWeight:800, letterSpacing:'.2em', color:'#facc15', textTransform:'uppercase', marginBottom:8 }}>
                {p.setor || 'Projeto'}
              </div>
              <div style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-.02em' }}>{p.nome_projeto}</div>
              <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 10px', borderRadius:5,
                  color:'#09090b', background: COR[p.status] || '#a1a1aa' }}>{p.status}</span>
                {p.prioridade && <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 10px', borderRadius:5,
                  color:'#a1a1aa', background:'#27272a' }}>{p.prioridade}</span>}
                {p.repositorio && <span style={{ fontSize:10.5, fontWeight:600, padding:'3px 10px', borderRadius:5,
                  color:'#71717a', background:'#18181b', fontFamily:'monospace' }}>{p.repositorio}</span>}
              </div>
            </div>
            <button onClick={onFechar} style={{ background:'none', border:'none', color:'#71717a',
              fontSize:22, cursor:'pointer', lineHeight:1, padding:4 }}>×</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:6, padding:'14px 28px 0' }}>
          {[['inventario','Inventário'],['ganhos','Ganhos & Aceite']].map(([id,rot]) => (
            <button key={id} onClick={()=>setVista(id)} style={{
              fontSize:12, padding:'7px 16px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              border:'none', background: vista===id?'#facc15':'#18181b',
              color: vista===id?'#09090b':'#a1a1aa', fontWeight:700 }}>{rot}</button>
          ))}
        </div>

        {vista === 'ganhos' && <GanhosAceite p={p} ganhos={ganhos} aceites={aceites} onMudou={recarregar} />}

        <div style={{ padding:'24px 28px', display: vista==='inventario' ? 'block' : 'none' }}>
          {Array.isArray(d.metricas) && d.metricas.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:26 }}>
              {d.metricas.map((m,i) => (
                <div key={i} style={{ background:'#18181b', border:'1px solid #27272a', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:24, fontWeight:800, color:'#facc15', lineHeight:1 }}>{m.n}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#71717a', textTransform:'uppercase', letterSpacing:'.1em', marginTop:6 }}>{m.l}</div>
                </div>
              ))}
            </div>
          )}

          {linha('Resumo', p.resumo)}
          {linha('Benefício', p.beneficio)}
          {linha('Stack', p.stack)}
          {linha('Solicitante', p.solicitante)}
          {linha('Observações', p.obs)}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, margin:'18px 0 26px' }}>
            {[['Pedido',p.data_pedido],['Início',p.data_inicio],['Prev. encerramento',p.prev_encerramento],['Encerramento',p.data_encerramento]]
              .filter(([,v])=>v).map(([l,v]) => (
              <div key={l} style={{ background:'#18181b', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:9.5, fontWeight:700, color:'#71717a', textTransform:'uppercase', letterSpacing:'.1em' }}>{l}</div>
                <div style={{ fontSize:13, color:'#e4e4e7', marginTop:3 }}>{dBR(v)}</div>
              </div>
            ))}
          </div>

          {Array.isArray(d.secoes) && d.secoes.map((sec,i) => (
            <div key={i} style={{ marginBottom:22 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'#facc15', textTransform:'uppercase',
                letterSpacing:'.14em', marginBottom:10, paddingBottom:8, borderBottom:'1px solid #27272a' }}>
                {sec.titulo}
                <span style={{ marginLeft:8, color:'#52525b', fontWeight:600 }}>{(sec.itens||[]).length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {(sec.itens||[]).map((it,j) => {
                  const [t1, ...resto] = String(it).split(' — ')
                  return (
                    <div key={j} style={{ display:'flex', gap:10, fontSize:12.5, lineHeight:1.55 }}>
                      <span style={{ color:'#3f3f46', flexShrink:0 }}>▸</span>
                      <span>
                        <strong style={{ color:'#fafafa' }}>{t1}</strong>
                        {resto.length > 0 && <span style={{ color:'#a1a1aa' }}> — {resto.join(' — ')}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {!d.secoes && (
            <div style={{ background:'#18181b', border:'1px dashed #3f3f46', borderRadius:10,
              padding:'20px', fontSize:12.5, color:'#71717a', lineHeight:1.6, textAlign:'center' }}>
              Este projeto ainda não tem o inventário detalhado.<br/>
              Rode o prompt de levantamento no portal dele e me envie o resultado.
            </div>
          )}
        </div>
      </div>
    </>
  )
}


const FREQ = { 'Diária':22, 'Semanal':4.33, 'Mensal':1, 'Anual':0.0833, 'Por ocorrência':1 }
const horasMes = g => ((Number(g.min_antes)-Number(g.min_depois)) * Number(g.ocorrencias) * (FREQ[g.frequencia]||1)) / 60

// Onde o responsavel da area declara o que mudou e assina. O total de horas
// nunca e digitado: sai do calculo tarefa a tarefa, para o documento ter
// rastreabilidade de como se chegou ao numero.
function GanhosAceite({ p, ganhos, aceites, onMudou }) {
  const [nova, setNova] = useState({ tarefa:'', frequencia:'Diária', ocorrencias:1, min_antes:'', min_depois:'', quem_executava:'', colaborador:'', eliminada:false, fonte_medicao:'' })
  const [fontes, setFontes] = useState([])
  useEffect(() => { sbFetch('automacao_medicao?select=*&order=eventos.desc').then(r=>setFontes(r||[])).catch(()=>{}) }, [])
  const fonteDe = k => fontes.find(f => f.fonte === k)
  const [ass, setAss] = useState({ nome_assinante:'', cargo:'', setor:p.setor||'', email:'', declaracao:'', assinatura:'' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Quando a tarefa tem fonte, a economia vem do volume real contado no banco.
  // Sem fonte, cai na estimativa declarada pelo responsável.
  // eventos    = acumulado desde o início da medição
  // eventos_mes = ritmo mensal — é ele que entra no total/mês, senão o
  //               acumulado seria somado como se fosse de um mês só.
  const horasMedidas = g => {
    const f = fonteDe(g.fonte_medicao)
    if (!f) return null
    return ((Number(g.min_antes)-Number(g.min_depois)) * Number(f.eventos)) / 60
  }
  const horasMedidasMes = g => {
    const f = fonteDe(g.fonte_medicao)
    if (!f || f.eventos_mes == null) return null
    return ((Number(g.min_antes)-Number(g.min_depois)) * Number(f.eventos_mes)) / 60
  }
  // medido tem prioridade sobre a estimativa (mesma regra da view automacao_ganhos_resumo)
  const horasMesEfetiva = g => horasMedidasMes(g) ?? horasMes(g)

  const totalMes = ganhos.reduce((s,g) => s + horasMesEfetiva(g), 0)
  const totalAno = totalMes * 12
  const totalMedido = ganhos.reduce((s,g) => s + (horasMedidas(g) || 0), 0)
  const qtdMedidas = ganhos.filter(g => horasMedidas(g) != null).length
  const eliminadas = ganhos.filter(g => g.eliminada).length

  const addTarefa = async () => {
    if (!nova.tarefa.trim()) return
    setSalvando(true); setErro('')
    try {
      await api('POST','automacao_ganhos', { ...nova, projeto_id: p.id,
        ocorrencias:Number(nova.ocorrencias)||1, min_antes:Number(nova.min_antes)||0,
        min_depois:Number(nova.min_depois)||0, fonte_medicao: nova.fonte_medicao || null })
      setNova({ tarefa:'', frequencia:'Diária', ocorrencias:1, min_antes:'', min_depois:'', quem_executava:'', colaborador:'', eliminada:false, fonte_medicao:'' })
      onMudou()
    } catch(e){ setErro(e.message) } finally { setSalvando(false) }
  }
  const delTarefa = async (g) => {
    if (!window.confirm(`Remover "${g.tarefa}"?`)) return
    try { await api('DELETE',`automacao_ganhos?id=eq.${g.id}`); onMudou() } catch(e){ setErro(e.message) }
  }
  const assinar = async () => {
    if (!ass.nome_assinante.trim() || !ass.assinatura.trim()) { setErro('Preencha o nome e a assinatura.'); return }
    if (ass.assinatura.trim().toLowerCase() !== ass.nome_assinante.trim().toLowerCase()) {
      setErro('A assinatura precisa ser exatamente o nome informado.'); return
    }
    setSalvando(true); setErro('')
    try { await api('POST','automacao_aceite', { ...ass, projeto_id:p.id }); onMudou()
      setAss({ nome_assinante:'', cargo:'', setor:p.setor||'', email:'', declaracao:'', assinatura:'' })
    } catch(e){ setErro(e.message) } finally { setSalvando(false) }
  }

  const inp = { width:'100%', fontFamily:'inherit', fontSize:12.5, padding:'7px 9px', border:'1px solid #3f3f46',
    borderRadius:6, boxSizing:'border-box', background:'#18181b', color:'#fafafa', marginTop:3 }
  const lbl = { fontSize:9.5, fontWeight:700, color:'#71717a', textTransform:'uppercase', letterSpacing:'.1em', display:'block' }
  const btn = (cor='#facc15', fg='#09090b') => ({ padding:'8px 16px', borderRadius:7, border:'none',
    background:cor, color:fg, fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' })

  return (
    <div style={{ padding:'20px 28px 40px' }}>
      {erro && <div style={{ background:'#450a0a', color:'#fca5a5', padding:'9px 12px', borderRadius:7, fontSize:12, marginBottom:14 }}>⚠ {erro}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:22 }}>
        {[['Tarefas mapeadas', ganhos.length],['Eliminadas', eliminadas],
          ['Horas/mês', totalMes.toFixed(1)]].map(([l,v],i) => (
          <div key={i} style={{ background:'#18181b', border:'1px solid #27272a', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:24, fontWeight:800, color:'#facc15', lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:9.5, fontWeight:700, color:'#71717a', textTransform:'uppercase', letterSpacing:'.1em', marginTop:6 }}>{l}</div>
          </div>
        ))}
      </div>
      {totalMedido > 0 && (
        <div style={{ background:'#052e1f', border:'1px solid #10b981', borderRadius:12, padding:'18px 20px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
            <div>
              <div style={{ fontSize:9.5, fontWeight:800, color:'#34d399', textTransform:'uppercase', letterSpacing:'.14em' }}>
                Economia medida · volume real
              </div>
              <div style={{ fontSize:34, fontWeight:800, color:'#34d399', marginTop:6, lineHeight:1 }}>
                {totalMedido.toFixed(0)} horas
              </div>
              <div style={{ fontSize:11.5, color:'#059669', marginTop:6 }}>
                acumuladas desde o início · {qtdMedidas} tarefa(s) com contagem automática
              </div>
            </div>
            <div style={{ background:'#064e3b', borderRadius:9, padding:'10px 14px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:800, color:'#a7f3d0' }}>{(totalMedido/8).toFixed(0)}</div>
              <div style={{ fontSize:9, color:'#059669', textTransform:'uppercase', letterSpacing:'.1em', marginTop:2 }}>dias úteis</div>
            </div>
          </div>
        </div>
      )}

      {totalAno > 0 && (
        <div style={{ background:'#052e1f', border:'1px solid #065f46', borderRadius:12, padding:'16px 20px', marginBottom:24 }}>
          <div style={{ fontSize:9.5, fontWeight:800, color:'#34d399', textTransform:'uppercase', letterSpacing:'.14em' }}>Projeção anual · {qtdMedidas > 0 ? 'volume real medido' : 'estimativa declarada'}</div>
          <div style={{ fontSize:30, fontWeight:800, color:'#34d399', marginTop:6, lineHeight:1 }}>{totalAno.toFixed(0)} horas</div>
          <div style={{ fontSize:11.5, color:'#059669', marginTop:6 }}>equivale a {(totalAno/8).toFixed(0)} dias de trabalho por ano</div>
        </div>
      )}

      <div style={{ fontSize:11, fontWeight:800, color:'#facc15', textTransform:'uppercase', letterSpacing:'.14em',
        marginBottom:10, paddingBottom:8, borderBottom:'1px solid #27272a' }}>Tarefas impactadas</div>

      {ganhos.map(g => (
        <div key={g.id} style={{ background:'#18181b', borderRadius:9, padding:'11px 14px', marginBottom:8,
          display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#fafafa' }}>
              {g.tarefa}
              {g.eliminada && <span style={{ marginLeft:8, fontSize:9.5, fontWeight:700, padding:'2px 7px',
                borderRadius:4, background:'#052e1f', color:'#34d399' }}>eliminada</span>}
              {g.fonte_medicao && <span style={{ marginLeft:6, fontSize:9.5, fontWeight:700, padding:'2px 7px',
                borderRadius:4, background:'#1e3a5f', color:'#93c5fd' }}
                title={fonteDe(g.fonte_medicao)?.descricao}>📊 contagem automática</span>}
            </div>
            <div style={{ fontSize:11, color:'#71717a', marginTop:3 }}>
              {g.frequencia} · {g.ocorrencias}× · {g.min_antes}min → {g.min_depois}min
              {g.quem_executava && ` · ${g.quem_executava}`}
            </div>
          </div>
          <div style={{ textAlign:'right', minWidth:104 }}>
            {horasMedidasMes(g) != null ? (
              <>
                <div style={{ fontSize:16, fontWeight:800, color:'#34d399' }}>{horasMedidasMes(g).toFixed(1)}h</div>
                <div style={{ fontSize:9, color:'#059669', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>
                  medido / mês
                </div>
                <div style={{ fontSize:9, color:'#52525b', marginTop:2 }}>
                  {horasMedidas(g).toFixed(0)}h acum. · {Number(fonteDe(g.fonte_medicao).eventos).toLocaleString('pt-BR')}×
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:15, fontWeight:700, color:'#a1a1aa' }}>{horasMes(g).toFixed(1)}h</div>
                <div style={{ fontSize:9, color:'#52525b' }}>estimado / mês</div>
              </>
            )}
          </div>
          <button onClick={()=>delTarefa(g)} style={{ background:'none', border:'none', color:'#7f1d1d', cursor:'pointer', fontSize:11 }}>remover</button>
        </div>
      ))}

      <div style={{ background:'#18181b', border:'1px dashed #3f3f46', borderRadius:10, padding:16, marginTop:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:10 }}>
          <label style={lbl}>Tarefa<input style={inp} value={nova.tarefa} onChange={e=>setNova({...nova,tarefa:e.target.value})} placeholder="Ex: Conferir pedidos no ERP" /></label>
          <label style={lbl}>Frequência
            <select style={inp} value={nova.frequencia} onChange={e=>setNova({...nova,frequencia:e.target.value})}>
              {Object.keys(FREQ).map(f=><option key={f}>{f}</option>)}</select></label>
          <label style={lbl}>Vezes por período<input type="number" step="0.5" style={inp} value={nova.ocorrencias} onChange={e=>setNova({...nova,ocorrencias:e.target.value})} /></label>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10 }}>
          <label style={lbl}>Minutos ANTES<input type="number" style={inp} value={nova.min_antes} onChange={e=>setNova({...nova,min_antes:e.target.value})} /></label>
          <label style={lbl}>Minutos DEPOIS<input type="number" style={inp} value={nova.min_depois} onChange={e=>setNova({...nova,min_depois:e.target.value})} placeholder="0 se eliminou" /></label>
          <label style={lbl}>Quem executava<input style={inp} value={nova.quem_executava} onChange={e=>setNova({...nova,quem_executava:e.target.value})} /></label>
          <label style={lbl}>Colaborador<input style={inp} value={nova.colaborador} onChange={e=>setNova({...nova,colaborador:e.target.value})} placeholder="nome" /></label>
        </div>
        <label style={{...lbl, marginTop:10, display:'block'}}>Contagem automática (opcional)
          <select style={inp} value={nova.fonte_medicao} onChange={e=>setNova({...nova,fonte_medicao:e.target.value})}>
            <option value="">Sem contagem — usar a estimativa acima</option>
            {fontes.map(f => (
              <option key={f.fonte} value={f.fonte}>
                {f.descricao} — {Number(f.eventos).toLocaleString('pt-BR')} desde {f.desde ? new Date(f.desde+'T00:00').toLocaleDateString('pt-BR') : '—'}
              </option>
            ))}
          </select>
        </label>
        {nova.fonte_medicao && Number(nova.min_antes) > 0 && (
          <div style={{ background:'#052e1f', borderRadius:7, padding:'9px 12px', marginTop:8, fontSize:12, color:'#34d399' }}>
            Com o volume atual, isso daria <strong>
            {(((Number(nova.min_antes)-Number(nova.min_depois||0)) * Number(fonteDe(nova.fonte_medicao)?.eventos||0))/60).toFixed(1)}h
            </strong> economizadas até agora
            {fonteDe(nova.fonte_medicao)?.eventos_mes != null && <>
              {' '}(ritmo de <strong>
              {(((Number(nova.min_antes)-Number(nova.min_depois||0)) * Number(fonteDe(nova.fonte_medicao).eventos_mes))/60).toFixed(1)}h/mês
              </strong>)
            </>} — e o número cresce sozinho a cada execução.
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
          <label style={{ fontSize:12, color:'#a1a1aa', display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
            <input type="checkbox" checked={nova.eliminada} onChange={e=>setNova({...nova,eliminada:e.target.checked})} />
            A tarefa deixou de existir
          </label>
          <button onClick={addTarefa} disabled={salvando || !nova.tarefa.trim()} style={btn()}>+ Adicionar tarefa</button>
        </div>
      </div>

      <div style={{ fontSize:11, fontWeight:800, color:'#facc15', textTransform:'uppercase', letterSpacing:'.14em',
        margin:'28px 0 10px', paddingBottom:8, borderBottom:'1px solid #27272a' }}>Aceite do responsável</div>

      {aceites.map(a => (
        <div key={a.id} style={{ background:'#052e1f', border:'1px solid #065f46', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#34d399' }}>✓ {a.nome_assinante}</div>
          <div style={{ fontSize:11.5, color:'#059669', marginTop:3 }}>
            {[a.cargo, a.setor].filter(Boolean).join(' · ')} — assinado em {new Date(a.assinado_em).toLocaleString('pt-BR')}
          </div>
          {a.declaracao && <div style={{ fontSize:12, color:'#a7f3d0', marginTop:8, fontStyle:'italic' }}>"{a.declaracao}"</div>}
        </div>
      ))}

      <div style={{ background:'#18181b', border:'1px dashed #3f3f46', borderRadius:10, padding:16 }}>
        <div style={{ fontSize:12, color:'#a1a1aa', lineHeight:1.6, marginBottom:14 }}>
          Ao assinar, o responsável confirma que a automação está em uso na área e que os ganhos
          declarados acima refletem a realidade da operação.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <label style={lbl}>Nome completo *<input style={inp} value={ass.nome_assinante} onChange={e=>setAss({...ass,nome_assinante:e.target.value})} /></label>
          <label style={lbl}>Cargo<input style={inp} value={ass.cargo} onChange={e=>setAss({...ass,cargo:e.target.value})} /></label>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <label style={lbl}>Setor<input style={inp} value={ass.setor} onChange={e=>setAss({...ass,setor:e.target.value})} /></label>
          <label style={lbl}>E-mail<input style={inp} value={ass.email} onChange={e=>setAss({...ass,email:e.target.value})} /></label>
        </div>
        <label style={lbl}>Declaração / comentário
          <textarea style={{...inp, minHeight:54, resize:'vertical'}} value={ass.declaracao} onChange={e=>setAss({...ass,declaracao:e.target.value})}
            placeholder="O que mudou na rotina da área" /></label>
        <label style={{...lbl, marginTop:10, display:'block'}}>Assinatura — digite seu nome exatamente como acima *
          <input style={{...inp, fontFamily:'Georgia, serif', fontSize:17, fontStyle:'italic'}}
            value={ass.assinatura} onChange={e=>setAss({...ass,assinatura:e.target.value})} /></label>
        <button onClick={assinar} disabled={salvando} style={{...btn('#34d399','#052e1f'), marginTop:14}}>
          {salvando ? 'Registrando…' : '✓ Assinar aceite'}
        </button>
      </div>

      <button onClick={()=>window.print()} style={{...btn('#27272a','#fafafa'), marginTop:20, width:'100%'}}>
        🖨 Gerar documento (imprimir / salvar em PDF)
      </button>
    </div>
  )
}
