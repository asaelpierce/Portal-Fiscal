import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch } from '../config.js'
import { Spinner, EmptyState, Btn } from '../components/UI.jsx'

// ============================================================================
// Entregas — o que foi feito, por semana e por mês.
//
// Pensada para o gestor: ele abre e vê o ritmo, não a lista de 38 projetos.
// A origem é o histórico de commits dos dois portais, que é a fonte mais
// honesta que existe — data real e descrição do que foi feito, sem ninguém
// preencher de memória depois.
// ============================================================================

const PAPEL = '#FBFAF8', TINTA = '#1A1A18', TRACO = '#E4E1DC', SUAVE = '#6E6A64'
const COR_TIPO = {
  funcionalidade: { rot: 'Novidade', cor: '#12805C', bg: '#E9F7F1' },
  melhoria:       { rot: 'Melhoria', cor: '#1F60A8', bg: '#EAF1FA' },
  correcao:       { rot: 'Correção', cor: '#B45309', bg: '#FDF3E7' },
}
const COR_AREA = {
  Fiscal: '#9A3412', Custeio: '#B5502A', Comercial: '#1F60A8', Processos: '#6D28D9',
  Almoxarifado: '#3D86CC', Engenharia: '#0D2B54', PCP: '#0E7490',
  Qualidade: '#A2600F', 'Logística': '#166534', Geral: '#6E6A64',
}

const ni = (v) => Number(v ?? 0).toLocaleString('pt-BR')
const dtBR = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'

