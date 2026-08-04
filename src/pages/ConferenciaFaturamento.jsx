import React, { useState, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { UploadCloud, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Download, RotateCcw } from 'lucide-react'
import { Panel, Btn, Select } from '../components/UI.jsx'

// ─── Configuração dos cabeçalhos aceitos ──────────────────────────────────────
const HEADER_ALIASES = {
  nf:            ['NF', 'NF ', 'NRO. NOTA', 'NUMERO NOTA', 'NÚMERO NOTA'],
  gross:         ['GROSS VALUE'],
  icms:          ['ICMS', 'VLR. DO ICMS'],
  ipi:           ['IPI', 'VLR. DO IPI'],
  pis:           ['PIS', 'VLR. PIS*', 'VLR. PIS'],
  cofins:        ['COFINS', 'VLR. COFINS*', 'VLR. COFINS'],
  total_sankhya: ['VLR. NOTA'],
  date:          ['DT. NEG.', 'DATE', 'DT. DO FATURAMENTO'],
}

const MONTH_MAP = {
  JANEIRO: 0, FEVEREIRO: 1, MARÇO: 2, MARCO: 2, ABRIL: 3, MAIO: 4, JUNHO: 5,
  JULHO: 6, AGOSTO: 7, SETEMBRO: 8, OUTUBRO: 9, NOVEMBRO: 10, DEZEMBRO: 11,
}

const FIELD_LABELS = [
  { key: 'total',  label: 'Total' },
  { key: 'icms',   label: 'ICMS' },
  { key: 'ipi',    label: 'IPI' },
  { key: 'pis',    label: 'PIS' },
  { key: 'cofins', label: 'COFINS' },
]

function norm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toUpperCase()
}

function findHeaderRow(rows, mustHave) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = (rows[r] || []).map(norm)
    const hits = mustHave.filter(h => cells.some(c => c === norm(h)))
    if (hits.length >= 2) return r
  }
  return -1
}

function buildColumnMap(headerRow) {
  const cells = headerRow.map(norm)
  const map = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    let idx = -1
    for (const alias of aliases) {
      idx = cells.indexOf(norm(alias))
      if (idx !== -1) break
    }
    map[field] = idx
  }
  return map
}

function excelDateToJSDate(v) {
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return new Date(d.y, d.m - 1, d.d)
  }
  return null
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function normalizeNF(v) {
  if (v === null || v === undefined) return ''
  return String(v).trim().replace(/^0+(?=\d)/, '')
}

