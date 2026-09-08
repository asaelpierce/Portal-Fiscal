import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, int, dBR } from '../config.js'
import { Card, Panel, Btn, Spinner, SearchInput, EmptyState } from '../components/UI.jsx'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const SYNC_KEY = 'kb2026sync!'

async function sincronizar(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/identificacao-almox-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ ...payload, _key: SYNC_KEY }),
  })
  return res.json()
}

const dtBR = (iso) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—'

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotuloMes = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})/)
  return m ? `${MES_CURTO[Number(m[2]) - 1]}/${m[1].slice(2)}` : '—'
}

// horas -> "12h 24min"
const horas = (h) => {
  const v = Number(h) || 0
  const inteiras = Math.floor(v)
  const min = Math.round((v - inteiras) * 60)
  return min ? `${inteiras}h ${min}min` : `${inteiras}h`
}

export default function IdentificacaoAlmox({ sessao }) {
  const [ind, setInd] = useState(null)
  const [resumo, setResumo] = useState([])
  const [itens, setItens] = useState([])
  const [syncs, setSyncs] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [atualizando, setAtualizando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const [busca, setBusca] = useState('')
  const [soAbertos, setSoAbertos] = useState(true)
  const [soSemProjeto, setSoSemProjeto] = useState(false)

  const carregar = async () => {
    setErro('')
    try {
      const [i, r, d, s] = await Promise.all([
        sbFetch('almox_identificacao_indicadores?select=*'),
        sbFetch('almox_identificacao_resumo?select=*&order=mes.asc'),
        sbFetch('almox_identificacao_detalhe?select=*&order=data_pedido.desc,numero_pedido.desc'),
        sbFetch('almox_identificacao_sync?select=*&order=iniciado_em.desc&limit=15'),
      ])
      setInd(i?.[0] || null)
      setResumo(r || [])
      setItens(d || [])
      setSyncs(s || [])
      setFase('pronto')
    } catch (e) {
      setErro(e.message)
      setFase('erro')
    }
  }

  useEffect(() => { carregar() }, [])

  const atualizarAgora = async () => {
    setAtualizando(true); setAviso(null)
    try {
      const d = await sincronizar({ origem: 'manual', usuario: sessao?.email || 'manual' })
      if (!d.ok) throw new Error(d.erro || 'Falha na sincronização')
      setAviso({
        tipo: 'ok',
        texto: `Atualizado: ${int(d.total)} item(ns) na consulta · ${int(d.novos)} novo(s) · ` +
               `${int(d.encerrados)} encerrado(s) · Sankhya respondeu em ${int(d.tempo_sankhya_ms)}ms`,
      })
      await carregar()
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setAtualizando(false)
    }
  }

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter((r) => {
      if (soAbertos && !r.ativo) return false
      if (soSemProjeto && !r.sem_projeto) return false
      if (!q) return true
      return `${r.numero_pedido} ${r.codigo_produto} ${r.descricao_produto || ''} ${r.projeto || ''}`
        .toLowerCase().includes(q)
    })
  }, [itens, busca, soAbertos, soSemProjeto])

  const grafico = useMemo(
    () => resumo.map((r) => ({
      mes: rotuloMes(r.mes),
      piso: Number(r.horas_economizadas_piso) || 0,
      teto: Number(r.horas_economizadas_teto) || 0,
      itens: Number(r.itens) || 0,
    })),
    [resumo],
  )

  const cel = { padding: '8px 12px', whiteSpace: 'nowrap' }
  const celWrap = { padding: '8px 12px', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const th = (a) => ({
    padding: '8px 12px', background: '#F9FAFB', textAlign: a || 'left', fontSize: 10.5,
    fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em',
    borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 0,
  })

  if (fase === 'carregando') return <Spinner />
  if (fase === 'erro') {
    return (
      <EmptyState title="Erro ao carregar" text={erro}>
        <Btn primary onClick={carregar}>Tentar novamente</Btn>
      </EmptyState>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
        padding: '14px 18px', fontSize: 12.5, color: '#1E40AF', lineHeight: 1.6,
      }}>
        <strong>Identificação de material recebido.</strong> A lista vem direto do Sankhya
        (pedidos de compra confirmados, natureza 510101, fretes excluídos) e atualiza sozinha
        às <strong>08h, 12h e 17h</strong> — ou quando você clicar em Atualizar. O tempo economizado
        usa a faixa de <strong>7 a 10 minutos por item</strong>, informada pela equipe do almoxarifado.
      </div>

      {aviso && (
        <div style={{
          borderRadius: 8, padding: '11px 16px', fontSize: 12.5,
          background: aviso.tipo === 'ok' ? '#ECFDF5' : '#FEE2E2',
          border: `1px solid ${aviso.tipo === 'ok' ? '#A7F3D0' : '#FECACA'}`,
          color: aviso.tipo === 'ok' ? '#12805C' : '#B42318',
        }}>
          {aviso.tipo === 'ok' ? '✓ ' : '⚠ '}{aviso.texto}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        <Card title="No mês" value={int(ind?.itens_mes)}
              sub={`${int(ind?.pedidos_mes)} pedido(s) · ${horas(ind?.horas_mes_piso)} a ${horas(ind?.horas_mes_teto)}`}
              color="blue" />
        <Card title="Total acumulado" value={int(ind?.itens_total)}
              sub={`${int(ind?.pedidos_total)} pedido(s) desde 01/03/2026`} color="gray" />
        <Card title="Tempo economizado (total)" value={horas(ind?.horas_economizadas_piso)}
              sub={`até ${horas(ind?.horas_economizadas_teto)} no teto de 10 min`} color="green" />
        <Card title="Itens em aberto" value={int(ind?.itens_abertos)}
              sub={`${int(ind?.novos_hoje)} novo(s) hoje · ${int(ind?.novos_24h)} em 24h`}
              color={Number(ind?.novos_hoje) ? 'orange' : 'gray'} />
        <Card title="Última atualização" value={dtBR(ind?.ultima_sync_ok)}
              sub={ind?.status_ultima_sync === 'erro' ? '⚠ última tentativa falhou' : 'automático 08h · 12h · 17h'}
              color={ind?.status_ultima_sync === 'erro' ? 'red' : 'gray'} />
      </div>

      {grafico.length > 0 && (
        <Panel title="Tempo economizado por mês">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={grafico} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} unit="h" />
                <Tooltip
                  formatter={(v, n) => [`${v}h`, n === 'piso' ? 'Piso (7 min/item)' : 'Teto (10 min/item)']}
                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11.5 }}
                  formatter={(v) => (v === 'piso' ? 'Piso (7 min/item)' : 'Teto (10 min/item)')}
                />
                <Bar dataKey="piso" fill="#1D5BBF" radius={[3, 3, 0, 0]} />
                <Bar dataKey="teto" fill="#93C5FD" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel
        title={`Itens para identificar — ${int(lista.length)} exibido(s)`}
        action={
          <Btn small primary onClick={atualizarAgora} disabled={atualizando}>
            {atualizando ? 'Atualizando…' : '↻ Atualizar agora'}
          </Btn>
        }
      >
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput value={busca} onChange={setBusca} placeholder="Pedido, código, produto, projeto…" />
          <label style={{ fontSize: 12.5, color: '#374151', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={soAbertos} onChange={(e) => setSoAbertos(e.target.checked)} />
            Só em aberto
          </label>
          <label style={{ fontSize: 12.5, color: '#374151', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={soSemProjeto} onChange={(e) => setSoSemProjeto(e.target.checked)} />
            Só sem projeto ({int(itens.filter((i) => i.sem_projeto).length)})
          </label>
        </div>

        {!lista.length ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
            Nenhum item com esses filtros.
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflow: 'auto', border: '1px solid #F3F4F6', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={th()}>Pedido</th>
                  <th style={th()}>Criado em</th>
                  <th style={th()}>Chegada</th>
                  <th style={th()}>Projeto</th>
                  <th style={th()}>Código</th>
                  <th style={th()}>Produto</th>
                  <th style={th('right')}>Qtd</th>
                  <th style={th()}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={`${r.numero_pedido}-${r.codigo_produto}`}
                      style={{ borderTop: '1px solid #F9FAFB', background: r.ativo ? 'transparent' : '#FAFAFA' }}>
                    <td style={{ ...cel, fontWeight: 600 }}>{r.numero_pedido}</td>
                    <td style={cel}>{dBR(r.data_pedido)}</td>
                    <td style={{ ...cel, color: r.chegada_em_outro_mes ? '#B54708' : '#101828' }}
                        title={r.chegada_em_outro_mes ? 'Chegada prevista em mês diferente do pedido' : ''}>
                      {dBR(r.data_chegada)}{r.chegada_em_outro_mes ? ' ⚠' : ''}
                    </td>
                    <td style={{ ...cel, color: r.sem_projeto ? '#9CA3AF' : '#101828' }}>
                      {r.sem_projeto ? 'sem projeto' : r.projeto}
                    </td>
                    <td style={cel}>{r.codigo_produto}</td>
                    <td style={celWrap} title={r.descricao_produto || ''}>{r.descricao_produto}</td>
                    <td style={{ ...cel, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {int(r.quantidade)}
                    </td>
                    <td style={cel}>
                      {r.ativo ? (
                        <span style={{ color: '#1D5BBF', fontWeight: 600 }}>Em aberto</span>
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>Encerrado {dBR(r.encerrado_em)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Execuções recentes" noPad>
        {!syncs.length ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 12.5 }}>
            Nenhuma execução registrada ainda.
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={th()}>Quando</th>
                  <th style={th()}>Origem</th>
                  <th style={th()}>Disparado por</th>
                  <th style={th('right')}>Itens</th>
                  <th style={th('right')}>Novos</th>
                  <th style={th('right')}>Encerrados</th>
                  <th style={th('right')}>Sankhya</th>
                  <th style={th()}>Status</th>
                </tr>
              </thead>
              <tbody>
                {syncs.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid #F9FAFB' }}>
                    <td style={cel}>{dtBR(s.iniciado_em)}</td>
                    <td style={cel}>{s.origem === 'cron' ? 'Automático' : 'Manual'}</td>
                    <td style={cel}>{s.disparado_por || '—'}</td>
                    <td style={{ ...cel, textAlign: 'right' }}>{int(s.total_retornado)}</td>
                    <td style={{ ...cel, textAlign: 'right', color: s.novos ? '#12805C' : '#9CA3AF', fontWeight: s.novos ? 600 : 400 }}>
                      {int(s.novos)}
                    </td>
                    <td style={{ ...cel, textAlign: 'right' }}>{int(s.encerrados)}</td>
                    <td style={{ ...cel, textAlign: 'right', color: '#6B7280' }}>
                      {s.tempo_sankhya_ms ? `${int(s.tempo_sankhya_ms)}ms` : '—'}
                    </td>
                    <td style={cel}>
                      {s.status === 'ok' ? (
                        <span style={{ color: '#12805C', fontWeight: 600 }}>✓ ok</span>
                      ) : s.status === 'erro' ? (
                        <span style={{ color: '#B42318', fontWeight: 600 }} title={s.erro || ''}>⚠ erro</span>
                      ) : (
                        <span style={{ color: '#B54708' }}>rodando…</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
