import React, { useMemo, useState } from 'react'
import { Panel, Tag, Btn } from '../components/UI.jsx'
import { brl, int, dBR, classeDe } from '../config.js'

const ABAS = [
  { id: 'tudo',           label: 'Todas',          classes: ['CRITICO','INVESTIGAR'] },
  { id: 'critico',        label: '🔴 Críticos',    classes: ['CRITICO'] },
  { id: 'investigar',     label: '⚠ Investigar',   classes: ['INVESTIGAR'] },
]

export default function Pendencias({ lancamentos, onDetalhe }) {
  const [aba, setAba] = useState('tudo')

  // Tudo que requer atenção — filtrado pelo banco via classe_divergencia
  const pendentes = useMemo(() =>
    lancamentos
      .filter(r => ['CRITICO','INVESTIGAR'].includes(r.classe_divergencia))
      .sort((a,b) => {
        // Críticos primeiro, depois por valor absoluto
        if (a.classe_divergencia !== b.classe_divergencia)
          return a.classe_divergencia === 'CRITICO' ? -1 : 1
        return Math.abs(Number(b.diferenca)||0) - Math.abs(Number(a.diferenca)||0)
      })
  , [lancamentos])

  const filtrados = useMemo(() => {
    const abaObj = ABAS.find(a => a.id === aba)
    if (!abaObj || aba === 'tudo') return pendentes
    return pendentes.filter(r => abaObj.classes.includes(r.classe_divergencia))
  }, [pendentes, aba])

  const valorCritico   = pendentes.filter(r=>r.classe_divergencia==='CRITICO').reduce((s,r)=>s+Math.abs(Number(r.diferenca)||0),0)
  const valorInvestigar= pendentes.filter(r=>r.classe_divergencia==='INVESTIGAR').reduce((s,r)=>s+Math.abs(Number(r.diferenca)||0),0)

  const exportarCSV = () => {
    const cols = ['conta_contabil','nota_fiscal','descr_local','data_entrada_saida','cod_top','descr_top','saldo_dash','saldo_contabil','diferenca','classe_divergencia','motivo_calculado']
    const csv  = [cols.join(';'), ...filtrados.map(r=>cols.map(c=>String(r[c]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url  = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a    = document.createElement('a')
    a.href=url; a.download=`pendencias-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Cards resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#991B1B', marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>Críticos</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#B42318', fontVariantNumeric:'tabular-nums' }}>
            {int(pendentes.filter(r=>r.classe_divergencia==='CRITICO').length)}
          </div>
          <div style={{ fontSize:12, color:'#991B1B', marginTop:4 }}>R$ {brl(valorCritico)} em risco</div>
        </div>
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#92400E', marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>Investigar</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#B54708', fontVariantNumeric:'tabular-nums' }}>
            {int(pendentes.filter(r=>r.classe_divergencia==='INVESTIGAR').length)}
          </div>
          <div style={{ fontSize:12, color:'#92400E', marginTop:4 }}>R$ {brl(valorInvestigar)}</div>
        </div>
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#166534', marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>Arredondamentos aceitos</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#12805C', fontVariantNumeric:'tabular-nums' }}>
            {int(lancamentos.filter(r=>r.classe_divergencia==='ARREDONDAMENTO').length)}
          </div>
          <div style={{ fontSize:12, color:'#166534', marginTop:4 }}>classificados automaticamente pelo banco</div>
        </div>
      </div>

      <Panel
        title={`${int(filtrados.length)} pendências`}
        action={<Btn small onClick={exportarCSV}>↓ CSV</Btn>}
      >
        {/* Abas */}
        <div style={{ display:'flex', gap:6, marginBottom:16, borderBottom:'1px solid #F3F4F6', paddingBottom:12 }}>
          {ABAS.map(a => {
            const count = a.id === 'tudo' ? pendentes.length : pendentes.filter(r=>a.classes.includes(r.classe_divergencia)).length
            return (
              <button key={a.id} onClick={()=>setAba(a.id)} style={{
                padding:'5px 12px', borderRadius:5, fontSize:12.5, fontWeight:aba===a.id?600:400,
                border:`1px solid ${aba===a.id?'#1D5BBF':'#E5E7EB'}`,
                background:aba===a.id?'#EBF2FC':'#fff',
                color:aba===a.id?'#1D5BBF':'#374151',
                cursor:'pointer', fontFamily:'inherit',
              }}>
                {a.label} <span style={{ opacity:.7 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Tabela */}
        <div style={{ overflowX:'auto', margin:'0 -18px -16px', borderTop:'1px solid #F3F4F6' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {['#','Nota','Conta','Local','Data','Operação','Diagnóstico','Valor custo','Valor CTB','Diferença'].map(h=>(
                  <th key={h} style={{
                    position:'sticky', top:0, background:'#F9FAFB', padding:'9px 12px',
                    textAlign:['Valor custo','Valor CTB','Diferença'].includes(h)?'right':'left',
                    fontSize:10.5, fontWeight:600, color:'#6B7280', textTransform:'uppercase',
                    letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
                <th style={{ position:'sticky', top:0, background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', width:30 }}/>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r,i) => {
                const cls = classeDe(r.classe_divergencia)
                return (
                  <tr key={r.id||i} onClick={()=>onDetalhe(r)} style={{ cursor:'pointer' }}
                    onMouseOver={e=>e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='#F9FAFB')}
                    onMouseOut={e=>e.currentTarget.querySelectorAll('td').forEach(td=>td.style.background='')}
                  >
                    <td style={TD}><span style={{ color:'#9CA3AF' }}>{i+1}</span></td>
                    <td style={{ ...TD, fontWeight:600 }}>{r.nota_fiscal}</td>
                    <td style={{ ...TD, fontVariantNumeric:'tabular-nums' }}>{r.conta_contabil}</td>
                    <td style={{ ...TD, color:'#6B7280', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.descr_local}</td>
                    <td style={{ ...TD, color:'#9CA3AF', whiteSpace:'nowrap' }}>{dBR(r.data_entrada_saida)}</td>
                    <td style={{ ...TD, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#6B7280' }}>{r.descr_top}</td>
                    <td style={TD}>
                      {/* Diagnóstico vem do banco — motivo_calculado */}
                      <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:cls.bg, color:cls.cor, whiteSpace:'nowrap', flexShrink:0 }}>
                          {cls.icone} {cls.rot}
                        </span>
                        <span style={{ fontSize:11, color:'#6B7280', lineHeight:1.4 }}>{r.motivo_calculado}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{brl(r.saldo_dash)}</td>
                    <td style={{ ...TD, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{brl(r.saldo_contabil)}</td>
                    <td style={{ ...TD, textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums', color:r.classe_divergencia==='CRITICO'?'#B42318':'#B54708' }}>
                      R$ {brl(r.diferenca)}
                    </td>
                    <td style={{ ...TD, color:'#D1D5DB' }}>›</td>
                  </tr>
                )
              })}
              {!filtrados.length && (
                <tr><td colSpan={11} style={{ textAlign:'center', padding:'32px', color:'#9CA3AF' }}>
                  Nenhuma pendência nessa categoria. ✓
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

const TD = { padding:'9px 12px', borderBottom:'1px solid #F9FAFB', fontSize:13, verticalAlign:'middle' }
