import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, int, dBR } from '../config.js'
import { Panel, Btn, Spinner, SearchInput, Select } from '../components/UI.jsx'

const SYNC_KEY = 'kb2026sync!'

const TIPO_INFO = {
  I: { rot: 'Inclusão', cor: '#12805C', bg: '#D1FAE5' },
  U: { rot: 'Alteração', cor: '#B54708', bg: '#FEF3C7' },
  D: { rot: 'Exclusão', cor: '#B42318', bg: '#FEE2E2' },
}

function hojeISO() { return new Date().toISOString().slice(0,10) }
function diasAtrasISO(n) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10) }
function isoParaBR(iso) { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
function dataHoraBR(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

async function chamarSync(payload) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auditoria-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ ...payload, _key: SYNC_KEY }),
  })
  return res.json()
}

// Quebra o periodo em janelas de ate 5 dias - a funcao de sincronizacao do
// backend pode dar timeout em janelas maiores (limite pratico descoberto)
function gerarJanelas(dtIniISO, dtFimISO, tamanho = 5) {
  const janelas = []
  let cursor = new Date(dtIniISO)
  const fim = new Date(dtFimISO)
  while (cursor <= fim) {
    const fimJanela = new Date(cursor)
    fimJanela.setDate(fimJanela.getDate() + tamanho - 1)
    if (fimJanela > fim) fimJanela.setTime(fim.getTime())
    janelas.push({ ini: cursor.toISOString().slice(0,10), fim: fimJanela.toISOString().slice(0,10) })
    cursor = new Date(fimJanela); cursor.setDate(cursor.getDate() + 1)
  }
  return janelas
}

