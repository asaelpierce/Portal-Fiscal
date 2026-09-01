import React, { useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'
import { Btn } from './UI.jsx'

const HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

async function inserir(tabela, corpo) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify(corpo),
  })
  if (!res.ok) throw new Error((await res.json())?.message || `Erro ao inserir em ${tabela}`)
  return res.json()
}
async function atualizar(tabela, id, corpo) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: JSON.stringify({ ...corpo, atualizado_em: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error((await res.json())?.message || `Erro ao atualizar ${tabela}`)
  return res.json()
}
async function excluir(tabela, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, {
    method: 'DELETE', headers: HEADERS,
  })
  if (!res.ok) throw new Error((await res.json())?.message || `Erro ao excluir de ${tabela}`)
}

// Painel genérico de duas colunas (chave/valor) reaproveitado para
// Centros de Resultado (setor/código) e Naturezas (tipo/codnat)
function SecaoConfig({ titulo, descricao, tabela, campoChave, labelChave, campoValor, labelValor, linhas, onMudou }) {
  const [novaChave, setNovaChave] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [edicao, setEdicao] = useState({ chave: '', valor: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const adicionar = async () => {
    if (!novaChave.trim() || !novoValor.trim()) return
    setSalvando(true); setErro('')
    try {
      await inserir(tabela, { [campoChave]: novaChave.trim(), [campoValor]: novoValor.trim() })
      setNovaChave(''); setNovoValor('')
      await onMudou()
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  const iniciarEdicao = (linha) => {
    setEditandoId(linha.id)
    setEdicao({ chave: linha[campoChave], valor: linha[campoValor] })
  }

  const salvarEdicao = async (id) => {
    if (!edicao.chave.trim() || !edicao.valor.trim()) return
    setSalvando(true); setErro('')
    try {
      await atualizar(tabela, id, { [campoChave]: edicao.chave.trim(), [campoValor]: edicao.valor.trim() })
      setEditandoId(null)
      await onMudou()
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  const remover = async (id) => {
    if (!confirm('Remover este item da configuração?')) return
    setSalvando(true); setErro('')
    try {
      await excluir(tabela, id)
      await onMudou()
    } catch (e) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{titulo}</div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{descricao}</p>

      <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', background: '#F9FAFB', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #E5E7EB' }}>{labelChave}</th>
              <th style={{ padding: '8px 12px', background: '#F9FAFB', textAlign: 'left', fontSize: 10.5, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #E5E7EB' }}>{labelValor}</th>
              <th style={{ padding: '8px 12px', background: '#F9FAFB', width: 90, borderBottom: '1px solid #E5E7EB' }}></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(linha => (
              <tr key={linha.id} style={{ borderTop: '1px solid #F9FAFB' }}>
                {editandoId === linha.id ? (
                  <>
                    <td style={{ padding: '6px 10px' }}>
                      <input value={edicao.chave} onChange={e => setEdicao(s => ({ ...s, chave: e.target.value }))}
                        style={{ width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '5px 7px', border: '1px solid #D1D5DB', borderRadius: 5 }} />
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <input value={edicao.valor} onChange={e => setEdicao(s => ({ ...s, valor: e.target.value }))}
                        style={{ width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '5px 7px', border: '1px solid #D1D5DB', borderRadius: 5 }} />
                    </td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => salvarEdicao(linha.id)} disabled={salvando} title="Salvar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#12805C', marginRight: 6 }}>✓</button>
                      <button onClick={() => setEditandoId(null)} title="Cancelar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '7px 12px' }}>{linha[campoChave]}</td>
                    <td style={{ padding: '7px 12px', fontVariantNumeric: 'tabular-nums' }}>{linha[campoValor]}</td>
                    <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button onClick={() => iniciarEdicao(linha)} title="Editar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1D5BBF', marginRight: 10 }}>✎</button>
                      <button onClick={() => remover(linha.id)} title="Remover" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B42318' }}>🗑</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid #F3F4F6', background: '#F9FAFB' }}>
              <td style={{ padding: '7px 10px' }}>
                <input value={novaChave} onChange={e => setNovaChave(e.target.value)} placeholder={`Novo ${labelChave.toLowerCase()}`}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '5px 7px', border: '1px solid #D1D5DB', borderRadius: 5 }} />
              </td>
              <td style={{ padding: '7px 10px' }}>
                <input value={novoValor} onChange={e => setNovoValor(e.target.value)} placeholder={`Novo ${labelValor.toLowerCase()}`}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 12.5, padding: '5px 7px', border: '1px solid #D1D5DB', borderRadius: 5 }} />
              </td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                <Btn small primary onClick={adicionar} disabled={salvando || !novaChave.trim() || !novoValor.trim()}>+ Add</Btn>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {erro && <div style={{ marginTop: 8, fontSize: 12, color: '#B42318' }}>Erro: {erro}</div>}
    </div>
  )
}

export default function ConfigRateio({ centros, naturezas, onFechar, onMudou }) {
  return (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.4)', zIndex: 50 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(720px, 94vw)', maxHeight: '86vh', overflowY: 'auto',
        background: '#fff', borderRadius: 10, zIndex: 51, boxShadow: '0 20px 60px rgba(16,24,40,.25)',
        padding: '22px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>⚙ Configuração de Rateio</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6B7280' }}>
              Mapeamentos usados para sugerir Centro de Resultado e Natureza automaticamente no rateio de compras.
            </p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6B7280' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <SecaoConfig
          titulo="Centros de Resultado"
          descricao="Mapeia o nome do setor para o código do Centro de Resultado no Sankhya (sem pontos e sem zero à esquerda)."
          tabela="rateio_centros_resultado"
          campoChave="setor" labelChave="Setor"
          campoValor="codigo" labelValor="Código"
          linhas={centros || []}
          onMudou={onMudou}
        />

        <SecaoConfig
          titulo="Naturezas"
          descricao="Mapeia o tipo de despesa/rateio para o código de Natureza (codnat) usado no lançamento no Sankhya."
          tabela="rateio_naturezas"
          campoChave="tipo" labelChave="Tipo"
          campoValor="codnat" labelValor="Cód. Natureza"
          linhas={naturezas || []}
          onMudou={onMudou}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <Btn onClick={onFechar}>Fechar</Btn>
        </div>
      </div>
    </>
  )
}
