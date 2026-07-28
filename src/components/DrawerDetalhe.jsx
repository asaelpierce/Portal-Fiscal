import React, { useEffect, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, brl, dBR, classeDe } from '../config.js'

const SYNC_KEY = 'kb2026sync!'

async function buscarDetalhe(nunota) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/nota-detalhe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ nunota, _key: SYNC_KEY }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.erro || 'Erro ao buscar detalhe')
  return data
}

async function analisarComIA(nota, dados) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/nota-analise-ia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ _key: SYNC_KEY, nota, itens: dados.itens, lancamentos: dados.lancamentos, totalCusto: dados.totalCusto, totalContab: dados.totalContab }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.erro || 'Erro na análise')
  return data.analise
}

export default function DrawerDetalhe({ nota, onClose }) {
  const [fase,     setFase]     = useState('carregando')
  const [dados,    setDados]    = useState(null)
  const [erro,     setErro]     = useState('')
  const [abaAtiva, setAba]      = useState('itens')
  const [iaFase,   setIaFase]   = useState('idle')
  const [iaTexto,  setIaTexto]  = useState('')
  const [iaErro,   setIaErro]   = useState('')

  useEffect(() => {
    if (!nota) return
    setFase('carregando'); setDados(null); setErro('')
    setIaFase('idle'); setIaTexto(''); setIaErro(''); setAba('itens')
    buscarDetalhe(nota.nunota)
      .then(d => { setDados(d); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [nota?.nunota])

  const rodarIA = async () => {
    if (!dados || iaFase === 'rodando') return
    setIaFase('rodando'); setIaTexto(''); setIaErro('')
    try { const txt = await analisarComIA(nota, dados); setIaTexto(txt); setIaFase('pronto') }
    catch(e) { setIaErro(e.message); setIaFase('erro') }
  }

  if (!nota) return null
  const cls = classeDe(nota.classe_divergencia)

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(16,24,40,.4)',zIndex:40 }}/>
      <aside style={{
        position:'fixed',top:0,right:0,bottom:0,width:'min(700px,95vw)',
        background:'#fff',borderLeft:'1px solid #E5E7EB',zIndex:41,
        display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(16,24,40,.15)',overflow:'hidden',
      }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{padding:'18px 22px',borderBottom:'1px solid #F3F4F6',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:5,background:cls.bg,color:cls.cor}}>
                  {cls.icone} {cls.rot}
                </span>
                <span style={{fontSize:11.5,color:'#9CA3AF'}}>TOP {nota.cod_top} · {nota.descr_top}</span>
              </div>
              <h2 style={{margin:0,fontSize:18,fontWeight:700}}>Nota fiscal {nota.nota_fiscal}</h2>
              {dados?.cab && <div style={{fontSize:12.5,color:'#6B7280',marginTop:3}}>{dados.cab.parceiro} · {dados.cab.dtentsai}</div>}
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:6,color:'#6B7280',flexShrink:0}}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Resumo diferença */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginTop:14,padding:'12px 14px',background:'#F9FAFB',borderRadius:8}}>
            {[['Custo apurado',nota.saldo_dash,'#101828'],['Saldo contábil',nota.saldo_contabil,'#101828'],
              ['Diferença',nota.diferenca,Math.abs(Number(nota.diferenca))>0.005?cls.cor:'#12805C']].map(([l,v,c])=>(
              <div key={l}>
                <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:3}}>{l}</div>
                <div style={{fontSize:17,fontWeight:700,color:c,fontVariantNumeric:'tabular-nums'}}>
                  {Number(v)>0?'+':''}R$ {brl(v)}
                </div>
              </div>
            ))}
          </div>

          {nota.motivo_calculado && (
            <div style={{marginTop:10,padding:'9px 12px',background:cls.bg,borderRadius:6,fontSize:12.5,color:cls.cor}}>
              <strong>Diagnóstico:</strong> {nota.motivo_calculado}
            </div>
          )}
        </div>

        {/* Abas */}
        <div style={{display:'flex',gap:2,padding:'10px 22px 0',borderBottom:'1px solid #F3F4F6',flexShrink:0}}>
          {[{id:'itens',label:'📦 Itens da nota'},{id:'lanc',label:'📒 Lançamentos contábeis'},{id:'vinculos',label:'🔗 Vínculos'},{id:'ia',label:'🤖 Análise IA'}].map(a=>(
            <button key={a.id} onClick={()=>setAba(a.id)} style={{
              padding:'7px 14px',fontSize:13,fontWeight:abaAtiva===a.id?600:400,
              border:'none',borderBottom:`2px solid ${abaAtiva===a.id?'#1D5BBF':'transparent'}`,
              background:'none',cursor:'pointer',fontFamily:'inherit',
              color:abaAtiva===a.id?'#1D5BBF':'#6B7280',
            }}>{a.label}</button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{flex:1,overflowY:'auto',padding:'18px 22px'}}>
          {fase==='carregando' && (
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'40px',color:'#9CA3AF',fontSize:13}}>
              <div style={{width:22,height:22,border:'3px solid #E5E7EB',borderTopColor:'#1D5BBF',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
              Buscando dados no Sankhya…
            </div>
          )}
          {fase==='erro' && (
            <div style={{padding:16,background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,color:'#B42318',fontSize:13}}>Erro: {erro}</div>
          )}

          {fase==='pronto' && dados && (
            <>
              {/* ABA ITENS */}
              {abaAtiva==='itens' && (
                <div>
                  <div style={{fontSize:12,color:'#9CA3AF',marginBottom:12}}>
                    {dados.itens.length} item(ns) · Valor NF: R$ {brl(dados.cab?.vlrnota)} · Fornecedor: {dados.cab?.parceiro}
                  </div>
                  {dados.itens.map((item,i)=>(
                    <div key={i} style={{border:'1px solid #E5E7EB',borderRadius:8,marginBottom:12,overflow:'hidden'}}>
                      <div style={{padding:'10px 14px',background:'#F9FAFB',borderBottom:'1px solid #E5E7EB',display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                        <div>
                          <span style={{fontSize:11,color:'#9CA3AF',marginRight:8}}>Seq {item.sequencia}</span>
                          <span style={{fontSize:13,fontWeight:700}}>{item.codprod}</span>
                          <span style={{fontSize:12.5,color:'#6B7280',marginLeft:8}}>{item.descrprod}</span>
                        </div>
                        <span style={{fontSize:11.5,color:'#9CA3AF'}}>{item.descrlocal} · {item.atualestoque===1?'ENTRADA':'SAÍDA'}</span>
                      </div>
                      <div style={{padding:'12px 14px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:10}}>
                          {[
                            ['Quantidade',`${Number(item.qtdneg).toLocaleString('pt-BR',{minimumFractionDigits:2})} ${item.codvol}`],
                            ['Vlr. unit. NF',`R$ ${brl(item.vlr_unit_nota)}`],
                            ['Custo s/ ICMS',`R$ ${brl(item.custo_sem_icms)}`],
                            ['Custo total',`R$ ${brl(item.custo_total)}`],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:2}}>{l}</div>
                              <div style={{fontSize:13,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {Math.abs(item.vlr_unit_nota-item.custo_sem_icms)>0.005 && (
                          <div style={{padding:'7px 10px',background:'#FEF3C7',borderRadius:6,fontSize:12,color:'#92400E',display:'flex',justifyContent:'space-between'}}>
                            <span>⚠ Valor NF (R$ {brl(item.vlr_unit_nota)}/un) difere do custo registrado (R$ {brl(item.custo_sem_icms)}/un)</span>
                            <strong>Δ R$ {brl(Math.abs(item.vlr_unit_nota-item.custo_sem_icms))}/un</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div style={{padding:'12px 14px',background:'#101828',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{color:'#fff',fontSize:13,fontWeight:600}}>Total custo apurado</span>
                    <span style={{color:'#fff',fontSize:16,fontWeight:800,fontVariantNumeric:'tabular-nums'}}>R$ {brl(dados.totalCusto)}</span>
                  </div>
                </div>
              )}

              {/* ABA LANÇAMENTOS */}
              {abaAtiva==='lanc' && (
                <div>
                  {dados.lancamentos.length===0 ? (
                    <div style={{padding:'24px',textAlign:'center',color:'#92400E',background:'#FEF3C7',borderRadius:8,border:'1px solid #FDE68A'}}>
                      ⚠ Nenhum lançamento contábil encontrado.<br/>
                      <span style={{fontSize:12,marginTop:6,display:'block'}}>Esta é provavelmente a causa da diferença.</span>
                    </div>
                  ) : (
                    <>
                      <div style={{fontSize:12,color:'#9CA3AF',marginBottom:12}}>
                        {dados.lancamentos.length} lançamento(s) · lote(s): {[...new Set(dados.lancamentos.map(l=>l.lote))].join(', ')}
                      </div>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                        <thead>
                          <tr>{['Conta','Descrição','D/C','Valor','Data','Lote'].map(h=>(
                            <th key={h} style={{padding:'8px 10px',background:'#F9FAFB',textAlign:h==='Valor'?'right':'left',
                              fontSize:10.5,fontWeight:600,color:'#6B7280',borderBottom:'1px solid #E5E7EB',
                              textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {dados.lancamentos.map((l,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}}>
                              <td style={{padding:'8px 10px',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{l.codctactb}</td>
                              <td style={{padding:'8px 10px',color:'#6B7280',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.descrcta}</td>
                              <td style={{padding:'8px 10px'}}><span style={{fontWeight:700,color:l.tiplanc==='D'?'#12805C':'#B42318'}}>{l.tiplanc==='D'?'D':'C'}</span></td>
                              <td style={{padding:'8px 10px',textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600}}>R$ {brl(l.vlrlanc)}</td>
                              <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{l.dtmov}</td>
                              <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{l.lote}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{background:'#F9FAFB',fontWeight:700}}>
                            <td colSpan={3} style={{padding:'8px 10px',borderTop:'2px solid #E5E7EB'}}>Total contabilizado</td>
                            <td style={{padding:'8px 10px',textAlign:'right',borderTop:'2px solid #E5E7EB',fontVariantNumeric:'tabular-nums'}}>R$ {brl(dados.totalContab)}</td>
                            <td colSpan={2} style={{borderTop:'2px solid #E5E7EB'}}/>
                          </tr>
                        </tfoot>
                      </table>
                      <div style={{marginTop:16,padding:'14px',background:'#F9FAFB',borderRadius:8}}>
                        <div style={{fontSize:12,fontWeight:600,marginBottom:10}}>Comparativo</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                          {[['Custo apurado',dados.totalCusto,'#101828'],['Contabilizado',dados.totalContab,'#101828'],
                            ['Diferença',Math.abs(dados.totalCusto-dados.totalContab),cls.cor]].map(([l,v,c])=>(
                            <div key={l} style={{padding:'10px',background:'#fff',borderRadius:6,border:'1px solid #E5E7EB'}}>
                              <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:3}}>{l}</div>
                              <div style={{fontSize:15,fontWeight:700,color:c,fontVariantNumeric:'tabular-nums'}}>R$ {brl(v)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ABA VÍNCULOS */}
              {abaAtiva==='vinculos' && (
                <div>
                  {/* Pedido de compra */}
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                      📄 Pedido de compra (OC)
                    </div>
                    {dados.pedidos && dados.pedidos.length > 0 ? (
                      <div style={{border:'1px solid #E5E7EB',borderRadius:8,overflow:'hidden'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                          <thead>
                            <tr>{['Pedido OC','Data','Produto','Qtd. atendida'].map(h=>(
                              <th key={h} style={{padding:'8px 10px',background:'#F9FAFB',
                                textAlign:h==='Qtd. atendida'?'right':'left',
                                fontSize:10.5,fontWeight:600,color:'#6B7280',borderBottom:'1px solid #E5E7EB',
                                textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {dados.pedidos.map((p,i)=>(
                              <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}}>
                                <td style={{padding:'8px 10px',fontWeight:700}}>{p.pedido_oc}</td>
                                <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{p.data_oc}</td>
                                <td style={{padding:'8px 10px',fontVariantNumeric:'tabular-nums'}}>{p.codprod}</td>
                                <td style={{padding:'8px 10px',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{p.qtd_atendida}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{padding:'14px',background:'#F9FAFB',borderRadius:8,fontSize:12.5,color:'#9CA3AF'}}>
                        Nenhum pedido de compra vinculado a esta nota.
                      </div>
                    )}
                  </div>

                  {/* CT-e */}
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                      🚚 CT-e (frete) vinculado
                    </div>
                    {dados.ctes && dados.ctes.length > 0 ? (
                      <div style={{border:'1px solid #E5E7EB',borderRadius:8,overflow:'hidden'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                          <thead>
                            <tr>{['CT-e','Transportadora','Data','Valor'].map(h=>(
                              <th key={h} style={{padding:'8px 10px',background:'#F9FAFB',
                                textAlign:h==='Valor'?'right':'left',
                                fontSize:10.5,fontWeight:600,color:'#6B7280',borderBottom:'1px solid #E5E7EB',
                                textTransform:'uppercase',letterSpacing:'.04em'}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {dados.ctes.map((c,i)=>(
                              <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}}>
                                <td style={{padding:'8px 10px',fontWeight:700}}>{c.num_cte}</td>
                                <td style={{padding:'8px 10px',color:'#6B7280'}}>{c.transportadora}</td>
                                <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{c.data_cte}</td>
                                <td style={{padding:'8px 10px',textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600}}>R$ {brl(c.vlr_cte)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{padding:'14px',background:'#F9FAFB',borderRadius:8,fontSize:12.5,color:'#9CA3AF'}}>
                        Nenhum CT-e vinculado a esta nota — não houve rateio de frete registrado.
                      </div>
                    )}
                  </div>

                  {/* Chave de acesso */}
                  {dados.cab?.chavenfe && (
                    <div style={{marginTop:20,padding:'10px 12px',background:'#F9FAFB',borderRadius:6}}>
                      <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:3}}>Chave de acesso da NF-e</div>
                      <div style={{fontSize:11.5,fontFamily:'monospace',color:'#374151',wordBreak:'break-all'}}>{dados.cab.chavenfe}</div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA IA */}
              {abaAtiva==='ia' && (
                <div>
                  <div style={{padding:'14px',background:'#F9FAFB',borderRadius:8,marginBottom:16,fontSize:12.5,color:'#6B7280',lineHeight:1.6}}>
                    O GPT-4 analisa os itens, o custo registrado vs valor da NF e os lançamentos contábeis para identificar a causa e sugerir a correção.
                    <strong style={{color:'#374151'}}> Uma chamada por análise.</strong>
                  </div>
                  {iaFase==='idle' && (
                    <button onClick={rodarIA} style={{width:'100%',padding:'12px',background:'#101828',color:'#fff',
                      border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                      🤖 Analisar com GPT-4
                    </button>
                  )}
                  {iaFase==='rodando' && (
                    <div style={{display:'flex',alignItems:'center',gap:12,padding:'20px',background:'#EBF2FC',borderRadius:8,color:'#1D5BBF',fontSize:13}}>
                      <div style={{width:20,height:20,border:'3px solid #BFDBFE',borderTopColor:'#1D5BBF',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}}/>
                      Consultando GPT-4…
                    </div>
                  )}
                  {iaFase==='erro' && (
                    <div style={{padding:'14px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,color:'#B42318',fontSize:13,marginBottom:12}}>
                      Erro: {iaErro}
                    </div>
                  )}
                  {iaFase==='pronto' && (
                    <div>
                      <div style={{padding:'18px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#166534',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>🤖 Análise GPT-4</div>
                        <div style={{fontSize:13.5,color:'#1a1a1a',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{iaTexto}</div>
                      </div>
                      <button onClick={()=>setIaFase('idle')} style={{fontSize:12,color:'#6B7280',background:'none',border:'1px solid #E5E7EB',borderRadius:6,padding:'6px 12px',cursor:'pointer',fontFamily:'inherit'}}>
                        ↺ Analisar novamente
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
