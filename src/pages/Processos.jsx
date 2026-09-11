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
        {resumo.map((r) => (
          <div key={r.projeto_id} style={{
            padding: '11px 18px', borderRight: `1px solid ${TRACO}`, minWidth: 172,
          }}>
            <div style={{ fontSize: 12, color: TINTA, fontWeight: 600, lineHeight: 1.3 }}>
              {r.nome_projeto}
            </div>
            <div style={{ ...num, fontSize: 15, color: TINTA, marginTop: 5 }}>
              {nf(r.horas_acumuladas)} h
            </div>
            <div style={{ fontSize: 10.5, color: SUAVE, marginTop: 3 }}>
              {r.nos > 0 ? `${r.nos} nós · ` : 'sem nó no mapa · '}
              {ni(r.volume)} itens
            </div>
          </div>
        ))}
      </div>

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
