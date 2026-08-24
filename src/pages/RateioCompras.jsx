import React, { useState } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, brl } from '../config.js'
import { Panel, Btn, Spinner } from '../components/UI.jsx'
import { lerRateioPdf } from '../lib/rateioPdfParser.js'
import { buscarCodigoCentroResultado } from '../lib/rateioCentrosResultado.js'
import { NATUREZAS_POR_TIPO } from '../lib/rateioNaturezas.js'

const SYNC_KEY = 'kb2026sync!'

// Chama a Edge Function direto do navegador — mesmo padrão usado em todas
// as outras telas deste app (a chave já fica exposta client-side em vários
// lugares do projeto; não introduzimos aqui um esquema de proxy server-side
// diferente do resto, pra manter consistência com a arquitetura existente).
async function confirmarRateioNoSankhya({ nunota, codnatPadrao, linhas }) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/rateio-compras-confirmar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, 'x-api-key': SYNC_KEY },
    body: JSON.stringify({
      nunota: Number(nunota),
      codnatPadrao,
      linhas: linhas.map(l => ({
        descricao: l.setor,
        valor: l.valor,
        codcencus: l.codcencus,
        codnat: l.codnat,
      })),
    }),
  })
  return res.json()
}

const inputStyle = {
  fontFamily: 'inherit', fontSize: 13, padding: '8px 10px',
  border: '1px solid #E5E7EB', borderRadius: 6, background: '#fff',
}

