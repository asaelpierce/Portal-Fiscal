import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch } from '../config.js'
import { Spinner, EmptyState, Btn } from '../components/UI.jsx'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts'

const RAMPA = ['#0D2B54', '#1F60A8', '#3D86CC', '#6BAAE2', '#A3C8EE', '#C9DEF5', '#E2EDF9']
const PAPEL = '#FBFAF8'
const TINTA = '#1A1A18'
const TRACO = '#E4E1DC'
const SUAVE = '#6E6A64'
const SINAL = '#A2600F'
const LINHA = '#12805C'

const nf = (v, d = 1) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const ni = (v) => Number(v ?? 0).toLocaleString('pt-BR')
const num = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }

const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const rotuloMes = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})/)
  return m ? `${MES[+m[2] - 1]}/${m[1].slice(2)}` : '—'
}
// o mês corrente ainda está correndo: sem marcar, a barra menor parece queda
const hoje = new Date()
const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
const emCurso = (iso) => String(iso || '').startsWith(mesCorrente)

function Dica({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const barras = payload.filter((p) => p.dataKey !== 'acumulado' && p.value > 0)
  const acum = payload.find((p) => p.dataKey === 'acumulado')
  return (
    <div style={{
      background: '#fff', border: `1px solid ${TRACO}`, padding: '10px 12px',
      fontSize: 12, minWidth: 200, boxShadow: '0 2px 10px rgba(0,0,0,.07)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 7, color: TINTA }}>{label}</div>
      {barras.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '2px 0' }}>
          <span style={{ color: SUAVE }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: p.color, marginRight: 6 }} />
            {p.dataKey}
          </span>
          <span style={{ ...num, color: TINTA }}>{nf(p.value)} h</span>
        </div>
      ))}
      {acum && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 14,
          marginTop: 7, paddingTop: 7, borderTop: `1px solid ${TRACO}`, fontWeight: 600,
        }}>
          <span style={{ color: LINHA }}>Acumulado</span>
          <span style={{ ...num, color: LINHA }}>{nf(acum.value)} h</span>
        </div>
      )}
    </div>
  )
}

