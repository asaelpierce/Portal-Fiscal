import React, { useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setErro(''); setCarregando(true)
    try {
      // 1. Autentica no Supabase Auth
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: email.trim(), password: senha }),
      })
      const auth = await res.json()
      if (!res.ok) throw new Error(auth.error_description || auth.msg || 'E-mail ou senha inválidos')

      // 2. Busca as páginas liberadas para esse e-mail (RLS: só authenticated)
      const resPerm = await fetch(
        `${SUPABASE_URL}/rest/v1/permissoes_usuario?email=eq.${encodeURIComponent(email.trim())}&select=paginas`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${auth.access_token}` } }
      )
      const permData = await resPerm.json()
      const paginas = permData?.[0]?.paginas || []

      if (!paginas.length) {
        throw new Error('Seu usuário não tem nenhuma página liberada. Fale com o administrador.')
      }

      const sessao = {
        email: email.trim(),
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        expira_em: Date.now() + (auth.expires_in || 3600) * 1000,
        paginas,
      }
      localStorage.setItem('kb_sessao', JSON.stringify(sessao))
      onLogin(sessao)
    } catch (err) {
      setErro(err.message || String(err))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F4F6F8', fontFamily: 'inherit',
    }}>
      <form onSubmit={entrar} style={{
        width: 360, background: '#fff', borderRadius: 12, padding: '32px 28px',
        boxShadow: '0 4px 24px rgba(16,24,40,.08)', border: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: '#101828', color: '#fff',
            display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>KB</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Conciliação</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>Fiscal & Financeiro</div>
          </div>
        </div>

        <label style={{ fontSize: 12.5, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>
          E-mail
        </label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
          placeholder="seu.nome@kalenborn.com.br"
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 7,
            fontSize: 14, marginBottom: 16, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 12.5, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 5 }}>
          Senha
        </label>
        <input
          type="password" value={senha} onChange={e => setSenha(e.target.value)} required
          placeholder="••••••••"
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 7,
            fontSize: 14, marginBottom: 20, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        {erro && (
          <div style={{ padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 6, color: '#B42318', fontSize: 12.5, marginBottom: 16 }}>
            {erro}
          </div>
        )}

        <button type="submit" disabled={carregando} style={{
          width: '100%', padding: '11px', background: carregando ? '#9CA3AF' : '#101828', color: '#fff',
          border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600,
          cursor: carregando ? 'default' : 'pointer', fontFamily: 'inherit',
        }}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
