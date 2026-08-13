import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, brl, brlK, int, dBR, isZero } from '../config.js'
import { Panel, Select, SearchInput, Spinner, Btn } from '../components/UI.jsx'

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtPeriodo(inicio, fim) {
  const f = s => { const [y,m,d]=String(s).slice(0,10).split('-'); return `${d}/${m}/${y}` }
  return `${f(inicio)} a ${f(fim)}`
}

const TD = { padding:'7px 11px', borderBottom:'1px solid #F3F4F6', verticalAlign:'top', fontSize:12 }

// ─── Dash × Razão (antiga "Razão analítico") ─────────────────────────────────
// Renomeada a pedido: a aba de conciliação nota-a-nota (que antes se chamava
// "Dash × Razão") foi removida daqui — essa agora é a única tela da página
// "Movimentos", e passou a se chamar "Dash × Razão".
function DashRazao({ importacoes }) {
  const [impId, setImpId] = useState('')
  const [fase, setFase] = useState('idle')
  const [dados, setDados] = useState([])
  const [fProd, setFProd] = useState('')
  const [fLocal, setFLocal] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (importacoes.length) setImpId(importacoes[0].id)
  }, [importacoes])

  useEffect(() => {
    if (!impId) return
    setFase('carregando'); setDados([])
    sbFetch(`razao_analitico?importacao_id=eq.${impId}&select=*&order=data_mov.asc,nunota.asc,sequencia.asc`)
      .then(r => { setDados(r||[]); setFase('pronto') })
      .catch(() => setFase('erro'))
  }, [impId])

  const opcoes = useMemo(() => ({
    prods: [...new Set(dados.map(r=>r.codprod).filter(Boolean))].sort(),
    locais: [...new Set(dados.map(r=>r.codlocal).filter(Boolean))].sort(),
  }), [dados])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(r => {
      if (fProd && r.codprod !== fProd) return false
      if (fLocal && r.codlocal !== fLocal) return false
      if (q) {
        const h = `${r.codprod} ${r.descrprod} ${r.numnota} ${r.nomeparc} ${r.descroper}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dados, fProd, fLocal, busca])

  // KPIs pedidos: valor de movimento total e quantidade de movimentos total
  // (sempre sobre TODOS os movimentos do período, não só os filtrados na tela —
  // assim o número não some quando alguém aplica um filtro pra procurar algo).
  const kpi = useMemo(() => ({
    valorTotal: dados.reduce((s,r)=>s+Math.abs(Number(r.custototal)||0),0),
    qtdMovimentos: dados.length,
  }), [dados])

  const exportar = () => {
    const cols = ['codprod','descrprod','codlocal','descrlocal','numnota','data_mov','tipo','descroper',
      'nomeparc','qtdneg','custo_unitario','custototal',
      'saldo_antes_qtd','saldo_antes_vlr','saldo_apos_qtd','saldo_apos_vlr',
      'conta_contabil','lote','lancamento']
    const csv = [cols.join(';'), ...filtrados.map(r=>cols.map(c=>String(r[c]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a=document.createElement('a'); a.href=url; a.download=`dash-razao-${impId}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Seletor de período */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <label style={{fontSize:12,color:'#6B7280',fontWeight:500}}>Período:</label>
        <select value={impId} onChange={e=>setImpId(e.target.value)} style={{
          fontFamily:'inherit',fontSize:13,padding:'7px 12px',border:'1px solid #E5E7EB',borderRadius:6,background:'#fff',
        }}>
          {importacoes.map(i=>(
            <option key={i.id} value={i.id}>
              {fmtPeriodo(i.periodo_inicio,i.periodo_fim)} · {int(i.total_movimentos)} movimentos
            </option>
          ))}
        </select>
      </div>

      {fase==='carregando'&&<Spinner/>}
      {fase==='pronto'&&(
        <>
          {/* KPIs: valor de movimento total e quantidade de movimento total */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr',background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'14px 20px'}}>
            <div>
              <div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>
                Valor de movimento (total)
              </div>
              <div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(kpi.valorTotal)}</div>
              <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>soma de todos os movimentos do período</div>
            </div>
            <div style={{background:'#E5E7EB'}}/>
            <div style={{paddingLeft:20}}>
              <div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>
                Quantidade de movimentos (total)
              </div>
              <div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{int(kpi.qtdMovimentos)}</div>
              <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>
                {[...new Set(dados.map(r=>r.codprod))].length} produtos · {[...new Set(dados.map(r=>r.codlocal))].length} locais
              </div>
            </div>
          </div>

          <Panel
            title={`${int(filtrados.length)} de ${int(dados.length)} movimentos`}
            action={
              <div style={{display:'flex',gap:8}}>
                {(fProd||fLocal||busca)&&<Btn small onClick={()=>{setFProd('');setFLocal('');setBusca('')}}>✕ Limpar</Btn>}
                <Btn small onClick={exportar}>↓ CSV</Btn>
              </div>
            }
          >
            <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
              <Select label="Produto" value={fProd} onChange={setFProd}
                options={opcoes.prods.map(p=>{
                  const d=dados.find(r=>r.codprod===p)
                  return p+(d?.descrprod?' — '+d.descrprod.slice(0,35):'')
                })}
              />
              <Select label="Local" value={fLocal} onChange={setFLocal} options={opcoes.locais}/>
              <SearchInput value={busca} onChange={setBusca} placeholder="produto, nota, parceiro…"/>
            </div>

            <div style={{maxHeight:580,overflowX:'auto',overflowY:'auto',margin:'0 -18px -16px',borderTop:'1px solid #F3F4F6'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr>
                    {[
                      ['Data',false],['Produto',false],['Local',false],['Nota',false],
                      ['Tipo',false],['Operação',false],['Parceiro',false],
                      ['Qtd mov.',true],['Custo unit.',true],['Valor mov.',true],
                      ['Saldo ant. Qtd',true],['Saldo ant. R$',true],
                      ['Saldo aps. Qtd',true],['Saldo aps. R$',true],
                      ['Conta CTB',false],['Lote',false],
                    ].map(([h,num])=>(
                      <th key={h} style={{
                        position:'sticky',top:0,background:'#F9FAFB',zIndex:1,
                        padding:'8px 11px',textAlign:num?'right':'left',
                        fontSize:10.5,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
                        letterSpacing:'.04em',borderBottom:'1px solid #E5E7EB',whiteSpace:'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0,1000).map((r,i)=>{
                    const ent=r.tipo==='ENTRADA'
                    const saldoNeg=Number(r.saldo_apos_qtd)<0
                    return(
                      <tr key={r.id||i} style={{background:i%2===0?'#fff':'#FAFAFA'}}>
                        <td style={TD}>{dBR(r.data_mov)}</td>
                        <td style={TD}>
                          <div style={{fontWeight:600,fontSize:11.5}}>{r.codprod}</div>
                          <div style={{color:'#9CA3AF',fontSize:10.5,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.descrprod}>{r.descrprod}</div>
                        </td>
                        <td style={TD}><span style={{fontSize:11}}>{r.codlocal}<br/><span style={{color:'#9CA3AF'}}>{r.descrlocal}</span></span></td>
                        <td style={{...TD,fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{r.numnota}</td>
                        <td style={TD}>
                          <span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:4,
                            background:ent?'#D1FAE5':'#FEE2E2',color:ent?'#065F46':'#991B1B'}}>
                            {r.tipo}
                          </span>
                        </td>
                        <td style={{...TD,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#6B7280'}} title={r.descroper}>{r.descroper}</td>
                        <td style={{...TD,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#6B7280'}}>{r.nomeparc}</td>
                        <td style={{...TD,textAlign:'right',color:ent?'#12805C':'#B42318',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>
                          {Number(r.qtdneg)>0?'+':''}{Number(r.qtdneg).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </td>
                        <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{brl(r.custo_unitario)}</td>
                        <td style={{...TD,textAlign:'right',fontWeight:600,fontVariantNumeric:'tabular-nums',color:ent?'#12805C':'#B42318'}}>
                          {Number(r.custototal)>0?'+':''}R$ {brl(r.custototal)}
                        </td>
                        <td style={{...TD,textAlign:'right',color:'#6B7280',fontVariantNumeric:'tabular-nums'}}>
                          {Number(r.saldo_antes_qtd).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </td>
                        <td style={{...TD,textAlign:'right',color:'#6B7280',fontVariantNumeric:'tabular-nums'}}>R$ {brl(r.saldo_antes_vlr)}</td>
                        <td style={{...TD,textAlign:'right',fontWeight:700,fontVariantNumeric:'tabular-nums',color:saldoNeg?'#B42318':'#101828'}}>
                          {Number(r.saldo_apos_qtd).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </td>
                        <td style={{...TD,textAlign:'right',fontWeight:700,fontVariantNumeric:'tabular-nums',color:Number(r.saldo_apos_vlr)<0?'#B42318':'#101828'}}>R$ {brl(r.saldo_apos_vlr)}</td>
                        <td style={{...TD,fontSize:11.5}}>{r.conta_contabil}</td>
                        <td style={{...TD,color:'#9CA3AF',fontSize:11}}>{r.lote}</td>
                      </tr>
                    )
                  })}
                  {filtrados.length>1000&&(
                    <tr><td colSpan={16} style={{textAlign:'center',padding:'12px',color:'#9CA3AF',fontSize:12}}>
                      Mostrando 1.000 de {int(filtrados.length)} — refine os filtros ou exporte o CSV.
                    </td></tr>
                  )}
                  {!filtrados.length&&(
                    <tr><td colSpan={16} style={{textAlign:'center',padding:'28px',color:'#9CA3AF'}}>Nenhum registro.</td></tr>
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

// ─── Página "Movimentos" ─────────────────────────────────────────────────────
// A pedido, ficou com uma tela só (a antiga "Razão analítico", renomeada para
// "Dash × Razão"). A conciliação nota-a-nota que antes se chamava assim foi
// removida desta página.
export default function Razao() {
  const [impRazao, setImpRazao] = useState([])

  useEffect(() => {
    sbFetch('razao_importacoes?select=*&order=periodo_inicio.desc')
      .then(r => setImpRazao(r||[]))
      .catch(()=>{})
  }, [])

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>
      <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,overflow:'hidden',marginBottom:18}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6'}}>
          <div style={{fontSize:14,fontWeight:700,color:'#101828'}}>Dash × Razão</div>
          <p style={{margin:'6px 0 0',fontSize:12.5,color:'#6B7280'}}>
            Movimentos com saldo acumulado por produto e local de estoque
          </p>
        </div>
      </div>

      <DashRazao importacoes={impRazao}/>
    </div>
  )
}
