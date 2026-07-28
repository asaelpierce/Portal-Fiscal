import React, { useState, useEffect } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl, int, dBR } from '../config.js'

// API key guardada no banco — não fica exposta no frontend
// A edge function valida pelo header x-api-key
const SYNC_URL = `${SUPABASE_URL}/functions/v1`

async function chamarSync(endpoint, body) {
  // Busca a api key do banco (campo público só se RLS permitir — mas aqui usamos anon)
  // Alternativa: hardcode da chave pública de sync (não é service key)
  const res = await fetch(`${SYNC_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-api-key': 'kb2026sync!',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok && !data.total_estoque) throw new Error(data.erro || 'Erro desconhecido')
  return data
}

function Passo({ n, titulo, status, mensagem, detalhe }) {
  const cor = status === 'ok' ? '#12805C' : status === 'erro' ? '#B42318' : status === 'rodando' ? '#1D5BBF' : '#9CA3AF'
  const bg  = status === 'ok' ? '#D1FAE5' : status === 'erro' ? '#FEE2E2' : status === 'rodando' ? '#DBEAFE' : '#F3F4F6'
  const icone = status === 'ok' ? '✓' : status === 'erro' ? '✗' : status === 'rodando' ? '↻' : '○'

  return (
    <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: bg, color: cor,
        display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0,
        animation: status === 'rodando' ? 'spin 1s linear infinite' : 'none' }}>
        {icone}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: cor === '#9CA3AF' ? '#374151' : cor }}>{titulo}</div>
        {mensagem && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{mensagem}</div>}
        {detalhe && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{detalhe}</div>}
      </div>
    </div>
  )
}

export default function Sincronizacao() {
  const [ano,    setAno]    = useState(2026)
  const [mes,    setMes]    = useState(6)
  const [fase,   setFase]   = useState('idle') // idle | rodando | pronto | erro
  const [log,    setLog]    = useState([])
  const [erroGeral, setErroGeral] = useState('')

  const meses = [
    {v:1,l:'Janeiro'},{v:2,l:'Fevereiro'},{v:3,l:'Março'},{v:4,l:'Abril'},
    {v:5,l:'Maio'},{v:6,l:'Junho'},{v:7,l:'Julho'},{v:8,l:'Agosto'},
    {v:9,l:'Setembro'},{v:10,l:'Outubro'},{v:11,l:'Novembro'},{v:12,l:'Dezembro'},
  ]
  const anos = [2024,2025,2026,2027]

  const ultimoDia = (m, a) => new Date(a, m, 0).getDate()
  const pad = n => String(n).padStart(2,'0')
  const dtIni = `01/${pad(mes)}/${ano}`
  const dtFim = `${ultimoDia(mes,ano)}/${pad(mes)}/${ano}`

  const addLog = (id, status, titulo, mensagem='', detalhe='') => {
    setLog(prev => {
      const idx = prev.findIndex(p => p.id === id)
      const item = { id, status, titulo, mensagem, detalhe }
      if (idx >= 0) { const n=[...prev]; n[idx]=item; return n }
      return [...prev, item]
    })
  }

  const rodar = async () => {
    setFase('rodando')
    setLog([])
    setErroGeral('')

    // IDs de importação
    let impConcilId = null
    let impRazaoId  = null

    try {
      // ── 1. Cria importação de conciliação ─────────────────────────────
      addLog('imp', 'rodando', 'Criando registro de importação…')
      const impRes = await fetch(`${SUPABASE_URL}/rest/v1/importacoes`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ periodo_inicio: `${ano}-${pad(mes)}-01`, periodo_fim: `${ano}-${pad(mes)}-${ultimoDia(mes,ano)}`, total_linhas: 0, criado_por: 'portal' }),
      })
      const impData = await impRes.json()
      impConcilId = impData[0]?.id
      addLog('imp', 'ok', 'Importação criada', `ID: ${impConcilId}`)

      // ── 2. Sincroniza conciliação por semanas ─────────────────────────
      const semanas = []
      let d = new Date(ano, mes-1, 1)
      while (d.getMonth() === mes-1) {
        const ini = `${pad(d.getDate())}/${pad(mes)}/${ano}`
        const fimD = new Date(d)
        fimD.setDate(fimD.getDate() + 6)
        if (fimD.getMonth() !== mes-1) fimD.setDate(ultimoDia(mes,ano))
        const fim = `${pad(fimD.getDate())}/${pad(mes)}/${ano}`
        semanas.push({ ini, fim })
        d.setDate(d.getDate() + 7)
      }

      addLog('concil', 'rodando', `Importando conciliação — ${semanas.length} semanas…`)
      let totalConcil = 0
      for (let i = 0; i < semanas.length; i++) {
        const s = semanas[i]
        addLog('concil', 'rodando', `Conciliação — semana ${i+1}/${semanas.length}`, `${s.ini} a ${s.fim}`)
        const r = await chamarSync('conciliacao-sync', {
          periodo_inicio: s.ini, periodo_fim: s.fim, importacao_id: impConcilId
        })
        totalConcil += r.inseridos || 0
      }
      addLog('concil', 'ok', 'Conciliação importada', `${int(totalConcil)} lançamentos`)

      // ── 3. Cria importação do razão ───────────────────────────────────
      addLog('razao_imp', 'rodando', 'Criando registro do razão…')
      const razImpRes = await fetch(`${SUPABASE_URL}/rest/v1/razao_importacoes`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ periodo_inicio: `${ano}-${pad(mes)}-01`, periodo_fim: `${ano}-${pad(mes)}-${ultimoDia(mes,ano)}`, status: 'processando' }),
      })
      const razImpData = await razImpRes.json()
      impRazaoId = razImpData[0]?.id
      addLog('razao_imp', 'ok', 'Importação do razão criada')

      // ── 4. Movimentos do razão ────────────────────────────────────────
      addLog('mov', 'rodando', 'Importando movimentos do razão…')
      const rMov = await chamarSync('razao-sync-movimentos', {
        periodo_inicio: dtIni, periodo_fim: dtFim, importacao_id: impRazaoId
      })
      addLog('mov', 'ok', 'Movimentos importados', `${int(rMov.total_movimentos)} movimentos`)

      // ── 5. Saldo inicial ─────────────────────────────────────────────
      addLog('saldo', 'rodando', 'Calculando saldo inicial…', 'buscando posição anterior ao período')
      const rSaldo = await chamarSync('razao-sync-saldo', {
        periodo_inicio: dtIni, importacao_id: impRazaoId
      })
      addLog('saldo', 'ok', 'Saldo inicial calculado', `${int(rSaldo.total_produtos)} produtos`)

      // ── 6. Lançamentos contábeis do razão ────────────────────────────
      addLog('ctb', 'rodando', 'Importando lançamentos contábeis…')
      const rCtb = await chamarSync('razao-sync-ctb', {
        periodo_inicio: dtIni, periodo_fim: dtFim, importacao_id: impRazaoId
      })
      addLog('ctb', 'ok', 'Lançamentos contábeis importados', `${int(rCtb.total_lancamentos_ctb)} lançamentos`)

      // Finaliza razão
      await fetch(`${SUPABASE_URL}/rest/v1/razao_importacoes?id=eq.${impRazaoId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pronto', total_movimentos: rMov.total_movimentos, concluido_em: new Date().toISOString() }),
      })

      // ── 7. Fechamento ─────────────────────────────────────────────────
      addLog('fech', 'rodando', 'Calculando fechamento…', `posição em ${dtFim}`)
      const rFech = await chamarSync('fechamento-sync', { data_posicao: dtFim })
      addLog('fech', 'ok', 'Fechamento calculado',
        `Total estoque: R$ ${brl(rFech.total_estoque)} · Contábil: R$ ${brl(rFech.total_contabil)}`,
        `Diferença: R$ ${brl(rFech.diferenca)}`)

      setFase('pronto')
    } catch (err) {
      setErroGeral(String(err?.message ?? err))
      setFase('erro')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Seletor de período */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '20px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Selecionar período para importar</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 5 }}>Mês</label>
            <select value={mes} onChange={e => setMes(Number(e.target.value))} style={{
              fontFamily: 'inherit', fontSize: 13, padding: '8px 12px',
              border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff', minWidth: 140,
            }} disabled={fase === 'rodando'}>
              {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 5 }}>Ano</label>
            <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{
              fontFamily: 'inherit', fontSize: 13, padding: '8px 12px',
              border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
            }} disabled={fase === 'rodando'}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ paddingBottom: 1 }}>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 6 }}>
              {dtIni} a {dtFim}
            </div>
            <button onClick={rodar} disabled={fase === 'rodando'} style={{
              padding: '9px 20px', background: fase === 'rodando' ? '#6B7280' : '#101828',
              color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: fase === 'rodando' ? 'default' : 'pointer', fontFamily: 'inherit',
            }}>
              {fase === 'rodando' ? '↻ Importando…' : '▶ Importar período'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: '10px 14px', background: '#F9FAFB', borderRadius: 6, fontSize: 12, color: '#6B7280' }}>
          <strong>O que será importado:</strong> Conciliação (Dash × Razão) + Razão analítico de estoque + Fechamento (posição do último dia do mês)
        </div>
      </div>

      {/* Log de execução */}
      {log.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '18px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            {fase === 'rodando' ? '↻ Importando…' : fase === 'pronto' ? '✅ Importação concluída' : '✗ Erro na importação'}
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 14 }}>
            {meses.find(m=>m.v===mes)?.l} de {ano}
          </div>

          {log.map(p => (
            <Passo key={p.id} {...p} />
          ))}

          {erroGeral && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 6, fontSize: 12.5, color: '#B42318' }}>
              <strong>Erro:</strong> {erroGeral}
            </div>
          )}

          {fase === 'pronto' && (
            <div style={{ marginTop: 14, padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: 6, fontSize: 13, color: '#166534' }}>
              ✅ <strong>{meses.find(m=>m.v===mes)?.l}/{ano} importado com sucesso.</strong>{' '}
              Clique em "Atualizar dados" no topo para ver os novos dados no portal.
            </div>
          )}
        </div>
      )}

      {/* Histórico de períodos disponíveis */}
      <PeriodosDisponiveis />
    </div>
  )
}