export default function RateioCompras() {
  const [nunota, setNunota] = useState('')
  const [tipoPadrao, setTipoPadrao] = useState(Object.keys(NATUREZAS_POR_TIPO)[0])
  const [linhas, setLinhas] = useState([])
  const [carregandoPdf, setCarregandoPdf] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erroLeitura, setErroLeitura] = useState(null)
  const [nomeArquivo, setNomeArquivo] = useState('')

  const codnatPadraoAtual = NATUREZAS_POR_TIPO[tipoPadrao] ?? ''
  const total = linhas.reduce((acc, l) => acc + l.valor, 0)
  const semCentroResultado = linhas.filter(l => !l.codcencus)

  async function aoEscolherArquivo(e) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return

    setErroLeitura(null)
    setResultado(null)
    setCarregandoPdf(true)
    setNomeArquivo(arquivo.name)
    try {
      const registros = await lerRateioPdf(arquivo)
      if (registros.length === 0) {
        setErroLeitura('Não encontrei linhas de Setor/Valor nesse PDF.')
        setLinhas([])
        return
      }
      setLinhas(registros.map(r => ({
        setor: r.setor,
        valor: r.valor,
        codcencus: buscarCodigoCentroResultado(r.setor) ?? '',
        codnat: codnatPadraoAtual,
        naturezaManual: false,
      })))
    } catch (err) {
      setErroLeitura(err.message || String(err))
    } finally {
      setCarregandoPdf(false)
    }
  }

  function aoTrocarTipoPadrao(novoTipo) {
    setTipoPadrao(novoTipo)
    const novoCodigo = NATUREZAS_POR_TIPO[novoTipo] ?? ''
    setLinhas(atuais => atuais.map(l => (l.naturezaManual ? l : { ...l, codnat: novoCodigo })))
  }

  function editarCentroResultado(indice, valor) {
    setLinhas(atuais => atuais.map((l, i) => (i === indice ? { ...l, codcencus: valor } : l)))
  }

  function editarNatureza(indice, valor) {
    setLinhas(atuais => atuais.map((l, i) =>
      i === indice ? { ...l, codnat: valor, naturezaManual: true } : l
    ))
  }

  // Remove uma linha que o PDF trouxe errada (ex.: leu uma linha a mais,
  // um subtotal que passou pelo filtro, etc.) — o usuário revisa antes de
  // confirmar e pode tirar qualquer linha que não deveria estar ali.
  function removerLinha(indice) {
    setLinhas(atuais => atuais.filter((_, i) => i !== indice))
  }

  async function confirmarRateio() {
    if (!nunota.trim()) {
      setResultado({ ok: false, erro: 'Informe o Nro. Único do pedido.' })
      return
    }
    if (linhas.length === 0) {
      setResultado({ ok: false, erro: 'Carregue um PDF primeiro.' })
      return
    }
    if (semCentroResultado.length > 0) {
      setResultado({ ok: false, erro: `${semCentroResultado.length} linha(s) sem Centro de Resultado preenchido — complete antes de confirmar.` })
      return
    }

    setEnviando(true)
    setResultado(null)
    try {
      const dados = await confirmarRateioNoSankhya({ nunota, codnatPadrao: codnatPadraoAtual, linhas })
      setResultado(dados)
    } catch (err) {
      setResultado({ ok: false, erro: err.message || String(err) })
    } finally {
      setEnviando(false)
    }
  }

  function limparTudo() {
    setNunota(''); setLinhas([]); setResultado(null); setErroLeitura(null); setNomeArquivo('')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth: 900 }}>

      <Panel title="Dados do pedido">
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={{ display:'block', fontSize:12, color:'#6B7280', fontWeight:600, marginBottom:5 }}>
              Nro. Único do pedido
            </label>
            <input
              type="text" value={nunota} onChange={e => setNunota(e.target.value)}
              placeholder="ex.: 119685" style={{ ...inputStyle, width: 180 }}
            />
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, color:'#6B7280', fontWeight:600, marginBottom:5 }}>
              PDF de rateio
            </label>
            <input type="file" accept="application/pdf" onChange={aoEscolherArquivo} style={{ fontSize:13 }} />
          </div>

          {(nunota || linhas.length > 0) && (
            <Btn small onClick={limparTudo}>✕ Limpar tudo</Btn>
          )}
        </div>

        <div style={{ marginTop:18 }}>
          <label style={{ display:'block', fontSize:12, color:'#6B7280', fontWeight:600, marginBottom:8 }}>
            Tipo padrão do rateio
          </label>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            {Object.keys(NATUREZAS_POR_TIPO).map(tipo => (
              <label key={tipo} style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                <input
                  type="radio" name="tipo-natureza"
                  checked={tipoPadrao === tipo}
                  onChange={() => aoTrocarTipoPadrao(tipo)}
                />
                {tipo}
              </label>
            ))}
          </div>
          <p style={{ fontSize:11.5, color:'#9CA3AF', marginTop:6 }}>
            Aplica a todas as linhas que você não editar manualmente na tabela.
          </p>
        </div>
      </Panel>

      {carregandoPdf && <Spinner />}
      {erroLeitura && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'12px 14px', color:'#B42318', fontSize:13 }}>
          {erroLeitura}
        </div>
      )}

      {linhas.length > 0 && (
        <Panel title={`${nomeArquivo} · ${linhas.length} setor(es)`}>
          <div style={{ overflowX:'auto', margin:'0 -18px', borderTop:'1px solid #F3F4F6' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['Setor','Valor (R$)','Cód.Centro Resultado','Cód.Natureza',''].map((h,i) => (
                    <th key={h||'acao'} style={{
                      padding:'9px 14px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB',
                      textAlign: i===1 ? 'right' : i>=2 && i<4 ? 'center' : i===4 ? 'center' : 'left',
                      fontSize:10.5, fontWeight:600, color:'#6B7280',
                      textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap',
                      width: i===4 ? 36 : undefined,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} style={{ background: l.codcencus ? '#fff' : '#FEF2F2', borderTop:'1px solid #F3F4F6' }}>
                    <td style={{ padding:'8px 14px' }}>{l.setor}</td>
                    <td style={{ padding:'8px 14px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      {brl(l.valor)}
                    </td>
                    <td style={{ padding:'6px 14px', textAlign:'center' }}>
                      <input
                        type="text" value={l.codcencus}
                        onChange={e => editarCentroResultado(i, e.target.value)}
                        placeholder="⚠ preencher"
                        style={{ ...inputStyle, width:110, textAlign:'center', padding:'6px 8px' }}
                      />
                    </td>
                    <td style={{ padding:'6px 14px', textAlign:'center' }}>
                      <input
                        type="text" value={l.codnat}
                        onChange={e => editarNatureza(i, e.target.value)}
                        style={{ ...inputStyle, width:90, textAlign:'center', padding:'6px 8px' }}
                      />
                      {l.naturezaManual && <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:4 }}>✎</span>}
                    </td>
                    <td style={{ padding:'6px 10px', textAlign:'center' }}>
                      <button
                        onClick={() => removerLinha(i)}
                        title="Remover esta linha"
                        style={{
                          background:'none', border:'none', cursor:'pointer',
                          color:'#B42318', fontSize:15, padding:4, lineHeight:1,
                          borderRadius:4,
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#FEE2E2'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:'#F9FAFB', fontWeight:700 }}>
                  <td style={{ padding:'9px 14px', borderTop:'2px solid #E5E7EB' }}>Total</td>
                  <td style={{ padding:'9px 14px', borderTop:'2px solid #E5E7EB', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                    R$ {brl(total)}
                  </td>
                  <td colSpan={3} style={{ borderTop:'2px solid #E5E7EB' }} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
            <div style={{ fontSize:12.5, color: semCentroResultado.length ? '#B42318' : '#6B7280' }}>
              {semCentroResultado.length > 0
                ? `⚠ ${semCentroResultado.length} setor(es) sem Centro de Resultado`
                : '✓ Todos os setores com Centro de Resultado preenchido'}
            </div>
            <Btn primary onClick={confirmarRateio} disabled={enviando}>
              {enviando ? 'Confirmando…' : 'Confirmar rateio no Sankhya'}
            </Btn>
          </div>
        </Panel>
      )}

      {resultado && (
        <div style={{
          borderRadius:8, padding:'14px 16px', fontSize:13,
          background: resultado.ok ? '#F0FDF4' : '#FEF2F2',
          border:`1px solid ${resultado.ok ? '#BBF7D0' : '#FECACA'}`,
          color: resultado.ok ? '#166534' : '#B42318',
        }}>
          {resultado.ok ? (
            <>
              ✅ Rateio confirmado! {resultado.totalLinhasGravadas} linha(s) gravada(s) no Sankhya,
              somando {Number(resultado.somaPercentualGravado || 0).toFixed(4)}% do valor da nota
              (R$ {brl(resultado.valorTotal)}).
            </>
          ) : (
            <>Erro: {resultado.erro ?? resultado.statusMessage}</>
          )}
        </div>
      )}
    </div>
  )
}
