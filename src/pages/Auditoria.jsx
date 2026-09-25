import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, int, dBR } from '../config.js'
import { Panel, Btn, Spinner, SearchInput, Select } from '../components/UI.jsx'

const SYNC_KEY = 'kb2026sync!'

const TIPO_INFO = {
  I: { rot: 'Inclusão', cor: '#12805C', bg: '#D1FAE5' },
  U: { rot: 'Alteração', cor: '#B54708', bg: '#FEF3C7' },
  D: { rot: 'Exclusão', cor: '#B42318', bg: '#FEE2E2' },
}

function hojeISO() { return new Date().toISOString().slice(0,10) }
function diasAtrasISO(n) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10) }
function isoParaBR(iso) { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
function dataHoraBR(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

async function chamarSync(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auditoria-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ ...payload, _key: SYNC_KEY }),
  })
  return res.json()
}

// Quebra o periodo em janelas de ate 5 dias - a funcao de sincronizacao do
// backend pode dar timeout em janelas maiores (limite pratico descoberto)
function gerarJanelas(dtIniISO, dtFimISO, tamanho = 5) {
  const janelas = []
  let cursor = new Date(dtIniISO)
  const fim = new Date(dtFimISO)
  while (cursor <= fim) {
    const fimJanela = new Date(cursor)
    fimJanela.setDate(fimJanela.getDate() + tamanho - 1)
    if (fimJanela > fim) fimJanela.setTime(fim.getTime())
    janelas.push({ ini: cursor.toISOString().slice(0,10), fim: fimJanela.toISOString().slice(0,10) })
    cursor = new Date(fimJanela); cursor.setDate(cursor.getDate() + 1)
  }
  return janelas
}

