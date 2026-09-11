import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch } from '../config.js'
import { Spinner, EmptyState, Btn } from '../components/UI.jsx'
import Economia from './Economia.jsx'
import MapaFluxos from './MapaFluxos.jsx'

const PAPEL = '#FBFAF8'
const TINTA = '#1A1A18'
const TRACO = '#E4E1DC'
const SUAVE = '#6E6A64'

const nf = (v, d = 1) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const ni = (v) => Number(v ?? 0).toLocaleString('pt-BR')
const num = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }

export default function Processos() {
  const [vista, setVista] = useState('mapa')
  const [totais, setTotais] = useState(null)
  const [resumo, setResumo] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null)     // projeto_id
  const [painel, setPainel] = useState(null)
  const [carregandoPainel, setCarregandoPainel] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [t, r] = await Promise.all([
          sbFetch('automacao_ganhos_totais?select=*'),
          sbFetch('automacao_resumo_fluxo?select=*'),
        ])
        setTotais(t?.[0] || null); setResumo(r || []); setFase('pronto')
      } catch (e) { setErro(e.message); setFase('erro') }
    })()
  }, [])

  const abrir = async (id) => {
    if (aberto === id) { setAberto(null); setPainel(null); return }
    setAberto(id); setPainel(null); setCarregandoPainel(true)
    try {
      const d = await sbFetch(`automacao_painel?select=*&projeto_id=eq.${id}`)
      setPainel(d?.[0] || null)
    } catch (e) { setErro(e.message) } finally { setCarregandoPainel(false) }
  }

  const semMapa = useMemo(() => resumo.filter((r) => r.nos === 0 && r.tarefas > 0), [resumo])

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return <EmptyState title="Não foi possível carregar" text={erro}>
      <Btn primary onClick={() => window.location.reload()}>Recarregar</Btn>
    </EmptyState>
  }

  const aba = (k, r) => ({
    fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', padding: '7px 16px',
    border: `1px solid ${vista === k ? TINTA : TRACO}`,
    background: vista === k ? TINTA : 'transparent',
    color: vista === k ? PAPEL : SUAVE, borderRadius: 2,
  })

  return (
    <div style={{ margin: '-22px -26px -60px', background: PAPEL, minHeight: '100%' }}>
      {/* faixa comum: vale para as duas vistas */}
      <div style={{
        padding: '20px 26px 16px', borderBottom: `1px solid ${TRACO}`, background: '#fff',
        display: 'flex', alignItems: 'flex-end', gap: 34, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 12.5, color: SUAVE, marginBottom: 6 }}>Horas devolvidas ao time</div>
          <div style={{ ...num, fontSize: 44, fontWeight: 300, letterSpacing: '-.03em', lineHeight: .9, color: TINTA }}>
            {nf(totais?.horas_acumuladas)}
          </div>
        </div>
        {[
          ['Por mês', `${nf(totais?.horas_mes)} h`],
          ['Por ano', `${nf(totais?.horas_ano, 0)} h`],
          ['Automações', ni(resumo.length)],
          ['Tarefas', ni(totais?.tarefas)],
          ['Itens processados', ni(totais?.eventos_processados)],
        ].map(([r, v]) => (
          <div key={r}>
            <div style={{ fontSize: 11.5, color: SUAVE, marginBottom: 5 }}>{r}</div>
            <div style={{ ...num, fontSize: 21, fontWeight: 400, color: TINTA, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={aba('mapa')} onClick={() => setVista('mapa')}>Mapa</button>
          <button style={aba('numeros')} onClick={() => setVista('numeros')}>Números</button>
        </div>
      </div>

      {/* tira de automações: o índice que liga as duas vistas */}
      <div style={{
        display: 'flex', gap: 0, overflowX: 'auto', background: '#fff',
        borderBottom: `1px solid ${TRACO}`,
      }}>
        {resumo.map((r) => {
          const sel = aberto === r.projeto_id
          return (
            <button key={r.projeto_id} onClick={() => abrir(r.projeto_id)}
              aria-expanded={sel} title="Ver benefícios desta automação"
              style={{
                padding: '11px 18px', borderRight: `1px solid ${TRACO}`, minWidth: 172,
                border: 'none', borderBottom: `2px solid ${sel ? TINTA : 'transparent'}`,
                background: sel ? '#F4F2EE' : 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
              }}>
              <div style={{ fontSize: 12, color: TINTA, fontWeight: 600, lineHeight: 1.3 }}>
                {r.nome_projeto}
              </div>
              <div style={{ ...num, fontSize: 15, color: TINTA, marginTop: 5 }}>
                {nf(r.horas_acumuladas)} h
              </div>
              <div style={{ fontSize: 10.5, color: SUAVE, marginTop: 3 }}>
                {r.nos > 0 ? `${r.nos} nós · ` : 'sem nó no mapa · '}{ni(r.volume)} itens
              </div>
            </button>
          )
        })}
      </div>

      {aberto && (
        <PainelBeneficios dados={painel} carregando={carregandoPainel}
                          onFechar={() => { setAberto(null); setPainel(null) }} />
      )}

      {semMapa.length > 0 && vista === 'mapa' && (
        <div style={{
          padding: '9px 26px', fontSize: 12, color: '#A2600F',
          background: '#FDF3E7', borderBottom: '1px solid #F5D9B0',
        }}>
          {semMapa.map((r) => r.nome_projeto).join(', ')} {semMapa.length > 1 ? 'têm' : 'tem'} ganho
          medido mas ainda não {semMapa.length > 1 ? 'aparecem' : 'aparece'} no mapa.
        </div>
      )}

      <div style={{ padding: vista === 'numeros' ? '22px 26px 60px' : 0 }}>
        {vista === 'mapa' ? <MapaFluxos embutido /> : <Economia embutido />}
      </div>
    </div>
  )
}


const CORTIPO = {
  material:    { cor: '#166534', fundo: '#E9F7EF', rot: 'Material' },
  eficiencia:  { cor: '#1F60A8', fundo: '#EAF1FA', rot: 'Eficiência' },
  risco:       { cor: '#A2600F', fundo: '#FDF3E7', rot: 'Risco' },
  qualitativo: { cor: '#4A4741', fundo: '#F1EFEB', rot: 'Qualitativo' },
}

function PainelBeneficios({ dados, carregando, onFechar }) {
  if (carregando) {
    return <div style={{ padding: '20px 26px', fontSize: 13, color: SUAVE, background: '#fff',
      borderBottom: `1px solid ${TRACO}` }}>Carregando…</div>
  }
  if (!dados) return null
  const tarefas = dados.tarefas_detalhe || []
  const benef = dados.beneficios || []

  return (
    <div style={{ background: '#fff', borderBottom: `1px solid ${TRACO}`, padding: '20px 26px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: TINTA }}>{dados.nome_projeto}</h3>
          <div style={{ fontSize: 11.5, color: SUAVE, marginTop: 4 }}>
            {[dados.setor, dados.status, dados.tipo].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button onClick={onFechar} style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: '#9A958E', fontSize: 20, lineHeight: 1, padding: 0,
        }}>×</button>
      </div>

      {dados.beneficio && (
        <p style={{ fontSize: 13, color: '#4A4741', lineHeight: 1.6, margin: '12px 0 0', maxWidth: 820 }}>
          {dados.beneficio}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 26, marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: SUAVE, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Tarefas que deixaram de existir
          </div>
          {tarefas.length === 0 && <div style={{ fontSize: 12.5, color: SUAVE }}>Nenhuma medida ainda.</div>}
          {tarefas.map((t, i) => (
            <div key={i} style={{ padding: '9px 0', borderTop: i ? `1px solid ${TRACO}` : 'none' }}>
              <div style={{ fontSize: 12.5, color: TINTA, lineHeight: 1.4 }}>{t.tarefa}</div>
              <div style={{ fontSize: 11.5, color: SUAVE, marginTop: 4, ...num }}>
                {Number(t.min_antes)} min → {Number(t.min_depois)} · {ni(t.volume)} itens ·{' '}
                <strong style={{ color: TINTA }}>{nf(t.horas)} h</strong>
                {t.quem ? ` · ${t.quem}` : ''}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 11, color: SUAVE, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Ganhos que não viram hora
          </div>
          {benef.length === 0 && (
            <div style={{ fontSize: 12.5, color: SUAVE }}>Nada registrado ainda.</div>
          )}
          {benef.map((b, i) => {
            const c = CORTIPO[b.tipo] || CORTIPO.qualitativo
            return (
              <div key={i} style={{ padding: '9px 0', borderTop: i ? `1px solid ${TRACO}` : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, color: c.cor, background: c.fundo,
                    padding: '2px 6px', borderRadius: 2, letterSpacing: '.04em',
                  }}>{c.rot.toUpperCase()}</span>
                  <span style={{ fontSize: 12.5, color: TINTA, fontWeight: 600 }}>{b.titulo}</span>
                  {b.valor && <span style={{ ...num, fontSize: 12, color: c.cor }}>{b.valor}</span>}
                </div>
                {b.detalhe && (
                  <div style={{ fontSize: 11.5, color: SUAVE, marginTop: 4, lineHeight: 1.5 }}>{b.detalhe}</div>
                )}
              </div>
            )
          })}
        </div>

        <div>
          <div style={{ fontSize: 11, color: SUAVE, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            No mapa
          </div>
          {(dados.nos_mapa || []).length === 0 ? (
            <div style={{ fontSize: 12.5, color: '#A2600F' }}>
              Esta automação ainda não tem nó desenhado no mapa.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dados.nos_mapa.map((n) => (
                <span key={n.chave} style={{
                  fontSize: 11.5, color: TINTA, background: '#F1EFEB',
                  padding: '4px 9px', borderRadius: 2,
                }}>{n.rotulo}</span>
              ))}
            </div>
          )}
          {dados.stack && (
            <>
              <div style={{ fontSize: 11, color: SUAVE, textTransform: 'uppercase', letterSpacing: '.06em', margin: '16px 0 8px' }}>
                Como foi feito
              </div>
              <div style={{ fontSize: 11.5, color: '#4A4741', lineHeight: 1.5 }}>{dados.stack}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
