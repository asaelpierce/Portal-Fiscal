import React, { useEffect, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, brl, int, sbFetch } from '../config.js'
import { Panel, Btn, Spinner } from '../components/UI.jsx'

const SYNC_KEY = 'kb2026sync!'

async function chamarGerador(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sankhya-sql-generator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ ...payload, _key: SYNC_KEY }),
  })
  return res.json()
}

const EXEMPLOS = [
  'Quantos pedidos de compra foram feitos em julho de 2026?',
  'Some o valor total de notas de compra por fornecedor em junho de 2026',
  'Quantos títulos a pagar (TGFFIN) estão em aberto com vencimento este mês?',
  'Liste os 10 produtos com maior valor em estoque',
]

export default function GeradorSQL() {
  const [pergunta, setPergunta] = useState('')
  const [fase, setFase] = useState('idle') // idle | carregando | pronto | erro
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const [sqlEditavel, setSqlEditavel] = useState('')
  const [editando, setEditando] = useState(false)
  const [historico, setHistorico] = useState([])

  const carregarHistorico = () => {
    sbFetch('gerador_sql_historico?select=*&order=criado_em.desc&limit=15')
      .then(r => setHistorico(r || []))
      .catch(() => {})
  }
  useEffect(() => { carregarHistorico() }, [])

  const perguntar = async (perguntaTexto) => {
    const texto = (perguntaTexto ?? pergunta).trim()
    if (!texto) return
    setFase('carregando'); setErro(''); setResultado(null); setEditando(false)
    try {
      const d = await chamarGerador({ pergunta: texto })
      if (!d.ok) {
        setErro(d.erro || 'Erro desconhecido')
        if (d.sql) { setResultado(d); setSqlEditavel(d.sql) }
        setFase('erro')
      }
      else { setResultado(d); setSqlEditavel(d.sql); setFase('pronto') }
    } catch (e) {
      setErro(e.message); setFase('erro')
    } finally {
      carregarHistorico()
    }
  }

  const rodarSqlEditado = async () => {
    setFase('carregando'); setErro('')
    try {
      const d = await chamarGerador({
        pergunta: resultado?.pergunta || pergunta,
        sql_manual: sqlEditavel,
        explicacao_anterior: resultado?.explicacao,
      })
      if (!d.ok) {
        setErro(d.erro || 'Erro desconhecido')
        if (d.sql) { setResultado(d); setSqlEditavel(d.sql) }
        setFase('erro')
      }
      else { setResultado(d); setFase('pronto'); setEditando(false) }
    } catch (e) {
      setErro(e.message); setFase('erro')
    } finally {
      carregarHistorico()
    }
  }

  const exportarCsv = () => {
    if (!resultado) return
    const linhas = [resultado.colunas.join(';'), ...resultado.linhas.map(l => l.map(v => String(v ?? '').replace(/;/g,',')).join(';'))]
    const url = URL.createObjectURL(new Blob(['\ufeff'+linhas.join('\n')], { type:'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'consulta.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <p style={{ margin:0, fontSize:13, color:'#6B7280', maxWidth:700, lineHeight:1.6 }}>
        Escreva sua pergunta em português. A IA monta a consulta SQL usando o dicionário de dados
        real do Sankhya (tabelas, campos e armadilhas conhecidas deste projeto) e executa direto no banco.
        Sempre confira o SQL gerado antes de confiar no resultado — você pode editá-lo manualmente se precisar.
      </p>

      <Panel title="Nova pergunta">
        <textarea
          value={pergunta}
          onChange={e => setPergunta(e.target.value)}
          placeholder="Ex: Quantos pedidos de compra foram feitos em julho de 2026?"
          rows={3}
          style={{
            width:'100%', fontFamily:'inherit', fontSize:14, padding:'10px 12px',
            border:'1px solid #E5E7EB', borderRadius:8, resize:'vertical', boxSizing:'border-box',
          }}
        />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {EXEMPLOS.map(ex => (
              <button key={ex} onClick={() => { setPergunta(ex); perguntar(ex) }} style={{
                fontSize:11.5, padding:'5px 10px', borderRadius:14, border:'1px solid #E5E7EB',
                background:'#F9FAFB', color:'#6B7280', cursor:'pointer', fontFamily:'inherit',
              }}>{ex}</button>
            ))}
          </div>
          <Btn primary onClick={() => perguntar()} disabled={fase==='carregando' || !pergunta.trim()}>
            {fase==='carregando' ? '↻ Gerando…' : '✨ Perguntar'}
          </Btn>
        </div>
      </Panel>

      {fase === 'carregando' && <Spinner/>}

      {fase === 'erro' && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:16, color:'#B42318', fontSize:13 }}>
          <strong>Erro:</strong> {erro}
          {resultado?.sql && (
            <>
              {resultado?.explicacao && <p style={{ margin:'8px 0 0', color:'#7F1D1D' }}>{resultado.explicacao}</p>}
              <div style={{ marginTop:8, fontFamily:'monospace', fontSize:12, whiteSpace:'pre-wrap', background:'#fff', padding:'8px 10px', borderRadius:6, border:'1px solid #FECACA' }}>{resultado.sql}</div>
            </>
          )}
          <div style={{ marginTop:10 }}>
            <Btn small onClick={() => { setSqlEditavel(resultado?.sql || ''); setEditando(true); setFase('pronto') }}>
              Editar SQL manualmente
            </Btn>
          </div>
        </div>
      )}

      {fase === 'pronto' && resultado && (
        <>
          <Panel
            title="SQL gerado"
            action={
              <div style={{ display:'flex', gap:8 }}>
                {!editando && <Btn small onClick={() => setEditando(true)}>✎ Editar</Btn>}
                {resultado.colunas && <Btn small onClick={exportarCsv}>↓ CSV</Btn>}
              </div>
            }
          >
            <p style={{ margin:'0 0 10px', fontSize:13, color:'#374151' }}>{resultado.explicacao}</p>
            {resultado.tabelas_novas_buscadas?.length > 0 && (
              <div style={{ margin:'0 0 10px', fontSize:12, color:'#6B21A8', background:'#FAF5FF', padding:'8px 12px', borderRadius:6 }}>
                🧠 Aprendeu agora os campos de: <strong>{resultado.tabelas_novas_buscadas.join(', ')}</strong> — já ficou salvo pra próxima vez.
              </div>
            )}
            {editando ? (
              <>
                <textarea
                  value={sqlEditavel}
                  onChange={e => setSqlEditavel(e.target.value)}
                  rows={6}
                  style={{
                    width:'100%', fontFamily:'monospace', fontSize:12.5, padding:'10px 12px',
                    border:'1px solid #E5E7EB', borderRadius:8, resize:'vertical', boxSizing:'border-box',
                    background:'#F9FAFB',
                  }}
                />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <Btn primary small onClick={rodarSqlEditado}>▶ Rodar SQL editado</Btn>
                  <Btn small onClick={() => { setSqlEditavel(resultado.sql); setEditando(false) }}>Cancelar</Btn>
                </div>
              </>
            ) : (
              <pre style={{
                margin:0, fontFamily:'monospace', fontSize:12.5, padding:'10px 12px',
                background:'#F9FAFB', border:'1px solid #F3F4F6', borderRadius:8,
                whiteSpace:'pre-wrap', overflowX:'auto',
              }}>{resultado.sql}</pre>
            )}
          </Panel>

          {resultado.colunas && (
            <Panel title={`Resultado — ${int(resultado.total)} linha(s)`}>
              <div style={{ maxHeight:480, overflow:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead>
                    <tr>
                      {resultado.colunas.map(c => (
                        <th key={c} style={{
                          position:'sticky', top:0, background:'#F9FAFB', padding:'8px 12px',
                          textAlign:'left', fontSize:10.5, fontWeight:600, color:'#6B7280',
                          textTransform:'uppercase', letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap',
                        }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.linhas.map((linha, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #F9FAFB' }}>
                        {linha.map((v, j) => (
                          <td key={j} style={{ padding:'7px 12px', whiteSpace:'nowrap', fontVariantNumeric:'tabular-nums' }}>
                            {v === null || v === undefined ? '—' : String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!resultado.linhas.length && (
                      <tr><td colSpan={resultado.colunas.length || 1} style={{ textAlign:'center', padding:'24px', color:'#9CA3AF' }}>
                        Nenhum registro encontrado.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {historico.length > 0 && (
        <Panel title="Histórico recente">
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {historico.map(h => (
              <div key={h.id}
                onClick={() => { if (h.status==='ok') { setPergunta(h.pergunta); perguntar(h.pergunta) } }}
                style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:10,
                  padding:'8px 12px', borderRadius:6, background: h.status==='ok' ? '#F9FAFB' : '#FEF2F2',
                  cursor: h.status==='ok' ? 'pointer' : 'default', fontSize:12.5,
                }}>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{h.pergunta}</span>
                <span style={{
                  fontSize:10.5, fontWeight:700, padding:'2px 7px', borderRadius:4, whiteSpace:'nowrap',
                  background: h.status==='ok' ? '#D1FAE5' : '#FEE2E2',
                  color: h.status==='ok' ? '#12805C' : '#B42318',
                }}>
                  {h.status==='ok' ? `${int(h.total_linhas)} linhas` : 'erro'}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
