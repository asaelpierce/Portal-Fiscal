import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, brl, brlK, int, dBR, classeDe } from '../config.js'
import { Spinner, Btn } from '../components/UI.jsx'
import DrawerDetalhe from '../components/DrawerDetalhe.jsx'

const ACAO_ESTILO = {
  'CONFERE':        { cor:'#12805C', bg:'#D1FAE5', icone:'✓' },
  'AUMENTAR CUSTO': { cor:'#1D5BBF', bg:'#DBEAFE', icone:'▲' },
  'DIMINUIR CUSTO': { cor:'#B54708', bg:'#FEF3C7', icone:'▼' },
}

// ─── Painel lateral de notas de uma conta ────────────────────────────────────
function PainelNotas({ conta, dataFechamento, onClose, onNota }) {
  const [fase,    setFase]    = useState('carregando')
  const [notas,   setNotas]   = useState([])
  const [filtro,  setFiltro]  = useState('todas') // todas | diferenca | ok

  useEffect(() => {
    if (!conta) return
    setFase('carregando'); setNotas([])
    // Busca lançamentos da conta na importação mais próxima do fechamento
    sbFetch(`lancamentos_conciliacao?conta_contabil=eq.${conta}&select=*&order=prioridade.asc,diferenca.desc`)
      .then(r => { setNotas(r || []); setFase('pronto') })
      .catch(e => setFase('erro'))
  }, [conta])

  const filtradas = useMemo(() => {
    if (filtro === 'diferenca') return notas.filter(n => n.classe_divergencia !== 'OK')
    if (filtro === 'ok')        return notas.filter(n => n.classe_divergencia === 'OK')
    return notas
  }, [notas, filtro])

  const totCusto = notas.reduce((s,n)=>s+Number(n.saldo_dash||0),0)
  const totCtb   = notas.reduce((s,n)=>s+Number(n.saldo_contabil||0),0)
  const comDif   = notas.filter(n=>n.classe_divergencia!=='OK').length

  return (
    <div style={{
      position:'fixed', top:0, right:0, bottom:0, width:'min(560px,92vw)',
      background:'#fff', borderLeft:'1px solid #E5E7EB', zIndex:35,
      display:'flex', flexDirection:'column',
      boxShadow:'-6px 0 30px rgba(16,24,40,.12)',
    }}>
      {/* Header */}
      <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:11,color:'#9CA3AF',marginBottom:4}}>NOTAS DA CONTA</div>
            <div style={{fontSize:18,fontWeight:800}}>{conta}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',padding:6,color:'#6B7280'}}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Resumo custo x contábil */}
        {fase==='pronto' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12,padding:'10px 12px',background:'#F9FAFB',borderRadius:8}}>
            <div>
              <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:2}}>Custo apurado (fluxo)</div>
              <div style={{fontSize:15,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(totCusto)}</div>
            </div>
            <div>
              <div style={{fontSize:10.5,color:'#9CA3AF',marginBottom:2}}>Saldo contábil</div>
              <div style={{fontSize:15,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(totCtb)}</div>
            </div>
          </div>
        )}

        {/* Filtro */}
        {fase==='pronto' && (
          <div style={{display:'flex',gap:6,marginTop:12}}>
            {[
              {id:'todas',    label:`Todas (${notas.length})`},
              {id:'diferenca',label:`Com diferença (${comDif})`, cor:'#B54708'},
              {id:'ok',       label:`Conciliadas (${notas.length-comDif})`, cor:'#12805C'},
            ].map(f=>(
              <button key={f.id} onClick={()=>setFiltro(f.id)} style={{
                padding:'5px 11px',fontSize:12,borderRadius:5,
                border:`1px solid ${filtro===f.id?'#1D5BBF':'#E5E7EB'}`,
                background:filtro===f.id?'#EBF2FC':'#fff',
                color:filtro===f.id?'#1D5BBF':f.cor||'#374151',
                cursor:'pointer',fontFamily:'inherit',fontWeight:filtro===f.id?600:400,
              }}>{f.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de notas */}
      <div style={{flex:1,overflowY:'auto'}}>
        {fase==='carregando' && (
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'32px 20px',color:'#9CA3AF',fontSize:13}}>
            <div style={{width:20,height:20,border:'3px solid #E5E7EB',borderTopColor:'#1D5BBF',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
            Carregando notas…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {fase==='pronto' && filtradas.map((nota,i) => {
          const cls = classeDe(nota.classe_divergencia)
          const dif = Number(nota.diferenca||0)
          return (
            <button key={nota.id||i} onClick={()=>onNota(nota)}
              style={{
                display:'grid', gridTemplateColumns:'1fr auto',
                gap:12, width:'100%', padding:'13px 20px',
                background:'none', border:'none',
                borderBottom:'1px solid #F3F4F6',
                cursor:'pointer', textAlign:'left', fontFamily:'inherit',
              }}
              onMouseOver={e=>e.currentTarget.style.background='#F9FAFB'}
              onMouseOut={e=>e.currentTarget.style.background='none'}
            >
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700}}>NF {nota.nota_fiscal}</span>
                  <span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:4,
                    background:cls.bg,color:cls.cor}}>{cls.icone} {cls.rot}</span>
                </div>
                <div style={{fontSize:12,color:'#6B7280'}}>{nota.descr_top}</div>
                <div style={{fontSize:11.5,color:'#9CA3AF',marginTop:2}}>{dBR(nota.data_entrada_saida)} · {nota.descr_local}</div>
                {nota.motivo_calculado && nota.classe_divergencia!=='OK' && (
                  <div style={{fontSize:11.5,color:cls.cor,marginTop:3}}>{nota.motivo_calculado}</div>
                )}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:11,color:'#9CA3AF',marginBottom:2}}>Custo · Contábil</div>
                <div style={{fontSize:12,fontVariantNumeric:'tabular-nums',color:'#374151'}}>
                  {brl(nota.saldo_dash)} · {brl(nota.saldo_contabil)}
                </div>
                {Math.abs(dif)>0.005 && (
                  <div style={{fontSize:13,fontWeight:700,fontVariantNumeric:'tabular-nums',marginTop:3,
                    color:cls.cor}}>
                    {dif>0?'+':''}R$ {brl(dif)}
                  </div>
                )}
                <div style={{fontSize:11,color:'#9CA3AF',marginTop:4}}>ver detalhes →</div>
              </div>
            </button>
          )
        })}
        {fase==='pronto' && !filtradas.length && (
          <div style={{padding:'32px',textAlign:'center',color:'#9CA3AF',fontSize:13}}>
            Nenhuma nota com esses filtros.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tela principal de Fechamento ─────────────────────────────────────────────
export default function Fechamento() {
  const [fase,       setFase]       = useState('carregando')
  const [erro,       setErro]       = useState('')
  const [datas,      setDatas]      = useState([])
  const [data,       setData]       = useState('')
  const [linhas,     setLinhas]     = useState([])
  const [contaAberta, setContaAberta] = useState(null) // abre painel de notas
  const [notaAberta,  setNotaAberta]  = useState(null) // abre drawer de detalhe

  useEffect(() => {
    sbFetch('fechamento_saldos?select=data_posicao&order=data_posicao.desc')
      .then(r => {
        const u = [...new Set((r||[]).map(x=>x.data_posicao))]
        setDatas(u)
        if (u.length) setData(u[0])
        else setFase('vazio')
      })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [])

  useEffect(() => {
    if (!data) return
    setFase('carregando')
    sbFetch(`fechamento_analitico?data_posicao=eq.${data}&select=*&order=grupo.asc`)
      .then(r => { setLinhas(r||[]); setFase('pronto') })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [data])

  const tot = useMemo(() => {
    const est  = linhas.reduce((s,l)=>s+Number(l.saldo_estoque||0),0)
    const ctb  = linhas.reduce((s,l)=>s+Number(l.saldo_contabil||0),0)
    return { est, ctb, dif:est-ctb, conferem:linhas.filter(l=>l.confere).length }
  }, [linhas])

  const fechou = Math.abs(tot.dif)<0.10 && tot.conferem===linhas.length
  const maxDif = Math.max(1,...linhas.map(l=>Math.abs(Number(l.diferenca)||0)))

  const exportar = () => {
    const cols=['contas','descr_conta','descr_local','saldo_estoque','saldo_contabil','diferenca','acao']
    const csv=[cols.join(';'),...linhas.map(l=>cols.map(k=>String(l[k]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a=document.createElement('a'); a.href=url; a.download=`fechamento-${data}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = s => { const [y,m,d]=String(s).slice(0,10).split('-'); return `${d}/${m}/${y}` }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>

      {/* Seletor de data */}
      {datas.length>1 && (
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <label style={{fontSize:12,color:'#6B7280'}}>Posição em:</label>
          <select value={data} onChange={e=>setData(e.target.value)} style={{
            fontFamily:'inherit',fontSize:13,padding:'6px 10px',border:'1px solid #E5E7EB',borderRadius:6,
          }}>
            {datas.map(d=><option key={d} value={d}>{fmt(d)}</option>)}
          </select>
        </div>
      )}

      {fase==='carregando' && <Spinner/>}
      {fase==='erro' && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:8,padding:16,color:'#B42318'}}>Erro: {erro}</div>}

      {fase==='pronto' && (
        <>
          {/* Veredito */}
          <div style={{
            background:fechou?'#F0FDF4':'#FFFBEB',
            border:`1px solid ${fechou?'#BBF7D0':'#FDE68A'}`,
            borderRadius:8,padding:'16px 20px',
            display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14,
          }}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:fechou?'#166534':'#92400E',marginBottom:3}}>
                {fechou?`✅ Fechamento conciliado — posição de ${fmt(data)}`:`⚙ ${linhas.filter(l=>!l.confere).length} conta(s) pendente(s) de ajuste`}
              </div>
              <div style={{fontSize:12.5,color:fechou?'#166534':'#92400E',opacity:.85}}>
                {tot.conferem} de {linhas.length} contas conferem · Clique em qualquer conta para ver as notas
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

          {/* Tabela de contas — cada linha é clicável */}
          <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,overflow:'hidden'}}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid #F3F4F6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <span style={{fontSize:14,fontWeight:600}}>Conciliação por conta</span>
                <span style={{fontSize:12,color:'#9CA3AF',marginLeft:10}}>clique numa conta para ver as notas</span>
              </div>
              <Btn small onClick={exportar}>↓ CSV</Btn>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr>
                  {['Conta','Descrição','Estoque','Contábil','Diferença','','Ação'].map((h,k)=>(
                    <th key={k} style={{
                      padding:'10px 14px',background:'#F9FAFB',borderBottom:'1px solid #E5E7EB',
                      textAlign:['Estoque','Contábil','Diferença'].includes(h)?'right':'left',
                      fontSize:10.5,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
                      letterSpacing:'.04em',whiteSpace:'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => {
                  const dif=Number(l.diferenca||0)
                  const est=ACAO_ESTILO[l.acao]||ACAO_ESTILO['CONFERE']
                  const ativa=contaAberta===l.contas
                  return (
                    <tr key={l.grupo}
                      onClick={()=>setContaAberta(ativa?null:l.contas)}
                      style={{
                        background:ativa?'#EBF2FC':l.confere?'#fff':'#FFFDF7',
                        cursor:'pointer',
                        borderLeft:`3px solid ${ativa?'#1D5BBF':'transparent'}`,
                      }}
                      onMouseOver={e=>{ if(!ativa) e.currentTarget.style.background='#F9FAFB' }}
                      onMouseOut={e=>{ if(!ativa) e.currentTarget.style.background=l.confere?'#fff':'#FFFDF7' }}
                    >
                      <td style={{...TD,fontWeight:700,fontVariantNumeric:'tabular-nums',fontSize:12,whiteSpace:'nowrap'}}>
                        {l.contas}
                      </td>
                      <td style={TD}>
                        <div style={{fontWeight:500}}>{l.descr_conta}</div>
                        {l.descr_local&&<div style={{fontSize:11,color:'#9CA3AF'}}>{l.descr_local}</div>}
                      </td>
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
                  <td style={{...TD,borderTop:'2px solid #E5E7EB'}} colSpan={2}>TOTAL GERAL</td>
                  <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.est)}</td>
                  <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(tot.ctb)}</td>
                  <td style={{...TD,borderTop:'2px solid #E5E7EB',textAlign:'right',fontVariantNumeric:'tabular-nums',
                    color:fechou?'#12805C':'#B54708'}}>R$ {brl(tot.dif)}</td>
                  <td style={{...TD,borderTop:'2px solid #E5E7EB'}} colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Overlay para fechar painel */}
      {contaAberta && (
        <div onClick={()=>setContaAberta(null)}
          style={{position:'fixed',inset:0,background:'rgba(16,24,40,.2)',zIndex:34}}/>
      )}

      {/* Painel de notas da conta */}
      {contaAberta && (
        <PainelNotas
          conta={contaAberta}
          dataFechamento={data}
          onClose={()=>setContaAberta(null)}
          onNota={nota=>{ setContaAberta(null); setNotaAberta(nota) }}
        />
      )}

      {/* Drawer de detalhe da nota */}
      <DrawerDetalhe nota={notaAberta} onClose={()=>setNotaAberta(null)}/>
    </div>
  )
}

const TD={padding:'10px 14px',borderBottom:'1px solid #F3F4F6',fontSize:13}
