import React, { useMemo, useState, useEffect } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl, int, dBR, classeDe } from '../config.js'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

async function analisarComIA(nota, dados) {
  const itens = dados.itens.map(i => ({
    produto: i.codprod,
    descricao: i.descrprod.slice(0, 60),
    quantidade: i.qtdneg,
    unidade: i.codvol,
    vlr_unit_nf: i.vlr_unit_nota,
    custo_sem_icms: i.custo_sem_icms,
    diff_unit: Math.abs(i.vlr_unit_nota - i.custo_sem_icms).toFixed(4),
    custo_total: i.custo_total,
  }))

  const lancs = dados.lancamentos.map(l => ({
    conta: l.codctactb,
    descricao: l.descrcta,
    dc: l.tiplanc === 'D' ? 'Débito' : 'Crédito',
    valor: l.vlrlanc,
    data: l.dtmov,
  }))

  const prompt = `Você é um analista de custos sênior especialista em sistema Sankhya.

Analise a seguinte divergência entre o custo apurado no módulo de estoque e o lançamento contábil:

NOTA FISCAL: ${nota.nota_fiscal}
OPERAÇÃO: ${nota.descr_top} (TOP ${nota.cod_top})
DATA: ${nota.data_entrada_saida}
CONTA CONTÁBIL: ${nota.conta_contabil} — ${nota.descr_local}

VALORES:
- Custo apurado (Dash): R$ ${brl_str(nota.saldo_dash)}
- Saldo contábil (Razão): R$ ${brl_str(nota.saldo_contabil)}
- Diferença: R$ ${brl_str(nota.diferenca)}

ITENS DA NOTA:
${JSON.stringify(itens, null, 2)}

LANÇAMENTOS CONTÁBEIS GERADOS:
${JSON.stringify(lancs, null, 2)}

TOTAL CUSTO DOS ITENS: R$ ${brl_str(dados.totalCusto)}
TOTAL CONTABILIZADO: R$ ${brl_str(dados.totalContab)}

Com base nesses dados, responda em português (máximo 200 palavras):
1. Qual é a causa exata desta diferença?
2. O que o analista deve fazer para corrigir?
3. Esta diferença é esperada ou indica um problema real?

Seja direto e específico. Use os valores reais.`

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.content?.[0]?.text || 'Sem resposta'
}

function brl_str(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}



const SYNC_KEY = 'kb2026sync!'

async function buscarDetalhe(nunota) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/nota-detalhe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'x-api-key': SYNC_KEY,
    },
    body: JSON.stringify({ nunota }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.erro || 'Erro ao buscar detalhe')
  return data
}

