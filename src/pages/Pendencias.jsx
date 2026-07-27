import React, { useMemo, useState } from 'react'
import { Panel, Tag, Btn, Select } from '../components/UI.jsx'
import { brl, int, dBR, sitDe } from '../config.js'

// TOPs que NÃO precisam de investigação
const TOPS_SEM_CTB = new Set([
  '1402','1400','1403','1410','1411',
  '3301','3302','3303','3304',
  '1600','1605',
  '1102','1100','1101','1105',
  '3203','3225','2207',
])

const CATEGORIAS = [
  { id: 'tudo',     label: 'Todas as pendências' },
  { id: 'compra',   label: '🛒 Compras sem CTB',     tops: new Set(['2050','2305','2103','2122','2413','2412']) },
  { id: 'venda',    label: '📤 Vendas sem baixa CTB', tops: new Set(['3214','3200','3201']) },
  { id: 'comodato', label: '🔄 Comodato',             tops: new Set(['2312','2405','2410','2202']) },
  { id: 'remessa',  label: '⏳ Remessas em aberto',   tops: new Set(['3203','3225','2207']) },
]

export default function Pendencias({ lancamentos, onDetalhe }) {
  const [cat, setCat] = useState('tudo')

  // Separar o que é problema real do ruído
  const { pendentes, remessas, internas } = useMemo(() => {
    const pendentes = [], remessas = [], internas = []
    lancamentos.forEach(r => {
      if (!String(r.motivo_divergencia || '').startsWith('3')) return // só "só no custo"
      const top = r.cod_top || ''
      if (TOPS_SEM_CTB.has(top)) {
        if (['3203','3225','2207'].includes(top)) remessas.push(r)
        else internas.push(r)
      } else {
        pendentes.push(r)
      }
    })
    return { pendentes, remessas, internas }
  }, [lancamentos])

  const todasAcao = useMemo(() => [...pendentes, ...remessas], [pendentes, remessas])

  const filtradas = useMemo(() => {
    if (cat === 'tudo') return todasAcao
    const catObj = CATEGORIAS.find(c => c.id === cat)
    if (!catObj?.tops) return todasAcao
    return todasAcao.filter(r => catObj.tops.has(r.cod_top || ''))
  }, [todasAcao, cat])

  const ordenadas = [...filtradas].sort((a, b) => Math.abs(Number(b.saldo_dash)||0) - Math.abs(Number(a.saldo_dash)||0))

  const totalValor = pendentes.reduce((s, r) => s + Math.abs(Number(r.saldo_dash||0)), 0)
  const totalVendas = Math.abs(pendentes.filter(r => ['3214','3200','3201'].includes(r.cod_top)).reduce((s,r) => s + Number(r.saldo_dash||0), 0))
  const totalCompras = pendentes.filter(r => ['2050','2305','2103','2122','2413','2412'].includes(r.cod_top)).reduce((s,r) => s + Number(r.saldo_dash||0), 0)

  const exportarCSV = () => {
    const cols = ['conta_contabil','nota_fiscal','descr_local','data_entrada_saida','cod_top','descr_top','saldo_dash','saldo_contabil','diferenca','motivo_divergencia']
    const csv  = [cols.join(';'), ...ordenadas.map(r => cols.map(c => String(r[c]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url  = URL.createObjectURL(new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' }))
    const a    = document.createElement('a')
    a.href = url; a.download = `pendencias-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Resumo executivo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14 }}>
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11.5, color:'#991B1B', fontWeight:600, marginBottom:6 }}>ATIVO DESCOBERTO</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#B42318', fontVariantNumeric:'tabular-nums' }}>R$ {brl(totalCompras)}</div>
          <div style={{ fontSize:11.5, color:'#991B1B', marginTop:4 }}>compras sem lançamento contábil</div>
        </div>
        <div style={{ background:'#FFF7ED', border:'1px solid #FED7AA', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11.5, color:'#92400E', fontWeight:600, marginBottom:6 }}>CMV SUBAVALIADO</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#B54708', fontVariantNumeric:'tabular-nums' }}>R$ {brl(totalVendas)}</div>
          <div style={{ fontSize:11.5, color:'#92400E', marginTop:4 }}>vendas sem baixa no custo contábil</div>
        </div>
        <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11.5, color:'#1E40AF', fontWeight:600, marginBottom:6 }}>REMESSAS EM ABERTO</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#1D5BBF', fontVariantNumeric:'tabular-nums' }}>{int(remessas.length)}</div>
          <div style={{ fontSize:11.5, color:'#1E40AF', marginTop:4 }}>aguardando retorno/encerramento</div>
        </div>
        <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontSize:11.5, color:'#166534', fontWeight:600, marginBottom:6 }}>RUÍDO FILTRADO</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#12805C', fontVariantNumeric:'tabular-nums' }}>{int(internas.length)}</div>
          <div style={{ fontSize:11.5, color:'#166534', marginTop:4 }}>movimentações internas — não investigar</div>
        </div>
      </div>

      {/* Filtro por categoria */}
      <Panel
        title={`Fila de pendências — ${int(ordenadas.length)} registros`}
        action={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Btn small onClick={exportarCSV}>↓ CSV</Btn>
          </div>
        }
      >
        {/* Abas de categoria */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16, borderBottom:'1px solid #F3F4F6', paddingBottom:12 }}>
          {CATEGORIAS.map(c => {
            const count = c.id === 'tudo' ? todasAcao.length
              : todasAcao.filter(r => c.tops?.has(r.cod_top || '')).length
            return (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                padding:'5px 12px', borderRadius:5, fontSize:12.5, fontWeight: cat === c.id ? 600 : 400,
                border: `1px solid ${cat === c.id ? '#1D5BBF' : '#E5E7EB'}`,
                background: cat === c.id ? '#EBF2FC' : '#fff',
                color: cat === c.id ? '#1D5BBF' : '#374151',
                cursor:'pointer', fontFamily:'inherit',
              }}>
                {c.label} <span style={{ opacity:.7 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Tabela */}
        <div style={{ overflowX:'auto', margin:'0 -18px -16px', borderTop:'1px solid #F3F4F6' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {['#','Nota fiscal','Conta','Local','Data','Operação','Valor no custo','Situação'].map(h => (
                  <th key={h} style={{
                    position:'sticky', top:0, background:'#F9FAFB', padding:'10px 14px',
                    textAlign: h === 'Valor no custo' ? 'right' : 'left',
                    fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase',
                    letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap',
                  }}>{h}</th>
                ))}
                <th style={{ position:'sticky', top:0, background:'#F9FAFB', width:30, borderBottom:'1px solid #E5E7EB' }}/>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((r, i) => {
                const sit = sitDe(r.motivo_divergencia)
                const isRemessa = ['3203','3225','2207'].includes(r.cod_top || '')
                return (
                  <tr key={r.id || i} onClick={() => onDetalhe(r)} style={{ cursor:'pointer' }}
                    onMouseOver={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '#F9FAFB')}
                    onMouseOut={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}
                  >
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', color:'#9CA3AF', fontVariantNumeric:'tabular-nums', width:32 }}>{i+1}</td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', fontWeight:600, fontVariantNumeric:'tabular-nums' }}>{r.nota_fiscal ?? '—'}</td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', fontVariantNumeric:'tabular-nums' }}>{r.conta_contabil ?? '—'}</td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#6B7280' }} title={r.descr_local}>{r.descr_local ?? '—'}</td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', color:'#9CA3AF', whiteSpace:'nowrap' }}>{dBR(r.data_entrada_saida)}</td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.descr_top}>
                      <span style={{ fontSize:10, background: isRemessa ? '#EFF6FF' : '#FEF2F2', color: isRemessa ? '#1E40AF' : '#991B1B', padding:'1px 6px', borderRadius:4, fontWeight:600, marginRight:6 }}>
                        {isRemessa ? 'REMESSA' : 'PENDENTE'}
                      </span>
                      {r.descr_top ?? '—'}
                    </td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums', color: Number(r.saldo_dash) >= 0 ? '#B42318' : '#1D5BBF' }}>
                      R$ {brl(r.saldo_dash)}
                    </td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB' }}><Tag sit={sit} /></td>
                    <td style={{ padding:'9px 14px', borderBottom:'1px solid #F9FAFB', color:'#D1D5DB' }}>›</td>
                  </tr>
                )
              })}
              {!ordenadas.length && (
                <tr><td colSpan={9} style={{ textAlign:'center', padding:'32px', color:'#9CA3AF' }}>Nenhuma pendência nessa categoria. ✓</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

    </div>
  )
}
