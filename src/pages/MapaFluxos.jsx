import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, MarkerType, addEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch } from '../config.js'
import { Spinner, EmptyState, Btn } from '../components/UI.jsx'

/* Cada sistema tem sua cor. O nó diz de onde a coisa roda, que é a
   pergunta que a gente sempre faz olhando um fluxo desses. */
const SISTEMA = {
  'Sankhya':        { cor: '#0D2B54', fundo: '#EAF0F8', sigla: 'SNK' },
  'Supabase':       { cor: '#12805C', fundo: '#E9F7F1', sigla: 'SUP' },
  'Power Automate': { cor: '#1F60A8', fundo: '#EAF1FA', sigla: 'PA'  },
  'Microsoft 365':  { cor: '#B45309', fundo: '#FDF3E7', sigla: 'M365'},
  'OpenAI':         { cor: '#6D28D9', fundo: '#F1EBFD', sigla: 'IA'  },
  'Render':         { cor: '#0E7490', fundo: '#E7F5F8', sigla: 'RND' },
  'Portal':         { cor: '#1A1A18', fundo: '#F1EFEB', sigla: 'KB'  },
  'Externo':        { cor: '#6E6A64', fundo: '#F4F2EE', sigla: '—'   },
  'Pessoa':         { cor: '#9A3412', fundo: '#FBEEE8', sigla: '👤'  },
}
const info = (s) => SISTEMA[s] || SISTEMA['Externo']

const FORMA = {
  gatilho:       { borda: '18px',  traco: 'dashed' },
  armazenamento: { borda: '3px',   traco: 'solid'  },
  ia:            { borda: '14px',  traco: 'solid'  },
  medicao:       { borda: '3px',   traco: 'dotted' },
  saida:         { borda: '3px',   traco: 'solid'  },
  pessoa:        { borda: '22px',  traco: 'solid'  },
  passo:         { borda: '6px',   traco: 'solid'  },
}

const ni = (v) => Number(v ?? 0).toLocaleString('pt-BR')

function NoFluxo({ data, selected }) {
  const porArea = data.__corPorArea
  const base = info(data.sistema)
  // cor da área vem do cadastro; sem área, cai no cinza neutro
  const s = porArea
    ? { cor: data.area_cor || '#6E6A64', fundo: (data.area_cor || '#6E6A64') + '14',
        sigla: (data.area || 'Sem área').slice(0, 12) }
    : base
  const f = FORMA[data.tipo] || FORMA.passo
  return (
    <div style={{
      background: s.fundo,
      border: `${selected ? 2 : 1.5}px ${f.traco} ${s.cor}`,
      borderRadius: f.borda,
      padding: '10px 13px', minWidth: 168, maxWidth: 230,
      boxShadow: selected ? `0 0 0 3px ${s.cor}22` : 'none',
    }}>
      <Handle type="target" position={Position.Left}  style={{ background: s.cor, width: 7, height: 7, border: 'none' }} />
      <div style={{
        fontSize: 9, fontWeight: 700, color: s.cor, letterSpacing: '.06em', marginBottom: 3,
      }}>{s.sigla}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18', lineHeight: 1.3 }}>
        {data.rotulo}
      </div>
      {data.volume_medido != null && (
        <div style={{
          fontSize: 10.5, color: s.cor, marginTop: 5, fontVariantNumeric: 'tabular-nums',
        }}>
          {ni(data.volume_medido)} medidos · +{ni(Math.round(data.volume_mes))}/mês
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: s.cor, width: 7, height: 7, border: 'none' }} />
    </div>
  )
}
const tiposNo = { fluxo: NoFluxo }

// Layout em camadas da esquerda para a direita. Com 27 nós posicionados
// à mão o mapa vira espaguete; o dagre resolve o cruzamento de arestas.
function organizar(nos, linhas, espacamento = 'normal') {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'LR',
    nodesep: espacamento === 'largo' ? 70 : 42,
    ranksep: espacamento === 'largo' ? 160 : 110,
    marginx: 30, marginy: 30,
  })
  g.setDefaultEdgeLabel(() => ({}))
  const L = 210, A = 74
  nos.forEach((n) => g.setNode(n.id, { width: L, height: A }))
  linhas.forEach((e) => { if (e.source && e.target) g.setEdge(e.source, e.target) })
  dagre.layout(g)
  return nos.map((n) => {
    const p = g.node(n.id)
    return p ? { ...n, position: { x: p.x - L / 2, y: p.y - A / 2 } } : n
  })
}

const CORLINHA = { dados: '#8B8781', gatilho: '#1F60A8', notificacao: '#B45309', condicional: '#6D28D9' }

