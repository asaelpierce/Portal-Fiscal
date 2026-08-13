import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, brl, brlK, int, dBR, isZero, classeDe } from '../config.js'
import { Panel, Select, SearchInput, Spinner, Btn } from '../components/UI.jsx'
import DrawerDetalhe from '../components/DrawerDetalhe.jsx'

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtPeriodo(inicio, fim) {
const f = s => { const [y,m,d]=String(s).slice(0,10).split('-'); return `${d}/${m}/${y}` }
return `${f(inicio)} a ${f(fim)}`
}

// ─── Aba 1: Dash × Razão ─────────────────────────────────────────────────────
function DashRazao({ importacoes }) {
const [notaAberta, setNotaAberta] = useState(null)
const [impId, setImpId] = useState('')
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
if (importacoes.length) setImpId(importacoes[0].importacao_id)
}, [importacoes])

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

// Busca agora inclui os produtos da nota (campo `produtos`, gerado pelo
// conciliacao-sync com código + descrição de cada item que compõe a nota).
// Antes só dava pra localizar uma nota digitando o próprio número dela;
// agora também é possível digitar o código ou nome de um produto e achar
// todas as notas em que ele aparece.
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

const exportar = () => {
const cols = ['conta_contabil','nota_fiscal','descr_local','data_entrada_saida',
'saldo_dash','saldo_contabil','diferenca','classe_divergencia','motivo_calculado',
'descr_top','descr_centro_resultado','produtos']
const csv = [cols.join(';'), ...ordenados.map(r=>cols.map(c=>String(r[c]??'').replace(/;/g,',')).join(';'))].join('\n')
const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
const a=document.createElement('a'); a.href=url; a.download=`dash-razao-${impId}.csv`; a.click()
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
{ k:'saldo_dash', r:'Custo (Dash)', num:true },
{ k:'saldo_contabil', r:'Contábil (Razão)', num:true },
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
<select value={impId} onChange={e=>setImpId(e.target.value)} style={{
fontFamily:'inherit',fontSize:13,padding:'7px 12px',border:'1px solid #E5E7EB',borderRadius:6,background:'#fff',
}}>
{importacoes.map(i=>(
<option key={i.importacao_id} value={i.importacao_id}>
{fmtPeriodo(i.periodo_inicio,i.periodo_fim)} · {int(i.total)} lançamentos
</option>
))}
</select>
</div>

{fase==='carregando' && <Spinner/>}
{fase==='pronto' && (
<>
{/* KPIs */}
<div style={{display:'grid',gridTemplateColumns:'1fr 1px 1fr 1px 1fr',background:'#fff',border:'1px solid #E5E7EB',borderRadius:8,padding:'14px 20px'}}>
<div>
<div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>
Custo apurado (Dash)
</div>
<div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(kpi.custo)}</div>
<div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>soma do fluxo do período</div>
</div>
<div style={{background:'#E5E7EB'}}/>
<div style={{paddingLeft:20}}>
<div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>
Saldo contábil (Razão)
</div>
<div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>R$ {brl(kpi.ctb)}</div>
<div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>lançamentos TCBLAN no período</div>
</div>
<div style={{background:'#E5E7EB'}}/>
<div style={{paddingLeft:20}}>
<div style={{fontSize:10.5,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:4}}>
Diferença
</div>
<div style={{fontSize:20,fontWeight:700,fontVariantNumeric:'tabular-nums',
color:isZero(kpi.custo-kpi.ctb)?'#12805C':'#B54708'}}>
R$ {brl(kpi.custo-kpi.ctb)}
</div>
<div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>
{int(kpi.ok)} ok · {int(kpi.inv)} investigar · {int(kpi.adj)} ajuste de custo
</div>
</div>
</div>

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
</table>
</div>
</Panel>
</>
)}
<DrawerDetalhe nota={notaAberta} onClose={()=>setNotaAberta(null)} />
</div>
)
}

// ─── Aba 2: Razão analítico ───────────────────────────────────────────────────
function RazaoAnalitico({ importacoes }) {
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

const exportar = () => {
const cols = ['codprod','descrprod','codlocal','descrlocal','numnota','data_mov','tipo','descroper',
'nomeparc','qtdneg','custo_unitario','custototal',
'saldo_antes_qtd','saldo_antes_vlr','saldo_apos_qtd','saldo_apos_vlr',
'conta_contabil','lote','lancamento']
const csv = [cols.join(';'), ...filtrados.map(r=>cols.map(c=>String(r[c]??'').replace(/;/g,',')).join(';'))].join('\n')
const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
const a=document.createElement('a'); a.href=url; a.download=`razao-analitico-${impId}.csv`; a.click()
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
{fase==='pronto'&&(
<span style={{fontSize:12,color:'#9CA3AF'}}>
{int(dados.length)} movimentos · {[...new Set(dados.map(r=>r.codprod))].length} produtos · {[...new Set(dados.map(r=>r.codlocal))].length} locais
</span>
)}
</div>

{fase==='carregando'&&<Spinner/>}
{fase==='pronto'&&(
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
)}
</div>
)
}

const TD = { padding:'7px 11px', borderBottom:'1px solid #F3F4F6', verticalAlign:'top', fontSize:12 }

// ─── Componente principal com abas ───────────────────────────────────────────
export default function Razao() {
const [aba, setAba] = useState('dash')
const [impConcil, setImpConcil] = useState([])
const [impRazao, setImpRazao] = useState([])

useEffect(() => {
// carrega listas de períodos disponíveis para cada módulo
sbFetch('importacoes?select=importacao_id:id,periodo_inicio,periodo_fim,total:total_linhas&order=periodo_inicio.desc')
.then(r => setImpConcil(r||[]))
.catch(()=>{})
sbFetch('razao_importacoes?select=*&order=periodo_inicio.desc')
.then(r => setImpRazao(r||[]))
.catch(()=>{})
}, [])

const abas = [
{ id: 'dash', label: 'Dash × Razão', desc: 'Conciliação nota a nota — custo apurado vs lançamento contábil' },
{ id: 'razao', label: 'Razão analítico', desc: 'Movimentos com saldo acumulado por produto e local de estoque' },
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
{aba==='dash' && <DashRazao importacoes={impConcil}/>}
{aba==='razao' && <RazaoAnalitico importacoes={impRazao}/>}
</div>
)
}