// ─── Drawer de detalhe ───────────────────────────────────────────────────────
function DrawerDetalhe({ nota, onClose }) {
  const [fase,   setFase]   = useState('carregando')
  const [dados,  setDados]  = useState(null)
  const [erro,   setErro]   = useState('')
  const [abaAtiva, setAba]  = useState('itens')
  const [iaFase,  setIaFase] = useState('idle') // idle | rodando | pronto | erro
  const [iaTexto, setIaTexto] = useState('')
  const [iaErro,  setIaErro]  = useState('')

  const rodarIA = async () => {
    if (!dados || iaFase === 'rodando') return
    setIaFase('rodando'); setIaTexto(''); setIaErro('')
    try {
      const txt = await analisarComIA(nota, dados)
      setIaTexto(txt); setIaFase('pronto')
    } catch(e) { setIaErro(e.message); setIaFase('erro') }
  }

  useEffect(() => {
    if (!nota) return
    setFase('carregando'); setDados(null); setErro('')
    setIaFase('idle'); setIaTexto(''); setIaErro('')
    buscarDetalhe(nota.nunota)
      .then(d => { setDados(d); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [nota?.nunota])

  if (!nota) return null

  const cls = classeDe(nota.classe_divergencia)

  return (
    <>
      {/* overlay */}
      <div onClick={onClose} style={{
        position:'fixed',inset:0,background:'rgba(16,24,40,.4)',zIndex:40,
      }}/>

      {/* painel */}
      <aside style={{
        position:'fixed',top:0,right:0,bottom:0,width:'min(680px,95vw)',
        background:'#fff',borderLeft:'1px solid #E5E7EB',zIndex:41,
        display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(16,24,40,.15)',
        overflow:'hidden',
      }}>

        {/* header */}
        <div style={{padding:'18px 22px',borderBottom:'1px solid #F3F4F6',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:5,
                  background:cls.bg,color:cls.cor}}>{cls.icone} {cls.rot}</span>
                <span style={{fontSize:11.5,color:'#9CA3AF'}}>TOP {nota.cod_top} · {nota.descr_top}</span>
              </div>
              <h2 style={{margin:0,fontSize:18,fontWeight:700}}>Nota fiscal {nota.nota_fiscal}</h2>
              {dados?.cab && (
                <div style={{fontSize:12.5,color:'#6B7280',marginTop:3}}>
                  {dados.cab.parceiro} · {dados.cab.dtentsai}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',
              padding:6,color:'#6B7280',borderRadius:5,flexShrink:0}}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* resumo da diferença */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginTop:14,
            padding:'12px 14px',background:'#F9FAFB',borderRadius:8}}>
            {[
              ['Custo apurado',  nota.saldo_dash,    '#101828'],
              ['Saldo contábil', nota.saldo_contabil,'#101828'],
              ['Diferença',      nota.diferenca,     Math.abs(Number(nota.diferenca))>0.005?cls.cor:'#12805C'],
            ].map(([label,val,cor])=>(
              <div key={label}>
                <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:3}}>{label}</div>
                <div style={{fontSize:17,fontWeight:700,color:cor,fontVariantNumeric:'tabular-nums'}}>
                  {Number(val)>0?'+':''}R$ {brl(val)}
                </div>
              </div>
            ))}
          </div>

          {/* diagnóstico */}
          <div style={{marginTop:10,padding:'9px 12px',background:cls.bg,borderRadius:6,fontSize:12.5,color:cls.cor}}>
            <strong>Diagnóstico:</strong> {nota.motivo_calculado}
          </div>
        </div>

        {/* abas */}
        <div style={{display:'flex',gap:2,padding:'10px 22px 0',borderBottom:'1px solid #F3F4F6',flexShrink:0}}>
          {[
            {id:'itens', label:'Itens da nota'},
            {id:'lanc',  label:'Lançamentos contábeis'},
      {id:'ia',    label:'🤖 Análise inteligente'},
          ].map(a=>(
            <button key={a.id} onClick={()=>setAba(a.id)} style={{
              padding:'7px 16px',fontSize:13,fontWeight:abaAtiva===a.id?600:400,
              border:'none',borderBottom:`2px solid ${abaAtiva===a.id?'#1D5BBF':'transparent'}`,
              background:'none',cursor:'pointer',fontFamily:'inherit',
              color:abaAtiva===a.id?'#1D5BBF':'#6B7280',
            }}>{a.label}</button>
          ))}
        </div>

        {/* conteúdo */}
        <div style={{flex:1,overflowY:'auto',padding:'18px 22px'}}>

          {fase==='carregando' && (
            <div style={{display:'flex',justifyContent:'center',padding:'40px',color:'#9CA3AF',fontSize:13}}>
              <div style={{width:24,height:24,border:'3px solid #E5E7EB',borderTopColor:'#1D5BBF',
                borderRadius:'50%',animation:'spin 0.8s linear infinite',marginRight:10}}/>
              Buscando no Sankhya…
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {fase==='erro' && (
            <div style={{padding:'16px',background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,
              color:'#B42318',fontSize:13}}>Erro: {erro}</div>
          )}

          {fase==='pronto' && dados && (
            <>
              {/* ABA: ITENS */}
              {abaAtiva==='itens' && (
                <div>
                  <div style={{fontSize:12,color:'#9CA3AF',marginBottom:12}}>
                    {dados.itens.length} item(ns) · valor da nota R$ {brl(dados.cab?.vlrnota)}
                  </div>
                  {dados.itens.map((item,i)=>(
                    <div key={i} style={{border:'1px solid #E5E7EB',borderRadius:8,
                      marginBottom:12,overflow:'hidden'}}>
                      {/* cabeçalho do item */}
                      <div style={{padding:'10px 14px',background:'#F9FAFB',
                        borderBottom:'1px solid #E5E7EB',
                        display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                        <div>
                          <span style={{fontSize:11,color:'#9CA3AF',marginRight:8}}>Seq {item.sequencia}</span>
                          <span style={{fontSize:13,fontWeight:700}}>{item.codprod}</span>
                          <span style={{fontSize:12.5,color:'#6B7280',marginLeft:8}}>{item.descrprod}</span>
                        </div>
                        <span style={{fontSize:11.5,color:'#9CA3AF'}}>
                          {item.descrlocal} · {item.atualestoque===1?'ENTRADA':'SAÍDA'}
                        </span>
                      </div>
                      {/* dados do item */}
                      <div style={{padding:'12px 14px'}}>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
                          {[
                            ['Quantidade',   `${Number(item.qtdneg).toLocaleString('pt-BR',{minimumFractionDigits:2})} ${item.codvol}`],
                            ['Vlr. unit. NF', `R$ ${brl(item.vlr_unit_nota)}`],
                            ['Custo s/ ICMS', `R$ ${brl(item.custo_sem_icms)}`],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:2}}>{l}</div>
                              <div style={{fontSize:14,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {/* barra mostrando diferença custo NF vs custo entrada */}
                        {Math.abs(item.vlr_unit_nota - item.custo_sem_icms) > 0.005 && (
                          <div style={{padding:'8px 10px',background:'#FEF3C7',borderRadius:6,
                            fontSize:12,color:'#92400E',display:'flex',justifyContent:'space-between'}}>
                            <span>⚠ Valor NF (R$ {brl(item.vlr_unit_nota)}/un) difere do custo registrado (R$ {brl(item.custo_sem_icms)}/un)</span>
                            <strong>Δ R$ {brl(Math.abs(item.vlr_unit_nota - item.custo_sem_icms))}/un</strong>
                          </div>
                        )}
                        <div style={{marginTop:10,display:'flex',justifyContent:'space-between',
                          padding:'8px 10px',background:'#F3F4F6',borderRadius:6}}>
                          <span style={{fontSize:12,color:'#6B7280'}}>Custo total do item</span>
                          <span style={{fontWeight:700,fontSize:13,fontVariantNumeric:'tabular-nums'}}>
                            R$ {brl(item.custo_total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* total */}
                  <div style={{padding:'12px 14px',background:'#101828',borderRadius:8,
                    display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{color:'#fff',fontSize:13,fontWeight:600}}>Total custo apurado</span>
                    <span style={{color:'#fff',fontSize:16,fontWeight:800,fontVariantNumeric:'tabular-nums'}}>
                      R$ {brl(dados.totalCusto)}
                    </span>
                  </div>
                </div>
              )}

              {/* ABA: LANÇAMENTOS CONTÁBEIS */}
              {abaAtiva==='lanc' && (
                <div>
                  {dados.lancamentos.length === 0 ? (
                    <div style={{padding:'24px',textAlign:'center',color:'#9CA3AF',
                      background:'#FEF3C7',borderRadius:8,border:'1px solid #FDE68A'}}>
                      ⚠ Nenhum lançamento contábil encontrado para esta nota.<br/>
                      <span style={{fontSize:12,marginTop:6,display:'block'}}>
                        Esta é provavelmente a causa da diferença.
                      </span>
                    </div>
                  ) : (
                    <>
                      <div style={{fontSize:12,color:'#9CA3AF',marginBottom:12}}>
                        {dados.lancamentos.length} lançamento(s) · lote(s): {[...new Set(dados.lancamentos.map(l=>l.lote))].join(', ')}
                      </div>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                        <thead>
                          <tr>
                            {['Conta','Descrição','D/C','Valor','Data mov.','Lote'].map(h=>(
                              <th key={h} style={{padding:'8px 10px',background:'#F9FAFB',
                                textAlign:h==='Valor'?'right':'left',
                                fontSize:10.5,fontWeight:600,color:'#6B7280',
                                borderBottom:'1px solid #E5E7EB',textTransform:'uppercase',
                                letterSpacing:'.04em',whiteSpace:'nowrap'}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dados.lancamentos.map((l,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #F9FAFB'}}>
                              <td style={{padding:'8px 10px',fontVariantNumeric:'tabular-nums',fontWeight:600}}>{l.codctactb}</td>
                              <td style={{padding:'8px 10px',color:'#6B7280',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.descrcta}</td>
                              <td style={{padding:'8px 10px'}}>
                                <span style={{fontWeight:700,color:l.tiplanc==='D'?'#12805C':'#B42318'}}>
                                  {l.tiplanc==='D'?'D':'C'}
                                </span>
                              </td>
                              <td style={{padding:'8px 10px',textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600}}>
                                R$ {brl(l.vlrlanc)}
                              </td>
                              <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{l.dtmov}</td>
                              <td style={{padding:'8px 10px',color:'#9CA3AF'}}>{l.lote}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{background:'#F9FAFB',fontWeight:700}}>
                            <td colSpan={3} style={{padding:'8px 10px',borderTop:'2px solid #E5E7EB'}}>
                              Total contabilizado
                            </td>
                            <td style={{padding:'8px 10px',textAlign:'right',borderTop:'2px solid #E5E7EB',
                              fontVariantNumeric:'tabular-nums',fontSize:13}}>
                              R$ {brl(dados.totalContab)}
                            </td>
                            <td colSpan={2} style={{borderTop:'2px solid #E5E7EB'}}/>
                          </tr>
                        </tfoot>
                      </table>

                      {/* comparativo final */}
                      <div style={{marginTop:16,padding:'14px',background:'#F9FAFB',borderRadius:8}}>
                        <div style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:10}}>
                          Comparativo custo × contabilidade
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                          {[
                            ['Custo apurado',  dados.totalCusto,   '#101828'],
                            ['Contabilizado',  dados.totalContab,  '#101828'],
                            ['Diferença',      Math.abs(dados.totalCusto - dados.totalContab), cls.cor],
                          ].map(([l,v,c])=>(
                            <div key={l} style={{padding:'10px',background:'#fff',borderRadius:6,border:'1px solid #E5E7EB'}}>
                              <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:3}}>{l}</div>
                              <div style={{fontSize:15,fontWeight:700,color:c,fontVariantNumeric:'tabular-nums'}}>
                                R$ {brl(v)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ABA: ANÁLISE INTELIGENTE */}
              {abaAtiva==='ia' && (
                <div>
                  <div style={{padding:'14px',background:'#F9FAFB',borderRadius:8,marginBottom:16,
                    fontSize:12.5,color:'#6B7280',lineHeight:1.6}}>
                    A IA analisa os itens da nota, o custo registrado vs valor da NF e os lançamentos contábeis
                    para identificar a causa exata da diferença e sugerir a correção.
                    <strong style={{color:'#374151'}}> Uma chamada por análise.</strong>
                  </div>

                  {iaFase==='idle' && (
                    <button onClick={rodarIA} style={{
                      width:'100%',padding:'12px',background:'#101828',color:'#fff',
                      border:'none',borderRadius:8,fontSize:14,fontWeight:600,
                      cursor:'pointer',fontFamily:'inherit',
                    }}>
                      🤖 Analisar esta nota com IA
                    </button>
                  )}

                  {iaFase==='rodando' && (
                    <div style={{display:'flex',alignItems:'center',gap:12,padding:'20px',
                      background:'#EBF2FC',borderRadius:8,color:'#1D5BBF',fontSize:13}}>
                      <div style={{width:20,height:20,border:'3px solid #BFDBFE',borderTopColor:'#1D5BBF',
                        borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0}}/>
                      Analisando os dados da nota no Sankhya…
                    </div>
                  )}

                  {iaFase==='erro' && (
                    <div style={{padding:'14px',background:'#FEF2F2',border:'1px solid #FECACA',
                      borderRadius:8,color:'#B42318',fontSize:13,marginBottom:12}}>
                      Erro: {iaErro}
                    </div>
                  )}

                  {iaFase==='pronto' && (
                    <div>
                      <div style={{padding:'18px',background:'#F0FDF4',border:'1px solid #BBF7D0',
                        borderRadius:8,marginBottom:12}}>
                        <div style={{fontSize:11,fontWeight:700,color:'#166534',textTransform:'uppercase',
                          letterSpacing:'.08em',marginBottom:10}}>🤖 Análise da IA</div>
                        <div style={{fontSize:13.5,color:'#1a1a1a',lineHeight:1.7,whiteSpace:'pre-wrap'}}>
                          {iaTexto}
                        </div>
                      </div>
                      <button onClick={()=>setIaFase('idle')} style={{
                        fontSize:12,color:'#6B7280',background:'none',border:'1px solid #E5E7EB',
                        borderRadius:6,padding:'6px 12px',cursor:'pointer',fontFamily:'inherit',
                      }}>↺ Analisar novamente</button>
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

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function Divergencias({ lancamentos }) {
  const [notaAberta, setNotaAberta] = useState(null)
  const [abaAtiva,   setAba]        = useState('investigar')

  const grupos = useMemo(()=>{
    const investigar = lancamentos.filter(r=>r.classe_divergencia==='INVESTIGAR')
      .sort((a,b)=>Math.abs(Number(b.diferenca))-Math.abs(Number(a.diferenca)))

    // ajustes de custo agrupados por nota
    const ajMap = {}
    lancamentos.filter(r=>r.classe_divergencia==='AJUSTE_CUSTO').forEach(r=>{
      const k = r.nota_fiscal
      if (!ajMap[k]) ajMap[k] = { nota_fiscal:r.nota_fiscal, nunota:r.nunota, descr_top:r.descr_top,
        data_entrada_saida:r.data_entrada_saida, linhas:[], maxDif:0, classe_divergencia:'AJUSTE_CUSTO',
        motivo_calculado:r.motivo_calculado }
      ajMap[k].linhas.push(r)
      ajMap[k].maxDif = Math.max(ajMap[k].maxDif, Math.abs(Number(r.diferenca)))
    })
    const ajustes = Object.values(ajMap).sort((a,b)=>b.maxDif-a.maxDif)

    return { investigar, ajustes }
  },[lancamentos])

  const abas = [
    { id:'investigar', label:`⚠ Investigar (${grupos.investigar.length})`, cor:'#B54708' },
    { id:'ajuste',     label:`⚙ Ajuste de custo (${grupos.ajustes.length})`, cor:'#6B7280' },
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>

      {/* abas */}
      <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,marginBottom:16,overflow:'hidden'}}>
        <div style={{display:'flex',padding:'0 4px',borderBottom:'1px solid #F3F4F6'}}>
          {abas.map(a=>(
            <button key={a.id} onClick={()=>setAba(a.id)} style={{
              padding:'12px 18px',fontSize:13,fontWeight:abaAtiva===a.id?700:400,
              border:'none',borderBottom:`2px solid ${abaAtiva===a.id?a.cor:'transparent'}`,
              background:'none',cursor:'pointer',fontFamily:'inherit',
              color:abaAtiva===a.id?a.cor:'#6B7280',
            }}>{a.label}</button>
          ))}
        </div>
        <div style={{padding:'12px 18px',fontSize:12.5,color:'#6B7280'}}>
          {abaAtiva==='investigar'
            ? 'Diferença real entre custo de entrada e lançamento contábil. Clique numa nota para ver os itens e a contabilização.'
            : 'Diferença de custo médio entre o momento da transação e o recálculo do Sankhya. Fecham no saldo da conta — não requerem ação imediata.'}
        </div>
      </div>

      {/* investigar */}
      {abaAtiva==='investigar' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {grupos.investigar.length===0 && (
            <div style={{padding:'32px',textAlign:'center',color:'#12805C',background:'#F0FDF4',
              border:'1px solid #BBF7D0',borderRadius:8,fontSize:13}}>
              ✅ Nenhuma nota para investigar no período.
            </div>
          )}
          {grupos.investigar.map(nota=>(
            <div key={nota.id||nota.nota_fiscal}
              onClick={()=>setNotaAberta(nota)}
              style={{background:'#fff',border:'1px solid #FDE68A',borderRadius:8,
                padding:'14px 18px',cursor:'pointer',transition:'border-color .12s'}}
              onMouseOver={e=>e.currentTarget.style.borderColor='#F59E0B'}
              onMouseOut={e=>e.currentTarget.style.borderColor='#FDE68A'}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:5}}>
                    <span style={{fontSize:15,fontWeight:800}}>NF {nota.nota_fiscal}</span>
                    <span style={{fontSize:11.5,color:'#9CA3AF'}}>{nota.conta_contabil} · {nota.descr_local}</span>
                    <span style={{fontSize:11.5,color:'#9CA3AF'}}>{dBR(nota.data_entrada_saida)}</span>
                  </div>
                  <div style={{fontSize:12.5,color:'#6B7280'}}>{nota.descr_top}</div>
                  <div style={{fontSize:12,color:'#B54708',marginTop:4}}>{nota.motivo_calculado}</div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:4}}>
                    {[['Custo',nota.saldo_dash],['Contábil',nota.saldo_contabil]].map(([l,v])=>(
                      <div key={l}>
                        <div style={{fontSize:10.5,color:'#9CA3AF'}}>{l}</div>
                        <div style={{fontSize:13,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>R$ {brl(v)}</div>
                      </div>
                    ))}
                    <div>
                      <div style={{fontSize:10.5,color:'#9CA3AF'}}>Diferença</div>
                      <div style={{fontSize:14,fontWeight:800,color:'#B54708',fontVariantNumeric:'tabular-nums'}}>R$ {brl(nota.diferenca)}</div>
                    </div>
                  </div>
                  <span style={{fontSize:11,color:'#1D5BBF'}}>→ clique para detalhar</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ajuste de custo */}
      {abaAtiva==='ajuste' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {grupos.ajustes.map(g=>(
            <div key={g.nota_fiscal}
              onClick={()=>setNotaAberta({...g, saldo_dash:g.linhas.reduce((s,r)=>s+Number(r.saldo_dash||0),0),
                saldo_contabil:g.linhas.reduce((s,r)=>s+Number(r.saldo_contabil||0),0),
                diferenca:g.maxDif, conta_contabil:g.linhas.map(r=>r.conta_contabil).join(' / '),
                cod_top:g.linhas[0].cod_top })}
              style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,
                padding:'14px 18px',cursor:'pointer'}}
              onMouseOver={e=>e.currentTarget.style.borderColor='#9CA3AF'}
              onMouseOut={e=>e.currentTarget.style.borderColor='#E5E7EB'}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:5}}>
                    <span style={{fontSize:15,fontWeight:800}}>NF {g.nota_fiscal}</span>
                    <span style={{fontSize:11.5,color:'#9CA3AF'}}>{g.linhas.length} conta(s) afetada(s)</span>
                    <span style={{fontSize:11.5,color:'#9CA3AF'}}>{dBR(g.data_entrada_saida)}</span>
                  </div>
                  <div style={{fontSize:12.5,color:'#6B7280'}}>{g.descr_top}</div>
                  <div style={{fontSize:12,color:'#9CA3AF',marginTop:4}}>{g.motivo_calculado}</div>
                  {/* contas afetadas */}
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
                    {g.linhas.map((l,i)=>(
                      <span key={i} style={{fontSize:11,padding:'2px 8px',borderRadius:4,
                        background:'#F3F4F6',color:'#6B7280'}}>
                        {l.conta_contabil}: {Number(l.diferenca)>0?'+':''}{brl(l.diferenca)}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:10.5,color:'#9CA3AF'}}>Maior desvio</div>
                  <div style={{fontSize:15,fontWeight:800,color:'#6B7280',fontVariantNumeric:'tabular-nums'}}>
                    R$ {brl(g.maxDif)}
                  </div>
                  <div style={{fontSize:11,color:'#1D5BBF',marginTop:4}}>→ ver itens</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DrawerDetalhe nota={notaAberta} onClose={()=>setNotaAberta(null)}/>
    </div>
  )
}