function LinhaExpandida({ linha, dicCampos }) {
  const campos = linha.campos_alterados
  if (!campos || !campos.length) {
    return <div style={{ padding:'10px 16px', fontSize:12, color:'#9CA3AF', background:'#FAFAFA' }}>
      Sem detalhe de campos disponível para este registro.
    </div>
  }
  return (
    <div style={{ padding:'10px 16px', background:'#FAFAFA', borderTop:'1px solid #F3F4F6' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr>
            {['Campo','Valor anterior','Valor novo'].map(h => (
              <th key={h} style={{ textAlign:'left', padding:'4px 8px', color:'#6B7280', fontSize:10.5, textTransform:'uppercase', letterSpacing:'.03em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campos.filter(c => c.campo !== 'DTALTER').map((c,i) => {
            const descricao = dicCampos[`${linha.tabela}::${c.campo}`]
            return (
              <tr key={i} style={{ borderTop:'1px solid #F3F4F6' }}>
                <td style={{ padding:'4px 8px' }}>
                  <div style={{ fontWeight:600 }}>{descricao || c.campo}</div>
                  {descricao && <div style={{ fontSize:10.5, color:'#9CA3AF' }}>{c.campo}</div>}
                </td>
                <td style={{ padding:'4px 8px', color:'#B42318', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={String(c.valor_antigo ?? '')}>{String(c.valor_antigo ?? '') || '—'}</td>
                <td style={{ padding:'4px 8px', color:'#12805C', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={String(c.valor_novo ?? '')}>{String(c.valor_novo ?? '') || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TabelaLinhas({ linhas, dicCampos, expandido, setExpandido, mensagemVazio }) {
  return (
    <div style={{ maxHeight:600, overflow:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
        <thead>
          <tr>
            {['','Data/Hora','Usuário','Tipo','Tabela','Registro alterado'].map(h => (
              <th key={h} style={{
                position:'sticky', top:0, background:'#F9FAFB', padding:'8px 12px', textAlign:'left',
                fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em',
                borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(d => {
            const tipoInfo = TIPO_INFO[d.tipo] || { rot:d.tipo, cor:'#6B7280', bg:'#F3F4F6' }
            const aberto = expandido === d.id
            return (
              <React.Fragment key={d.id}>
                <tr
                  onClick={() => setExpandido(aberto ? null : d.id)}
                  style={{
                    borderTop:'1px solid #F9FAFB', cursor:'pointer',
                    background: d.tipo === 'D' ? '#FFFBFB' : 'transparent',
                  }}
                >
                  <td style={{ padding:'7px 10px', color:'#9CA3AF', width:20 }}>{aberto ? '▾' : '▸'}</td>
                  <td style={{ padding:'7px 12px', whiteSpace:'nowrap', color:'#6B7280' }}>{dataHoraBR(d.data_hora)}</td>
                  <td style={{ padding:'7px 12px', fontWeight:600 }}>{d.username}</td>
                  <td style={{ padding:'7px 12px' }}>
                    <span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:600, color:tipoInfo.cor, background:tipoInfo.bg }}>
                      {tipoInfo.rot}
                    </span>
                  </td>
                  <td style={{ padding:'7px 12px' }}>{d.tabela}<span style={{ color:'#9CA3AF' }}> · {d.instancia}</span></td>
                  <td style={{ padding:'7px 12px', color:'#6B7280', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={d.chave}>{d.chave}</td>
                </tr>
                {aberto && (
                  <tr>
                    <td colSpan={6} style={{ padding:0 }}>
                      <LinhaExpandida linha={d} dicCampos={dicCampos} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
          {!linhas.length && (
            <tr><td colSpan={6} style={{ textAlign:'center', padding:'32px', color:'#9CA3AF' }}>
              {mensagemVazio}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function Auditoria() {
  const [dtIni, setDtIni] = useState(diasAtrasISO(7))
  const [dtFim, setDtFim] = useState(hojeISO())
  const [dados, setDados] = useState([])
  const [dicCampos, setDicCampos] = useState({})
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fTabela, setFTabela] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [mostrarSistema, setMostrarSistema] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [msgSync, setMsgSync] = useState('')

  const [buscaChave, setBuscaChave] = useState('')
  const [resultadoChave, setResultadoChave] = useState(null)
  const [buscandoChave, setBuscandoChave] = useState(false)
  const [dicCamposChave, setDicCamposChave] = useState({})

  // Sub-aba de exclusões: o que foi APAGADO no Sankhya. A auditoria de
  // modificações mostra o que mudou; exclusão é o registro que some, e
  // por isso mora em tabela espelho separada (TGFITE_EXC / TGFCAB_EXC).
  const [subAba, setSubAba] = useState('modificacoes')
  const [exclusoes, setExclusoes] = useState([])
  const [excPorUsuario, setExcPorUsuario] = useState([])
  const [carregandoExc, setCarregandoExc] = useState(false)
  const [fUsuario, setFUsuario] = useState('')
  const [fTipmov, setFTipmov] = useState('')
  const [fSoDoc, setFSoDoc] = useState(false)
  const [buscaExc, setBuscaExc] = useState('')

  const carregarExclusoes = async () => {
    if (exclusoes.length || carregandoExc) return
    setCarregandoExc(true)
    try {
      const PASSO = 1000
      let todas = []
      for (let de = 0; ; de += PASSO) {
        const d = await sbFetch(
          `exclusao_sankhya?select=*&order=dh_exclusao.desc&offset=${de}&limit=${PASSO}`)
        todas = todas.concat(d || [])
        if (!d || d.length < PASSO) break
        if (todas.length > 20000) break
      }
      setExclusoes(todas)
      setExcPorUsuario(await sbFetch('exclusao_por_usuario?select=*') || [])
    } catch (e) { setErro(e.message) }
    setCarregandoExc(false)
  }

  useEffect(() => { if (subAba === 'exclusoes') carregarExclusoes() }, [subAba])

  const excFiltradas = useMemo(() => exclusoes.filter(e => {
    if (fUsuario && e.usuario !== fUsuario) return false
    if (fTipmov && e.tipmov !== fTipmov) return false
    if (fSoDoc && e.tipo_exclusao !== 'PEDIDO EXCLUIDO') return false
    if (buscaExc) {
      const t = `${e.nunota} ${e.cliente || ''} ${e.produto || ''} ${e.br || ''} ${e.cod_produto || ''}`
      if (!t.toLowerCase().includes(buscaExc.toLowerCase())) return false
    }
    return true
  }), [exclusoes, fUsuario, fTipmov, fSoDoc, buscaExc])

  const tiposMov = useMemo(() => {
    const m = {}
    exclusoes.forEach(e => { if (e.tipmov) m[e.tipmov] = e.tipmov_nome || e.tipmov })
    return Object.entries(m).sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  }, [exclusoes])

  const buscarPorChave = async () => {
    const valor = buscaChave.trim()
    if (!valor) return
    setBuscandoChave(true); setResultadoChave(null)
    try {
      // busca em TODO o histórico já sincronizado, sem filtro de período —
      // a "chave" é o mesmo em qualquer data, então não faz sentido limitar
      const r = await sbFetch(`auditoria_modificacoes?select=*&chave=ilike.*${encodeURIComponent(valor)}*&order=data_hora.desc&limit=200`)
      setResultadoChave(r || [])

      const tabelasEnvolvidas = [...new Set((r || []).map(d => d.tabela).filter(Boolean))]
      if (tabelasEnvolvidas.length) {
        const filtro = tabelasEnvolvidas.map(t => `"${t}"`).join(',')
        const dic = await sbFetch(`sankhya_dic_campos?select=nome_tabela,nome_campo,descr_campo&nome_tabela=in.(${filtro})`)
        const mapa = {}
        ;(dic || []).forEach(c => { mapa[`${c.nome_tabela}::${c.nome_campo}`] = c.descr_campo })
        setDicCamposChave(mapa)
      }
    } catch (e) {
      setResultadoChave([])
    } finally {
      setBuscandoChave(false)
    }
  }

  const carregar = async () => {
    setFase('carregando'); setErro('')
    try {
      const iniISOCompleto = `${dtIni}T00:00:00`
      const fimISOCompleto = `${dtFim}T23:59:59`
      const r = await sbFetch(`auditoria_modificacoes?select=*&data_hora=gte.${iniISOCompleto}&data_hora=lte.${fimISOCompleto}&order=data_hora.desc`)
      setDados(r || [])
      setFase('pronto')

      const tabelasEnvolvidas = [...new Set((r || []).map(d => d.tabela).filter(Boolean))]
      if (tabelasEnvolvidas.length) {
        const filtro = tabelasEnvolvidas.map(t => `"${t}"`).join(',')
        const dic = await sbFetch(`sankhya_dic_campos?select=nome_tabela,nome_campo,descr_campo&nome_tabela=in.(${filtro})`)
        const mapa = {}
        ;(dic || []).forEach(c => { mapa[`${c.nome_tabela}::${c.nome_campo}`] = c.descr_campo })
        setDicCampos(mapa)
      }
    } catch (e) {
      setErro(e.message); setFase('erro')
    }
  }
  useEffect(() => { carregar() }, [])

  const sincronizarPeriodo = async () => {
    setSincronizando(true); setMsgSync('')
    try {
      const janelas = gerarJanelas(dtIni, dtFim, 2)
      let totalInserido = 0
      for (let i = 0; i < janelas.length; i++) {
        setMsgSync(`Sincronizando janela ${i+1}/${janelas.length}…`)
        const d = await chamarSync({ data_inicio: isoParaBR(janelas[i].ini), data_fim: isoParaBR(janelas[i].fim) })
        if (d.ok) totalInserido += d.inseridos || 0
        else throw new Error(d.erro || 'Erro na sincronização')
      }
      setMsgSync(`✓ Sincronizado! ${totalInserido} registros no período.`)
      await carregar()
    } catch (e) {
      setMsgSync(`Erro: ${e.message}`)
    } finally {
      setSincronizando(false)
    }
  }

  const opcoesTabela = useMemo(() => [...new Set(dados.map(d => d.tabela).filter(Boolean))].sort(), [dados])

  const qtdSistema = useMemo(() => dados.filter(d => d.username === 'SUP').length, [dados])

  const dadosVisiveis = useMemo(() =>
    mostrarSistema ? dados : dados.filter(d => d.username !== 'SUP')
  , [dados, mostrarSistema])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dadosVisiveis.filter(d => {
      if (fTipo && d.tipo !== fTipo) return false
      if (fTabela && d.tabela !== fTabela) return false
      if (q) {
        const h = `${d.tabela} ${d.instancia} ${d.username} ${d.chave}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dadosVisiveis, busca, fTipo, fTabela])

  const kpi = useMemo(() => ({
    total: dadosVisiveis.length,
    inclusoes: dadosVisiveis.filter(d => d.tipo === 'I').length,
    alteracoes: dadosVisiveis.filter(d => d.tipo === 'U').length,
    exclusoes: dadosVisiveis.filter(d => d.tipo === 'D').length,
  }), [dadosVisiveis])

  const porDia = useMemo(() => {
    const mapa = new Map()
    dadosVisiveis.forEach(d => {
      const dia = (d.data_hora || '').slice(0,10)
      if (!dia) return
      if (!mapa.has(dia)) mapa.set(dia, { dia, Inclusão:0, Alteração:0, Exclusão:0 })
      const rot = TIPO_INFO[d.tipo]?.rot || d.tipo
      mapa.get(dia)[rot] = (mapa.get(dia)[rot] || 0) + 1
    })
    return [...mapa.values()].sort((a,b) => a.dia.localeCompare(b.dia)).map(r => ({ ...r, diaLabel: dBR(r.dia) }))
  }, [dadosVisiveis])

  const porTabela = useMemo(() => {
    const mapa = new Map()
    dadosVisiveis.forEach(d => {
      const nome = d.instancia || d.tabela || '—'
      mapa.set(nome, (mapa.get(nome) || 0) + 1)
    })
    return [...mapa.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a,b) => b.qtd - a.qtd).slice(0,8)
  }, [dadosVisiveis])

  const porUsuario = useMemo(() => {
    const mapa = new Map()
    dadosVisiveis.forEach(d => {
      if (d.username === 'SUP') return
      mapa.set(d.username, (mapa.get(d.username) || 0) + 1)
    })
    return [...mapa.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a,b) => b.qtd - a.qtd).slice(0,8)
  }, [dadosVisiveis])

  const porTipo = useMemo(() => [
    { nome:'Inclusão', qtd:kpi.inclusoes, cor:'#12805C' },
    { nome:'Alteração', qtd:kpi.alteracoes, cor:'#B54708' },
    { nome:'Exclusão', qtd:kpi.exclusoes, cor:'#B42318' },
  ].filter(x => x.qtd > 0), [kpi])

  if (subAba === 'exclusoes') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
        <BarraSubAbas subAba={subAba} setSubAba={setSubAba} qtdExc={exclusoes.length} />
        <PainelExclusoes
          exclusoes={exclusoes} filtradas={excFiltradas} porUsuario={excPorUsuario}
          carregando={carregandoExc} tiposMov={tiposMov}
          fUsuario={fUsuario} setFUsuario={setFUsuario}
          fTipmov={fTipmov} setFTipmov={setFTipmov}
          fSoDoc={fSoDoc} setFSoDoc={setFSoDoc}
          busca={buscaExc} setBusca={setBuscaExc} />
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <BarraSubAbas subAba={subAba} setSubAba={setSubAba} qtdExc={exclusoes.length} />
      <Panel title="🔎 Buscar histórico de um registro específico">
        <p style={{ margin:'0 0 10px', fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
          Digite o número/código do registro (ex: número único do pedido, código do produto, código do parceiro)
          pra ver tudo que já aconteceu com ele, em qualquer data já sincronizada — não depende do período
          selecionado abaixo.
        </p>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input
            value={buscaChave} onChange={e => setBuscaChave(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarPorChave()}
            placeholder="Ex: 4032, 3548-001, 496…"
            style={{ fontFamily:'inherit', fontSize:13, padding:'8px 12px', border:'1px solid #E5E7EB', borderRadius:6, width:280 }}
          />
          <Btn primary onClick={buscarPorChave} disabled={buscandoChave || !buscaChave.trim()}>
            {buscandoChave ? '↻ Buscando…' : '🔎 Buscar'}
          </Btn>
          {resultadoChave !== null && (
            <Btn onClick={() => { setResultadoChave(null); setBuscaChave('') }}>✕ Limpar</Btn>
          )}
        </div>

        {resultadoChave !== null && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:12.5, color:'#6B7280', marginBottom:8 }}>
              {resultadoChave.length
                ? `${resultadoChave.length} registro(s) encontrado(s) para "${buscaChave}" (em todo o histórico sincronizado):`
                : `Nenhum registro encontrado para "${buscaChave}". Pode ser que o período em que isso aconteceu ainda não foi sincronizado — tente sincronizar o período abaixo.`}
            </div>
            {resultadoChave.length > 0 && (
              <TabelaLinhas
                linhas={resultadoChave}
                dicCampos={dicCamposChave}
                expandido={expandido}
                setExpandido={setExpandido}
                mensagemVazio=""
              />
            )}
          </div>
        )}
      </Panel>

      <Panel title="Período">
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>De</label>
            <input type="date" value={dtIni} onChange={e => setDtIni(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>Até</label>
            <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }} />
          </div>
          <Btn primary onClick={carregar}>Ver período</Btn>
          <Btn onClick={sincronizarPeriodo} disabled={sincronizando}>
            {sincronizando ? '↻ Sincronizando…' : '↻ Sincronizar este período com o Sankhya'}
          </Btn>
          {msgSync && <span style={{ fontSize:12, color: msgSync.startsWith('Erro') ? '#B42318' : '#12805C' }}>{msgSync}</span>}
        </div>
        <p style={{ margin:'10px 0 0', fontSize:11.5, color:'#9CA3AF' }}>
          Ações do usuário de sistema (SUP) — renovação de sessão, tokens, estatísticas internas — ficam ocultas
          por padrão, pois não são ações de nenhuma pessoa. O dia de hoje é sincronizado automaticamente todo dia
          às 9h. Pra ver dias anteriores que ainda não foram buscados, use "Sincronizar este período" — ele busca
          dia a dia direto do Sankhya (pode demorar um pouco em períodos longos).
        </p>
      </Panel>

      {fase === 'carregando' && <Spinner/>}
      {fase === 'erro' && <div style={{ color:'#B42318', fontSize:13 }}>Erro: {erro}</div>}

      {fase === 'pronto' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[
              { label:'Total de alterações', valor:int(kpi.total), cor:'#101828' },
              { label:'Inclusões', valor:int(kpi.inclusoes), cor:'#12805C' },
              { label:'Alterações', valor:int(kpi.alteracoes), cor:'#B54708' },
              { label:'⚠ Exclusões', valor:int(kpi.exclusoes), cor:'#B42318' },
            ].map((k,i) => (
              <div key={i} style={{
                background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'16px 18px',
                borderTop: `3px solid ${k.cor}`,
              }}>
                <div style={{ fontSize:12, color:'#6B7280', marginBottom:8, fontWeight:500 }}>{k.label}</div>
                <div style={{ fontSize:24, fontWeight:700, color:k.cor }}>{k.valor}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:14 }}>
            <Panel title="Alterações por dia">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porDia} margin={{ top:6, right:10, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="diaLabel" tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize:12, borderRadius:8, border:'1px solid #E5E7EB' }} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                  <Bar dataKey="Inclusão" stackId="a" fill="#12805C" radius={[0,0,0,0]} />
                  <Bar dataKey="Alteração" stackId="a" fill="#B54708" radius={[0,0,0,0]} />
                  <Bar dataKey="Exclusão" stackId="a" fill="#B42318" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Por tipo de ação">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={porTipo} dataKey="qtd" nameKey="nome" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {porTipo.map((p,i) => <Cell key={i} fill={p.cor} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize:12, borderRadius:8, border:'1px solid #E5E7EB' }} />
                  <Legend wrapperStyle={{ fontSize:11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Tabelas mais alteradas">
              <ResponsiveContainer width="100%" height={Math.max(160, porTabela.length * 32)}>
                <BarChart data={porTabela} layout="vertical" margin={{ top:4, right:16, left:8, bottom:4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize:11, fill:'#374151' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize:12, borderRadius:8, border:'1px solid #E5E7EB' }} />
                  <Bar dataKey="qtd" fill="#1D5BBF" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Usuários mais ativos (sem contar sistema)">
              {porUsuario.length ? (
                <ResponsiveContainer width="100%" height={Math.max(160, porUsuario.length * 32)}>
                  <BarChart data={porUsuario} layout="vertical" margin={{ top:4, right:16, left:8, bottom:4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize:11, fill:'#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize:11, fill:'#374151' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize:12, borderRadius:8, border:'1px solid #E5E7EB' }} />
                    <Bar dataKey="qtd" fill="#6B21A8" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding:'24px', textAlign:'center', color:'#9CA3AF', fontSize:12.5 }}>
                  Nenhuma ação de usuário real neste período.
                </div>
              )}
            </Panel>
          </div>

          <Panel title={`Registros — ${int(filtrados.length)} de ${int(dadosVisiveis.length)}`} noPad>
            <div style={{ display:'flex', gap:12, padding:'14px 18px', borderBottom:'1px solid #F3F4F6', flexWrap:'wrap', alignItems:'flex-end' }}>
              <SearchInput value={busca} onChange={setBusca} placeholder="Tabela, usuário, chave…" />
              <Select label="Tipo" value={fTipo} onChange={setFTipo} options={['I','U','D']} placeholder="Todos" />
              <Select label="Tabela" value={fTabela} onChange={setFTabela} options={opcoesTabela} placeholder="Todas" />
              {(fTipo === 'D' || (!fTipo && kpi.exclusoes > 0)) && (
                <button onClick={() => setFTipo(fTipo === 'D' ? '' : 'D')} style={{
                  fontSize:12, padding:'7px 12px', borderRadius:6, border:'1px solid #FECACA',
                  background: fTipo === 'D' ? '#FEE2E2' : '#fff', color:'#B42318', cursor:'pointer', fontFamily:'inherit', fontWeight:600,
                }}>
                  {fTipo === 'D' ? '✕ Limpar filtro' : `⚠ Só exclusões (${kpi.exclusoes})`}
                </button>
              )}
              {qtdSistema > 0 && (
                <button onClick={() => setMostrarSistema(v => !v)} style={{
                  fontSize:12, padding:'7px 12px', borderRadius:6, border:'1px solid #E5E7EB',
                  background: mostrarSistema ? '#F3F4F6' : '#fff', color:'#6B7280', cursor:'pointer', fontFamily:'inherit',
                  marginLeft:'auto',
                }}>
                  {mostrarSistema
                    ? `✓ Mostrando sistema (SUP) — clique pra ocultar`
                    : `🤖 ${qtdSistema} ações de sistema (SUP) ocultas — clique pra ver`}
                </button>
              )}
            </div>

            <TabelaLinhas
              linhas={filtrados}
              dicCampos={dicCampos}
              expandido={expandido}
              setExpandido={setExpandido}
              mensagemVazio="Nenhum registro encontrado neste período/filtro. Se o período ainda não foi sincronizado, use o botão acima."
            />
          </Panel>
        </>
      )}
    </div>
  )
}

// ─── Sub-abas: modificações e exclusões ────────────────────────────────────
function BarraSubAbas({ subAba, setSubAba, qtdExc }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[['modificacoes','O que mudou'],
        ['exclusoes', `O que foi excluído${qtdExc ? ` (${qtdExc.toLocaleString('pt-BR')})` : ''}`]].map(([k,r]) => (
        <button key={k} onClick={() => setSubAba(k)} style={{
          fontFamily:'inherit', fontSize:13, cursor:'pointer', padding:'8px 16px',
          border:`1px solid ${subAba===k ? '#101828' : '#E5E7EB'}`, borderRadius:6,
          background: subAba===k ? '#101828' : '#fff',
          color: subAba===k ? '#fff' : '#6B7280', fontWeight: subAba===k ? 600 : 400,
        }}>{r}</button>
      ))}
    </div>
  )
}

// Exclusão não é modificação: o registro some, e o Sankhya guarda numa
// tabela espelho. Sem olhar ali, o que foi apagado é invisível.
function PainelExclusoes({ exclusoes, filtradas, porUsuario, carregando, tiposMov,
                           fUsuario, setFUsuario, fTipmov, setFTipmov,
                           fSoDoc, setFSoDoc, busca, setBusca }) {
  const [expandido, setExpandido] = useState(null)
  const moeda = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const dh = (v) => v ? new Date(v).toLocaleString('pt-BR',
    { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

  const tot = useMemo(() => ({
    itens: filtradas.length,
    docs: new Set(filtradas.map(e => e.nunota)).size,
    inteiros: filtradas.filter(e => e.tipo_exclusao === 'PEDIDO EXCLUIDO').length,
    valor: filtradas.reduce((s, e) => s + (Number(e.valor_item) || 0), 0),
    usuarios: new Set(filtradas.map(e => e.usuario)).size,
  }), [filtradas])

  if (carregando) return <Panel title="Exclusões"><div style={{ padding:20, color:'#6B7280', fontSize:13 }}>Carregando o histórico de exclusões…</div></Panel>
  if (!exclusoes.length) return <Panel title="Exclusões"><div style={{ padding:20, color:'#6B7280', fontSize:13 }}>Nenhuma exclusão registrada no período sincronizado.</div></Panel>

  return (
    <>
      <Panel title="O que foi excluído no Sankhya">
        <p style={{ margin:'0 0 14px', fontSize:12.5, color:'#6B7280', lineHeight:1.6 }}>
          Itens e documentos apagados, com quem apagou e quando. A aba de modificações
          mostra o que mudou; aqui está o que deixou de existir — o Sankhya guarda numa tabela
          espelho, e sem olhar nela a exclusão é invisível.
        </p>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:16 }}>
          {[
            ['Itens excluídos', tot.itens.toLocaleString('pt-BR')],
            ['Documentos atingidos', tot.docs.toLocaleString('pt-BR')],
            ['Documentos inteiros', tot.inteiros.toLocaleString('pt-BR')],
            ['Valor dos itens', moeda(tot.valor)],
            ['Pessoas', String(tot.usuarios)],
          ].map(([r,v]) => (
            <div key={r}>
              <div style={{ fontSize:11.5, color:'#9CA3AF', marginBottom:4 }}>{r}</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#101828',
                            fontVariantNumeric:'tabular-nums' }}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {porUsuario.length > 0 && (
        <Panel title="Por quem">
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:640 }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['Usuário','Itens','Documentos','Doc. inteiros','Valor','Última exclusão'].map((h,i) => (
                    <th key={h} style={{ padding:'9px 12px', fontSize:11, fontWeight:600, color:'#6B7280',
                      textAlign: i>=1 && i<=4 ? 'right' : 'left', borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porUsuario.slice(0,12).map(u => (
                  <tr key={u.usuario} style={{ borderBottom:'1px solid #F3F4F6', cursor:'pointer',
                        background: fUsuario===u.usuario ? '#EEF2FF' : undefined }}
                      onClick={() => setFUsuario(fUsuario===u.usuario ? '' : u.usuario)}>
                    <td style={{ padding:'8px 12px', fontWeight:600, color:'#101828' }}>{u.usuario || '—'}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      {Number(u.exclusoes).toLocaleString('pt-BR')}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', color:'#6B7280', fontVariantNumeric:'tabular-nums' }}>
                      {Number(u.documentos).toLocaleString('pt-BR')}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', color:'#B42318', fontVariantNumeric:'tabular-nums' }}>
                      {Number(u.docs_inteiros).toLocaleString('pt-BR')}</td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      {moeda(u.valor)}</td>
                    <td style={{ padding:'8px 12px', color:'#9CA3AF', fontSize:11.5 }}>
                      {u.ultima ? new Date(u.ultima).toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:8 }}>
            Clique num usuário para filtrar a lista abaixo.
          </div>
        </Panel>
      )}

      <Panel title={`${filtradas.length.toLocaleString('pt-BR')} de ${exclusoes.length.toLocaleString('pt-BR')} exclusões`}>
        <div style={{ display:'flex', gap:9, flexWrap:'wrap', marginBottom:12, alignItems:'center' }}>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Nº único, cliente, produto ou BR…"
            style={{ fontFamily:'inherit', fontSize:13, padding:'7px 11px',
                     border:'1px solid #E5E7EB', borderRadius:6, width:250 }} />
          <select value={fTipmov} onChange={e => setFTipmov(e.target.value)}
            style={{ fontFamily:'inherit', fontSize:13, padding:'7px 11px',
                     border:'1px solid #E5E7EB', borderRadius:6 }}>
            <option value="">Todos os tipos</option>
            {tiposMov.map(([k,r]) => <option key={k} value={k}>{r}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5,
                          color:'#6B7280', cursor:'pointer' }}>
            <input type="checkbox" checked={fSoDoc} onChange={e => setFSoDoc(e.target.checked)} />
            só documento inteiro
          </label>
          {(fUsuario || fTipmov || fSoDoc || busca) && (
            <button onClick={() => { setFUsuario(''); setFTipmov(''); setFSoDoc(false); setBusca('') }}
              style={{ fontFamily:'inherit', fontSize:12.5, cursor:'pointer', padding:'6px 11px',
                       border:'none', background:'none', color:'#1F60A8' }}>limpar</button>
          )}
          {fUsuario && (
            <span style={{ fontSize:12, color:'#1F60A8', background:'#EEF2FF',
                           padding:'4px 10px', borderRadius:5 }}>usuário: {fUsuario}</span>
          )}
        </div>

        <div style={{ overflowX:'auto', maxHeight:620 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:900 }}>
            <thead>
              <tr style={{ background:'#F9FAFB' }}>
                {['Excluído em','Nº único','Tipo','Situação','Usuário','Cliente','Produto','Qtd','Valor'].map((h,i) => (
                  <th key={h} style={{ padding:'9px 11px', fontSize:11, fontWeight:600, color:'#6B7280',
                    textAlign: i>=7 ? 'right' : 'left', borderBottom:'1px solid #E5E7EB',
                    position:'sticky', top:0, background:'#F9FAFB', zIndex:1, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0,400).map(e => {
                const inteiro = e.tipo_exclusao === 'PEDIDO EXCLUIDO'
                const ab = expandido === e.id
                return (
                  <React.Fragment key={e.id}>
                    <tr onClick={() => setExpandido(ab ? null : e.id)}
                        style={{ borderBottom:'1px solid #F3F4F6', cursor:'pointer',
                                 background: inteiro ? '#FEF2F2' : undefined }}>
                      <td style={{ padding:'8px 11px', color:'#6B7280', whiteSpace:'nowrap' }}>{dh(e.dh_exclusao)}</td>
                      <td style={{ padding:'8px 11px', fontWeight:600, color:'#101828',
                                   fontVariantNumeric:'tabular-nums' }}>
                        {e.nunota}<span style={{ color:'#9CA3AF', fontWeight:400 }}>-{e.sequencia}</span>
                      </td>
                      <td style={{ padding:'8px 11px', color:'#6B7280' }}>{e.tipmov_nome || e.tipmov || '—'}</td>
                      <td style={{ padding:'8px 11px' }}>
                        <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:4,
                          background: inteiro ? '#FEE2E2' : '#F3F4F6',
                          color: inteiro ? '#B42318' : '#6B7280' }}>
                          {inteiro ? 'Documento inteiro' : 'Só o item'}
                        </span>
                      </td>
                      <td style={{ padding:'8px 11px', color:'#101828' }}>{e.usuario || '—'}</td>
                      <td style={{ padding:'8px 11px', color:'#6B7280', maxWidth:180, overflow:'hidden',
                                   textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.cliente}</td>
                      <td style={{ padding:'8px 11px', color:'#6B7280', maxWidth:200, overflow:'hidden',
                                   textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={e.produto}>{e.produto}</td>
                      <td style={{ padding:'8px 11px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                        {Number(e.quantidade || 0).toLocaleString('pt-BR')}</td>
                      <td style={{ padding:'8px 11px', textAlign:'right', fontWeight:600,
                                   fontVariantNumeric:'tabular-nums' }}>{moeda(e.valor_item)}</td>
                    </tr>
                    {ab && (
                      <tr style={{ background:'#FAFAFA' }}>
                        <td colSpan={9} style={{ padding:'11px 14px', borderBottom:'1px solid #F3F4F6' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',
                                        gap:16, fontSize:12 }}>
                            {[['Chave do item', `${e.nunota}-${e.sequencia}`],
                              ['Código do produto', e.cod_produto],
                              ['BR / projeto', e.br || 'sem projeto'],
                              ['Data do documento', e.data_doc ? new Date(e.data_doc+'T00:00:00').toLocaleDateString('pt-BR') : '—'],
                              ['Tipo de movimento', `${e.tipmov_nome || ''} (${e.tipmov || '—'})`],
                            ].map(([k,v]) => (
                              <div key={k}>
                                <div style={{ fontSize:10.5, color:'#9CA3AF', fontWeight:600, marginBottom:3 }}>
                                  {k.toUpperCase()}</div>
                                <div style={{ color:'#101828' }}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize:11.5, color:'#6B7280', marginTop:10, lineHeight:1.5 }}>
                            {inteiro
                              ? 'O documento inteiro deixou de existir: o número único não está mais na base ativa.'
                              : 'Só este item saiu; o documento continua existindo com os demais itens.'}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:10, lineHeight:1.5 }}>
          Linhas em vermelho são documentos que deixaram de existir por completo · clique para o detalhe
          {filtradas.length > 400 && ` · mostrando 400 de ${filtradas.length.toLocaleString('pt-BR')}`}
        </div>
      </Panel>
    </>
  )
}