export default function MapaFluxos({ embutido = false }) {
  const [nos, setNos, aoMudarNos] = useNodesState([])
  const [linhas, setLinhas, aoMudarLinhas] = useEdgesState([])
  const [bruto, setBruto] = useState([])
  const [areas, setAreas] = useState([])
  const [orfaos, setOrfaos] = useState([])
  const [sel, setSel] = useState(null)
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [expandido, setExpandido] = useState(false)
  const [criando, setCriando] = useState(false)
  const [area, setArea] = useState('todas')
  const [camada, setCamada] = useState('processo')
  const [modoCor, setModoCor] = useState('area')
  const nosRef = useRef([])
  const [projetos, setProjetos] = useState([])
  const [ganhos, setGanhos] = useState([])
  const [listaAreas, setListaAreas] = useState([])
  const [selLigacao, setSelLigacao] = useState(null)
  const [conexBruto, setConexBruto] = useState([])

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const [m, c, o, ar, pj, gh, ax] = await Promise.all([
        sbFetch('fluxo_mapa?select=*&ativo=eq.true'),
        sbFetch('fluxo_conexao?select=*'),
        sbFetch('fluxo_orfaos?select=*'),
        sbFetch('fluxo_area_resumo?select=*'),
        sbFetch('automacao_projetos?select=id,nome_projeto,setor,status&order=nome_projeto.asc'),
        sbFetch('automacao_ganhos_tarefas?select=id,projeto_id,tarefa,min_antes,min_depois,vol_medido,horas_acumuladas,horas_mes'),
        sbFetch('area?select=id,nome,cor&order=ordem.asc'),
      ])
      setBruto(m || [])
      setConexBruto(c || [])
      setOrfaos(o || [])
      setAreas(ar || [])
      setProjetos(pj || [])
      setGanhos(gh || [])
      setListaAreas(ax || [])
      // preserva o que o usuário moveu: qualquer ação que recarregue o mapa
      // (salvar nó, criar ligação, excluir) estava jogando as posições fora
      setNos((antes) => {
        const posAtual = new Map(antes.map((n) => [n.id, n.position]))
        return (m || []).map((n) => ({
          id: n.chave, type: 'fluxo',
          position: posAtual.get(n.chave) ?? { x: n.x, y: n.y },
          data: { ...n },
        }))
      })
      setLinhas((c || []).map((e) => ({
        id: e.id, source: e.de, target: e.para, label: e.rotulo || undefined,
        animated: e.tipo === 'gatilho',
        style: {
          stroke: CORLINHA[e.tipo] || CORLINHA.dados,
          strokeWidth: 1.6,
          strokeDasharray: e.tipo === 'condicional' ? '5 4' : undefined,
        },
        labelStyle: { fontSize: 10.5, fill: '#6E6A64', fontFamily: 'inherit' },
        labelBgStyle: { fill: '#FBFAF8' },
        markerEnd: { type: MarkerType.ArrowClosed, color: CORLINHA[e.tipo] || CORLINHA.dados, width: 16, height: 16 },
      })))
      setFase('pronto')
      setSujo(false)
    } catch (e) { setErro(e.message); setFase('erro') }
  }, [setNos, setLinhas])

  useEffect(() => { nosRef.current = nos }, [nos])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!expandido) return
    const sair = (e) => { if (e.key === 'Escape') setExpandido(false) }
    window.addEventListener('keydown', sair)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', sair)
      document.body.style.overflow = antes
    }
  }, [expandido])

  // usado antes de recarregar: evita perder arrastos não salvos
  const gravarPosicoes = async (lista) => {
    const alvo = lista ?? nosRef.current
    if (!alvo?.length) return
    await Promise.all(alvo.map((n) =>
      fetch(`${SUPABASE_URL}/rest/v1/fluxo_no?chave=eq.${encodeURIComponent(n.id)}`, {
        method: 'PATCH', headers: cab('minimal'),
        body: JSON.stringify({
          x: Math.round(n.position.x), y: Math.round(n.position.y),
          atualizado_em: new Date().toISOString(),
        }),
      })))
  }

  const salvarPosicoes = async () => {
    setSalvando(true)
    try { await gravarPosicoes(nos); setSujo(false) }
    catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  const cab = (prefer = 'representation') => ({
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: `return=${prefer}`,
  })

  // ligar dois nós arrastando de um para o outro
  const aoConectar = async (c) => {
    if (!c.source || !c.target || c.source === c.target) return
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/fluxo_conexao`, {
        method: 'POST', headers: cab(),
        body: JSON.stringify({ de: c.source, para: c.target, rotulo: null, tipo: 'dados' }),
      })
      if (!r.ok) throw new Error(await r.text())
      const criada = await r.json().catch(() => null)
      if (sujo) { await gravarPosicoes(); setSujo(false) }
      await carregar()
      // abre o painel já na ligação nova, para nomear na hora
      if (criada?.[0]?.id) setSelLigacao(criada[0].id)
    } catch (e) { setErro(`Não consegui criar a ligação: ${e.message}`) }
  }

  const salvarConexao = async (id, campos) => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/fluxo_conexao?id=eq.${id}`, {
        method: 'PATCH', headers: cab('minimal'),
        body: JSON.stringify(campos),
      })
      if (!r.ok) throw new Error(await r.text())
      if (sujo) { await gravarPosicoes(); setSujo(false) }
      await carregar()
    } catch (e) { setErro(`Não consegui salvar a ligação: ${e.message}`) }
  }

  const removerConexao = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/fluxo_conexao?id=eq.${id}`, {
        method: 'DELETE', headers: cab(),
      })
      await carregar()
    } catch (e) { setErro(e.message) }
  }

  const criarNo = async (dados) => {
    const chave = dados.rotulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
      || `no_${Date.now()}`
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/fluxo_no`, {
        method: 'POST', headers: cab(),
        body: JSON.stringify({ ...dados, chave, origem: 'manual', x: 40, y: 40 }),
      })
      if (!r.ok) {
        const t = await r.text()
        throw new Error(t.includes('duplicate') ? 'Já existe um nó com esse nome.' : t)
      }
      setCriando(false)
      await carregar()
      setSel(chave)
    } catch (e) { setErro(`Não consegui criar o nó: ${e.message}`) }
  }

  const excluirNo = async (chave) => {
    if (!window.confirm('Excluir este nó? As ligações dele também somem.')) return
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/fluxo_no?chave=eq.${encodeURIComponent(chave)}`, {
        method: 'DELETE', headers: cab(),
      })
      setSel(null)
      await carregar()
    } catch (e) { setErro(e.message) }
  }

  // Vincula o nó a uma automação. É o que liga o desenho do processo ao
  // controle de ganhos: mapeando o fluxo, já se registra o que foi automatizado.
  const vincularProjeto = async (chave, projeto_id) => {
    await salvarNo(chave, { projeto_id: projeto_id || null })
  }

  const criarProjeto = async (nome, setor) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/automacao_projetos`, {
      method: 'POST', headers: cab(),
      body: JSON.stringify({
        nome_projeto: nome, tipo: 'Automação', setor: setor || null,
        status: 'Em produção', prioridade: 'Média',
        criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
      }),
    })
    if (!r.ok) throw new Error(await r.text())
    const d = await r.json()
    return d?.[0]?.id
  }

  const criarTarefa = async (projeto_id, t) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/automacao_ganhos`, {
      method: 'POST', headers: cab('minimal'),
      body: JSON.stringify({
        projeto_id,
        tarefa: t.tarefa,
        frequencia: 'Mensal',
        ocorrencias: Number(t.ocorrencias) || 0,
        min_antes: Number(t.min_antes) || 0,
        min_depois: Number(t.min_depois) || 0,
        eliminada: Number(t.min_depois) === 0,
        quem_executava: t.quem || null,
        setores: t.setor ? [t.setor] : null,
        observacao: 'Registrada pelo mapa de processos em ' + new Date().toLocaleDateString('pt-BR')
          + '. Volume informado à mão; sem contador automático.',
      }),
    })
    if (!r.ok) throw new Error(await r.text())
  }

  const salvarNo = async (chave, campos) => {
    await fetch(`${SUPABASE_URL}/rest/v1/fluxo_no?chave=eq.${encodeURIComponent(chave)}`, {
      method: 'PATCH', headers: cab('minimal'),
      body: JSON.stringify({ ...campos, atualizado_em: new Date().toISOString() }),
    })
    if (sujo) { await gravarPosicoes(); setSujo(false) }
    await carregar()
  }

  const sistemas = useMemo(
    () => ['todos', ...Array.from(new Set(bruto.map((n) => n.sistema)))],
    [bruto],
  )
  // área recorta o mapa; sistema só destaca dentro do recorte
  // Recorte por área. Os nós de fora que conversam com a área entram
  // apagados: é na fronteira que estão os acordos entre setores, e sem
  // eles o mapa da área parece um sistema fechado, que não é.
  const { nosFiltrados, linhasFiltradas } = useMemo(() => {
    // camada primeiro: a instrumentação de medição não é processo do
    // negócio e, misturada, cruza linha com tudo
    const nosCamada = camada === 'tudo'
      ? nos : nos.filter((n) => (n.data.camada || 'processo') === camada)
    const chavesCamada = new Set(nosCamada.map((n) => n.id))
    const linhasCamada = linhas.filter(
      (l) => chavesCamada.has(l.source) && chavesCamada.has(l.target))
    const nosBase = nosCamada, linhasBase = linhasCamada
    if (area === 'todas') {
      const base = (filtro === 'todos' ? nosBase
        : nosBase.map((n) => ({ ...n, style: { opacity: n.data.sistema === filtro ? 1 : .22 } })))
        .map((n) => ({ ...n, data: { ...n.data, __corPorArea: modoCor === 'area' } }))
      return { nosFiltrados: base, linhasFiltradas: linhasBase }
    }
    const dentro = new Set(
      nosBase.filter((n) => (n.data.area || 'Sem área') === area).map((n) => n.id))
    const vizinhos = new Set()
    for (const l of linhasBase) {
      if (dentro.has(l.source) && !dentro.has(l.target)) vizinhos.add(l.target)
      if (dentro.has(l.target) && !dentro.has(l.source)) vizinhos.add(l.source)
    }
    const visiveis = nosBase
      .filter((n) => dentro.has(n.id) || vizinhos.has(n.id))
      .map((n) => {
        const fora = !dentro.has(n.id)
        const apagadoPorSistema = filtro !== 'todos' && n.data.sistema !== filtro
        return {
          ...n,
          data: { ...n.data, __corPorArea: modoCor === 'area' },
          style: { opacity: fora ? 0.3 : (apagadoPorSistema ? 0.22 : 1) },
        }
      })
    const chaves = new Set(visiveis.map((n) => n.id))
    return {
      nosFiltrados: visiveis,
      linhasFiltradas: linhasBase.filter((l) => chaves.has(l.source) && chaves.has(l.target)),
    }
  }, [nos, linhas, filtro, area, camada, modoCor])

  const legenda = useMemo(() => {
    const conta = new Map()
    for (const n of nos) {
      const k = n.data.area || 'Sem área'
      const c = conta.get(k) || { nome: k, cor: n.data.area_cor || '#6E6A64', qtd: 0 }
      c.qtd += 1
      if (n.data.area_cor) c.cor = n.data.area_cor
      conta.set(k, c)
    }
    return [...conta.values()].sort((a, b) => b.qtd - a.qtd)
  }, [nos])

  const criarArea = async () => {
    const nome = window.prompt('Nome da nova área:')
    if (!nome?.trim()) return
    const cor = window.prompt('Cor em hexadecimal (ex: #1F60A8):', '#6E6A64')
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/area`, {
        method: 'POST', headers: cab('minimal'),
        body: JSON.stringify({ nome: nome.trim(), cor: (cor || '#6E6A64').trim(), ordem: 99 }),
      })
      if (!r.ok) throw new Error(await r.text())
      await carregar()
    } catch (e) { setErro(`Não consegui criar a área: ${e.message}`) }
  }

  const dentroDaArea = useMemo(
    () => area === 'todas' ? nosFiltrados.length
      : nosFiltrados.filter((n) => (n.data.area || 'Sem área') === area).length,
    [nosFiltrados, area])

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return <EmptyState title="Não foi possível carregar o mapa" text={erro}>
      <Btn primary onClick={carregar}>Tentar de novo</Btn>
    </EmptyState>
  }

  const selNo = sel ? bruto.find((n) => n.chave === sel) : null
  const ligacaoSel = selLigacao ? conexBruto.find((c) => c.id === selLigacao) : null

  return (
    <div style={
      expandido
        ? {
            position: 'fixed', inset: 0, zIndex: 1000, background: '#fff',
            display: 'flex', flexDirection: 'column',
          }
        : embutido
          ? { height: 'calc(100vh - 250px)', minHeight: 460, display: 'flex', flexDirection: 'column' }
          : { margin: '-22px -26px -60px', height: 'calc(100vh - 62px)', display: 'flex', flexDirection: 'column' }
    }>
      <div style={{
        padding: '12px 26px', borderBottom: '1px solid #E4E1DC', background: '#fff',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18' }}>Mapa dos processos</div>
        <div style={{ fontSize: 12, color: '#6E6A64' }}>
          {area === 'todas'
            ? `${bruto.length} nós · ${linhas.length} ligações`
            : `${dentroDaArea} na área · ${nosFiltrados.length - dentroDaArea} na fronteira`}
        </div>

        <button onClick={() => setModoCor((m) => m === 'area' ? 'sistema' : 'area')}
          title="Alterna a cor dos nós entre área responsável e sistema onde roda"
          style={{
            fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '5px 11px',
            border: '1px solid #E4E1DC', background: '#fff', color: '#1A1A18', borderRadius: 3,
            whiteSpace: 'nowrap',
          }}>
          Cor: {modoCor === 'area' ? 'área' : 'sistema'}
        </button>

        <div style={{ display: 'flex', gap: 4 }}>
          {[['processo','Processo'],['medicao','Medição'],['tudo','Tudo']].map(([k, r]) => (
            <button key={k} onClick={() => setCamada(k)}
              title={k === 'processo' ? 'Só o processo do negócio'
                   : k === 'medicao' ? 'Só a instrumentação que mede' : 'Processo e medição juntos'}
              style={{
                fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '5px 11px',
                border: `1px solid ${camada === k ? '#1A1A18' : '#E4E1DC'}`,
                background: camada === k ? '#1A1A18' : '#fff',
                color: camada === k ? '#fff' : '#6E6A64', borderRadius: 2,
              }}>{r}</button>
          ))}
        </div>

        <select value={area} onChange={(e) => setArea(e.target.value)}
          style={{
            fontFamily: 'inherit', fontSize: 12.5, padding: '5px 9px',
            border: `1px solid ${area === 'todas' ? '#E4E1DC' : '#1A1A18'}`, borderRadius: 3,
            background: '#fff', color: '#1A1A18', fontWeight: area === 'todas' ? 400 : 600,
          }}>
          <option value="todas">Todas as áreas · {bruto.length} nós</option>
          {areas.map((a) => (
            <option key={a.area} value={a.area}>{a.area} · {a.nos} nós</option>
          ))}
        </select>

        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}
          style={{
            fontFamily: 'inherit', fontSize: 12.5, padding: '5px 9px',
            border: '1px solid #E4E1DC', borderRadius: 3, background: '#fff', color: '#1A1A18',
          }}>
          {sistemas.map((s) => <option key={s} value={s}>{s === 'todos' ? 'Todos os sistemas' : s}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {sujo && (
          <Btn small primary onClick={salvarPosicoes} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar posições'}
          </Btn>
        )}
        <button onClick={() => { setNos(organizar(nosFiltrados, linhasFiltradas)); setSujo(true) }}
          title="Reposiciona os nós em camadas, da esquerda para a direita"
          style={{
            fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '5px 11px',
            border: '1px solid #E4E1DC', background: '#fff', color: '#1A1A18', borderRadius: 3,
          }}>⇄  Organizar</button>
        <button onClick={() => { setCriando(true); setSel(null) }}
          style={{
            fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '5px 11px',
            border: '1px solid #E4E1DC', background: '#fff', color: '#1A1A18', borderRadius: 3,
          }}>+  Novo nó</button>
        <button onClick={() => setExpandido((v) => !v)}
          title={expandido ? 'Sair da tela cheia (Esc)' : 'Expandir para trabalhar no mapa'}
          style={{
            fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '5px 11px',
            border: '1px solid #E4E1DC', background: expandido ? '#1A1A18' : '#fff',
            color: expandido ? '#fff' : '#1A1A18', borderRadius: 3, whiteSpace: 'nowrap',
          }}>
          {expandido ? '✕  Sair da tela cheia' : '⤢  Expandir'}
        </button>
        {orfaos.length > 0 && (
          <div style={{
            fontSize: 12, color: '#B45309', background: '#FDF3E7',
            border: '1px solid #F5D9B0', borderRadius: 3, padding: '5px 10px',
          }}>
            {orfaos.length} fora do mapa
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, background: '#FBFAF8', position: 'relative' }}>
          {modoCor === 'area' && (
            <div style={{
              position: 'absolute', left: 12, top: 12, zIndex: 5, background: '#fff',
              border: '1px solid #E4E1DC', borderRadius: 4, padding: '9px 11px', maxWidth: 210,
              boxShadow: '0 1px 6px rgba(0,0,0,.06)',
            }}>
              <div style={{ fontSize: 10, color: '#6E6A64', textTransform: 'uppercase',
                            letterSpacing: '.05em', marginBottom: 7 }}>Áreas</div>
              {legenda.map((l) => (
                <button key={l.nome} onClick={() => setArea(area === l.nome ? 'todas' : l.nome)}
                  title={`${l.qtd} nó(s) · clique para filtrar`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '3px 0',
                    background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    opacity: area === 'todas' || area === l.nome ? 1 : .4, textAlign: 'left',
                  }}>
                  <span style={{ width: 10, height: 10, background: l.cor, borderRadius: 2, flexShrink: 0,
                                 boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.15)' }} />
                  <span style={{ fontSize: 11.5, color: '#1A1A18', flex: 1,
                                 fontWeight: area === l.nome ? 600 : 400 }}>{l.nome}</span>
                  <span style={{ fontSize: 10.5, color: '#6E6A64', fontVariantNumeric: 'tabular-nums' }}>{l.qtd}</span>
                </button>
              ))}
              <button onClick={criarArea} style={{
                marginTop: 7, fontSize: 11, color: '#1F60A8', background: 'transparent',
                border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
              }}>+ nova área</button>
            </div>
          )}
          <ReactFlow
            nodes={nosFiltrados}
            edges={linhasFiltradas}
            nodeTypes={tiposNo}
            onNodesChange={(ch) => {
              aoMudarNos(ch)
              if (ch.some((c) => c.type === 'position' && c.dragging === false)) setSujo(true)
            }}
            onEdgesChange={aoMudarLinhas}
            onConnect={aoConectar}
            onEdgeClick={(_, e) => { setSelLigacao(e.id); setSel(null); setCriando(false) }}
            onNodeClick={(_, n) => { setSel(n.id); setSelLigacao(null) }}
            onPaneClick={() => { setSel(null); setSelLigacao(null) }}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#DCD8D1" gap={22} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable zoomable
              nodeColor={(n) => modoCor === 'area' ? (n.data?.area_cor || '#6E6A64') : info(n.data?.sistema).cor}
              style={{ background: '#F4F2EE', border: '1px solid #E4E1DC' }}
            />
          </ReactFlow>
        </div>

        {(criando || selNo || ligacaoSel || orfaos.length > 0) && (
          <aside style={{
            width: 316, borderLeft: '1px solid #E4E1DC', background: '#fff',
            overflowY: 'auto', padding: '18px 20px',
          }}>
            {ligacaoSel ? (
              <DetalheLigacao
                ligacao={ligacaoSel}
                deNome={bruto.find((n) => n.chave === ligacaoSel.de)?.rotulo || ligacaoSel.de}
                paraNome={bruto.find((n) => n.chave === ligacaoSel.para)?.rotulo || ligacaoSel.para}
                onSalvar={salvarConexao}
                onRemover={removerConexao}
                onFechar={() => setSelLigacao(null)} />
            ) : criando ? (
              <NovoNo onCriar={criarNo} onFechar={() => setCriando(false)} />
            ) : selNo ? (
              <DetalheNo no={selNo} onSalvar={salvarNo} onExcluir={excluirNo}
                         onFechar={() => setSel(null)}
                         projetos={projetos} ganhos={ganhos} areas={listaAreas}
                         onVincular={vincularProjeto} onCriarProjeto={criarProjeto}
                         onCriarTarefa={criarTarefa} onRecarregar={carregar} />
            ) : (
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#B45309', marginBottom: 6 }}>
                  Fora do mapa
                </div>
                <p style={{ fontSize: 12, color: '#6E6A64', lineHeight: 1.55, marginTop: 0 }}>
                  Recursos que existem no banco mas não aparecem em nenhum nó. Se algo novo for
                  criado e ninguém desenhar, aparece aqui.
                </p>
                {orfaos.map((o, i) => (
                  <div key={i} style={{ padding: '9px 0', borderTop: '1px solid #F1EFEB' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A18' }}>{o.recurso}</div>
                    <div style={{ fontSize: 11, color: '#6E6A64', marginTop: 2 }}>
                      {o.recurso_tipo} · {o.detalhe}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function DetalheNo({ no, onSalvar, onExcluir, onFechar, projetos, ganhos, areas, onVincular, onCriarProjeto, onCriarTarefa, onRecarregar }) {
  const [edicao, setEdicao] = useState(false)
  const [f, setF] = useState({ rotulo: no.rotulo, descricao: no.descricao || '', sistema: no.sistema, tipo: no.tipo })
  const [salvando, setSalvando] = useState(false)
  useEffect(() => {
    setF({ rotulo: no.rotulo, descricao: no.descricao || '', sistema: no.sistema, tipo: no.tipo })
    setEdicao(false)
  }, [no.chave])

  const campo = {
    width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '6px 8px',
    border: '1px solid #E4E1DC', borderRadius: 3, marginBottom: 9, background: '#fff',
  }
  const rot = { fontSize: 11, color: '#6E6A64', marginBottom: 3, display: 'block' }

  const gravar = async () => {
    setSalvando(true)
    await onSalvar(no.chave, f)
    setSalvando(false)
    setEdicao(false)
  }

  const s = info(no.sistema)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: s.cor, background: s.fundo,
          padding: '2px 7px', borderRadius: 2,
        }}>{no.sistema}</span>
        <button onClick={onFechar} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: '#9A958E', fontSize: 16, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>

      {!edicao ? (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', margin: '10px 0 6px' }}>
            {no.rotulo}
          </h3>
          {no.descricao && (
            <p style={{ fontSize: 12.5, color: '#4A4741', lineHeight: 1.6, margin: '0 0 14px' }}>
              {no.descricao}
            </p>
          )}
          <dl style={{ margin: 0, fontSize: 12 }}>
            {[
              ['Tipo', no.tipo],
              ['Automação', no.nome_projeto],
              ['Recurso', no.ref_nome && `${no.ref_tipo}: ${no.ref_nome}`],
              ['Fonte de medição', no.fonte_medicao],
              ['Volume', no.volume_medido != null && `${ni(no.volume_medido)} (+${ni(Math.round(no.volume_mes))}/mês)`],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, padding: '5px 0', borderTop: '1px solid #F1EFEB' }}>
                <dt style={{ color: '#6E6A64', minWidth: 108 }}>{k}</dt>
                <dd style={{ margin: 0, color: '#1A1A18' }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div style={{ marginTop: 16, paddingTop: 13, borderTop: '1px solid #E4E1DC' }}>
            <label style={{ fontSize: 11, color: '#6E6A64', marginBottom: 4, display: 'block' }}>
              Área responsável
            </label>
            <select value={no.area_id || ''}
              onChange={(e) => onSalvar(no.chave, { area_id: e.target.value || null })}
              style={{
                width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '6px 8px',
                border: '1px solid #E4E1DC', borderRadius: 3, background: '#fff',
              }}>
              <option value="">— sem área —</option>
              {(areas || []).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <div style={{ fontSize: 11, color: '#6E6A64', marginTop: 5, lineHeight: 1.45 }}>
              Vale para qualquer passo, mesmo os que não são automação — o e-mail que chega
              na caixa do Comercial é do Comercial.
            </div>
          </div>

          <BlocoAutomacao no={no} projetos={projetos} ganhos={ganhos}
            onVincular={onVincular} onCriarProjeto={onCriarProjeto}
            onCriarTarefa={onCriarTarefa} onRecarregar={onRecarregar} />

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setEdicao(true)} style={{
              fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
              border: '1px solid #E4E1DC', background: '#fff', borderRadius: 3, padding: '6px 12px',
            }}>Editar</button>
            {onExcluir && (
              <button onClick={() => onExcluir(no.chave)} style={{
                fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', color: '#B42318',
                border: '1px solid #F3C6C0', background: '#fff', borderRadius: 3, padding: '6px 12px',
              }}>Excluir</button>
            )}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12 }}>
          <label style={rot}>Nome</label>
          <input style={campo} value={f.rotulo} onChange={(e) => setF({ ...f, rotulo: e.target.value })} />
          <label style={rot}>Descrição</label>
          <textarea style={{ ...campo, minHeight: 74, resize: 'vertical' }}
            value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
          <label style={rot}>Sistema</label>
          <select style={campo} value={f.sistema} onChange={(e) => setF({ ...f, sistema: e.target.value })}>
            {Object.keys(SISTEMA).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label style={rot}>Tipo</label>
          <select style={campo} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {Object.keys(FORMA).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={gravar} disabled={salvando} style={{
              fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', color: '#fff',
              border: 'none', background: '#1A1A18', borderRadius: 3, padding: '7px 14px',
            }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button onClick={() => setEdicao(false)} style={{
              fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
              border: '1px solid #E4E1DC', background: '#fff', borderRadius: 3, padding: '7px 12px',
            }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}


function NovoNo({ onCriar, onFechar }) {
  const [f, setF] = useState({ rotulo: '', sistema: 'Supabase', tipo: 'passo', descricao: '' })
  const [salvando, setSalvando] = useState(false)
  const campo = {
    width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '6px 8px',
    border: '1px solid #E4E1DC', borderRadius: 3, marginBottom: 9, background: '#fff',
  }
  const rot = { fontSize: 11, color: '#6E6A64', marginBottom: 3, display: 'block' }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A18' }}>Novo nó</h3>
        <button onClick={onFechar} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: '#9A958E', fontSize: 16, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>
      <p style={{ fontSize: 11.5, color: '#6E6A64', lineHeight: 1.5, margin: '8px 0 14px' }}>
        O nó aparece no canto superior esquerdo. Arraste para posicionar e puxe de uma bolinha
        até outro nó para ligar.
      </p>
      <label style={rot}>Nome</label>
      <input style={campo} value={f.rotulo} autoFocus
             onChange={(e) => setF({ ...f, rotulo: e.target.value })}
             placeholder="Ex: Aprovação do gestor" />
      <label style={rot}>Sistema</label>
      <select style={campo} value={f.sistema} onChange={(e) => setF({ ...f, sistema: e.target.value })}>
        {Object.keys(SISTEMA).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <label style={rot}>Tipo</label>
      <select style={campo} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
        {Object.keys(FORMA).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <label style={rot}>Descrição</label>
      <textarea style={{ ...campo, minHeight: 64, resize: 'vertical' }}
                value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
      <button
        disabled={!f.rotulo.trim() || salvando}
        onClick={async () => { setSalvando(true); await onCriar(f); setSalvando(false) }}
        style={{
          fontFamily: 'inherit', fontSize: 12.5, cursor: f.rotulo.trim() ? 'pointer' : 'not-allowed',
          color: '#fff', border: 'none', background: f.rotulo.trim() ? '#1A1A18' : '#C9C5BE',
          borderRadius: 3, padding: '7px 14px',
        }}>{salvando ? 'Criando…' : 'Criar nó'}</button>
    </div>
  )
}


// Liga o nó do processo ao controle de automações: enquanto se desenha o
// fluxo, já se registra o que foi automatizado e quanto tempo custava.
function BlocoAutomacao({ no, projetos, ganhos, onVincular, onCriarProjeto, onCriarTarefa, onRecarregar }) {
  const [modo, setModo] = useState(null)          // vincular | novoProjeto | novaTarefa
  const [sel, setSel] = useState(no.projeto_id || '')
  const [nome, setNome] = useState(no.rotulo)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const [t, setT] = useState({ tarefa: '', min_antes: '', min_depois: '0', ocorrencias: '', quem: '', setor: no.area || '' })

  useEffect(() => { setSel(no.projeto_id || ''); setModo(null); setMsg('') }, [no.chave])

  const meus = (ganhos || []).filter((g) => g.projeto_id === no.projeto_id)
  const campo = {
    width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '6px 8px',
    border: '1px solid #E4E1DC', borderRadius: 3, marginBottom: 8, background: '#fff',
  }
  const rot = { fontSize: 11, color: '#6E6A64', marginBottom: 3, display: 'block' }
  const btn = (primario) => ({
    fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: '6px 11px', borderRadius: 3,
    border: primario ? 'none' : '1px solid #E4E1DC',
    background: primario ? '#1A1A18' : '#fff', color: primario ? '#fff' : '#1A1A18',
  })

  const aviso = (texto) => { setMsg(texto); setTimeout(() => setMsg(''), 5000) }

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #E4E1DC' }}>
      <div style={{ fontSize: 11, color: '#6E6A64', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        Automação deste passo
      </div>

      {no.nome_projeto ? (
        <div style={{ fontSize: 12.5, color: '#1A1A18', marginBottom: 8 }}>
          {no.nome_projeto}
          {meus.length > 0 && (
            <div style={{ marginTop: 7 }}>
              {meus.map((g) => (
                <div key={g.id} style={{ fontSize: 11.5, color: '#6E6A64', padding: '3px 0', lineHeight: 1.4 }}>
                  · {g.tarefa}
                  <span style={{ color: '#1A1A18' }}>
                    {' '}{Number(g.min_antes)} → {Number(g.min_depois)} min
                    {g.horas_acumuladas ? ` · ${Number(g.horas_acumuladas).toFixed(1)} h` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#A2600F', marginBottom: 8 }}>
          Este passo ainda não está ligado a nenhuma automação.
        </div>
      )}

      {!modo && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={btn(false)} onClick={() => setModo('vincular')}>
            {no.projeto_id ? 'Trocar automação' : 'Vincular automação'}
          </button>
          <button style={btn(false)} onClick={() => setModo('novoProjeto')}>+ Nova automação</button>
          {no.projeto_id && (
            <button style={btn(true)} onClick={() => setModo('novaTarefa')}>+ Tarefa e tempo</button>
          )}
        </div>
      )}

      {modo === 'vincular' && (
        <div style={{ marginTop: 10 }}>
          <label style={rot}>Automação</label>
          <select style={campo} value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">— sem automação —</option>
            {(projetos || []).map((p) => (
              <option key={p.id} value={p.id}>{p.nome_projeto}{p.setor ? ` · ${p.setor}` : ''}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn(true)} disabled={ocupado} onClick={async () => {
              setOcupado(true)
              try { await onVincular(no.chave, sel); aviso('Vinculado.') }
              catch (e) { aviso(String(e.message ?? e)) }
              setOcupado(false); setModo(null)
            }}>{ocupado ? 'Salvando…' : 'Salvar'}</button>
            <button style={btn(false)} onClick={() => setModo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {modo === 'novoProjeto' && (
        <div style={{ marginTop: 10 }}>
          <label style={rot}>Nome da automação</label>
          <input style={campo} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn(true)} disabled={ocupado || !nome.trim()} onClick={async () => {
              setOcupado(true)
              try {
                const id = await onCriarProjeto(nome.trim(), no.area)
                if (id) { await onVincular(no.chave, id); aviso('Automação criada e vinculada.') }
              } catch (e) { aviso(String(e.message ?? e)) }
              setOcupado(false); setModo(null)
            }}>{ocupado ? 'Criando…' : 'Criar e vincular'}</button>
            <button style={btn(false)} onClick={() => setModo(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {modo === 'novaTarefa' && (
        <div style={{ marginTop: 10 }}>
          <label style={rot}>O que a pessoa fazia à mão</label>
          <input style={campo} value={t.tarefa} autoFocus
                 placeholder="Ex: conferir nota por nota antes de lançar"
                 onChange={(e) => setT({ ...t, tarefa: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={rot}>Min antes</label>
              <input style={campo} type="number" step="0.5" value={t.min_antes}
                     onChange={(e) => setT({ ...t, min_antes: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={rot}>Min hoje</label>
              <input style={campo} type="number" step="0.5" value={t.min_depois}
                     onChange={(e) => setT({ ...t, min_depois: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={rot}>Vezes/mês</label>
              <input style={campo} type="number" value={t.ocorrencias}
                     onChange={(e) => setT({ ...t, ocorrencias: e.target.value })} />
            </div>
          </div>
          <label style={rot}>Quem executava</label>
          <input style={campo} value={t.quem} onChange={(e) => setT({ ...t, quem: e.target.value })} />
          {t.min_antes && t.ocorrencias && (
            <div style={{ fontSize: 11.5, color: '#12805C', marginBottom: 8 }}>
              Economia estimada:{' '}
              {(((Number(t.min_antes) - Number(t.min_depois || 0)) * Number(t.ocorrencias)) / 60).toFixed(1)} h/mês
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn(true)} disabled={ocupado || !t.tarefa.trim()} onClick={async () => {
              setOcupado(true)
              try {
                await onCriarTarefa(no.projeto_id, t)
                setT({ tarefa: '', min_antes: '', min_depois: '0', ocorrencias: '', quem: '', setor: no.area || '' })
                await onRecarregar()
                aviso('Tarefa registrada.')
              } catch (e) { aviso(String(e.message ?? e)) }
              setOcupado(false); setModo(null)
            }}>{ocupado ? 'Salvando…' : 'Registrar tarefa'}</button>
            <button style={btn(false)} onClick={() => setModo(null)}>Cancelar</button>
          </div>
          <div style={{ fontSize: 11, color: '#6E6A64', marginTop: 8, lineHeight: 1.5 }}>
            O volume informado aqui é declarado. Para virar contagem automática, a tarefa precisa de
            uma fonte de medição ligada em Controle de Automações.
          </div>
        </div>
      )}

      {msg && <div style={{ fontSize: 11.5, color: '#1F60A8', marginTop: 8 }}>{msg}</div>}
    </div>
  )
}


// Painel da ligação. O rótulo é o que dá sentido à seta: duas saídas de uma
// decisão precisam dizer "sim" e "não", não "é PO" nas duas.
function DetalheLigacao({ ligacao, deNome, paraNome, onSalvar, onRemover, onFechar }) {
  const [f, setF] = useState({ rotulo: ligacao.rotulo || '', tipo: ligacao.tipo || 'dados', observacao: ligacao.observacao || '' })
  const [salvando, setSalvando] = useState(false)
  useEffect(() => {
    setF({ rotulo: ligacao.rotulo || '', tipo: ligacao.tipo || 'dados', observacao: ligacao.observacao || '' })
  }, [ligacao.id])

  const campo = {
    width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '6px 8px',
    border: '1px solid #E4E1DC', borderRadius: 3, marginBottom: 9, background: '#fff',
  }
  const rot = { fontSize: 11, color: '#6E6A64', marginBottom: 3, display: 'block' }

  const TIPOS = [
    ['dados', 'Dados', 'Algo passa adiante: arquivo, registro, informação'],
    ['gatilho', 'Gatilho', 'Um dispara o outro, sem carregar conteúdo'],
    ['condicional', 'Condicional', 'Só segue se uma condição for verdadeira'],
    ['notificacao', 'Notificação', 'Aviso a alguém, não continuidade do fluxo'],
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#1A1A18' }}>Ligação</h3>
        <button onClick={onFechar} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: '#9A958E', fontSize: 16, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>

      <div style={{ fontSize: 12, color: '#4A4741', margin: '10px 0 14px', lineHeight: 1.5 }}>
        <strong>{deNome}</strong>
        <span style={{ color: '#9A958E' }}> → </span>
        <strong>{paraNome}</strong>
      </div>

      <label style={rot}>Rótulo</label>
      <input style={campo} value={f.rotulo} autoFocus
             placeholder="Ex: sim, não, anexo PDF, aprovado"
             onChange={(e) => setF({ ...f, rotulo: e.target.value })} />

      <label style={rot}>Tipo</label>
      <select style={campo} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
        {TIPOS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
      </select>
      <div style={{ fontSize: 11, color: '#6E6A64', marginTop: -4, marginBottom: 10, lineHeight: 1.45 }}>
        {TIPOS.find(([k]) => k === f.tipo)?.[2]}
      </div>

      <label style={rot}>Observação</label>
      <textarea style={{ ...campo, minHeight: 54, resize: 'vertical' }}
                value={f.observacao}
                onChange={(e) => setF({ ...f, observacao: e.target.value })} />

      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={salvando} onClick={async () => {
          setSalvando(true)
          await onSalvar(ligacao.id, {
            rotulo: f.rotulo.trim() || null, tipo: f.tipo,
            observacao: f.observacao.trim() || null,
          })
          setSalvando(false)
        }} style={{
          fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', color: '#fff',
          border: 'none', background: '#1A1A18', borderRadius: 3, padding: '7px 14px',
        }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={() => {
          if (window.confirm('Remover esta ligação?')) { onRemover(ligacao.id); onFechar() }
        }} style={{
          fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', color: '#B42318',
          border: '1px solid #F3C6C0', background: '#fff', borderRadius: 3, padding: '7px 12px',
        }}>Remover</button>
      </div>
    </div>
  )
}
