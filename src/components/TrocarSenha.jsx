import React, { useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

// Troca a senha do proprio usuario logado, usando o token da sessao.
// Nao passa pelo admin: a pessoa escolhe a senha dela e ninguem mais ve.
export default function TrocarSenha({ sessao, onFechar, onTrocada }) {
  const [nova, setNova] = useState('')
  const [conf, setConf] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    if (nova.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (nova !== conf) { setErro('As duas senhas não são iguais.'); return }
    setSalvando(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${sessao?.access_token}`,
        },
        body: JSON.stringify({ password: nova }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.msg || d.error_description || d.message || 'Não foi possível trocar a senha')
      setOk(true)
      onTrocada?.()
    } catch (err) {
      // Sessao expirada e o motivo mais comum de falhar aqui
      setErro(String(err.message).toLowerCase().includes('jwt')
        ? 'Sua sessão expirou. Saia e entre de novo para trocar a senha.'
        : err.message)
    } finally { setSalvando(false) }
  }

  const inp = {
    width:'100%', fontFamily:'inherit', fontSize:14, padding:'9px 12px',
    border:'1px solid #E5E7EB', borderRadius:6, boxSizing:'border-box', marginTop:4,
  }

  return (
    <>
      <div onClick={onFechar} style={{ position:'fixed', inset:0, background:'rgba(16,24,40,.45)', zIndex:60 }} />
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:'min(400px,94vw)',
        background:'#fff', borderRadius:12, zIndex:61, padding:'26px 24px', boxShadow:'0 20px 60px rgba(16,24,40,.25)' }}>
        {ok ? (
          <>
            <div style={{ fontSize:16, fontWeight:700, color:'#12805C', marginBottom:8 }}>✓ Senha alterada</div>
            <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.6, margin:'0 0 18px' }}>
              Sua nova senha já está valendo. Use ela no próximo login.
            </p>
            <button onClick={onFechar} style={{ width:'100%', padding:'10px', borderRadius:6, border:'none',
              background:'#1D5BBF', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Fechar
            </button>
          </>
        ) : (
          <form onSubmit={salvar}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>Trocar minha senha</div>
            <p style={{ fontSize:12.5, color:'#9CA3AF', margin:'0 0 18px' }}>{sessao?.email}</p>

            {erro && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#B42318',
              borderRadius:6, padding:'9px 12px', fontSize:12.5, marginBottom:14 }}>{erro}</div>}

            <label style={{ fontSize:12, color:'#6B7280', fontWeight:500 }}>Nova senha
              <input type="password" value={nova} onChange={e=>setNova(e.target.value)}
                autoFocus autoComplete="new-password" style={inp} placeholder="mínimo 6 caracteres" />
            </label>
            <div style={{ height:12 }} />
            <label style={{ fontSize:12, color:'#6B7280', fontWeight:500 }}>Repita a nova senha
              <input type="password" value={conf} onChange={e=>setConf(e.target.value)}
                autoComplete="new-password" style={inp} />
            </label>

            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <button type="submit" disabled={salvando || !nova || !conf} style={{
                flex:1, padding:'10px', borderRadius:6, border:'none', fontFamily:'inherit',
                background: (salvando||!nova||!conf) ? '#93B4E3' : '#1D5BBF', color:'#fff',
                fontSize:14, fontWeight:600, cursor:(salvando||!nova||!conf)?'not-allowed':'pointer' }}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
              <button type="button" onClick={onFechar} style={{ padding:'10px 16px', borderRadius:6,
                border:'1px solid #E5E7EB', background:'#fff', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
