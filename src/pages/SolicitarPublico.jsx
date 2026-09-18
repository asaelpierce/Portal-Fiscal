import React, { useEffect, useMemo, useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch } from '../config.js'

// ============================================================================
// Formulário público de solicitação.
//
// Aberto por link com token, SEM login: quem vai pedir uma automação é o
// pessoal da área, que não tem conta no portal. Exigir cadastro mataria o
// canal antes de ele existir.
//
// O token é conferido contra automacao_config. Não é segredo forte — é o
// suficiente para o link não ser adivinhado, e pode ser trocado a qualquer
// momento para invalidar o anterior.
//
// A estimativa de tempo é o coração do formulário: quem faz o trabalho hoje
// informa quanto ele custa, ANTES de existir automação. É esse número que
// vira o "antes" da medição, em vez de ser reconstruído de memória meses
// depois.
// ============================================================================

const PAPEL = '#FBFAF8', TINTA = '#1A1A18', TRACO = '#E4E1DC', SUAVE = '#6E6A64'
const TERRA = '#B5502A', VERDE = '#12805C'

const campo = {
  width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px',
  border: `1px solid ${TRACO}`, borderRadius: 4, background: '#fff', color: TINTA,
  boxSizing: 'border-box',
}
const rot = { fontSize: 12, color: SUAVE, marginBottom: 5, display: 'block', fontWeight: 600 }
const bloco = { marginBottom: 16 }