function PeriodosDisponiveis() {
  const [concil, setConcil] = useState([])
  const [razao,  setRazao]  = useState([])
  const [fech,   setFech]   = useState([])

  useEffect(() => {
    sbFetch('importacoes?select=id,periodo_inicio,periodo_fim,total_linhas,criado_em&order=periodo_inicio.desc')
      .then(r => setConcil(r||[])).catch(()=>{})
    sbFetch('razao_importacoes?select=*&order=periodo_inicio.desc')
      .then(r => setRazao(r||[])).catch(()=>{})
    sbFetch('fechamento_saldos?select=data_posicao&order=data_posicao.desc')
      .then(r => setFech([...new Set((r||[]).map(x=>x.data_posicao))]))
      .catch(()=>{})
  }, [])

  const fmt = s => { const [y,m,d]=String(s).slice(0,10).split('-'); return `${d}/${m}/${y}` }
  const fmtP = (i,f) => `${fmt(i)} a ${fmt(f)}`

  if (!concil.length && !razao.length) return null

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '18px 22px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Períodos disponíveis no banco</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>

        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
            letterSpacing: '.08em', marginBottom: 8 }}>Conciliação (Dash × Razão)</div>
          {concil.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: '1px solid #F3F4F6', fontSize: 12.5 }}>
              <span>{fmtP(i.periodo_inicio, i.periodo_fim)}</span>
              <span style={{ color: '#9CA3AF' }}>{int(i.total_linhas)} lançamentos</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
            letterSpacing: '.08em', marginBottom: 8 }}>Razão analítico</div>
          {razao.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: '1px solid #F3F4F6', fontSize: 12.5 }}>
              <span>{fmtP(i.periodo_inicio, i.periodo_fim)}</span>
              <span style={{ color: '#9CA3AF', fontSize: 11.5 }}>{int(i.total_movimentos)} movimentos · {i.status}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase',
            letterSpacing: '.08em', marginBottom: 8 }}>Fechamento (posições calculadas)</div>
          {fech.map(d => (
            <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: '1px solid #F3F4F6', fontSize: 12.5 }}>
              <span>Posição em {fmt(d)}</span>
              <span style={{ color: '#12805C', fontSize: 11.5 }}>✓ disponível</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
