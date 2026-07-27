import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, brl, brlK, int, dBR } from '../config.js'
import { Panel, Spinner, Btn } from '../components/UI.jsx'

/*
  NÍVEL 1 DA CONCILIAÇÃO — equivale à aba COMPARATIVO da planilha.
  Compara a POSIÇÃO do estoque numa data com o SALDO da conta contábil.
  É este número que decide se o mês fechou.
  Fonte: view fechamento_analitico (tudo calculado no banco).
*/

const ACAO = {
  'CONFERE':        { cor:'#12805C', bg:'#D1FAE5', icone:'✓' },
  'AUMENTAR CUSTO': { cor:'#1D5BBF', bg:'#DBEAFE', icone:'▲' },
  'DIMINUIR CUSTO': { cor:'#B54708', bg:'#FEF3C7', icone:'▼' },
}

export default function Fechamento() {
  const [fase, setFase]     = useState('carregando')
  const [erro, setErro]     = useState('')
  const [datas, setDatas]   = useState([])
  const [data, setData]     = useState('')
  const [linhas, setLinhas] = useState([])

  // carrega as posições disponíveis
  useEffect(() => {
    sbFetch('fechamento_saldos?select=data_posicao&order=data_posicao.desc')
      .then(r => {
        const u = [...new Set((r||[]).map(x => x.data_posicao))]
        setDatas(u)
        if (u.length) setData(u[0])
        else setFase('vazio')
      })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [])

  // carrega a posição selecionada
  useEffect(() => {
    if (!data) return
    setFase('carregando')
    sbFetch(`fechamento_analitico?data_posicao=eq.${data}&select=*&order=grupo.asc`)
      .then(r => { setLinhas(r||[]); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [data])

  const tot = useMemo(() => {
    const est = linhas.reduce((s,l)=>s+Number(l.saldo_estoque||0),0)
    const ctb = linhas.reduce((s,l)=>s+Number(l.saldo_contabil||0),0)
    const conf = linhas.filter(l=>l.confere).length
    return { est, ctb, dif: est-ctb, conferem: conf, pendentes: linhas.length-conf }
  }, [linhas])

  const fechou = Math.abs(tot.dif) < 0.10 && tot.pendentes === 0
  const maxDif = Math.max(1, ...linhas.map(l=>Math.abs(Number(l.diferenca)||0)))

  const exportar = () => {
    const cols = ['contas','descr_conta','descr_local','qtd_produtos','saldo_estoque','saldo_contabil','diferenca','acao']
    const csv = [cols.join(';'), ...linhas.map(l=>cols.map(k=>String(l[k]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a=document.createElement('a'); a.href=url; a.download=`fechamento-${data}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (fase==='erro') return (
    <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:16,color:'#B42318'}}>Erro: {erro}</div>
  )
  if (fase==='vazio') return (
    <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'40px',textAlign:'center'}}>
      <strong style={{fontSize:15}}>Nenhuma posição calculada</strong>
      <p style={{color:'#6B7280',marginTop:8}}>Rode a função <code>fechamento-sync</code> para gerar a posição de uma data.</p>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>

      {/* Seletor de data */}
      {datas.length > 1 && (
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <label style={{fontSize:12,color:'#6B7280'}}>Posição em:</label>
          <select value={data} onChange={e=>setData(e.target.value)} style={{
            fontFamily:'inherit',fontSize:13,padding:'6px 10px',border:'1px solid #E5E7EB',borderRadius:6,
          }}>
            {datas.map(d=><option key={d} value={d}>{dBR(d)}</option>)}
          </select>
        </div>
      )}

      {fase==='carregando' ? <Spinner/> : (
        <>
          {/* Veredito */}
          <div style={{
            background: fechou?'#F0FDF4':'#FFFBEB',
            border:`1px solid ${fechou?'#BBF7D0':'#FDE68A'}`,
            borderRadius:8, padding:'16px 20px',
            display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14,
          }}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:fechou?'#166534':'#92400E',marginBottom:3}}>
                {fechou
                  ? `✅ Fechamento conciliado — posição de ${dBR(data)}`
                  : `⚙ ${tot.pendentes} conta${tot.pendentes>1?'s':''} pendente${tot.pendentes>1?'s':''} de ajuste`}
              </div>
              <div style={{fontSize:12.5,color:fechou?'#166534':'#92400E',opacity:.85}}>
                {tot.conferem} de {linhas.length} contas conferem · estoque × contabilidade
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em'}}>Diferença geral</div>
              <div style={{fontSize:25,fontWeight:800,fontVariantNumeric:'tabular-nums',color:fechou?'#12805C':'#B54708'}}>
                {tot.dif>0?'+':''}R$ {brl(tot.dif)}
              </div>
            </div>
          </div>

          {/* Totais */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr',background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'16px 22px'}}>
            <div>
              <div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>Estoque · posição apurada</div>
              <div style={{fontSize:24,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.est)}</div>
            </div>
            <div style={{background:'#E5E7EB'}}/>
            <div style={{paddingLeft:22}}>
              <div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>Contabilidade · saldo do razão</div>
              <div style={{fontSize:24,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.ctb)}</div>
            </div>
          </div>

          {/* Tabela */}
          <Panel title={`Conciliação por conta — posição ${dBR(data)}`} action={<Btn small onClick={exportar}>↓ CSV</Btn>}>
            <div style={{overflowX:'auto',margin:'0 -18px -16px'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr>
                    {['Conta','Descrição','Prod.','Estoque','Contábil','Diferença','','Ação'].map((h,k)=>(
                      <th key={k} style={{
                        padding:'10px 14px',background:'#F9FAFB',borderBottom:'1px solid #E5E7EB',
                        textAlign:['Estoque','Contábil','Diferença','Prod.'].includes(h)?'right':'left',
                        fontSize:10.5,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
                        letterSpacing:'.04em',whiteSpace:'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => {
                    const dif = Number(l.diferenca)||0
                    const est = ACAO[l.acao] || ACAO['CONFERE']
                    return (
                      <tr key={l.grupo} style={{background: l.confere?'#fff':'#FFFDF7'}}>
                        <td style={{...TD,fontWeight:700,fontVariantNumeric:'tabular-nums',fontSize:12,whiteSpace:'nowrap'}}>{l.contas}</td>
                        <td style={TD}>
                          <div style={{fontWeight:500}}>{l.descr_conta}</div>
                          {l.descr_local && <div style={{fontSize:11,color:'#9CA3AF'}}>{l.descr_local}</div>}
                        </td>
                        <td style={{...TD,textAlign:'right',color:'#9CA3AF',fontVariantNumeric:'tabular-nums'}}>{int(l.qtd_produtos)}</td>
                        <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(l.saldo_estoque)}</td>
                        <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(l.saldo_contabil)}</td>
                        <td style={{...TD,textAlign:'right',fontWeight:700,fontVariantNumeric:'tabular-nums',
                          color:l.confere?'#12805C':'#B54708'}}>
                          {dif>0?'+':''}R$ {brl(dif)}
                        </td>
                        <td style={{...TD,width:80,padding:'10px 6px'}}>
                          <div style={{height:5,background:'#F3F4F6',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:3,
                              width:`${Math.min(100,(Math.abs(dif)/maxDif)*100)}%`,
                              background:l.confere?'#12805C':'#B54708'}}/>
                          </div>
                        </td>
                        <td style={TD}>
                          <span style={{fontSize:10.5,fontWeight:700,padding:'3px 8px',borderRadius:5,
                            background:est.bg,color:est.cor,whiteSpace:'nowrap'}}>{est.icone} {l.acao}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:'#F9FAFB',fontWeight:700}}>
                    <td style={{...TD,borderTop:'2px solid #E5E7EB'}} colSpan={3}>TOTAL GERAL</td>
                    <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.est)}</td>
                    <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.ctb)}</td>
                    <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums',
                      color:fechou?'#12805C':'#B54708'}}>R$ {brl(tot.dif)}</td>
                    <td style={{...TD,borderTop:'2px solid #E5E7EB'}} colSpan={2}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          <p style={{fontSize:12,color:'#9CA3AF',margin:0,lineHeight:1.6}}>
            <strong>Como ler:</strong> compara a posição do estoque na data (quantidade × custo médio) com o saldo
            acumulado da conta no razão. "AUMENTAR CUSTO" = estoque abaixo do contábil; "DIMINUIR CUSTO" = o contrário.
            Diferenças abaixo de R$ 0,10 contam como conciliadas.
          </p>
        </>
      )}
    </div>
  )
}

const TD = { padding:'10px 14px', borderBottom:'1px solid #F3F4F6', fontSize:13 }