export default function Entregas() {
  const [linhas, setLinhas] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [visao, setVisao] = useState('semana')
  const [abertoSem, setAbertoSem] = useState(null)
  const [abertoMes, setAbertoMes] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const d = await sbFetch('entrega?select=*&order=data.desc')
        setLinhas(d || []); setFase('pronto')
      } catch (e) { setErro(e.message); setFase('erro') }
    })()
  }, [])

  const semanas = useMemo(() => {
    const m = new Map()
    for (const l of linhas) {
      const d = new Date(l.data + 'T00:00:00')
      const dia = (d.getDay() + 6) % 7            // segunda = 0
      const ini = new Date(d); ini.setDate(d.getDate() - dia)
      const k = ini.toISOString().slice(0, 10)
      if (!m.has(k)) m.set(k, { chave: k, inicio: ini, itens: [] })
      m.get(k).itens.push(l)
    }
    return [...m.values()].sort((a, b) => b.chave.localeCompare(a.chave))
  }, [linhas])

  const meses = useMemo(() => {
    const m = new Map()
    for (const l of linhas) {
      const k = l.data.slice(0, 7)
      if (!m.has(k)) m.set(k, { chave: k, itens: [] })
      m.get(k).itens.push(l)
    }
    return [...m.values()].sort((a, b) => b.chave.localeCompare(a.chave))
  }, [linhas])

  const conta = (itens, tipo) => itens.filter(i => i.tipo === tipo).length
  const areas = (itens) => [...new Set(itens.map(i => i.area))].sort()

  const totais = useMemo(() => ({
    total: linhas.length,
    novidades: conta(linhas, 'funcionalidade'),
    melhorias: conta(linhas, 'melhoria'),
    correcoes: conta(linhas, 'correcao'),
    areas: areas(linhas).length,
    semanas: semanas.length,
  }), [linhas, semanas])

  const nomeMes = (k) => {
    const [a, m] = k.split('-')
    return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
  const periodo = (ini) => {
    const f = new Date(ini); f.setDate(ini.getDate() + 6)
    const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return `${fmt(ini)} a ${fmt(f)}`
  }

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return <EmptyState title="Não foi possível carregar" text={erro} />
  }

  const Barra = ({ itens }) => {
    const t = itens.length || 1
    return (
      <span style={{ display: 'inline-flex', height: 7, width: 130, borderRadius: 4,
                     overflow: 'hidden', background: '#EFECE7', verticalAlign: 'middle' }}>
        {['funcionalidade', 'melhoria', 'correcao'].map(k => {
          const n = conta(itens, k)
          return n > 0 ? <span key={k} title={`${n} ${COR_TIPO[k].rot.toLowerCase()}`}
            style={{ width: `${(n / t) * 100}%`, background: COR_TIPO[k].cor }} /> : null
        })}
      </span>
    )
  }

  const Detalhe = ({ itens }) => {
    const porArea = {}
    itens.forEach(i => { (porArea[i.area] = porArea[i.area] || []).push(i) })
    return (
      <div style={{ borderTop: `1px solid ${TRACO}`, padding: '12px 16px', background: '#FDFCFA' }}>
        {Object.entries(porArea).sort((a, b) => b[1].length - a[1].length).map(([area, its]) => (
          <div key={area} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COR_AREA[area] || SUAVE,
                          marginBottom: 5, letterSpacing: '.03em' }}>
              {area.toUpperCase()} · {its.length}
            </div>
            {its.map(i => (
              <div key={i.id} style={{ display: 'flex', gap: 9, alignItems: 'baseline', padding: '3px 0' }}>
                <span style={{ fontSize: 10, fontWeight: 700, minWidth: 64, textAlign: 'center',
                               color: COR_TIPO[i.tipo]?.cor, background: COR_TIPO[i.tipo]?.bg,
                               padding: '2px 5px', borderRadius: 3 }}>
                  {COR_TIPO[i.tipo]?.rot}
                </span>
                <span style={{ fontSize: 10.5, color: '#9A958E', minWidth: 58 }}>{dtBR(i.data)}</span>
                <span style={{ fontSize: 12.5, color: '#4A4741', lineHeight: 1.45 }}>{i.titulo}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: PAPEL, margin: '-22px -26px -60px', padding: '30px 26px 56px', minHeight: '100%' }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TINTA }}>Entregas</h2>
      <p style={{ margin: '6px 0 20px', fontSize: 12.5, color: SUAVE, maxWidth: 700, lineHeight: 1.55 }}>
        O que foi entregue nos portais, semana a semana. O registro vem do histórico de
        desenvolvimento, com data real de cada alteração.
      </p>

      <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginBottom: 22 }}>
        {[
          ['Entregas no período', ni(totais.total)],
          ['Novidades', ni(totais.novidades)],
          ['Melhorias', ni(totais.melhorias)],
          ['Correções', ni(totais.correcoes)],
          ['Áreas atendidas', ni(totais.areas)],
          ['Média por semana', totais.semanas ? (totais.total / totais.semanas).toFixed(1) : '0'],
        ].map(([r, v]) => (
          <div key={r}>
            <div style={{ fontSize: 11.5, color: SUAVE, marginBottom: 5 }}>{r}</div>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22, color: TINTA, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {[['semana', 'Por semana'], ['mes', 'Por mês']].map(([k, r]) => (
          <button key={k} onClick={() => setVisao(k)} style={{
            fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '6px 14px',
            border: `1px solid ${visao === k ? TINTA : TRACO}`, borderRadius: 3,
            background: visao === k ? TINTA : 'transparent', color: visao === k ? PAPEL : SUAVE,
            fontWeight: visao === k ? 600 : 400,
          }}>{r}</button>
        ))}
      </div>

      {visao === 'semana' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {semanas.map((s, idx) => {
            const ab = abertoSem === s.chave
            return (
              <div key={s.chave} style={{ background: '#fff', border: `1px solid ${TRACO}` }}>
                <button onClick={() => setAbertoSem(ab ? null : s.chave)} aria-expanded={ab}
                  style={{ width: '100%', display: 'grid',
                           gridTemplateColumns: '16px 150px 70px 140px 1fr',
                           gap: 14, alignItems: 'center', padding: '12px 16px',
                           background: 'transparent', border: 'none', cursor: 'pointer',
                           fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 10, color: SUAVE,
                                 transform: ab ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}>▶</span>
                  <span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: TINTA }}>{periodo(s.inicio)}</span>
                    {idx === 0 && <span style={{ fontSize: 10, color: '#12805C', marginLeft: 7 }}>atual</span>}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 17, color: TINTA }}>
                    {s.itens.length}
                  </span>
                  <Barra itens={s.itens} />
                  <span style={{ fontSize: 11.5, color: SUAVE, overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {areas(s.itens).join(' · ')}
                  </span>
                </button>
                {ab && <Detalhe itens={s.itens} />}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {meses.map(m => {
            const ab = abertoMes === m.chave
            return (
              <div key={m.chave} style={{ background: '#fff', border: `1px solid ${TRACO}` }}>
                <button onClick={() => setAbertoMes(ab ? null : m.chave)} aria-expanded={ab}
                  style={{ width: '100%', display: 'grid',
                           gridTemplateColumns: '16px 170px 70px 140px 1fr',
                           gap: 14, alignItems: 'center', padding: '13px 16px',
                           background: 'transparent', border: 'none', cursor: 'pointer',
                           fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 10, color: SUAVE,
                                 transform: ab ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}>▶</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: TINTA, textTransform: 'capitalize' }}>
                    {nomeMes(m.chave)}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 18, color: TINTA }}>
                    {m.itens.length}
                  </span>
                  <Barra itens={m.itens} />
                  <span style={{ fontSize: 11.5, color: SUAVE }}>
                    {conta(m.itens, 'funcionalidade')} novidades · {areas(m.itens).length} áreas
                  </span>
                </button>
                {ab && <Detalhe itens={m.itens} />}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 11, color: SUAVE, marginTop: 16, lineHeight: 1.5 }}>
        Clique na linha para ver o que foi feito, agrupado por área.
        <span style={{ marginLeft: 10 }}>
          {Object.entries(COR_TIPO).map(([k, v]) => (
            <span key={k} style={{ marginRight: 12 }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, background: v.cor,
                             borderRadius: 2, marginRight: 4 }} />{v.rot}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
