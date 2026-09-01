import React, { useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

const HDR = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
}

async function inserir(tabela, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
    method: 'POST', headers: { ...HDR, Prefer: 'return=representation' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message || `Erro ao criar (HTTP ${res.status})`)
  return data?.[0]
}
async function atualizarLinha(tabela, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
    method: 'PATCH', headers: HDR, body: JSON.stringify({ ...body, atualizado_em: new Date().toISOString() }),
  })
  if (!res.ok) { const d = await res.json().catch(()=>null); throw new Error(d?.message || `Erro ao salvar (HTTP ${res.status})`) }
}
async function remover(tabela, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, { method: 'DELETE', headers: HDR })
  if (!res.ok) throw new Error(`Erro ao excluir (HTTP ${res.status})`)
}

const thStyle = { padding:'8px 12px', background:'#F9FAFB', textAlign:'left', fontSize:11, fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.03em' }
const tdStyle = { padding:'6px 12px' }
const inputStyle = { fontFamily:'inherit', fontSize:13, padding:'5px 8px', border:'1px solid #E5E7EB', borderRadius:5, width:'100%', boxSizing:'border-box' }
const linkBtn = { border:'none', background:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, color:'#374151', padding:0 }

// Lista editável genérica (usada tanto pra Setor->Centro quanto pra
// Tipo->Natureza) — evita repetir a mesma marcação de tabela duas vezes.
function TabelaEditavel({ titulo, descricao, itens, colChave, colValor, labelChave, labelValor, tabela, onMudou }) {
  const [novoChave, setNovoChave] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [editChave, setEditChave] = useState('')
  const [editValor, setEditValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function adicionar() {
    if (!novoChave.trim() || !novoValor.trim()) return
    setSalvando(true); setErro('')
    try {
      await inserir(tabela, { [colChave]: novoChave.trim(), [colValor]: novoValor.trim() })
      setNovoChave(''); setNovoValor('')
      await onMudou()
    } catch (e) { setErro(e.message || String(e)) } finally { setSalvando(false) }
  }
  function iniciarEdicao(item) {
    setEditandoId(item.id); setEditChave(item[colChave]); setEditValor(item[colValor]); setErro('')
  }
  async function salvarEdicao(id) {
    if (!editChave.trim() || !editValor.trim()) return
    setSalvando(true); setErro('')
    try {
      await atualizarLinha(tabela, id, { [colChave]: editChave.trim(), [colValor]: editValor.trim() })
      setEditandoId(null)
      await onMudou()
    } catch (e) { setErro(e.message || String(e)) } finally { setSalvando(false) }
  }
  async function excluir(id, rotulo) {
    if (!window.confirm(`Remover "${rotulo}"? Isso não muda rateios já enviados ao Sankhya, só os próximos.`)) return
    setSalvando(true); setErro('')
    try {
      await remover(tabela, id)
      await onMudou()
    } catch (e) { setErro(e.message || String(e)) } finally { setSalvando(false) }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{descricao}</div>
      {erro && <div style={{ color: '#B42318', fontSize: 12.5, marginBottom: 8 }}>⚠ {erro}</div>}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>{labelChave}</th>
              <th style={{ ...thStyle, width: 130 }}>{labelValor}</th>
              <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {itens.map(item => (
              <tr key={item.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                {editandoId === item.id ? (
                  <>
                    <td style={tdStyle}><input value={editChave} onChange={e => setEditChave(e.target.value)} style={inputStyle} autoFocus /></td>
                    <td style={tdStyle}><input value={editValor} onChange={e => setEditValor(e.target.value)} style={inputStyle} /></td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button onClick={() => salvarEdicao(item.id)} disabled={salvando} style={{ ...linkBtn, color: '#12805C', fontWeight: 600 }}>salvar</button>
                      {' · '}
                      <button onClick={() => setEditandoId(null)} style={linkBtn}>cancelar</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{item[colChave]}</td>
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{item[colValor]}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button onClick={() => iniciarEdicao(item)} style={linkBtn}>editar</button>
                      {' · '}
                      <button onClick={() => excluir(item.id, item[colChave])} style={{ ...linkBtn, color: '#B42318' }}>excluir</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #F3F4F6', background: '#F9FAFB' }}>
              <td style={tdStyle}>
                <input value={novoChave} onChange={e => setNovoChave(e.target.value)} placeholder={`novo ${labelChave.toLowerCase()}`} style={inputStyle} />
              </td>
              <td style={tdStyle}>
                <input value={novoValor} onChange={e => setNovoValor(e.target.value)} placeholder="código" style={inputStyle} />
              </td>
              <td style={tdStyle}>
                <button
                  onClick={adicionar} disabled={salvando || !novoChave.trim() || !novoValor.trim()}
                  style={{ ...linkBtn, color: '#1D5BBF', fontWeight: 600 }}
                >
                  + adicionar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Painel lateral de configurações do Rateio de Compras — permite ajustar
// os mapeamentos Setor->Centro de Resultado e Tipo->Natureza direto pela
// tela, sem precisar editar o código-fonte do projeto pra isso.
export default function ConfigRateio({ centros, naturezas, onFechar, onMudou }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.4)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: 640, maxWidth: '100%', background: '#fff', height: '100%', overflowY: 'auto', padding: '22px 24px', boxShadow: '-8px 0 24px rgba(16,24,40,.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Configurações do Rateio de Compras</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              Ajuste os centros de resultado e os tipos de rateio por aqui — não precisa mais mexer em código.
            </div>
          </div>
          <button onClick={onFechar} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF', lineHeight: 1 }}>✕</button>
        </div>

        <TabelaEditavel
          titulo="Centro de Resultado por Setor"
          descricao="Usado pra preencher automaticamente o Centro de Resultado de cada linha, com base no nome do setor lido do PDF de rateio."
          itens={centros} colChave="setor" colValor="codigo"
          labelChave="Setor" labelValor="Código"
          tabela="rateio_centros_resultado" onMudou={onMudou}
        />

        <TabelaEditavel
          titulo="Tipos de Rateio (Natureza)"
          descricao="Cada um vira uma opção de 'Tipo padrão do rateio' na tela principal."
          itens={naturezas} colChave="tipo" colValor="codnat"
          labelChave="Tipo" labelValor="Cód. Natureza"
          tabela="rateio_naturezas" onMudou={onMudou}
        />
      </div>
    </div>
  )
}