export default function Economia({ embutido = false }) {
  const [totais, setTotais] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [setores, setSetores] = useState([])
  const [mensal, setMensal] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [setorAberto, setSetorAberto] = useState(null)
  const [proc, setProc] = useState(null)

  const carregar = async () => {
    setErro('')
    try {
      const [t, g, s, m, pr] = await Promise.all([
        sbFetch('automacao_ganhos_totais?select=*'),
        sbFetch('automacao_ganhos_tarefas?select=*&order=horas_acumuladas.desc'),
        sbFetch('automacao_ganhos_por_setor?select=*&order=horas_acumuladas.desc'),
        sbFetch('automacao_ganhos_mensal?select=*&order=mes.asc'),
        sbFetch('automacao_procedencia?select=*'),
      ])
      setTotais(t?.[0] || null); setTarefas(g || []); setSetores(s || []); setMensal(m || [])
      setProc(pr?.[0] || null)
      setFase('pronto')
    } catch (e) { setErro(e.message); setFase('erro') }
  }
  useEffect(() => { carregar() }, [])

  const lista = useMemo(
    () => tarefas.map((t, i) => ({ ...t, cor: RAMPA[i % RAMPA.length] })), [tarefas])

  const { serie, projetos, coresProjeto } = useMemo(() => {
    const nomes = Array.from(new Set(mensal.map((r) => r.nome_projeto)))
    const cores = Object.fromEntries(nomes.map((n, i) => [n, RAMPA[i % RAMPA.length]]))
    const porMes = new Map()
    for (const r of mensal) {
      if (!porMes.has(r.mes)) porMes.set(r.mes, { mes: rotuloMes(r.mes) + (emCurso(r.mes) ? ' ·' : ''), _iso: r.mes, _curso: emCurso(r.mes) })
      const l = porMes.get(r.mes)
      l[r.nome_projeto] = (l[r.nome_projeto] || 0) + Number(r.horas)
    }
    const ord = [...porMes.values()].sort((a, b) => a._iso.localeCompare(b._iso))
    let ac = 0
    for (const l of ord) {
      ac += nomes.reduce((s, n) => s + (l[n] || 0), 0)
      l.acumulado = Math.round(ac * 10) / 10
    }
    return { serie: ord, projetos: nomes, coresProjeto: cores }
  }, [mensal])

  const dispersao = useMemo(
    () => lista
      .filter((t) => Number(t.vol_medido) > 0 && Number(t.horas_acumuladas) > 0)
      .map((t) => ({
        tarefa: t.tarefa, projeto: t.nome_projeto, cor: t.cor,
        vol: Number(t.vol_medido),
        min: Number(t.min_antes) - Number(t.min_depois),
        horas: Number(t.horas_acumuladas),
      })),
    [lista],
  )

  const maiorMin = useMemo(() => Math.max(1, ...lista.map((t) => Number(t.min_antes) || 0)), [lista])
  const maiorSetor = useMemo(
    () => Math.max(1, ...setores.map((s) => Number(s.horas_acumuladas) || 0)), [setores])

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return <EmptyState title="Não foi possível carregar" text={erro}>
      <Btn primary onClick={carregar}>Tentar de novo</Btn>
    </EmptyState>
  }
  if (!lista.length) {
    return <EmptyState title="Nenhuma tarefa medida ainda"
      text="Cadastre o ganho de uma automação em Controle de Automações." />
  }

  const th = (a) => ({
    padding: '10px 14px', textAlign: a || 'left', fontSize: 11.5, fontWeight: 500,
    color: SUAVE, borderBottom: `1px solid ${TRACO}`, whiteSpace: 'nowrap',
  })
  const td = (a) => ({
    padding: '12px 14px', textAlign: a || 'left', fontSize: 13,
    borderBottom: `1px solid ${TRACO}`, color: TINTA,
  })
  const h2 = { fontSize: 17, fontWeight: 600, color: TINTA, margin: '0 0 4px' }
  const sub = { fontSize: 12.5, color: SUAVE, margin: '0 0 18px', maxWidth: 660, lineHeight: 1.55 }

  return (
    <div style={ embutido
      ? { background: 'transparent' }
      : { background: PAPEL, margin: '-22px -26px -60px', padding: '30px 26px 56px', minHeight: '100%' } }>
      <style>{`
        @keyframes ec-crescer { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .ec-barra { transform-origin: left center; animation: ec-crescer .5s cubic-bezier(.2,.7,.3,1) both }
        .ec-linha:hover { background: #F4F2EE }
        @media print {
          @page { size: A4 portrait; margin: 14mm 12mm; }
          .ec-barra { animation: none !important; transform: none !important }
          .ec-nao-imprime { display: none !important }
          h2 { break-after: avoid }
          .ec-bloco { break-inside: avoid }
          .ec-resumo { border-left-width: 3px }
        }
        @media (prefers-reduced-motion: reduce) { .ec-barra { animation: none } }
      `}</style>

      <div className="ec-resumo" style={{
        background: '#fff', border: `1px solid ${TRACO}`, borderLeft: `3px solid ${RAMPA[0]}`,
        padding: '16px 20px', marginBottom: 26, maxWidth: 900,
      }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: TINTA }}>
          De março a setembro de 2026, <strong>{ni(totais?.projetos)} automações</strong> devolveram{' '}
          <strong>{nf(totais?.horas_acumuladas)} horas</strong> de trabalho manual ao time — o
          equivalente a <strong>{nf(totais?.dias_uteis)} dias</strong> de oito horas. O ritmo atual é
          de <strong>{nf(totais?.horas_mes)} horas por mês</strong>, projetando{' '}
          <strong>{nf(totais?.horas_ano, 0)} horas ao ano</strong>.
        </p>
        {proc && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.6, color: SUAVE }}>
            <strong style={{ color: TINTA }}>Procedência: </strong>
            {nf(proc.pct_contado, 0)}% desse total ({nf(proc.horas_volume_contado)} h) vem de volume
            contado automaticamente no banco, em {ni(proc.tarefas_volume_contado)} de{' '}
            {ni(proc.tarefas)} tarefas. O restante apoia-se em volume declarado pela área e está
            marcado com <span style={{ color: SINAL, fontWeight: 600 }}>*</span> ao longo da página.
            O tempo por item é sempre informado por quem executava a tarefa antes da automação.
          </p>
        )}
      </div>

      {!embutido && (
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 28, flexWrap: 'wrap', paddingBottom: 26,
      }}>
        <div>
          <div style={{ fontSize: 14, color: SUAVE, marginBottom: 10 }}>Horas devolvidas ao time</div>
          <div style={{ ...num, fontSize: 76, fontWeight: 300, letterSpacing: '-.035em', lineHeight: .88, color: TINTA }}>
            {nf(totais?.horas_acumuladas)}
          </div>
          <div style={{ fontSize: 14, color: SUAVE, marginTop: 12 }}>
            equivalem a <strong style={{ color: TINTA, fontWeight: 600 }}>{nf(totais?.dias_uteis)} dias</strong> de trabalho de 8 horas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[
            ['Ritmo atual', `${nf(totais?.horas_mes)} h`, 'por mês'],
            ['Projeção anual', `${nf(totais?.horas_ano, 0)} h`, `${nf((totais?.horas_ano || 0) / 8, 0)} dias`],
            ['Itens processados', ni(totais?.eventos_processados), 'contados no banco'],
            ['Folhas não impressas', ni(totais?.folhas_evitadas), 'checklist em papel'],
          ].map(([r, v, s]) => (
            <div key={r} style={{ minWidth: 112 }}>
              <div style={{ fontSize: 12.5, color: SUAVE, marginBottom: 6 }}>{r}</div>
              <div style={{ ...num, fontSize: 26, fontWeight: 400, color: TINTA, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 11.5, color: SUAVE, marginTop: 5 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      <h2 style={h2}>Como a economia foi crescendo</h2>
      <p style={sub}>
        As barras mostram quanto cada automação devolveu naquele mês. A linha verde é o total somado desde
        o começo. O mês marcado com · ainda está correndo, por isso a barra é menor.
      </p>
      <div className="ec-bloco" style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '18px 14px 10px', marginBottom: 40 }}>
        <div style={{ width: '100%', height: 330 }}>
          <ResponsiveContainer>
            <ComposedChart data={serie} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1EFEB" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11.5, fill: SUAVE }} axisLine={{ stroke: TRACO }} tickLine={false} />
              <YAxis yAxisId="e" tick={{ fontSize: 11.5, fill: SUAVE }} unit="h" axisLine={false} tickLine={false} />
              <YAxis yAxisId="d" orientation="right" tick={{ fontSize: 11.5, fill: LINHA }} unit="h" axisLine={false} tickLine={false} />
              <Tooltip content={<Dica />} cursor={{ fill: '#F4F2EE' }} />
              <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 10 }} iconType="square" iconSize={9} />
              {projetos.map((p) => (
                <Bar key={p} yAxisId="e" dataKey={p} stackId="a" fill={coresProjeto[p]} maxBarSize={54} />
              ))}
              <Line yAxisId="d" type="monotone" dataKey="acumulado" name="Acumulado"
                    stroke={LINHA} strokeWidth={2.4} dot={{ r: 3, fill: LINHA }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 style={h2}>O que cada tarefa custava, e o que custa hoje</h2>
      <p style={sub}>
        A barra escura é o tempo que sobrou. A clara é o que a automação devolveu.
        Nem toda tarefa foi a zero: algumas só encolheram.
      </p>
      <div style={{ marginBottom: 40, maxWidth: 880 }}>
        {lista.map((t, i) => {
          const antes = Number(t.min_antes) || 0
          const depois = Number(t.min_depois) || 0
          const pct = antes ? Math.round(((antes - depois) / antes) * 100) : 0
          return (
            <div key={t.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 300px 104px 60px', gap: 14,
              alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${TRACO}`,
            }}>
              <div style={{ fontSize: 13, color: TINTA, lineHeight: 1.35 }}>
                {t.tarefa}
                {t.tem_baseline_declarado && <span style={{ color: SINAL, marginLeft: 5, fontWeight: 600 }}>*</span>}
                <span style={{ color: SUAVE, fontSize: 11.5, marginLeft: 8 }}>{t.nome_projeto}</span>
              </div>
              <div style={{ display: 'flex', height: 18, background: '#F1EFEB' }}>
                <div className="ec-barra" style={{
                  width: `${(depois / maiorMin) * 100}%`, background: '#4A4741',
                  animationDelay: `${i * 0.04}s`,
                }} title={`Ainda leva ${nf(depois, 1)} min`} />
                <div className="ec-barra" style={{
                  width: `${((antes - depois) / maiorMin) * 100}%`, background: t.cor,
                  animationDelay: `${i * 0.04}s`,
                }} title={`Economiza ${nf(antes - depois, 1)} min`} />
              </div>
              <div style={{ ...num, fontSize: 12, color: SUAVE, whiteSpace: 'nowrap' }}>
                {nf(antes, 1)} → {nf(depois, 1)} min
              </div>
              <div style={{
                ...num, fontSize: 12.5, textAlign: 'right', fontWeight: 600,
                color: pct === 100 ? '#12805C' : TINTA,
              }}>−{pct}%</div>
            </div>
          )
        })}
      </div>

      <h2 style={h2}>Volume ou tempo unitário</h2>
      <p style={sub}>
        Cada bolha é uma tarefa; o tamanho é a economia acumulada. À direita, as que rendem por
        volume; no alto, as que rendem porque cada ocorrência custava caro. Escala logarítmica
        nos dois eixos — sem ela as pequenas desapareceriam.
      </p>
      <div className="ec-bloco" style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '18px 14px 10px', marginBottom: 40 }}>
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 34, right: 46, left: 4, bottom: 22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1EFEB" />
              <XAxis type="number" dataKey="vol" name="Volume" scale="log" domain={[1, 4000]}
                     ticks={[1, 10, 100, 1000]}
                     tick={{ fontSize: 11.5, fill: SUAVE }} axisLine={{ stroke: TRACO }} tickLine={false}
                     label={{ value: 'itens processados', position: 'insideBottom', offset: -10,
                              fontSize: 11, fill: SUAVE }} />
              <YAxis type="number" dataKey="min" name="Min/item" scale="log" domain={[1, 120]}
                     ticks={[1, 3, 10, 30, 100]}
                     tick={{ fontSize: 11.5, fill: SUAVE }} axisLine={false} tickLine={false} unit=" min"
                     width={66} />
              <ZAxis type="number" dataKey="horas" range={[60, 900]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{
                      background: '#fff', border: `1px solid ${TRACO}`, padding: '10px 12px',
                      fontSize: 12, maxWidth: 250, boxShadow: '0 2px 10px rgba(0,0,0,.07)',
                    }}>
                      <div style={{ fontWeight: 600, color: TINTA, marginBottom: 5 }}>{d.tarefa}</div>
                      <div style={{ color: SUAVE, marginBottom: 6 }}>{d.projeto}</div>
                      <div style={{ ...num }}>
                        {ni(d.vol)} itens × {nf(d.min, 1)} min ={' '}
                        <strong style={{ color: TINTA }}>{nf(d.horas)} h</strong>
                      </div>
                    </div>
                  )
                }} />
              <Scatter data={dispersao} fillOpacity={0.82}>
                {dispersao.map((d, i) => <Cell key={i} fill={d.cor} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 style={h2}>Quem ganhou esse tempo</h2>
      <p style={sub}>
        Tarefas que atravessam mais de um setor são divididas por igual entre eles.
        Clique num setor para ver de onde vem o tempo dele.
      </p>
      <div style={{ marginBottom: 40, maxWidth: 830 }}>
        {setores.map((s) => {
          const v = Number(s.horas_acumuladas) || 0
          const aberto = setorAberto === s.setor
          const contrib = lista
            .filter((t) => (t.setores || []).includes(s.setor))
            .map((t) => {
              const divisor = (t.setores || []).length || 1
              return { ...t, divisor, fatia: Number(t.horas_acumuladas) / divisor }
            })
            .sort((a, b) => b.fatia - a.fatia)
          return (
            <div key={s.setor} style={{ borderBottom: `1px solid ${TRACO}` }}>
              <button onClick={() => setSetorAberto(aberto ? null : s.setor)} aria-expanded={aberto}
                style={{
                  width: '100%', display: 'grid', gridTemplateColumns: '14px 124px 1fr 96px',
                  alignItems: 'center', gap: 16, padding: '11px 0', background: 'transparent',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: TINTA,
                }}>
                <span style={{
                  fontSize: 10, color: SUAVE, lineHeight: 1,
                  transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease',
                }}>▶</span>
                <span style={{ fontSize: 13.5 }}>{s.setor}</span>
                <span style={{ height: 10, background: '#EFEDE8', display: 'block' }}>
                  <span className="ec-barra" style={{
                    width: `${(v / maiorSetor) * 100}%`, height: '100%', background: RAMPA[1], display: 'block',
                  }} />
                </span>
                <span style={{ ...num, fontSize: 13.5, textAlign: 'right' }}>{nf(v)} h</span>
              </button>
              {aberto && (
                <div style={{ padding: '4px 0 16px 30px', marginLeft: 4, borderLeft: `1px solid ${TRACO}` }}>
                  {contrib.map((t) => (
                    <div key={t.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 210px 84px', gap: 14,
                      alignItems: 'baseline', padding: '7px 0 7px 14px',
                    }}>
                      <span style={{ fontSize: 12.5, color: TINTA, lineHeight: 1.4 }}>
                        <span style={{
                          display: 'inline-block', width: 7, height: 7, background: t.cor, marginRight: 8,
                          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.14)',
                        }} />
                        {t.tarefa}
                      </span>
                      <span style={{ fontSize: 11.5, color: SUAVE, lineHeight: 1.4 }}>
                        {t.divisor > 1
                          ? `1/${t.divisor} de ${nf(t.horas_acumuladas)} h, dividida com ${t.setores.filter((x) => x !== s.setor).join(' e ')}`
                          : t.nome_projeto}
                      </span>
                      <span style={{ ...num, fontSize: 12.5, textAlign: 'right' }}>{nf(t.fatia)} h</span>
                    </div>
                  ))}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 210px 84px', gap: 14,
                    padding: '9px 0 0 14px', marginTop: 4, borderTop: `1px solid ${TRACO}`,
                    fontSize: 12.5, fontWeight: 600,
                  }}>
                    <span>{contrib.length} tarefa{contrib.length > 1 ? 's' : ''} em {s.setor}</span>
                    <span /><span style={{ ...num, textAlign: 'right' }}>{nf(v)} h</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h2 style={h2}>Como cada número foi apurado</h2>
      <p style={sub}>
        O volume vem da contagem real no banco e cresce a cada sincronização. A coluna
        Entrando/mês mostra o ritmo de entrada.
      </p>
      <div style={{ overflowX: 'auto', border: `1px solid ${TRACO}`, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th()}>Tarefa</th>
              <th style={th()}>Automação</th>
              <th style={th('right')}>Volume</th>
              <th style={th('right')}>Entrando/mês</th>
              <th style={th('right')}>Min/item</th>
              <th style={th('right')}>Horas acum.</th>
              <th style={th('right')}>Horas/mês</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id} className="ec-linha">
                <td style={td()}>
                  <span style={{
                    display: 'inline-block', width: 3, height: 15, background: t.cor,
                    marginRight: 9, transform: 'translateY(3px)',
                  }} />
                  {t.tarefa}
                  {t.tem_baseline_declarado && <span style={{ color: SINAL, marginLeft: 5, fontWeight: 600 }}>*</span>}
                </td>
                <td style={{ ...td(), color: SUAVE, fontSize: 12.5 }}>{t.nome_projeto}</td>
                <td style={{ ...td('right'), ...num }}>{ni(t.vol_medido)}</td>
                <td style={{ ...td('right'), ...num, color: SUAVE }}>+{nf(t.vol_medido_mes, 0)}</td>
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
              <td style={{ ...td('right'), ...num, fontWeight: 600, borderBottom: 'none' }}>{ni(totais?.eventos_processados)}</td>
              <td style={{ ...td(), borderBottom: 'none' }} />
              <td style={{ ...td(), borderBottom: 'none' }} />
              <td style={{ ...td('right'), ...num, fontWeight: 700, borderBottom: 'none' }}>{nf(totais?.horas_acumuladas)} h</td>
              <td style={{ ...td('right'), ...num, fontWeight: 600, borderBottom: 'none' }}>{nf(totais?.horas_mes)} h</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{
        fontSize: 12, color: SUAVE, marginTop: 14, maxWidth: 680, lineHeight: 1.6,
        paddingLeft: 12, borderLeft: `2px solid ${SINAL}`,
      }}>
        <span style={{ color: SINAL, fontWeight: 600 }}>*</span> Duas fontes não têm data por
        registro: os 225 processos do Checklist e as análises da API do Extrator, contadas pelo
        painel da OpenAI até 02/08. No gráfico mensal elas aparecem distribuídas em partes iguais
        no período, por isso a barra delas é constante. As demais usam a data real de cada registro.
      </p>
    </div>
  )
}
