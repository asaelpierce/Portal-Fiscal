import React, { useEffect, useMemo, useRef, useState } from 'react'
import { sbFetch } from '../config.js'
import { Spinner, EmptyState, Btn } from '../components/UI.jsx'

/* ---------------------------------------------------------------
   Paleta: um único tom de azul do escuro ao claro, ordenado por
   tamanho da tarefa. Cor é hierarquia, não enfeite.
   O âmbar tem um uso só: marcar número que depende de baseline
   declarado em vez de contagem no banco.
----------------------------------------------------------------*/
const RAMPA = ['#0D2B54', '#164680', '#1F60A8', '#2F7AC4', '#4B93D6', '#6BAAE2', '#8CBFEC']
const PAPEL = '#FBFAF8'
const TINTA = '#1A1A18'
const TRACO = '#E4E1DC'
const SUAVE = '#6E6A64'
const SINAL = '#A2600F'

const nf = (v, d = 1) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const ni = (v) => Number(v ?? 0).toLocaleString('pt-BR')

// 517.6 -> "517h 36min"
const hm = (h) => {
  const v = Number(h) || 0
  const inteiras = Math.floor(v)
  const min = Math.round((v - inteiras) * 60)
  return min ? `${ni(inteiras)}h ${min}min` : `${ni(inteiras)}h`
}

const num = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }

