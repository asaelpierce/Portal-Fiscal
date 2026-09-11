import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
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
  const s = info(data.sistema)
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

const CORLINHA = { dados: '#8B8781', gatilho: '#1F60A8', notificacao: '#B45309', condicional: '#6D28D9' }

export default function MapaFluxos({ embutido = false }) {
  const [nos, setNos, aoMudarNos] = useNodesState([])
  const [linhas, setLinhas, aoMudarLinhas] = useEdgesState([])
  const [bruto, setBruto] = useState([])
  const [orfaos, setOrfaos] = useState([])
  const [sel, setSel] = useState(null)
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)
  const [filtro, setFiltro] = useState('todos')

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const [m, c, o] = await Promise.all([
        sbFetch('fluxo_mapa?select=*&ativo=eq.true'),
        sbFetch('fluxo_conexao?select=*'),
        sbFetch('fluxo_orfaos?select=*'),
      ])
      setBruto(m || [])
      setOrfaos(o || [])
      setNos((m || []).map((n) => ({
        id: n.chave, type: 'fluxo', position: { x: n.x, y: n.y }, data: { ...n },
      })))
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

  useEffect(() => { carregar() }, [carregar])

  const salvarPosicoes = async () => {
    setSalvando(true)
    try {
      await Promise.all(nos.map((n) =>
        fetch(`${SUPABASE_URL}/rest/v1/fluxo_no?chave=eq.${encodeURIComponent(n.id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            x: Math.round(n.position.x), y: Math.round(n.position.y),
            atualizado_em: new Date().toISOString(),
          }),
        })))
      setSujo(false)
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  const salvarNo = async (chave, campos) => {
    await fetch(`${SUPABASE_URL}/rest/v1/fluxo_no?chave=eq.${encodeURIComponent(chave)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ ...campos, atualizado_em: new Date().toISOString() }),
    })
    await carregar()
  }

  const sistemas = useMemo(
    () => ['todos', ...Array.from(new Set(bruto.map((n) => n.sistema)))],
    [bruto],
  )
  const nosFiltrados = useMemo(
    () => filtro === 'todos' ? nos : nos.map((n) => ({
      ...n, style: { opacity: n.data.sistema === filtro ? 1 : .22 },
    })),
    [nos, filtro],
  )

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return <EmptyState title="Não foi possível carregar o mapa" text={erro}>
      <Btn primary onClick={carregar}>Tentar de novo</Btn>
    </EmptyState>
  }

  const selNo = sel ? bruto.find((n) => n.chave === sel) : null

  return (
    <div style={ embutido
      ? { height: 'calc(100vh - 250px)', minHeight: 460, display: 'flex', flexDirection: 'column' }
      : { margin: '-22px -26px -60px', height: 'calc(100vh - 62px)', display: 'flex', flexDirection: 'column' } }>
      <div style={{
        padding: '12px 26px', borderBottom: '1px solid #E4E1DC', background: '#fff',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18' }}>Mapa dos processos</div>
        <div style={{ fontSize: 12, color: '#6E6A64' }}>
          {bruto.length} nós · {linhas.length} ligações
        </div>

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
        <div style={{ flex: 1, background: '#FBFAF8' }}>
          <ReactFlow
            nodes={nosFiltrados}
            edges={linhas}
            nodeTypes={tiposNo}
            onNodesChange={(ch) => {
              aoMudarNos(ch)
              if (ch.some((c) => c.type === 'position' && c.dragging === false)) setSujo(true)
            }}
            onEdgesChange={aoMudarLinhas}
            onNodeClick={(_, n) => setSel(n.id)}
            onPaneClick={() => setSel(null)}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#DCD8D1" gap={22} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable zoomable
              nodeColor={(n) => info(n.data?.sistema).cor}
              style={{ background: '#F4F2EE', border: '1px solid #E4E1DC' }}
            />
          </ReactFlow>
        </div>

        {(selNo || orfaos.length > 0) && (
          <aside style={{
            width: 316, borderLeft: '1px solid #E4E1DC', background: '#fff',
            overflowY: 'auto', padding: '18px 20px',
          }}>
            {selNo ? (
              <DetalheNo no={selNo} onSalvar={salvarNo} onFechar={() => setSel(null)} />
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

function DetalheNo({ no, onSalvar, onFechar }) {
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
          <button onClick={() => setEdicao(true)} style={{
            marginTop: 16, fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
            border: '1px solid #E4E1DC', background: '#fff', borderRadius: 3, padding: '6px 12px',
          }}>Editar</button>
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
