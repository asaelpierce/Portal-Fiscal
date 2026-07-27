import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, brl, brlK, int, dBR, isZero } from '../config.js'
import { Panel, Spinner, Btn } from '../components/UI.jsx'

/*
  NÍVEL 1 DA CONCILIAÇÃO — equivale à aba COMPARATIVO da planilha manual.
  É este número que decide se o mês fechou: saldo de custo × saldo contábil por conta.
  Tudo calculado no banco (view conciliacao_por_conta), sem IA.
*/

const ACAO_ESTILO = {
  'CONFERE':        { cor:'#12805C', bg:'#D1FAE5', icone:'✓' },
  'AUMENTAR CUSTO': { cor:'#1D5BBF', bg:'#DBEAFE', icone:'▲' },
  'DIMINUIR CUSTO': { cor:'#B54708', bg:'#FEF3C7', icone:'▼' },
}

export default function Fechamento({ importacaoId, periodo }) {
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [contas, setContas] = useState([])

  useEffect(() => {
    if (!importacaoId) return
    setFase('carregando')
    sbFetch(`conciliacao_por_conta?importacao_id=eq.${importacaoId}&select=*&order=conta_contabil.asc`)
      .then(r => { setContas(r || []); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [importacaoId])

  const tot = useMemo(() => {
    const custo = contas.reduce((s,c)=>s+Number(c.saldo_custo||0),0)
    const ctb   = contas.reduce((s,c)=>s+Number(c.saldo_contabil||0),0)
    const conf  = contas.filter(c=>c.acao==='CONFERE').length
    return {
      custo, ctb, dif: custo-ctb,
      conferem: conf,
      pendentes: contas.length - conf,
      ajustes: contas.reduce((s,c)=>s+Number(c.qtd_ajuste||0),0),
      criticos: contas.reduce((s,c)=>s+Number(c.qtd_critico||0),0),
    }
  }, [contas])

  const fechou = Math.abs(tot.dif) < 0.10

  const exportar = () => {
    const cols = ['conta_contabil','descr_local','qtd_lancamentos','saldo_custo','saldo_contabil','diferenca','acao','qtd_critico','qtd_ajuste','qtd_ok']
    const csv = [cols.join(';'), ...contas.map(c=>cols.map(k=>String(c[k]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a = document.createElement('a'); a.href=url
    a.download=`fechamento-${periodo||''}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (fase==='carregando') return <Spinner/>
  if (fase==='erro') return (
    <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:16,color:'#B42318'}}>Erro: {erro}</div>
  )

  const maxDif = Math.max(1, ...contas.map(c=>Math.abs(Number(c.diferenca)||0)))

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>

      {/* Veredito */}
      <div style={{
        background: fechou?'#F0FDF4':'#FFFBEB',
        border:`1px solid ${fechou?'#BBF7D0':'#FDE68A'}`,
        borderRadius:8, padding:'16px 20px',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:fechou?'#166534':'#92400E',marginBottom:3}}>
              {fechou ? '✅ Período fechado — custo e contábil conciliados'
                      : `⚙ ${tot.pendentes} conta${tot.pendentes>1?'s':''} pendente${tot.pendentes>1?'s':''} de ajuste`}
            </div>
            <div style={{fontSize:12.5,color:fechou?'#166534':'#92400E',opacity:.85}}>
              {tot.conferem} de {contas.length} contas conferem
              {tot.ajustes>0 && ` · ${tot.ajustes} lançamentos precisam de ajuste de custo`}
              {tot.criticos>0 && ` · ${tot.criticos} críticos`}
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em'}}>Diferença geral</div>
            <div style={{fontSize:24,fontWeight:800,fontVariantNumeric:'tabular-nums',
              color:fechou?'#12805C':'#B54708'}}>
              {tot.dif>0?'+':''}R$ {brl(tot.dif)}
            </div>
          </div>
        </div>
      </div>

      {/* Totais */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr',background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'16px 22px'}}>
        <div>
          <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>Custo apurado · estoque</div>
          <div style={{fontSize:23,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.custo)}</div>
        </div>
        <div style={{background:'#E5E7EB'}}/>
        <div style={{paddingLeft:22}}>
          <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>Saldo contábil · razão</div>
          <div style={{fontSize:23,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.ctb)}</div>
        </div>
      </div>

      {/* Tabela por conta */}
      <Panel
        title="Conciliação por conta contábil"
        action={<Btn small onClick={exportar}>↓ CSV</Btn>}
      >
        <div style={{overflowX:'auto',margin:'0 -18px -16px'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr>
                {['Conta','Local','Lanç.','Custo apurado','Saldo contábil','Diferença','','Ação','Ajustes'].map((h,i)=>(
                  <th key={i} style={{
                    padding:'10px 14px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB',
                    textAlign:['Custo apurado','Saldo contábil','Diferença','Lanç.','Ajustes'].includes(h)?'right':'left',
                    fontSize:10.5,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
                    letterSpacing:'.04em',whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contas.map(c => {
                const dif = Number(c.diferenca)||0
                const est = ACAO_ESTILO[c.acao] || ACAO_ESTILO['CONFERE']
                const conf = c.acao === 'CONFERE'
                return (
                  <tr key={c.conta_contabil} style={{background: conf?'#fff':'#FFFDF7'}}>
                    <td style={{...TD,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{c.conta_contabil}</td>
                    <td style={{...TD,color:'#6B7280',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.descr_local}</td>
                    <td style={{...TD,textAlign:'right',color:'#9CA3AF',fontVariantNumeric:'tabular-nums'}}>{int(c.qtd_lancamentos)}</td>
                    <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(c.saldo_custo)}</td>
                    <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(c.saldo_contabil)}</td>
                    <td style={{...TD,textAlign:'right',fontWeight:700,fontVariantNumeric:'tabular-nums',
                      color: conf?'#12805C':'#B54708'}}>
                      {dif>0?'+':''}R$ {brl(dif)}
                    </td>
                    {/* barra proporcional */}
                    <td style={{...TD,width:90,padding:'10px 6px'}}>
                      <div style={{height:5,background:'#F3F4F6',borderRadius:3,overflow:'hidden'}}>
                        <div style={{
                          height:'100%',borderRadius:3,
                          width:`${Math.min(100,(Math.abs(dif)/maxDif)*100)}%`,
                          background: conf?'#12805C':'#B54708',
                        }}/>
                      </div>
                    </td>
                    <td style={TD}>
                      <span style={{
                        fontSize:10.5,fontWeight:700,padding:'3px 8px',borderRadius:5,
                        background:est.bg,color:est.cor,whiteSpace:'nowrap',
                      }}>{est.icone} {c.acao}</span>
                    </td>
                    <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>
                      {Number(c.qtd_critico)>0 && <span style={{color:'#B42318',fontWeight:700,marginRight:6}}>🔴{c.qtd_critico}</span>}
                      {Number(c.qtd_ajuste)>0  && <span style={{color:'#B54708',fontWeight:600}}>⚙{c.qtd_ajuste}</span>}
                      {Number(c.qtd_critico)===0 && Number(c.qtd_ajuste)===0 && <span style={{color:'#12805C'}}>✓</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{background:'#F9FAFB',fontWeight:700}}>
                <td style={{...TD,borderTop:'2px solid #E5E7EB'}} colSpan={3}>TOTAL GERAL</td>
                <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.custo)}</td>
                <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.ctb)}</td>
                <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums',
                  color:fechou?'#12805C':'#B54708'}}>R$ {brl(tot.dif)}</td>
                <td style={{...TD,borderTop:'2px solid #E5E7EB'}} colSpan={3}/>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <p style={{fontSize:12,color:'#9CA3AF',margin:0,lineHeight:1.6}}>
        <strong>Como ler:</strong> "AUMENTAR CUSTO" significa que o custo apurado está abaixo do contábil e precisa ser
        elevado no Sankhya; "DIMINUIR CUSTO" o contrário. Diferenças abaixo de R$ 0,10 são tratadas como conciliadas,
        seguindo o critério do fechamento manual.
      </p>
    </div>
  )
}

const TD = { padding:'10px 14px', borderBottom:'1px solid #F3F4F6', fontSize:13 }