function LinhaExpandida({ linha, dicCampos }) {
  const campos = linha.campos_alterados
  if (!campos || !campos.length) {
    return <div style={{ padding:'10px 16px', fontSize:12, color:'#9CA3AF', background:'#FAFAFA' }}>
      Sem detalhe de campos disponível para este registro.
    </div>
  }
  return (
    <div style={{ padding:'10px 16px', background:'#FAFAFA', borderTop:'1px solid #F3F4F6' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr>
            {['Campo','Valor anterior','Valor novo'].map(h => (
              <th key={h} style={{ textAlign:'left', padding:'4px 8px', color:'#6B7280', fontSize:10.5, textTransform:'uppercase', letterSpacing:'.03em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campos.filter(c => c.campo !== 'DTALTER').map((c,i) => {
            const descricao = dicCampos[`${linha.tabela}::${c.campo}`]
            return (
              <tr key={i} style={{ borderTop:'1px solid #F3F4F6' }}>
                <td style={{ padding:'4px 8px' }}>
                  <div style={{ fontWeight:600 }}>{descricao || c.campo}</div>
                  {descricao && <div style={{ fontSize:10.5, color:'#9CA3AF' }}>{c.campo}</div>}
                </td>
                <td style={{ padding:'4px 8px', color:'#B42318', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={String(c.valor_antigo ?? '')}>{String(c.valor_antigo ?? '') || '—'}</td>
                <td style={{ padding:'4px 8px', color:'#12805C', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={String(c.valor_novo ?? '')}>{String(c.valor_novo ?? '') || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Auditoria() {
  const [dtIni, setDtIni] = useState(diasAtrasISO(7))
  const [dtFim, setDtFim] = useState(hojeISO())
  const [dados, setDados] = useState([])
  const [dicCampos, setDicCampos] = useState({})
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fTabela, setFTabela] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [mostrarSistema, setMostrarSistema] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [msgSync, setMsgSync] = useState('')

  const carregar = async () => {
    setFase('carregando'); setErro('')
    try {
      const iniISOCompleto = `${dtIni}T00:00:00`
      const fimISOCompleto = `${dtFim}T23:59:59`
      const r = await sbFetch(`auditoria_modificacoes?select=*&data_hora=gte.${iniISOCompleto}&data_hora=lte.${fimISOCompleto}&order=data_hora.desc`)
      setDados(r || [])
      setFase('pronto')

      const tabelasEnvolvidas = [...new Set((r || []).map(d => d.tabela).filter(Boolean))]
      if (tabelasEnvolvidas.length) {
        const filtro = tabelasEnvolvidas.map(t => `"${t}"`).join(',')
        const dic = await sbFetch(`sankhya_dic_campos?select=nome_tabela,nome_campo,descr_campo&nome_tabela=in.(${filtro})`)
        const mapa = {}
        ;(dic || []).forEach(c => { mapa[`${c.nome_tabela}::${c.nome_campo}`] = c.descr_campo })
        setDicCampos(mapa)
      }
    } catch (e) {
      setErro(e.message); setFase('erro')
    }
  }
  useEffect(() => { carregar() }, [])

  const sincronizarPeriodo = async () => {
    setSincronizando(true); setMsgSync('')
    try {
      const janelas = gerarJanelas(dtIni, dtFim, 5)
      let totalInserido = 0
      for (let i = 0; i < janelas.length; i++) {
        setMsgSync(`Sincronizando janela ${i+1}/${janelas.length}…`)
        const d = await chamarSync({ data_inicio: isoParaBR(janelas[i].ini), data_fim: isoParaBR(janelas[i].fim) })
        if (d.ok) totalInserido += d.inseridos || 0
        else throw new Error(d.erro || 'Erro na sincronização')
      }
      setMsgSync(`✓ Sincronizado! ${totalInserido} registros no período.`)
      await carregar()
    } catch (e) {
      setMsgSync(`Erro: ${e.message}`)
    } finally {
      setSincronizando(false)
    }
  }

  const opcoesTabela = useMemo(() => [...new Set(dados.map(d => d.tabela).filter(Boolean))].sort(), [dados])

  const qtdSistema = useMemo(() => dados.filter(d => d.username === 'SUP').length, [dados])

  const dadosVisiveis = useMemo(() =>
    mostrarSistema ? dados : dados.filter(d => d.username !== 'SUP')
  , [dados, mostrarSistema])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dadosVisiveis.filter(d => {
      if (fTipo && d.tipo !== fTipo) return false
      if (fTabela && d.tabela !== fTabela) return false
      if (q) {
        const h = `${d.tabela} ${d.instancia} ${d.username} ${d.chave}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dadosVisiveis, busca, fTipo, fTabela])

  const kpi = useMemo(() => ({
    total: dadosVisiveis.length,
    inclusoes: dadosVisiveis.filter(d => d.tipo === 'I').length,
    alteracoes: dadosVisiveis.filter(d => d.tipo === 'U').length,
    exclusoes: dadosVisiveis.filter(d => d.tipo === 'D').length,
  }), [dadosVisiveis])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <Panel title="Período">
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>De</label>
            <input type="date" value={dtIni} onChange={e => setDtIni(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>Até</label>
            <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }} />
          </div>
          <Btn primary onClick={carregar}>Ver período</Btn>
          <Btn onClick={sincronizarPeriodo} disabled={sincronizando}>
            {sincronizando ? '↻ Sincronizando…' : '↻ Sincronizar este período com o Sankhya'}
          </Btn>
          {msgSync && <span style={{ fontSize:12, color: msgSync.startsWith('Erro') ? '#B42318' : '#12805C' }}>{msgSync}</span>}
        </div>
        <p style={{ margin:'10px 0 0', fontSize:11.5, color:'#9CA3AF' }}>
          Ações do usuário de sistema (SUP) — renovação de sessão, tokens, estatísticas internas — ficam ocultas
          por padrão, pois não são ações de nenhuma pessoa. O dia de hoje é sincronizado automaticamente todo dia
          às 9h. Pra ver dias anteriores que ainda não foram buscados, use "Sincronizar este período" — ele busca
          dia a dia direto do Sankhya (pode demorar um pouco em períodos longos).
        </p>
      </Panel>

      {fase === 'carregando' && <Spinner/>}
      {fase === 'erro' && <div style={{ color:'#B42318', fontSize:13 }}>Erro: {erro}</div>}

      {fase === 'pronto' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[
              { label:'Total de alterações', valor:int(kpi.total), cor:'#101828' },
              { label:'Inclusões', valor:int(kpi.inclusoes), cor:'#12805C' },
              { label:'Alterações', valor:int(kpi.alteracoes), cor:'#B54708' },
              { label:'⚠ Exclusões', valor:int(kpi.exclusoes), cor:'#B42318' },
            ].map((k,i) => (
              <div key={i} style={{
                background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'16px 18px',
                borderTop: `3px solid ${k.cor}`,
              }}>
                <div style={{ fontSize:12, color:'#6B7280', marginBottom:8, fontWeight:500 }}>{k.label}</div>
                <div style={{ fontSize:24, fontWeight:700, color:k.cor }}>{k.valor}</div>
              </div>
            ))}
          </div>

          <Panel title={`Registros — ${int(filtrados.length)} de ${int(dadosVisiveis.length)}`} noPad>
            <div style={{ display:'flex', gap:12, padding:'14px 18px', borderBottom:'1px solid #F3F4F6', flexWrap:'wrap', alignItems:'flex-end' }}>
              <SearchInput value={busca} onChange={setBusca} placeholder="Tabela, usuário, chave…" />
              <Select label="Tipo" value={fTipo} onChange={setFTipo} options={['I','U','D']} placeholder="Todos" />
              <Select label="Tabela" value={fTabela} onChange={setFTabela} options={opcoesTabela} placeholder="Todas" />
              {(fTipo === 'D' || (!fTipo && kpi.exclusoes > 0)) && (
                <button onClick={() => setFTipo(fTipo === 'D' ? '' : 'D')} style={{
                  fontSize:12, padding:'7px 12px', borderRadius:6, border:'1px solid #FECACA',
                  background: fTipo === 'D' ? '#FEE2E2' : '#fff', color:'#B42318', cursor:'pointer', fontFamily:'inherit', fontWeight:600,
                }}>
                  {fTipo === 'D' ? '✕ Limpar filtro' : `⚠ Só exclusões (${kpi.exclusoes})`}
                </button>
              )}
              {qtdSistema > 0 && (
                <button onClick={() => setMostrarSistema(v => !v)} style={{
                  fontSize:12, padding:'7px 12px', borderRadius:6, border:'1px solid #E5E7EB',
                  background: mostrarSistema ? '#F3F4F6' : '#fff', color:'#6B7280', cursor:'pointer', fontFamily:'inherit',
                  marginLeft:'auto',
                }}>
                  {mostrarSistema
                    ? `✓ Mostrando sistema (SUP) — clique pra ocultar`
                    : `🤖 ${qtdSistema} ações de sistema (SUP) ocultas — clique pra ver`}
                </button>
              )}
            </div>

            <div style={{ maxHeight:600, overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                <thead>
                  <tr>
                    {['','Data/Hora','Usuário','Tipo','Tabela','Chave'].map(h => (
                      <th key={h} style={{
                        position:'sticky', top:0, background:'#F9FAFB', padding:'8px 12px', textAlign:'left',
                        fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em',
                        borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(d => {
                    const tipoInfo = TIPO_INFO[d.tipo] || { rot:d.tipo, cor:'#6B7280', bg:'#F3F4F6' }
                    const aberto = expandido === d.id
                    return (
                      <React.Fragment key={d.id}>
                        <tr
                          onClick={() => setExpandido(aberto ? null : d.id)}
                          style={{
                            borderTop:'1px solid #F9FAFB', cursor:'pointer',
                            background: d.tipo === 'D' ? '#FFFBFB' : 'transparent',
                          }}
                        >
                          <td style={{ padding:'7px 10px', color:'#9CA3AF', width:20 }}>{aberto ? '▾' : '▸'}</td>
                          <td style={{ padding:'7px 12px', whiteSpace:'nowrap', color:'#6B7280' }}>{dataHoraBR(d.data_hora)}</td>
                          <td style={{ padding:'7px 12px', fontWeight:600 }}>{d.username}</td>
                          <td style={{ padding:'7px 12px' }}>
                            <span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:600, color:tipoInfo.cor, background:tipoInfo.bg }}>
                              {tipoInfo.rot}
                            </span>
                          </td>
                          <td style={{ padding:'7px 12px' }}>{d.tabela}<span style={{ color:'#9CA3AF' }}> · {d.instancia}</span></td>
                          <td style={{ padding:'7px 12px', color:'#6B7280', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.chave}</td>
                        </tr>
                        {aberto && (
                          <tr>
                            <td colSpan={6} style={{ padding:0 }}>
                              <LinhaExpandida linha={d} dicCampos={dicCampos} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                  {!filtrados.length && (
                    <tr><td colSpan={6} style={{ textAlign:'center', padding:'32px', color:'#9CA3AF' }}>
                      Nenhum registro encontrado neste período/filtro. Se o período ainda não foi sincronizado, use o botão acima.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
