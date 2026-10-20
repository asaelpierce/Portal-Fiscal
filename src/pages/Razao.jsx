import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, brl, int, dBR, isZero, classeDe } from '../config.js'
import { Panel, Select, SearchInput, Spinner, Btn } from '../components/UI.jsx'
import DrawerDetalhe from '../components/DrawerDetalhe.jsx'
import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import { sincronizarConciliacao, sincronizarRazao } from '../lib/sync.js'

// ─── helpers ─────────────────────────────────────────────────────────────────
const TD = { padding:'7px 11px', borderBottom:'1px solid #F3F4F6', verticalAlign:'top', fontSize:12 }
const KPI_LABEL = { fontSize:10.5, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }

// Definição das colunas da tabela de movimentos: cada uma sabe extrair seu
// próprio texto (pro filtro por coluna) e, se for numérica, tem uma chave de
// soma pro subtotal do rodapé.
// Quantidade saiu: a conciliação Dash x Razão é sobre VALOR, e as três
// colunas de quantidade só disputavam espaço com o que importa.
// "essencial" define o que aparece por padrão; o resto fica atrás do
// botão de mais colunas, porque 13 colunas de uma vez ninguém lê.
// ─── Aba 2: Comparativo (custo apurado no estoque × saldo contábil) ─────────
function Comparativo({ importacoes, onSincronizado }) {
  const [notaAberta, setNotaAberta] = useState(null)
  const [impId, setImpId] = useState('')
  const [dtIni, setDtIni] = useState('')
  const [dtFim, setDtFim] = useState('')
  const [faseSync, setFaseSync] = useState('idle')
  const [fase, setFase] = useState('idle')
  const [dados, setDados] = useState([])
  const [fConta, setFConta] = useState('')
  const [fClasse, setFClasse] = useState('')
  const [fLocal, setFLocal] = useState('')
  const [fTop, setFTop] = useState('')
  const [fOperacao, setFOperacao] = useState('')
  const [fCentro, setFCentro] = useState('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState({ col: null, dir: 1 })

  useEffect(() => {
    if (importacoes.length && !dtIni && !dtFim) {
      const maisRecente = importacoes[0]
      setImpId(maisRecente.importacao_id)
      setDtIni(String(maisRecente.periodo_inicio).slice(0, 10))
      setDtFim(String(maisRecente.periodo_fim).slice(0, 10))
      setFaseSync('pronto')
    }
  }, [importacoes, dtIni, dtFim])

  const selecionarPeriodo = async (novoDtIni, novoDtFim) => {
    setDtIni(novoDtIni); setDtFim(novoDtFim)
    if (!novoDtIni || !novoDtFim) return
    setFaseSync('verificando')
    try {
      const existente = importacoes.find(i => String(i.periodo_inicio).slice(0,10) === novoDtIni && String(i.periodo_fim).slice(0,10) === novoDtFim)
      if (existente) {
        setImpId(existente.importacao_id)
        setFaseSync('pronto')
        return
      }
      setFaseSync('sincronizando')
      const novo = await sincronizarConciliacao(novoDtIni, novoDtFim)
      onSincronizado?.()
      setImpId(novo.importacao_id)
      setFaseSync('pronto')
    } catch (e) {
      setFaseSync('erro')
    }
  }

  useEffect(() => {
    if (!impId) return
    setFase('carregando'); setDados([])
    sbFetch(`lancamentos_conciliacao?importacao_id=eq.${impId}&select=*&order=prioridade.asc`)
      .then(r => { setDados(r || []); setFase('pronto') })
      .catch(e => setFase('erro'))
  }, [impId])

  const opcoes = useMemo(() => ({
    contas: [...new Set(dados.map(r => r.conta_contabil).filter(Boolean))].sort(),
    classes: [...new Set(dados.map(r => r.classe_divergencia).filter(Boolean))].sort(),
    locais: [...new Set(dados.map(r => r.descr_local).filter(Boolean))].sort(),
    tops: [...new Set(dados.map(r => r.cod_top).filter(Boolean))].sort((a,b)=>Number(a)-Number(b)),
    operacoes: [...new Set(dados.map(r => r.descr_top).filter(Boolean))].sort(),
    centros: [...new Set(dados.map(r => r.descr_centro_resultado).filter(Boolean))].sort(),
  }), [dados])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(r => {
      if (fConta && r.conta_contabil !== fConta) return false
      if (fClasse && r.classe_divergencia !== fClasse) return false
      if (fLocal && r.descr_local !== fLocal) return false
      if (fTop && r.cod_top !== fTop) return false
      if (fOperacao && r.descr_top !== fOperacao) return false
      if (fCentro && r.descr_centro_resultado !== fCentro) return false
      if (q) {
        const h = `${r.nota_fiscal} ${r.conta_contabil} ${r.descr_local} ${r.descr_top} ${r.descr_centro_resultado} ${r.produtos || ''}`.toLowerCase()
        if (!h.includes(q)) return false
      }
      return true
    })
  }, [dados, fConta, fClasse, fLocal, fTop, fOperacao, fCentro, busca])

  const ordenados = useMemo(() => {
    if (!ordem.col) return filtrados
    const a = [...filtrados]
    a.sort((x, y) => {
      const xv = x[ordem.col], yv = y[ordem.col]
      const xn = Number(xv), yn = Number(yv)
      if (!isNaN(xn) && !isNaN(yn) && xv !== null && yv !== null) return (xn - yn) * ordem.dir
      return String(xv ?? '').localeCompare(String(yv ?? ''), 'pt-BR') * ordem.dir
    })
    return a
  }, [filtrados, ordem])

  const kpi = useMemo(() => ({
    custo: dados.reduce((s,r)=>s+Number(r.saldo_dash||0),0),
    ctb: dados.reduce((s,r)=>s+Number(r.saldo_contabil||0),0),
    ok: dados.filter(r=>r.classe_divergencia==='OK').length,
    inv: dados.filter(r=>r.classe_divergencia==='INVESTIGAR').length,
    adj: dados.filter(r=>r.classe_divergencia==='AJUSTE_CUSTO').length,
  }), [dados])

  // Subtotal do que está filtrado agora (igual Excel)
  const subtotal = useMemo(() => ({
    custo: filtrados.reduce((s,r)=>s+Number(r.saldo_dash||0),0),
    ctb: filtrados.reduce((s,r)=>s+Number(r.saldo_contabil||0),0),
    linhas: filtrados.length,
  }), [filtrados])

  const exportar = () => {
    const cols = ['conta_contabil','nota_fiscal','descr_local','data_entrada_saida',
      'saldo_dash','saldo_contabil','diferenca','classe_divergencia','motivo_calculado',
      'descr_top','descr_centro_resultado','produtos']
    const csv = [cols.join(';'), ...ordenados.map(r=>cols.map(c=>String(r[c]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a=document.createElement('a'); a.href=url; a.download=`comparativo-${impId}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const ord = col => setOrdem(p => p.col === col ? { col, dir: p.dir * -1 } : { col, dir: 1 })
  const temFiltro = fConta || fClasse || fLocal || fTop || fOperacao || fCentro || busca

  const COLS = [
    { k:'conta_contabil', r:'Conta' },
    { k:'nota_fiscal', r:'Nota' },
    { k:'produtos', r:'Produto(s)' },
    { k:'descr_local', r:'Local' },
    { k:'data_entrada_saida', r:'Data' },
    { k:'saldo_dash', r:'Valor do movimento', num:true },
    { k:'saldo_contabil', r:'Saldo contábil', num:true },
    { k:'diferenca', r:'Diferença', num:true },
    { k:'classe_divergencia', r:'Situação' },
    { k:'cod_top', r:'TOP' },
    { k:'descr_top', r:'Operação' },
    { k:'descr_centro_resultado', r:'Centro de Resultado' },
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Seletor de período */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <label style={{fontSize:12,color:'#6B7280',fontWeight:500}}>Período:</label>
        <SeletorPeriodo dtIni={dtIni} dtFim={dtFim} onChange={selecionarPeriodo} fase={faseSync} />
      </div>

      {(fase==='carregando' || faseSync==='sincronizando') && <Spinner/>}
      {fase==='pronto' && faseSync!=='sincronizando' && (
        <>
          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr 1px 1fr',background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'14px 20px'}}>
            <div>
              <div style={KPI_LABEL}>Valor do movimento (período todo)</div>
              <div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(kpi.custo)}</div>
              <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>soma do fluxo do período (estoque)</div>
            </div>
            <div style={{background:'#E5E7EB'}}/>
            <div style={{paddingLeft:20}}>
              <div style={KPI_LABEL}>Saldo contábil (período todo)</div>
              <div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(kpi.ctb)}</div>
              <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>lançamentos TCBLAN no período</div>
            </div>
            <div style={{background:'#E5E7EB'}}/>
            <div style={{paddingLeft:20}}>
              <div style={KPI_LABEL}>Diferença (período todo)</div>
              <div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums',
                color:isZero(kpi.custo-kpi.ctb)?'#12805C':'#B54708'}}>
                R$ {brl(kpi.custo-kpi.ctb)}
              </div>
              <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>
                {int(kpi.ok)} ok · {int(kpi.inv)} investigar · {int(kpi.adj)} ajuste de custo
              </div>
            </div>
          </div>

          {kpi.ctb === 0 && kpi.custo !== 0 && (
            <div style={{padding:'10px 14px',background:'#EBF2FC',border:'1px solid #BFDBFE',borderRadius:8,fontSize:12.5,color:'#1D5BBF'}}>
              ℹ️ Saldo contábil ainda zerado neste período — normal quando a contabilidade ainda não lançou nada
              (ex.: mês em andamento). A diferença mostrada é o valor de movimento ainda não contabilizado, não um erro.
            </div>
          )}

          {/* Tabela */}
          <Panel
            title={`${int(ordenados.length)} de ${int(dados.length)} lançamentos`}
            action={
              <div style={{display:'flex',gap:8}}>
                {temFiltro && <Btn small onClick={()=>{setFConta('');setFClasse('');setFLocal('');setFTop('');setFOperacao('');setFCentro('');setBusca('')}}>✕ Limpar</Btn>}
                <Btn small onClick={exportar}>↓ CSV</Btn>
              </div>
            }
          >
            <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
              <Select label="Conta" value={fConta} onChange={setFConta} options={opcoes.contas} />
              <Select label="Situação" value={fClasse} onChange={setFClasse} options={opcoes.classes} placeholder="Todas"/>
              <Select label="Local" value={fLocal} onChange={setFLocal} options={opcoes.locais} />
              <Select label="TOP" value={fTop} onChange={setFTop} options={opcoes.tops} />
              <Select label="Operação" value={fOperacao} onChange={setFOperacao} options={opcoes.operacoes} />
              <Select label="Centro de Resultado" value={fCentro} onChange={setFCentro} options={opcoes.centros} />
              <SearchInput value={busca} onChange={setBusca} placeholder="nota, conta, operação, produto…"/>
            </div>

            <div style={{maxHeight:560,overflowY:'auto',overflowX:'auto',margin:'0 -18px -16px',borderTop:'1px solid #F3F4F6'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                <thead>
                  <tr>
                    {COLS.map(c=>(
                      <th key={c.k} onClick={()=>ord(c.k)} style={{
                        position:'sticky',top:0,background:'#F9FAFB',zIndex:1,
                        padding:'8px 12px',textAlign:c.num?'right':'left',
                        fontSize:10.5,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
                        letterSpacing:'.04em',borderBottom:'1px solid #E5E7EB',whiteSpace:'nowrap',
                        cursor:'pointer',userSelect:'none',
                      }}>
                        {c.r} {ordem.col===c.k ? (ordem.dir>0?'↑':'↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordenados.slice(0,500).map((r,i)=>{
                    const cls=classeDe(r.classe_divergencia)
                    const dif=Number(r.diferenca)||0
                    return (
                      <tr key={r.id||i}
                        onClick={()=>setNotaAberta(r)}
                        style={{background:r.classe_divergencia==='OK'?'#fff':'#FFFEF7',cursor:'pointer'}}
                        onMouseOver={e=>e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='#F0F7FF')}
                        onMouseOut={e=>e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='')}
                      >
                        <td style={TD}>{r.conta_contabil}</td>
                        <td style={{...TD,fontWeight:600}}>{r.nota_fiscal}</td>
                        <td style={{...TD,color:'#6B7280',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.produtos}>{r.produtos || '—'}</td>
                        <td style={{...TD,color:'#6B7280',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.descr_local}</td>
                        <td style={{...TD,color:'#9CA3AF',whiteSpace:'nowrap'}}>{dBR(r.data_entrada_saida)}</td>
                        <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{brl(r.saldo_dash)}</td>
                        <td style={{...TD,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{brl(r.saldo_contabil)}</td>
                        <td style={{...TD,textAlign:'right',fontWeight:Math.abs(dif)>0.005?700:400,
                          fontVariantNumeric:'tabular-nums',
                          color:Math.abs(dif)<0.005?'#12805C':Math.abs(dif)<0.10?'#6B7280':cls.cor}}>
                          {Math.abs(dif)<0.005?'—':`${dif>0?'+':''}${brl(dif)}`}
                        </td>
                        <td style={TD}>
                          <span style={{fontSize:10.5,fontWeight:700,padding:'2px 7px',borderRadius:4,
                            background:cls.bg,color:cls.cor,whiteSpace:'nowrap'}}>
                            {cls.icone} {cls.rot}
                          </span>
                        </td>
                        <td style={{...TD,fontVariantNumeric:'tabular-nums',fontWeight:600,color:'#374151'}}>
                          {r.cod_top || '—'}
                        </td>
                        <td style={{...TD,color:'#6B7280',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.descr_top}>
                          {r.descr_top || '—'}
                        </td>
                        <td style={{...TD,color:'#6B7280',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.descr_centro_resultado}>
                          {r.descr_centro_resultado || '—'}
                        </td>
                      </tr>
                    )
                  })}
                  {!ordenados.length&&(
                    <tr><td colSpan={12} style={{textAlign:'center',padding:'28px',color:'#9CA3AF'}}>Nenhum registro.</td></tr>
                  )}
                  {ordenados.length > 500 && (
                    <tr><td colSpan={12} style={{textAlign:'center',padding:'12px',color:'#9CA3AF',fontSize:12}}>
                      Mostrando 500 de {int(ordenados.length)} — refine os filtros ou exporte o CSV.
                    </td></tr>
                  )}
                </tbody>
                {ordenados.length > 0 && (
                  <tfoot>
                    <tr style={{background:'#F9FAFB',fontWeight:700,borderTop:'2px solid #E5E7EB'}}>
                      <td colSpan={5} style={{padding:'9px 12px',fontSize:12}}>
                        Subtotal ({int(subtotal.linhas)} {subtotal.linhas===1?'linha':'linhas'}{temFiltro?' filtradas':''})
                      </td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(subtotal.custo)}</td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(subtotal.ctb)}</td>
                      <td style={{padding:'9px 12px',textAlign:'right',fontVariantNumeric:'tabular-nums'}}>R$ {brl(subtotal.custo-subtotal.ctb)}</td>
                      <td colSpan={4}/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Panel>
        </>
      )}
      <DrawerDetalhe nota={notaAberta} onClose={()=>setNotaAberta(null)} />
    </div>
  )
}

// ─── Página "Movimentos" com 2 abas ───────────────────────────────────────────
export default function Razao() {
  const [aba, setAba] = useState('comparativo')
  const [impConcil, setImpConcil] = useState([])
  const [impRazao, setImpRazao] = useState([])

  const recarregarListas = () => {
    sbFetch('importacoes?select=importacao_id:id,periodo_inicio,periodo_fim,total:total_linhas,criado_em&order=criado_em.desc')
      .then(r => setImpConcil(r||[]))
      .catch(()=>{})
    sbFetch('razao_importacoes?select=*&order=criado_em.desc')
      .then(r => setImpRazao(r||[]))
      .catch(()=>{})
  }

  useEffect(() => {
    // FIX: ordenar por criado_em (quando a sincronizacao realmente rodou),
    // nao por periodo_inicio - varias sincronizacoes (inclusive tentativas
    // antigas que falharam e ficaram com 0 linhas) compartilham o mesmo
    // periodo_inicio (ex.: sempre "01/08"), entao ordenar so por essa data
    // podia trazer um registro errado/vazio pra frente do mais recente e bom.
    recarregarListas()
  }, [])

  const abas = [
    { id: 'comparativo', label: 'Comparativo', desc: 'Valor do movimento (estoque) comparado ao saldo contábil, por nota' },
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>

      {/* Abas */}
      <div style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,overflow:'hidden',marginBottom:18}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #F3F4F6'}}>
          <div style={{display:'flex',gap:4}}>
            {abas.map(a=>(
              <button key={a.id} onClick={()=>setAba(a.id)} style={{
                padding:'8px 16px',borderRadius:6,fontSize:13,fontWeight:aba===a.id?700:400,
                border:`1px solid ${aba===a.id?'#1D5BBF':'#E5E7EB'}`,
                background:aba===a.id?'#EBF2FC':'#fff',
                color:aba===a.id?'#1D5BBF':'#6B7280',
                cursor:'pointer',fontFamily:'inherit',
              }}>
                {a.label}
              </button>
            ))}
          </div>
          <p style={{margin:'10px 0 0',fontSize:12.5,color:'#6B7280'}}>
            {abas.find(a=>a.id===aba)?.desc}
          </p>
        </div>
      </div>

      {/* Conteúdo da aba */}
      {aba==='comparativo' && <Comparativo importacoes={impConcil} onSincronizado={recarregarListas}/>}
    </div>
  )
}