export default function Economia() {
  const [totais, setTotais] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [setores, setSetores] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [foco, setFoco] = useState(null)      // tarefa em destaque
  const [horizonte, setHorizonte] = useState('acumulado')  // acumulado | ano
  const [revelar, setRevelar] = useState(false)
  const jaRevelou = useRef(false)

  const carregar = async () => {
    setErro('')
    try {
      const [t, g, s] = await Promise.all([
        sbFetch('automacao_ganhos_totais?select=*'),
        sbFetch('automacao_ganhos_tarefas?select=*&order=horas_acumuladas.desc'),
        sbFetch('automacao_ganhos_por_setor?select=*&order=horas_acumuladas.desc'),
      ])
      setTotais(t?.[0] || null)
      setTarefas(g || [])
      setSetores(s || [])
      setFase('pronto')
    } catch (e) {
      setErro(e.message)
      setFase('erro')
    }
  }

  useEffect(() => { carregar() }, [])

  // um único momento de animação, na primeira carga
  useEffect(() => {
    if (fase !== 'pronto' || jaRevelou.current) return
    jaRevelou.current = true
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduz) { setRevelar(true); return }
    const id = requestAnimationFrame(() => setRevelar(true))
    return () => cancelAnimationFrame(id)
  }, [fase])

  const porAno = horizonte === 'ano'
  const campo = porAno ? 'horas_ano' : 'horas_acumuladas'

  const lista = useMemo(
    () => [...tarefas]
      .map((t, i) => ({ ...t, cor: RAMPA[i % RAMPA.length], valor: Number(t[campo]) || 0 }))
      .sort((a, b) => b.valor - a.valor)
      .map((t, i) => ({ ...t, cor: RAMPA[i % RAMPA.length] })),
    [tarefas, campo],
  )

  const total = useMemo(() => lista.reduce((s, t) => s + t.valor, 0), [lista])
  const maiorSetor = useMemo(
    () => Math.max(1, ...setores.map((s) => Number(s.horas_acumuladas) || 0)),
    [setores],
  )
  const temBaseline = lista.some((t) => t.tem_baseline_declarado)

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return (
      <EmptyState title="Não foi possível carregar a economia" text={erro}>
        <Btn primary onClick={carregar}>Tentar de novo</Btn>
      </EmptyState>
    )
  }
  if (!lista.length) {
    return (
      <EmptyState
        title="Nenhuma tarefa medida ainda"
        text="Cadastre o ganho de uma automação em Controle de Automações para o cálculo começar."
      />
    )
  }

  const th = (a) => ({
    padding: '10px 14px', textAlign: a || 'left', fontSize: 11.5, fontWeight: 500,
    color: SUAVE, borderBottom: `1px solid ${TRACO}`, whiteSpace: 'nowrap',
  })
  const td = (a) => ({
    padding: '13px 14px', textAlign: a || 'left', fontSize: 13,
    borderBottom: `1px solid ${TRACO}`, color: TINTA,
  })

  return (
    <div style={{ background: PAPEL, margin: '-22px -26px -60px', padding: '30px 26px 56px', minHeight: '100%' }}>
      <style>{`
        @keyframes ec-crescer { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .ec-seg { transform-origin: left center; }
        .ec-linha:hover { background: #F4F2EE; }
        .ec-chip:focus-visible { outline: 2px solid ${TINTA}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .ec-seg { animation: none !important } }
      `}</style>

      {/* ---------- topo: leitura de instrumento ---------- */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 28, flexWrap: 'wrap', paddingBottom: 22,
      }}>
        <div>
          <div style={{ fontSize: 14, color: SUAVE, marginBottom: 10 }}>
            {porAno ? 'Horas devolvidas ao time por ano' : 'Horas devolvidas ao time até agora'}
          </div>
          <div style={{
            ...num, fontSize: 78, fontWeight: 300, letterSpacing: '-.035em',
            lineHeight: .88, color: TINTA,
          }}>
            {nf(total)}
          </div>
          <div style={{ fontSize: 14, color: SUAVE, marginTop: 12 }}>
            equivalem a <strong style={{ color: TINTA, fontWeight: 600 }}>
              {nf(total / 8)} dias
            </strong> de trabalho de 8 horas
          </div>
        </div>

        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[
            ['Tarefas eliminadas', ni(totais?.tarefas), `em ${ni(totais?.projetos)} automações`],
            ['Itens processados',  ni(totais?.eventos_processados), 'contados no banco'],
            ['Folhas não impressas', ni(totais?.folhas_evitadas), 'checklist em papel'],
          ].map(([rot, val, sub]) => (
            <div key={rot} style={{ minWidth: 116 }}>
              <div style={{ fontSize: 12.5, color: SUAVE, marginBottom: 6 }}>{rot}</div>
              <div style={{ ...num, fontSize: 27, fontWeight: 400, color: TINTA, lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 11.5, color: SUAVE, marginTop: 5 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* alternância de horizonte */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 26 }}>
        {[['acumulado', 'Acumulado'], ['ano', 'Projeção anual']].map(([k, r]) => (
          <button key={k} className="ec-chip" onClick={() => setHorizonte(k)}
            style={{
              border: `1px solid ${horizonte === k ? TINTA : TRACO}`,
              background: horizonte === k ? TINTA : 'transparent',
              color: horizonte === k ? PAPEL : SUAVE,
              borderRadius: 2, padding: '6px 13px', fontSize: 12.5,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            {r}
          </button>
        ))}
      </div>

      {/* ---------- a barra: o programa inteiro em proporção ---------- */}
      <div style={{ display: 'flex', height: 74, marginBottom: 14, overflow: 'hidden' }}>
        {lista.map((t, i) => {
          const pct = total ? (t.valor / total) * 100 : 0
          const ativo = foco === null || foco === t.id
          return (
            <div
              key={t.id}
              className="ec-seg"
              onMouseEnter={() => setFoco(t.id)}
              onMouseLeave={() => setFoco(null)}
              title={`${t.tarefa} — ${hm(t.valor)}`}
              style={{
                width: `${pct}%`,
                background: t.tem_baseline_declarado
                  ? `repeating-linear-gradient(135deg, ${t.cor} 0 7px, ${t.cor}D9 7px 14px)`
                  : t.cor,
                opacity: ativo ? 1 : .32,
                transition: 'opacity .18s ease',
                animation: revelar ? `ec-crescer .5s ${i * 0.05}s cubic-bezier(.2,.7,.3,1) both` : 'none',
                transform: revelar ? undefined : 'scaleX(0)',
                borderRight: i < lista.length - 1 ? `1px solid ${PAPEL}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'default',
              }}
            >
              {pct > 8 && (
                <span style={{
                  ...num, color: i <= 2 ? '#fff' : '#0D2B54', fontSize: 15, fontWeight: 500,
                  textShadow: i <= 2 ? '0 1px 2px rgba(0,0,0,.25)' : 'none',
                }}>
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* legenda */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))',
        gap: '11px 22px', marginBottom: 40,
      }}>
        {lista.map((t) => (
          <div key={t.id}
            onMouseEnter={() => setFoco(t.id)} onMouseLeave={() => setFoco(null)}
            style={{
              display: 'flex', gap: 9, alignItems: 'baseline',
              opacity: foco === null || foco === t.id ? 1 : .4, transition: 'opacity .18s ease',
            }}>
            <span style={{
              width: 9, height: 9, flexShrink: 0, background: t.cor,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.14)',
              transform: 'translateY(-1px)',
            }} />
            <span style={{ fontSize: 12.5, color: TINTA, lineHeight: 1.35 }}>
              {t.tarefa}
              {t.tem_baseline_declarado && (
                <span title="Parte do volume vem de número declarado, não de contagem no banco"
                      style={{ color: SINAL, marginLeft: 5, fontWeight: 600 }}>*</span>
              )}
              <span style={{ ...num, color: SUAVE, marginLeft: 7 }}>{hm(t.valor)}</span>
            </span>
          </div>
        ))}
      </div>

      {/* ---------- por setor ---------- */}
      <h2 style={{ fontSize: 17, fontWeight: 600, color: TINTA, margin: '0 0 4px' }}>
        Quem ganhou esse tempo
      </h2>
      <p style={{ fontSize: 12.5, color: SUAVE, margin: '0 0 20px', maxWidth: 620, lineHeight: 1.55 }}>
        Tarefas que atravessam mais de um setor são divididas por igual entre eles. O Checklist
        Digital, por exemplo, entra em Comercial, Engenharia e Fiscal.
      </p>

      <div style={{ marginBottom: 40, maxWidth: 780 }}>
        {setores.map((s) => {
          const v = Number(s.horas_acumuladas) || 0
          return (
            <div key={s.setor} style={{
              display: 'grid', gridTemplateColumns: '132px 1fr 96px',
              alignItems: 'center', gap: 16, padding: '11px 0',
              borderBottom: `1px solid ${TRACO}`,
            }}>
              <div style={{ fontSize: 13.5, color: TINTA }}>{s.setor}</div>
              <div style={{ height: 9, background: '#EFEDE8' }}>
                <div className="ec-seg" style={{
                  width: `${(v / maiorSetor) * 100}%`, height: '100%', background: RAMPA[1],
                  animation: revelar ? 'ec-crescer .55s .12s cubic-bezier(.2,.7,.3,1) both' : 'none',
                }} />
              </div>
              <div style={{ ...num, fontSize: 13.5, textAlign: 'right', color: TINTA }}>
                {nf(v)} h
              </div>
            </div>
          )
        })}
      </div>

      {/* ---------- tabela ---------- */}
      <h2 style={{ fontSize: 17, fontWeight: 600, color: TINTA, margin: '0 0 4px' }}>
        Como cada número foi apurado
      </h2>
      <p style={{ fontSize: 12.5, color: SUAVE, margin: '0 0 16px', maxWidth: 620, lineHeight: 1.55 }}>
        O volume vem da contagem real no banco. O tempo por item foi informado por quem
        executava a tarefa antes da automação.
      </p>

      <div style={{ overflowX: 'auto', border: `1px solid ${TRACO}`, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th()}>Tarefa</th>
              <th style={th()}>Automação</th>
              <th style={th('right')}>Volume</th>
              <th style={th('right')}>Min/item</th>
              <th style={th('right')}>Acumulado</th>
              <th style={th('right')}>Por mês</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id} className="ec-linha"
                  onMouseEnter={() => setFoco(t.id)} onMouseLeave={() => setFoco(null)}>
                <td style={td()}>
                  <span style={{
                    display: 'inline-block', width: 3, height: 15, background: t.cor,
                    marginRight: 9, transform: 'translateY(3px)',
                  }} />
                  {t.tarefa}
                  {t.tem_baseline_declarado && (
                    <span style={{ color: SINAL, marginLeft: 5, fontWeight: 600 }}>*</span>
                  )}
                </td>
                <td style={{ ...td(), color: SUAVE, fontSize: 12.5 }}>{t.nome_projeto}</td>
                <td style={{ ...td('right'), ...num }}>{ni(t.vol_medido)}</td>
                <td style={{ ...td('right'), ...num }}>{nf(t.min_antes, 1)}</td>
                <td style={{ ...td('right'), ...num, fontWeight: 600 }}>{nf(t.horas_acumuladas)} h</td>
                <td style={{ ...td('right'), ...num, color: SUAVE }}>{nf(t.horas_mes)} h</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...td(), fontWeight: 600, borderBottom: 'none' }}>Total</td>
              <td style={{ ...td(), borderBottom: 'none' }} />
              <td style={{ ...td('right'), ...num, fontWeight: 600, borderBottom: 'none' }}>
                {ni(totais?.eventos_processados)}
              </td>
              <td style={{ ...td(), borderBottom: 'none' }} />
              <td style={{ ...td('right'), ...num, fontWeight: 700, borderBottom: 'none' }}>
                {nf(totais?.horas_acumuladas)} h
              </td>
              <td style={{ ...td('right'), ...num, fontWeight: 600, borderBottom: 'none' }}>
                {nf(totais?.horas_mes)} h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {temBaseline && (
        <p style={{
          fontSize: 12, color: SUAVE, marginTop: 14, maxWidth: 660, lineHeight: 1.6,
          paddingLeft: 12, borderLeft: `2px solid ${SINAL}`,
        }}>
          <span style={{ color: SINAL, fontWeight: 600 }}>*</span> Parte do volume dessas linhas vem
          de um número declarado, não de contagem no banco: os 225 processos do Checklist e as
          análises da API do Extrator, medidas pelo painel da OpenAI até 02/08. Os segmentos
          hachurados na barra são esses. As demais linhas contam registro a registro.
        </p>
      )}
    </div>
  )
}
