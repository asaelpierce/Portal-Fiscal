import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl, int, dBR } from '../config.js'
import { Panel, Btn, Spinner, SearchInput, Select } from '../components/UI.jsx'

const SYNC_KEY = 'kb2026sync!'

function hojeISO() { return new Date().toISOString().slice(0,10) }
function inicioAnoISO() { return `${new Date().getFullYear()}-01-01` }
function isoParaBR(iso) { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }

export default function VinculoFrete() {
  const [dtIni, setDtIni] = useState(inicioAnoISO())
  const [dtFim, setDtFim] = useState(hojeISO())
  const [dados, setDados] = useState([])
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [fSituacao, setFSituacao] = useState('')
  const [fTransp, setFTransp] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const [msgSync, setMsgSync] = useState('')
  const [visao, setVisao] = useState('nf') // 'nf' = por nota | 'cte' = por CT-e

  const carregar = async () => {
    setFase('carregando'); setErro('')
    try {
      const r = await sbFetch('frete_vinculo_nf_cte?select=*&order=data_nf.desc')
      setDados(r || []); setFase('pronto')
    } catch (e) { setErro(e.message); setFase('erro') }
  }
  useEffect(() => { carregar() }, [])

  const sincronizar = async () => {
    setSincronizando(true); setMsgSync('Buscando vínculos no Sankhya…')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/frete-vinculo-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ data_inicio: isoParaBR(dtIni), data_fim: isoParaBR(dtFim), _key: SYNC_KEY }),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.erro)
      setMsgSync(`✓ ${int(d.total)} notas — ${int(d.com_cte)} com CT-e, ${int(d.sem_cte)} sem.`)
      await carregar()
    } catch (e) { setMsgSync(`Erro: ${e.message}`) }
    finally { setSincronizando(false) }
  }

  const opcoesTransp = useMemo(() =>
    [...new Set(dados.map(d => d.transportadora).filter(Boolean))].sort(), [dados])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(d => {
      if (fSituacao === 'Com CT-e' && !d.tem_cte) return false
      if (fSituacao === 'Sem CT-e' && d.tem_cte) return false
      if (fTransp && d.transportadora !== fTransp) return false
      if (d.data_nf) {
        if (dtIni && d.data_nf < dtIni) return false
        if (dtFim && d.data_nf > dtFim) return false
      }
      if (q) {
        const h = `${d.numnota_nf} ${d.numnota_cte||''} ${d.fornecedor||''} ${d.transportadora||''} ${d.nunota_nf} ${d.nunota_cte||''}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dados, busca, fSituacao, fTransp, dtIni, dtFim])

  // Visão por CT-e: agrupa as notas que compartilham o mesmo CT-e
  const porCte = useMemo(() => {
    const mapa = new Map()
    filtrados.filter(d => d.tem_cte).forEach(d => {
      if (!mapa.has(d.nunota_cte)) {
        mapa.set(d.nunota_cte, {
          nunota_cte: d.nunota_cte, numnota_cte: d.numnota_cte, data_cte: d.data_cte,
          transportadora: d.transportadora, vlr_cte: d.vlr_cte, imp_cte: d.imp_cte,
          vlr_liq_cte: d.vlr_liq_cte, ctb_cte_debito: d.ctb_cte_debito, notas: [],
        })
      }
      mapa.get(d.nunota_cte).notas.push(d)
    })
    return [...mapa.values()].sort((a,b) => (b.data_cte||'').localeCompare(a.data_cte||''))
  }, [filtrados])

  const kpi = useMemo(() => ({
    total: filtrados.length,
    comCte: filtrados.filter(d => d.tem_cte).length,
    semCte: filtrados.filter(d => !d.tem_cte).length,
    vlrSemCte: filtrados.filter(d => !d.tem_cte).reduce((s,d) => s + Number(d.vlr_nf||0), 0),
  }), [filtrados])

  const exportarCsv = () => {
    const cab = ['Nota','Data NF','Fornecedor','Vlr NF','Impostos NF','Vlr Líq NF','Tem CT-e','CT-e','Data CT-e','Transportadora','Vlr CT-e','Impostos CT-e','Vlr Líq CT-e','Ctb NF Déb','Ctb NF Créd','Ctb CT-e Déb','Ctb CT-e Créd']
    const linhas = filtrados.map(d => [
      d.numnota_nf, dBR(d.data_nf), d.fornecedor, d.vlr_nf, d.imp_nf, d.vlr_liq_nf,
      d.tem_cte ? 'SIM' : 'NAO', d.numnota_cte||'', dBR(d.data_cte), d.transportadora||'',
      d.vlr_cte??'', d.imp_cte??'', d.vlr_liq_cte??'',
      d.ctb_nf_debito, d.ctb_nf_credito, d.ctb_cte_debito??'', d.ctb_cte_credito??'',
    ].map(v => String(v ?? '').replace(/;/g,',')).join(';'))
    const url = URL.createObjectURL(new Blob(['\ufeff'+[cab.join(';'),...linhas].join('\n')], { type:'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'vinculo_nf_cte.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const cel = { padding:'7px 12px', whiteSpace:'nowrap' }
  const celNum = { ...cel, textAlign:'right', fontVariantNumeric:'tabular-nums' }
  const th = (align='left') => ({
    position:'sticky', top:0, background:'#F9FAFB', padding:'8px 12px', textAlign:align,
    fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase',
    letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap',
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <p style={{ margin:0, fontSize:13, color:'#6B7280', maxWidth:760, lineHeight:1.6 }}>
        Mostra qual CT-e pertence a qual nota e vice-versa. O vínculo vem da chave de acesso: o CT-e
        referencia a chave da NF de mercadoria. Um mesmo CT-e pode cobrir várias notas.
      </p>

      <Panel title="Período">
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>De</label>
            <input type="date" value={dtIni} onChange={e=>setDtIni(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:11, color:'#6B7280', fontWeight:500 }}>Até</label>
            <input type="date" value={dtFim} onChange={e=>setDtFim(e.target.value)}
              style={{ fontFamily:'inherit', fontSize:13, padding:'7px 10px', border:'1px solid #E5E7EB', borderRadius:6 }} />
          </div>
          <Btn onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? '↻ Buscando…' : '↻ Buscar vínculos no Sankhya'}
          </Btn>
          {msgSync && <span style={{ fontSize:12, color: msgSync.startsWith('Erro') ? '#B42318' : '#12805C' }}>{msgSync}</span>}
        </div>
      </Panel>

      {fase === 'carregando' && <Spinner/>}
      {fase === 'erro' && <div style={{ color:'#B42318', fontSize:13 }}>Erro: {erro}</div>}

      {fase === 'pronto' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
            {[
              { label:'Notas no período', valor:int(kpi.total), cor:'#101828' },
              { label:'Com CT-e vinculado', valor:int(kpi.comCte), cor:'#12805C' },
              { label:'Sem CT-e', valor:int(kpi.semCte), cor:'#B54708' },
              { label:'Valor sem CT-e', valor:`R$ ${brl(kpi.vlrSemCte)}`, cor:'#B54708' },
            ].map((k,i) => (
              <div key={i} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'16px 18px', borderTop:`3px solid ${k.cor}` }}>
                <div style={{ fontSize:12, color:'#6B7280', marginBottom:8, fontWeight:500 }}>{k.label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:k.cor }}>{k.valor}</div>
              </div>
            ))}
          </div>

          <Panel
            title={visao==='nf' ? `Por nota — ${int(filtrados.length)}` : `Por CT-e — ${int(porCte.length)}`}
            noPad
            action={
              <div style={{ display:'flex', gap:8 }}>
                <Btn small onClick={()=>setVisao(visao==='nf'?'cte':'nf')}>
                  {visao==='nf' ? '⇄ Ver por CT-e' : '⇄ Ver por nota'}
                </Btn>
                <Btn small onClick={exportarCsv}>↓ CSV</Btn>
              </div>
            }
          >
            <div style={{ display:'flex', gap:12, padding:'14px 18px', borderBottom:'1px solid #F3F4F6', flexWrap:'wrap', alignItems:'flex-end' }}>
              <SearchInput value={busca} onChange={setBusca} placeholder="Nº da nota, do CT-e, fornecedor…" />
              <Select label="Situação" value={fSituacao} onChange={setFSituacao}
                options={['Com CT-e','Sem CT-e']} placeholder="Todas" />
              <Select label="Transportadora" value={fTransp} onChange={setFTransp} options={opcoesTransp} placeholder="Todas" />
            </div>

            <div style={{ maxHeight:620, overflow:'auto' }}>
              {visao === 'nf' ? (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead>
                    <tr>
                      <th style={th()}>Nota</th><th style={th()}>Data</th><th style={th()}>Fornecedor</th>
                      <th style={th('right')}>Vlr NF</th><th style={th('right')}>Líq. NF</th>
                      <th style={th()}>CT-e</th><th style={th()}>Transportadora</th>
                      <th style={th('right')}>Vlr CT-e</th><th style={th('right')}>Líq. CT-e</th>
                      <th style={th('right')}>Ctb NF (D)</th><th style={th('right')}>Ctb CT-e (D)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(d => (
                      <tr key={d.id} style={{ borderTop:'1px solid #F9FAFB', background: d.tem_cte ? 'transparent' : '#FFFBEB' }}>
                        <td style={{ ...cel, fontWeight:600 }}>{d.numnota_nf}</td>
                        <td style={{ ...cel, color:'#6B7280' }}>{dBR(d.data_nf)}</td>
                        <td style={{ ...cel, maxWidth:210, overflow:'hidden', textOverflow:'ellipsis' }} title={d.fornecedor}>{d.fornecedor}</td>
                        <td style={celNum}>R$ {brl(d.vlr_nf)}</td>
                        <td style={{ ...celNum, color:'#6B7280' }}>R$ {brl(d.vlr_liq_nf)}</td>
                        <td style={cel}>
                          {d.tem_cte ? (
                            <span style={{ fontWeight:600, color:'#12805C' }}>
                              {d.numnota_cte}
                              {d.qtd_nfs_no_cte > 1 && (
                                <span style={{ marginLeft:6, fontSize:10.5, fontWeight:600, padding:'1px 6px', borderRadius:4, background:'#DBEAFE', color:'#1D5BBF' }}
                                  title={`Este CT-e cobre ${d.qtd_nfs_no_cte} notas`}>
                                  {d.qtd_nfs_no_cte} NFs
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:5, background:'#FEF3C7', color:'#B54708' }}>sem CT-e</span>
                          )}
                        </td>
                        <td style={{ ...cel, maxWidth:190, overflow:'hidden', textOverflow:'ellipsis', color:'#6B7280' }} title={d.transportadora||''}>{d.transportadora || '—'}</td>
                        <td style={celNum}>{d.vlr_cte != null ? `R$ ${brl(d.vlr_cte)}` : '—'}</td>
                        <td style={{ ...celNum, color:'#6B7280' }}>{d.vlr_liq_cte != null ? `R$ ${brl(d.vlr_liq_cte)}` : '—'}</td>
                        <td style={celNum}>R$ {brl(d.ctb_nf_debito)}</td>
                        <td style={celNum}>{d.ctb_cte_debito != null ? `R$ ${brl(d.ctb_cte_debito)}` : '—'}</td>
                      </tr>
                    ))}
                    {!filtrados.length && <tr><td colSpan={11} style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Nenhum registro. Use "Buscar vínculos no Sankhya".</td></tr>}
                  </tbody>
                </table>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead>
                    <tr>
                      <th style={th()}>CT-e</th><th style={th()}>Data</th><th style={th()}>Transportadora</th>
                      <th style={th('right')}>Vlr CT-e</th><th style={th('right')}>Líq. CT-e</th>
                      <th style={th('right')}>Ctb (D)</th><th style={th()}>Notas cobertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCte.map(c => (
                      <tr key={c.nunota_cte} style={{ borderTop:'1px solid #F9FAFB' }}>
                        <td style={{ ...cel, fontWeight:600 }}>{c.numnota_cte}</td>
                        <td style={{ ...cel, color:'#6B7280' }}>{dBR(c.data_cte)}</td>
                        <td style={{ ...cel, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }} title={c.transportadora}>{c.transportadora}</td>
                        <td style={celNum}>R$ {brl(c.vlr_cte)}</td>
                        <td style={{ ...celNum, color:'#6B7280' }}>R$ {brl(c.vlr_liq_cte)}</td>
                        <td style={celNum}>R$ {brl(c.ctb_cte_debito)}</td>
                        <td style={{ padding:'7px 12px' }}>
                          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                            {c.notas.map(n => (
                              <span key={n.id} title={`${n.fornecedor} · R$ ${brl(n.vlr_nf)}`}
                                style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:'#F3F4F6', color:'#374151', fontWeight:600 }}>
                                {n.numnota_nf}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!porCte.length && <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Nenhum CT-e no filtro atual.</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