// Definido FORA do componente de propósito. Dentro, ele seria recriado a cada
// tecla digitada, e o React desmontaria e remontaria toda a árvore abaixo —
// fazendo o campo perder o foco a cada letra.
function Moldura({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: PAPEL, padding: '40px 20px',
                  fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

export default function SolicitarPublico({ token }) {
  const [fase, setFase] = useState('verificando')   // verificando | formulario | enviando | pronto | invalido
  const [erro, setErro] = useState('')
  const [areas, setAreas] = useState([])
  const [projetos, setProjetos] = useState([])
  const [protocolo, setProtocolo] = useState('')
  const [f, setF] = useState({
    solicitante: '', email: '', area_id: '', setor_texto: '',
    titulo: '', objetivo: '', processo_atual: '', o_que_muda: '',
    min_por_ocorrencia: '', ocorrencias_mes: '', pessoas_envolvidas: '',
    projeto_id: '',
  })

  useEffect(() => {
    (async () => {
      try {
        const cfg = await sbFetch(`automacao_config?select=valor&chave=eq.demanda_token`)
        const esperado = cfg?.[0]?.valor
        if (!esperado || esperado !== token) { setFase('invalido'); return }
        const [a, p] = await Promise.all([
          sbFetch('area?select=id,nome&order=nome.asc'),
          sbFetch('automacao_projetos?select=id,nome_projeto,setor&status=neq.Cancelado&order=nome_projeto.asc'),
        ])
        setAreas(a || []); setProjetos(p || []); setFase('formulario')
      } catch (e) { setErro(e.message); setFase('invalido') }
    })()
  }, [token])

  const horasMes = useMemo(() => {
    const m = Number(f.min_por_ocorrencia) || 0
    const o = Number(f.ocorrencias_mes) || 0
    return (m * o) / 60
  }, [f.min_por_ocorrencia, f.ocorrencias_mes])

  const enviar = async () => {
    if (!f.solicitante.trim() || !f.titulo.trim()) {
      setErro('Preencha ao menos seu nome e o título do pedido.'); return
    }
    setFase('enviando'); setErro('')
    // O protocolo é gerado aqui porque anon não tem permissão de leitura na
    // tabela: sem SELECT, o banco não consegue devolver a linha gravada.
    const agora = new Date()
    const proto = 'SOL-' + String(agora.getFullYear()).slice(2)
      + String(agora.getMonth() + 1).padStart(2, '0') + '-'
      + String(Math.floor(Math.random() * 9000) + 1000)
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/demanda`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          solicitante: f.solicitante.trim(),
          email: f.email.trim() || null,
          area_id: f.area_id || null,
          setor_texto: f.setor_texto.trim() || null,
          titulo: f.titulo.trim(),
          objetivo: f.objetivo.trim() || null,
          processo_atual: f.processo_atual.trim() || null,
          o_que_muda: f.o_que_muda.trim() || null,
          min_por_ocorrencia: f.min_por_ocorrencia ? Number(f.min_por_ocorrencia) : null,
          ocorrencias_mes: f.ocorrencias_mes ? Number(f.ocorrencias_mes) : null,
          pessoas_envolvidas: f.pessoas_envolvidas ? Number(f.pessoas_envolvidas) : null,
          projeto_id: f.projeto_id || null,
          status: 'Nova',
          protocolo: proto,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      setProtocolo(proto)
      setFase('pronto')
    } catch (e) {
      setErro(`Não consegui registrar: ${e.message}`); setFase('formulario')
    }
  }

  if (fase === 'verificando') {
    return <Moldura><div style={{ color: SUAVE, fontSize: 14 }}>Abrindo o formulário…</div></Moldura>
  }

  if (fase === 'invalido') {
    return (
      <Moldura>
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '32px 28px' }}>
          <h1 style={{ margin: 0, fontSize: 20, color: TINTA }}>Link inválido ou expirado</h1>
          <p style={{ fontSize: 14, color: SUAVE, lineHeight: 1.6, marginTop: 10 }}>
            Este link não é mais válido. Peça um novo ao time de Automação.
            {erro && <><br /><span style={{ fontSize: 12 }}>{erro}</span></>}
          </p>
        </div>
      </Moldura>
    )
  }

  if (fase === 'pronto') {
    return (
      <Moldura>
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '36px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 34, color: VERDE, marginBottom: 12 }}>✓</div>
          <h1 style={{ margin: 0, fontSize: 21, color: TINTA }}>Pedido registrado</h1>
          {protocolo && (
            <div style={{ fontSize: 15, color: TERRA, fontWeight: 700, marginTop: 10,
                          fontVariantNumeric: 'tabular-nums' }}>{protocolo}</div>
          )}
          <p style={{ fontSize: 14, color: SUAVE, lineHeight: 1.6, marginTop: 14, maxWidth: 460, marginInline: 'auto' }}>
            Anote o protocolo. Seu pedido entrou na fila e você será procurado se algo precisar
            ser esclarecido.
          </p>
          <button onClick={() => { setProtocolo(''); setFase('formulario')
            setF(v => ({ ...v, titulo: '', objetivo: '', processo_atual: '', o_que_muda: '',
                         min_por_ocorrencia: '', ocorrencias_mes: '', pessoas_envolvidas: '', projeto_id: '' })) }}
            style={{ marginTop: 20, fontFamily: 'inherit', fontSize: 13.5, cursor: 'pointer',
                     padding: '9px 18px', border: `1px solid ${TRACO}`, background: '#fff',
                     color: TINTA, borderRadius: 4 }}>
            Registrar outro pedido
          </button>
        </div>
      </Moldura>
    )
  }

  const enviando = fase === 'enviando'

  return (
    <Moldura>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, color: TERRA, fontWeight: 700, letterSpacing: '.08em',
                      textTransform: 'uppercase', marginBottom: 7 }}>Kalenborn do Brasil</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: TINTA }}>
          Pedir uma automação ou melhoria
        </h1>
        <p style={{ fontSize: 13.5, color: SUAVE, lineHeight: 1.6, marginTop: 8 }}>
          Preencha o que der. Quanto mais claro o problema de hoje, mais rápido dá para avaliar.
          Leva uns três minutos.
        </p>
      </div>

      <div style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '24px 22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, ...bloco }}>
          <div>
            <label style={rot}>Seu nome *</label>
            <input style={campo} value={f.solicitante}
              onChange={e => setF({ ...f, solicitante: e.target.value })} />
          </div>
          <div>
            <label style={rot}>E-mail</label>
            <input style={campo} type="email" value={f.email}
              onChange={e => setF({ ...f, email: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, ...bloco }}>
          <div>
            <label style={rot}>Sua área</label>
            <select style={campo} value={f.area_id}
              onChange={e => setF({ ...f, area_id: e.target.value })}>
              <option value="">— escolha —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={rot}>Setor, se não estiver na lista</label>
            <input style={campo} value={f.setor_texto}
              onChange={e => setF({ ...f, setor_texto: e.target.value })} />
          </div>
        </div>

        <div style={bloco}>
          <label style={rot}>O que você precisa? *</label>
          <input style={campo} value={f.titulo} placeholder="Em uma frase"
            onChange={e => setF({ ...f, titulo: e.target.value })} />
        </div>

        <div style={bloco}>
          <label style={rot}>Como é feito hoje</label>
          <textarea style={{ ...campo, minHeight: 78, resize: 'vertical' }}
            placeholder="Descreva o passo a passo atual, mesmo que pareça óbvio"
            value={f.processo_atual} onChange={e => setF({ ...f, processo_atual: e.target.value })} />
        </div>

        <div style={bloco}>
          <label style={rot}>O que você quer alcançar</label>
          <textarea style={{ ...campo, minHeight: 64, resize: 'vertical' }}
            value={f.objetivo} onChange={e => setF({ ...f, objetivo: e.target.value })} />
        </div>

        <div style={bloco}>
          <label style={rot}>O que muda na sua área se isso funcionar</label>
          <textarea style={{ ...campo, minHeight: 64, resize: 'vertical' }}
            value={f.o_que_muda} onChange={e => setF({ ...f, o_que_muda: e.target.value })} />
        </div>

        <div style={{ background: PAPEL, border: `1px solid ${TRACO}`, padding: '16px 16px 6px',
                      marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: TINTA, fontWeight: 600, marginBottom: 4 }}>
            Quanto tempo isso custa hoje
          </div>
          <div style={{ fontSize: 12, color: SUAVE, lineHeight: 1.55, marginBottom: 14 }}>
            Esta parte é a mais importante. É com ela que se compara depois, para saber se a
            automação valeu. Estimativa aproximada já serve.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={rot}>Minutos por vez</label>
              <input style={campo} type="number" min="0" value={f.min_por_ocorrencia}
                onChange={e => setF({ ...f, min_por_ocorrencia: e.target.value })} />
            </div>
            <div>
              <label style={rot}>Vezes por mês</label>
              <input style={campo} type="number" min="0" value={f.ocorrencias_mes}
                onChange={e => setF({ ...f, ocorrencias_mes: e.target.value })} />
            </div>
            <div>
              <label style={rot}>Pessoas envolvidas</label>
              <input style={campo} type="number" min="0" value={f.pessoas_envolvidas}
                onChange={e => setF({ ...f, pessoas_envolvidas: e.target.value })} />
            </div>
          </div>
          {horasMes > 0 && (
            <div style={{ fontSize: 13, color: VERDE, fontWeight: 600, marginTop: 10, marginBottom: 6 }}>
              Isso dá cerca de {horasMes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} horas por mês.
            </div>
          )}
        </div>

        {projetos.length > 0 && (
          <div style={bloco}>
            <label style={rot}>Tem a ver com algo que já existe?</label>
            <select style={campo} value={f.projeto_id}
              onChange={e => setF({ ...f, projeto_id: e.target.value })}>
              <option value="">— é um pedido novo —</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome_projeto}{p.setor ? ` · ${p.setor}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {erro && (
          <div style={{ fontSize: 13, color: '#B42318', background: '#FDECEA',
                        padding: '10px 12px', marginBottom: 14, borderRadius: 4 }}>{erro}</div>
        )}

        <button onClick={enviar} disabled={enviando} style={{
          width: '100%', fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
          cursor: enviando ? 'default' : 'pointer', padding: '12px 0', border: 'none',
          borderRadius: 4, background: enviando ? SUAVE : TINTA, color: PAPEL,
        }}>{enviando ? 'Registrando…' : 'Enviar pedido'}</button>

        <div style={{ fontSize: 11.5, color: SUAVE, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
          Você receberá um número de protocolo ao enviar.
        </div>
      </div>
    </Moldura>
  )
}