function fmt(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Status visual ────────────────────────────────────────────────────────────
const STATUS_INFO = {
  ok:                { icon: CheckCircle2, bg: '#D1FAE5', cor: '#12805C', rot: 'OK' },
  divergent:         { icon: AlertTriangle, bg: '#FEF3C7', cor: '#B54708', rot: 'Divergente' },
  missing_planilha:  { icon: XCircle,      bg: '#FEE2E2', cor: '#B42318', rot: 'Só no Sankhya' },
  missing_sankhya:   { icon: XCircle,      bg: '#FEE2E2', cor: '#B42318', rot: 'Só na planilha' },
}

function StatusStamp({ status }) {
  const s = STATUS_INFO[status]
  const Icon = s.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', background: s.bg, color: s.cor,
    }}>
      <Icon size={12} /> {s.rot}
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ConferenciaFaturamento() {
  const [fatBook, setFatBook] = useState(null)
  const [fatSheetNames, setFatSheetNames] = useState([])
  const [fatSheetChoice, setFatSheetChoice] = useState('')
  const [compBook, setCompBook] = useState(null)
  const [compSheetNames, setCompSheetNames] = useState([])
  const [compSheetChoice, setCompSheetChoice] = useState('')
  const [tolerance, setTolerance] = useState(0.05)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [loadingFat, setLoadingFat] = useState(false)
  const [loadingComp, setLoadingComp] = useState(false)

  const readWorkbook = useCallback(async (file) => {
    const buf = await file.arrayBuffer()
    return XLSX.read(buf, { type: 'array', cellDates: true })
  }, [])

  const onFatUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setLoadingFat(true)
    try {
      const wb = await readWorkbook(file)
      const names = wb.SheetNames.filter(n => norm(n) !== 'EVOLUCAO')
      setFatBook(wb); setFatSheetNames(names)
      const guess = names.find(n => Object.keys(MONTH_MAP).some(m => norm(n).startsWith(m)))
      setFatSheetChoice(guess || names[0] || '')
    } catch {
      setError('Não consegui ler a planilha de faturamento. Confira se é um arquivo .xlsx válido.')
    } finally { setLoadingFat(false) }
  }

  const onCompUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setLoadingComp(true)
    try {
      const wb = await readWorkbook(file)
      const names = wb.SheetNames
      setCompBook(wb); setCompSheetNames(names)
      const guess = names.find(n => norm(n).includes('NEW SHEET')) || names[0]
      setCompSheetChoice(guess)
    } catch {
      setError('Não consegui ler a planilha comparativo (Sankhya). Confira se é um arquivo .xlsx válido.')
    } finally { setLoadingComp(false) }
  }

  const canCompute = fatBook && fatSheetChoice && compBook && compSheetChoice

  const compute = () => {
    setError('')
    try {
      // ── Faturamento (planilha) ──
      const fatSheet = fatBook.Sheets[fatSheetChoice]
      const fatRows = XLSX.utils.sheet_to_json(fatSheet, { header: 1, raw: true })
      const fatHeaderIdx = findHeaderRow(fatRows, ['NF', 'GROSS VALUE', 'ICMS'])
      if (fatHeaderIdx === -1) throw new Error('Não encontrei o cabeçalho (NF, GROSS VALUE, ICMS...) na aba escolhida da planilha de faturamento.')
      const fatCols = buildColumnMap(fatRows[fatHeaderIdx])
      if (fatCols.nf === -1) throw new Error("Não encontrei a coluna 'NF' na planilha de faturamento.")

      const fatMap = new Map()
      for (let r = fatHeaderIdx + 1; r < fatRows.length; r++) {
        const row = fatRows[r] || []
        const nfRaw = row[fatCols.nf]
        if (nfRaw === undefined || nfRaw === null || String(nfRaw).trim() === '') continue
        const nf = normalizeNF(nfRaw)
        const entry = fatMap.get(nf) || { total: 0, icms: 0, ipi: 0, pis: 0, cofins: 0, rows: 0 }
        entry.total  += toNumber(row[fatCols.gross])
        entry.icms   += toNumber(row[fatCols.icms])
        entry.ipi    += toNumber(row[fatCols.ipi])
        entry.pis    += toNumber(row[fatCols.pis])
        entry.cofins += toNumber(row[fatCols.cofins])
        entry.rows   += 1
        fatMap.set(nf, entry)
      }

      // ── Comparativo (Sankhya) ──
      const compSheet = compBook.Sheets[compSheetChoice]
      const compRows = XLSX.utils.sheet_to_json(compSheet, { header: 1, raw: true })
      const compHeaderIdx = findHeaderRow(compRows, ['NRO. NOTA', 'VLR. NOTA', 'VLR. DO ICMS'])
      if (compHeaderIdx === -1) throw new Error('Não encontrei o cabeçalho (Nro. Nota, Vlr. Nota...) na aba escolhida da planilha comparativo.')
      const compCols = buildColumnMap(compRows[compHeaderIdx])
      if (compCols.nf === -1) throw new Error("Não encontrei a coluna 'Nro. Nota' na planilha comparativo.")

      const monthKey = Object.keys(MONTH_MAP).find(m => norm(fatSheetChoice).startsWith(m))
      const monthNum = monthKey ? MONTH_MAP[monthKey] : null
      const yearMatch = fatSheetChoice.match(/(20\d{2})/)
      const yearNum = yearMatch ? parseInt(yearMatch[1], 10) : null

      const compMap = new Map()
      for (let r = compHeaderIdx + 1; r < compRows.length; r++) {
        const row = compRows[r] || []
        const nfRaw = row[compCols.nf]
        if (nfRaw === undefined || nfRaw === null || String(nfRaw).trim() === '') continue
        if (monthNum !== null && compCols.date !== -1) {
          const d = excelDateToJSDate(row[compCols.date])
          if (d && (d.getMonth() !== monthNum || (yearNum && d.getFullYear() !== yearNum))) continue
        }
        const nf = normalizeNF(nfRaw)
        const entry = compMap.get(nf) || { total: 0, icms: 0, ipi: 0, pis: 0, cofins: 0, rows: 0 }
        entry.total  += toNumber(row[compCols.total_sankhya])
        entry.icms   += toNumber(row[compCols.icms])
        entry.ipi    += toNumber(row[compCols.ipi])
        entry.pis    += toNumber(row[compCols.pis])
        entry.cofins += toNumber(row[compCols.cofins])
        entry.rows   += 1
        compMap.set(nf, entry)
      }

      const allNFs = new Set([...fatMap.keys(), ...compMap.keys()])
      const rows = []
      for (const nf of allNFs) {
        const f = fatMap.get(nf)
        const c = compMap.get(nf)
        let status = 'ok'
        const fields = {}
        for (const { key } of FIELD_LABELS) {
          const fv = f ? f[key] : null
          const cv = c ? c[key] : null
          const diff = fv !== null && cv !== null ? cv - fv : null
          fields[key] = { fv, cv, diff }
        }
        if (!f) status = 'missing_planilha'
        else if (!c) status = 'missing_sankhya'
        else {
          const anyDiverge = FIELD_LABELS.some(({ key }) => Math.abs(fields[key].diff) > tolerance)
          status = anyDiverge ? 'divergent' : 'ok'
        }
        rows.push({ nf, status, fields, fatRows: f?.rows || 0, compRows: c?.rows || 0 })
      }

      rows.sort((a, b) => {
        const order = { divergent: 0, missing_planilha: 1, missing_sankhya: 2, ok: 3 }
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
        return String(a.nf).localeCompare(String(b.nf), 'pt-BR', { numeric: true })
      })

      const summary = {
        total: rows.length,
        ok: rows.filter(r => r.status === 'ok').length,
        divergent: rows.filter(r => r.status === 'divergent').length,
        missing_planilha: rows.filter(r => r.status === 'missing_planilha').length,
        missing_sankhya: rows.filter(r => r.status === 'missing_sankhya').length,
      }

      setResult({ rows, summary, monthLabel: fatSheetChoice })
    } catch (err) {
      setError(err.message || 'Ocorreu um erro ao processar as planilhas.')
      setResult(null)
    }
  }

  const filteredRows = useMemo(() => {
    if (!result) return []
    if (filter === 'all') return result.rows
    return result.rows.filter(r => r.status === filter)
  }, [result, filter])

  const exportXlsx = () => {
    if (!result) return
    const header = [
      'Nota Fiscal', 'Status',
      'Total Planilha', 'Total Sankhya', 'Dif. Total',
      'ICMS Planilha', 'ICMS Sankhya', 'Dif. ICMS',
      'IPI Planilha', 'IPI Sankhya', 'Dif. IPI',
      'PIS Planilha', 'PIS Sankhya', 'Dif. PIS',
      'COFINS Planilha', 'COFINS Sankhya', 'Dif. COFINS',
    ]
    const statusLabel = {
      ok: 'OK', divergent: 'DIVERGENTE',
      missing_planilha: 'SÓ NO SANKHYA (falta na planilha)',
      missing_sankhya: 'SÓ NA PLANILHA (falta no Sankhya)',
    }
    const data = result.rows.map(r => {
      const line = [r.nf, statusLabel[r.status]]
      for (const { key } of FIELD_LABELS) {
        const f = r.fields[key]
        line.push(f.fv ?? '', f.cv ?? '', f.diff ?? '')
      }
      return line
    })
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    ws['!cols'] = header.map(() => ({ wch: 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Conferencia')
    XLSX.writeFile(wb, `conferencia_${norm(result.monthLabel).replace(/\s+/g, '_')}.xlsx`)
  }

  const reset = () => {
    setFatBook(null); setFatSheetNames([]); setFatSheetChoice('')
    setCompBook(null); setCompSheetNames([]); setCompSheetChoice('')
    setResult(null); setError(''); setFilter('all')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <p style={{ margin: 0, fontSize: 13, color: '#6B7280', maxWidth: 640, lineHeight: 1.6 }}>
        Envie a planilha mensal de faturamento e a exportação do Sankhya ("new sheet"). O portal cruza
        cada nota fiscal e aponta o que bate e o que diverge — sem precisar montar a aba comparativo à mão todo mês.
      </p>

      {/* Upload dos dois arquivos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Panel title="1. Planilha de faturamento">
          <label style={{
            display: 'block', cursor: 'pointer', textAlign: 'center', padding: '20px 16px',
            border: '1.5px dashed #D1D5DB', borderRadius: 8, background: '#F9FAFB',
          }}>
            <UploadCloud size={22} color="#9CA3AF" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
              {fatBook ? 'Trocar arquivo' : 'Escolher arquivo .xlsx'}
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={onFatUpload} style={{ display: 'none' }} />
          </label>
          {loadingFat && <div style={{ fontSize: 12, marginTop: 8, color: '#9CA3AF' }}>Lendo arquivo…</div>}
          {fatSheetNames.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 5 }}>Aba do mês</label>
              <select value={fatSheetChoice} onChange={e => setFatSheetChoice(e.target.value)} style={{
                width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '8px 10px',
                border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
              }}>
                {fatSheetNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </Panel>

        <Panel title="2. Comparativo (Sankhya)">
          <label style={{
            display: 'block', cursor: 'pointer', textAlign: 'center', padding: '20px 16px',
            border: '1.5px dashed #D1D5DB', borderRadius: 8, background: '#F9FAFB',
          }}>
            <UploadCloud size={22} color="#9CA3AF" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
              {compBook ? 'Trocar arquivo' : 'Escolher arquivo .xlsx'}
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={onCompUpload} style={{ display: 'none' }} />
          </label>
          {loadingComp && <div style={{ fontSize: 12, marginTop: 8, color: '#9CA3AF' }}>Lendo arquivo…</div>}
          {compSheetNames.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 5 }}>Aba de origem</label>
              <select value={compSheetChoice} onChange={e => setCompSheetChoice(e.target.value)} style={{
                width: '100%', fontFamily: 'inherit', fontSize: 13, padding: '8px 10px',
                border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
              }}>
                {compSheetNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </Panel>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, display: 'block', marginBottom: 5 }}>Tolerância (R$)</label>
          <input type="number" step="0.01" min="0" value={tolerance}
            onChange={e => setTolerance(parseFloat(e.target.value) || 0)}
            style={{
              width: 90, fontFamily: 'inherit', fontSize: 13, padding: '7px 10px',
              border: '1px solid #E5E7EB', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
            }} />
        </div>
        <Btn primary onClick={compute} disabled={!canCompute}>
          <FileSpreadsheet size={15} /> Comparar
        </Btn>
        {result && (
          <>
            <Btn onClick={exportXlsx}><Download size={14} /> Baixar .xlsx</Btn>
            <Btn onClick={reset}><RotateCcw size={13} /> Recomeçar</Btn>
          </>
        )}
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', padding: '12px 14px', borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Resumo / filtros */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'all',               label: 'Todas',            count: result.summary.total,             cor: '#101828' },
              { key: 'ok',                 label: 'OK',               count: result.summary.ok,                cor: '#12805C' },
              { key: 'divergent',          label: 'Divergentes',      count: result.summary.divergent,         cor: '#B54708' },
              { key: 'missing_planilha',   label: 'Só no Sankhya',    count: result.summary.missing_planilha,  cor: '#B42318' },
              { key: 'missing_sankhya',    label: 'Só na planilha',   count: result.summary.missing_sankhya,   cor: '#B42318' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '7px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: filter === f.key ? 700 : 500,
                border: `1px solid ${filter === f.key ? f.cor : '#E5E7EB'}`,
                background: filter === f.key ? f.cor : '#fff',
                color: filter === f.key ? '#fff' : f.cor,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Tabela */}
          <Panel title={`${filteredRows.length} de ${result.summary.total} notas`}>
            <div style={{ maxHeight: 560, overflowY: 'auto', overflowX: 'auto', margin: '0 -18px -16px', borderTop: '1px solid #F3F4F6' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={THEAD}>NF</th>
                    <th style={THEAD}>Status</th>
                    {FIELD_LABELS.map(f => (
                      <React.Fragment key={f.key}>
                        <th style={{ ...THEAD, textAlign: 'right' }}>{f.label} planilha</th>
                        <th style={{ ...THEAD, textAlign: 'right' }}>{f.label} Sankhya</th>
                        <th style={{ ...THEAD, textAlign: 'right' }}>Dif. {f.label}</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={r.nf} style={{ background: r.status === 'ok' ? '#fff' : '#FFFEF7' }}>
                      <td style={{ ...TD, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.nf}</td>
                      <td style={TD}><StatusStamp status={r.status} /></td>
                      {FIELD_LABELS.map(({ key }) => {
                        const f = r.fields[key]
                        const diverge = f.diff !== null && Math.abs(f.diff) > tolerance
                        return (
                          <React.Fragment key={key}>
                            <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.fv !== null ? fmt(f.fv) : '—'}</td>
                            <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.cv !== null ? fmt(f.cv) : '—'}</td>
                            <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                              color: diverge ? '#B42318' : '#9CA3AF', fontWeight: diverge ? 700 : 400 }}>
                              {f.diff !== null ? fmt(f.diff) : '—'}
                            </td>
                          </React.Fragment>
                        )
                      })}
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={2 + FIELD_LABELS.length * 3} style={{ textAlign: 'center', padding: '28px', color: '#9CA3AF' }}>
                      Nenhuma nota nessa categoria.
                    </td></tr>
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

const THEAD = {
  position: 'sticky', top: 0, background: '#F9FAFB', zIndex: 1,
  padding: '9px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
}
const TD = { padding: '8px 12px', borderBottom: '1px solid #F9FAFB' }
