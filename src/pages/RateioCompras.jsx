import React, { useState, useEffect, useRef } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY, sbFetch, brl } from '../config.js'
import { Panel, Btn, Spinner } from '../components/UI.jsx'
import { lerRateioPdf } from '../lib/rateioPdfParser.js'
import { buscarCodigoCentroResultado } from '../lib/rateioCentrosResultado.js'
import { NATUREZAS_POR_TIPO_PADRAO } from '../lib/rateioNaturezas.js'
import ConfigRateio from '../components/ConfigRateio.jsx'

const SYNC_KEY = 'kb2026sync!'

// Mesma Edge Function já usada no DrawerDetalhe (fechamento/conciliação) —
// reaproveitamos aqui pra mostrar os dados do pedido assim que o usuário
// digita o número, sem precisar esperar carregar o PDF. Aceita busca por
// Nro. Único (nunota) OU por Número do documento (numnota) — nunca os dois
// ao mesmo tempo. Não lança erro aqui porque um retorno "não-ok" pode ser
// um caso normal de múltiplos pedidos com o mesmo número de documento, que
// o componente trata separadamente (não é uma falha de rede).
async function buscarDetalhePedido({ nunota, numnota }, signal) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/nota-detalhe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ nunota, numnota, _key: SYNC_KEY }),
    signal,
  })
  return res.json()
}

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

// Tabela genérica pra listar qualquer conjunto de linhas/colunas vindo da
// consulta ao Sankhya (itens, lançamentos, pedidos, CT-e), evitando repetir
// a mesma marcação de tabela quatro vezes.
function TabelaDetalhe({ titulo, colunas, linhas, alinharDireita = [] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>{titulo}</div>
      <div style={{ overflowX:'auto', border:'1px solid #F3F4F6', borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              {colunas.map((h, i) => (
                <th key={h} style={{
                  padding:'7px 10px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB',
                  textAlign: alinharDireita.includes(i) ? 'right' : 'left',
                  fontSize:10, fontWeight:600, color:'#6B7280',
                  textTransform:'uppercase', letterSpacing:'.03em', whiteSpace:'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, i) => (
              <tr key={i} style={{ borderTop:'1px solid #F9FAFB' }}>
                {linha.map((valor, j) => (
                  <td key={j} style={{
                    padding:'6px 10px',
                    textAlign: alinharDireita.includes(j) ? 'right' : 'left',
                    fontVariantNumeric: alinharDireita.includes(j) ? 'tabular-nums' : 'normal',
                    whiteSpace: 'nowrap',
                  }}>{valor ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RateioCompras() {
  // 'nunota' = Nro. Único (sempre exclusivo de um pedido).
  // 'numnota' = Número do documento (pode repetir entre pedidos diferentes,
  // por isso às vezes precisa de uma etapa extra de desambiguação).
  // Configuração editável pela tela (Setor->Centro de Resultado e
  // Tipo->Natureza) — carregada do banco em vez de fixa no código. Os
  // "_PADRAO" só entram em cena se a busca ao banco falhar por algum
  // motivo, pra tela nunca ficar sem nenhum mapeamento.
  const [centrosLista, setCentrosLista] = useState([]) // linhas cruas (id, setor, codigo), pro painel de config
  const [naturezasLista, setNaturezasLista] = useState([]) // linhas cruas (id, tipo, codnat)
  const [mapaCentros, setMapaCentros] = useState(null) // {setor: codigo} — null enquanto carrega
  const [naturezasPorTipo, setNaturezasPorTipo] = useState(NATUREZAS_POR_TIPO_PADRAO)
  const [mostrarConfig, setMostrarConfig] = useState(false)

  async function carregarConfigRateio() {
    try {
      const [centros, naturezas] = await Promise.all([
        sbFetch('rateio_centros_resultado?select=*&order=setor.asc'),
        sbFetch('rateio_naturezas?select=*&order=criado_em.asc'),
      ])
      setCentrosLista(centros || [])
      setNaturezasLista(naturezas || [])
      setMapaCentros(Object.fromEntries((centros || []).map(c => [c.setor, c.codigo])))
      if (naturezas?.length) {
        setNaturezasPorTipo(Object.fromEntries(naturezas.map(n => [n.tipo, n.codnat])))
      }
    } catch {
      // Sem internet/erro pontual — a tela continua funcionando com os
      // valores padrão fixos (NATUREZAS_POR_TIPO_PADRAO / mapa interno de
      // rateioCentrosResultado.js), só não reflete edições feitas na
      // configuração até a próxima tentativa de carregar.
    }
  }

  useEffect(() => { carregarConfigRateio() }, [])

  const [modoBusca, setModoBusca] = useState('nunota')
  const [entradaPedido, setEntradaPedido] = useState('')
  // Nro. Único já confirmado/resolvido — é sempre esse valor que vai pro
  // Sankhya na hora de confirmar o rateio, nunca o texto digitado cru
  // quando o modo de busca é por número de documento.
  const [nunotaResolvido, setNunotaResolvido] = useState('')
  const [opcoesMultiplas, setOpcoesMultiplas] = useState(null)

  const [tipoPadrao, setTipoPadrao] = useState(Object.keys(NATUREZAS_POR_TIPO_PADRAO)[0])
  const [linhas, setLinhas] = useState([])
  const [carregandoPdf, setCarregandoPdf] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erroLeitura, setErroLeitura] = useState(null)
  const [nomeArquivo, setNomeArquivo] = useState('')

  // Se a lista de tipos mudar (configuração editada) e o tipo selecionado
  // não existir mais, cai pro primeiro disponível em vez de ficar "preso"
  // num tipo que já foi excluído.
  useEffect(() => {
    if (!Object.keys(naturezasPorTipo).includes(tipoPadrao)) {
      setTipoPadrao(Object.keys(naturezasPorTipo)[0] ?? '')
    }
  }, [naturezasPorTipo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detalhes do pedido, buscados automaticamente enquanto o usuário digita
  // (com debounce, pra não disparar uma consulta a cada tecla).
  const [detalhePedido, setDetalhePedido] = useState(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [erroDetalhe, setErroDetalhe] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    const valor = entradaPedido.trim()
    setDetalhePedido(null)
    setErroDetalhe(null)
    setOpcoesMultiplas(null)
    setNunotaResolvido(modoBusca === 'nunota' && /^\d{3,}$/.test(valor) ? valor : '')

    if (abortRef.current) abortRef.current.abort()

    // Só busca quando parecer um número de verdade (evita disparo com "1",
    // "12" etc. enquanto a pessoa ainda está digitando).
    if (!/^\d{3,}$/.test(valor)) {
      setCarregandoDetalhe(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setCarregandoDetalhe(true)

    const timer = setTimeout(() => {
      const params = modoBusca === 'nunota' ? { nunota: valor } : { numnota: valor }
      buscarDetalhePedido(params, controller.signal)
        .then(dados => {
          if (dados.multiplos) {
            setOpcoesMultiplas(dados.opcoes)
            setCarregandoDetalhe(false)
            return
          }
          if (!dados.ok) {
            setErroDetalhe(dados.erro || 'Pedido não encontrado no Sankhya.')
            setCarregandoDetalhe(false)
            return
          }
          setDetalhePedido(dados)
          setNunotaResolvido(dados.cab?.nunota || (modoBusca === 'nunota' ? valor : ''))
          setCarregandoDetalhe(false)
        })
        .catch(err => {
          if (err.name === 'AbortError') return
          setErroDetalhe(err.message || String(err))
          setCarregandoDetalhe(false)
        })
    }, 500) // espera 500ms sem digitar antes de consultar o Sankhya

    return () => clearTimeout(timer)
  }, [entradaPedido, modoBusca])

  // Quando o número do documento bate com mais de um pedido de compra, a
  // pessoa escolhe qual é o certo aqui — buscamos o detalhe completo já
  // pelo Nro. Único daquela opção (sem ambiguidade).
  async function escolherOpcaoMultipla(opcao) {
    setOpcoesMultiplas(null)
    setErroDetalhe(null)
    setCarregandoDetalhe(true)
    try {
      const dados = await buscarDetalhePedido({ nunota: opcao.nunota })
      if (!dados.ok) {
        setErroDetalhe(dados.erro || 'Erro ao buscar esse pedido.')
        return
      }
      setDetalhePedido(dados)
      setNunotaResolvido(dados.cab?.nunota || opcao.nunota)
    } catch (err) {
      setErroDetalhe(err.message || String(err))
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const codnatPadraoAtual = naturezasPorTipo[tipoPadrao] ?? ''
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
        codcencus: buscarCodigoCentroResultado(r.setor, mapaCentros) ?? '',
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
    const novoCodigo = naturezasPorTipo[novoTipo] ?? ''
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

  // Remove uma linha que o PDF trouxe errada (duplicada, de mais, etc.) —
  // não mexe no arquivo original, só na lista que vai ser conferida/enviada.
  function removerLinha(indice) {
    setLinhas(atuais => atuais.filter((_, i) => i !== indice))
  }

  async function confirmarRateio() {
    if (!nunotaResolvido) {
      setResultado({
        ok: false,
        erro: modoBusca === 'nunota'
          ? 'Informe o Nro. Único do pedido.'
          : 'Informe o Número do documento e aguarde localizar o pedido (ou escolha uma opção, se houver mais de um) antes de confirmar.',
      })
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
      const dados = await confirmarRateioNoSankhya({ nunota: nunotaResolvido, codnatPadrao: codnatPadraoAtual, linhas })
      setResultado(dados)
    } catch (err) {
      setResultado({ ok: false, erro: err.message || String(err) })
    } finally {
      setEnviando(false)
    }
  }

  function limparTudo() {
    setEntradaPedido(''); setNunotaResolvido(''); setOpcoesMultiplas(null)
    setLinhas([]); setResultado(null); setErroLeitura(null); setNomeArquivo('')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth: 900 }}>

      <Panel
        title="Dados do pedido"
        action={<Btn small onClick={() => setMostrarConfig(true)}>⚙ Configurações</Btn>}
      >
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={{ display:'block', fontSize:12, color:'#6B7280', fontWeight:600, marginBottom:5 }}>
              Buscar pedido por
            </label>
            <div style={{ display:'flex', gap:14, marginBottom:7 }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, cursor:'pointer' }}>
                <input
                  type="radio" name="modo-busca"
                  checked={modoBusca === 'nunota'}
                  onChange={() => setModoBusca('nunota')}
                />
                Nro. Único
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, cursor:'pointer' }}>
                <input
                  type="radio" name="modo-busca"
                  checked={modoBusca === 'numnota'}
                  onChange={() => setModoBusca('numnota')}
                />
                Número do documento
              </label>
            </div>
            <input
              type="text" value={entradaPedido} onChange={e => setEntradaPedido(e.target.value)}
              placeholder={modoBusca === 'nunota' ? 'ex.: 119685' : 'ex.: 10127'}
              style={{ ...inputStyle, width: 180 }}
            />
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, color:'#6B7280', fontWeight:600, marginBottom:5 }}>
              PDF de rateio
            </label>
            <input type="file" accept="application/pdf" onChange={aoEscolherArquivo} style={{ fontSize:13 }} />
          </div>

          {(entradaPedido || linhas.length > 0) && (
            <Btn small onClick={limparTudo}>✕ Limpar tudo</Btn>
          )}
        </div>

        <div style={{ marginTop:18 }}>
          <label style={{ display:'block', fontSize:12, color:'#6B7280', fontWeight:600, marginBottom:8 }}>
            Tipo padrão do rateio
          </label>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            {Object.keys(naturezasPorTipo).map(tipo => (
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

      {(carregandoDetalhe || erroDetalhe || detalhePedido || opcoesMultiplas) && (
        <Panel title="Detalhes do pedido">
          {carregandoDetalhe && (
            <div style={{ display:'flex', alignItems:'center', gap:10, color:'#9CA3AF', fontSize:13 }}>
              <div style={{ width:16, height:16, border:'2.5px solid #E5E7EB', borderTopColor:'#1D5BBF', borderRadius:'50%', animation:'girar .8s linear infinite' }} />
              Buscando pedido {entradaPedido} no Sankhya…
              <style>{`@keyframes girar{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {erroDetalhe && !carregandoDetalhe && (
            <div style={{ color:'#B42318', fontSize:13 }}>⚠ {erroDetalhe}</div>
          )}

          {opcoesMultiplas && !carregandoDetalhe && (
            <div>
              <div style={{ fontSize:12.5, color:'#B54708', marginBottom:10 }}>
                ⚠ {opcoesMultiplas.length} pedidos de compra usam o documento nº {entradaPedido}. Qual deles é o certo?
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {opcoesMultiplas.map(op => (
                  <button
                    key={op.nunota}
                    onClick={() => escolherOpcaoMultipla(op)}
                    style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'10px 14px', border:'1px solid #E5E7EB', borderRadius:8,
                      background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:13, textAlign:'left',
                    }}
                  >
                    <span><strong>{op.parceiro}</strong> · {op.dtneg} · Nro. Único {op.nunota}</span>
                    <span style={{ fontWeight:700 }}>R$ {brl(op.vlrnota)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {detalhePedido?.cab && !carregandoDetalhe && (
            <>
              {/* Cabeçalho da nota — todos os campos vindos do TGFCAB/TGFPAR/TGFTOP/TGFNAT */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:16 }}>
                {[
                  ['Núm. nota', detalhePedido.cab.numnota],
                  ['Nro. único (NUNOTA)', detalhePedido.cab.nunota],
                  ['Fornecedor', detalhePedido.cab.parceiro],
                  ['CNPJ', detalhePedido.cab.cnpj],
                  ['Data negociação', detalhePedido.cab.dtneg],
                  ['Data entrada/saída', detalhePedido.cab.dtentsai],
                  ['Tipo de operação (TOP)', detalhePedido.cab.descroper],
                  ['Cód. TOP', detalhePedido.cab.codtipoper],
                  ['Natureza', detalhePedido.cab.descrnat],
                  ['Tipo mov.', detalhePedido.cab.tipmov],
                  ['Valor da nota', `R$ ${brl(detalhePedido.cab.vlrnota)}`],
                  ['Chave NF-e', detalhePedido.cab.chavenfe],
                ].map(([label, valor]) => (
                  <div key={label}>
                    <div style={{ fontSize:10.5, color:'#9CA3AF', marginBottom:3, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#101828', wordBreak:'break-all' }}>{valor || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Totais calculados pela mesma consulta usada no drawer de conciliação */}
              {(detalhePedido.totalCusto != null || detalhePedido.totalContab != null) && (
                <div style={{ display:'flex', gap:24, marginBottom:16, padding:'10px 14px', background:'#F9FAFB', borderRadius:8 }}>
                  <div>
                    <div style={{ fontSize:10.5, color:'#9CA3AF' }}>Total custo apurado</div>
                    <div style={{ fontSize:14, fontWeight:700 }}>R$ {brl(detalhePedido.totalCusto)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:10.5, color:'#9CA3AF' }}>Total contábil</div>
                    <div style={{ fontSize:14, fontWeight:700 }}>R$ {brl(detalhePedido.totalContab)}</div>
                  </div>
                </div>
              )}

              {/* Itens completos — todas as colunas trazidas pela consulta (produto, local, qtd, estoque, custos e conta contábil) */}
              {detalhePedido.itens?.length > 0 && (
                <TabelaDetalhe
                  titulo={`Itens do pedido (${detalhePedido.itens.length})`}
                  colunas={['Cód.', 'Produto', 'Local', 'Qtd', 'Estoque', 'Vlr. unit.', 'Custo s/ ICMS', 'Custo c/ ICMS', 'Custo total', 'Conta contábil']}
                  linhas={detalhePedido.itens.map(it => [
                    it.codprod, it.descrprod, it.descrlocal,
                    `${it.qtdneg} ${it.codvol || ''}`, it.atualestoque,
                    `R$ ${brl(it.vlr_unit_nota)}`, `R$ ${brl(it.custo_sem_icms)}`,
                    `R$ ${brl(it.custo_com_icms)}`, `R$ ${brl(it.custo_total)}`,
                    it.loc_codctactb,
                  ])}
                  alinharDireita={[3, 4, 5, 6, 7, 8]}
                />
              )}

              {/* Lançamentos contábeis gerados a partir dessa nota (TCBLAN/TCBINT/TCBPLA) */}
              {detalhePedido.lancamentos?.length > 0 && (
                <TabelaDetalhe
                  titulo={`Lançamentos contábeis (${detalhePedido.lancamentos.length})`}
                  colunas={['Lote', 'Lançamento', 'Conta', 'Descrição da conta', 'D/C', 'Valor', 'Data']}
                  linhas={detalhePedido.lancamentos.map(l => [
                    l.lote, l.lancamento, l.codctactb, l.descrcta, l.tiplanc,
                    `R$ ${brl(l.vlrlanc)}`, l.dtmov,
                  ])}
                  alinharDireita={[5]}
                />
              )}

              {/* Pedidos de compra (OC) vinculados a esta nota, se houver */}
              {detalhePedido.pedidos?.length > 0 && (
                <TabelaDetalhe
                  titulo={`Pedidos de compra vinculados (${detalhePedido.pedidos.length})`}
                  colunas={['Pedido (OC)', 'Nro. único OC', 'Data OC', 'Cód. produto', 'Qtd. atendida']}
                  linhas={detalhePedido.pedidos.map(p => [
                    p.pedido_oc, p.nunota_oc, p.data_oc, p.codprod, p.qtd_atendida,
                  ])}
                  alinharDireita={[4]}
                />
              )}

              {/* CT-e de frete vinculado a esta nota, se houver */}
              {detalhePedido.ctes?.length > 0 && (
                <TabelaDetalhe
                  titulo={`CT-e de frete vinculado (${detalhePedido.ctes.length})`}
                  colunas={['Núm. CT-e', 'Transportadora', 'Data', 'Vlr. total frete', 'Vlr. rateado nesta nota']}
                  linhas={detalhePedido.ctes.map(c => [
                    c.num_cte, c.transportadora, c.data_cte,
                    `R$ ${brl(c.vlr_total_frete)}`, `R$ ${brl(c.vlr_rateado_total)}`,
                  ])}
                  alinharDireita={[3, 4]}
                />
              )}
            </>
          )}
        </Panel>
      )}

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
                    <th key={h || 'acoes'} style={{
                      padding:'9px 14px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB',
                      textAlign: i===1 ? 'right' : i>=2 && i<4 ? 'center' : i===4 ? 'center' : 'left',
                      fontSize:10.5, fontWeight:600, color:'#6B7280',
                      textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap',
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
                    <td style={{ padding:'6px 14px', textAlign:'center' }}>
                      <button
                        onClick={() => removerLinha(i)}
                        title="Remover esta linha do rateio"
                        style={{
                          border:'none', background:'none', cursor:'pointer',
                          color:'#B42318', fontSize:16, lineHeight:1, padding:4,
                        }}
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

          {detalhePedido?.cab?.vlrnota != null && (() => {
            const diferenca = total - detalhePedido.cab.vlrnota
            const bate = Math.abs(diferenca) < 0.01
            return (
              <div style={{
                display:'flex', gap:24, marginTop:14, padding:'10px 14px', borderRadius:8,
                background: bate ? '#F0FDF4' : '#FEF2F2', border:`1px solid ${bate ? '#BBF7D0' : '#FECACA'}`,
                fontSize:12.5,
              }}>
                <div><span style={{ color:'#6B7280' }}>Total da tabela: </span><strong>R$ {brl(total)}</strong></div>
                <div><span style={{ color:'#6B7280' }}>Valor da nota: </span><strong>R$ {brl(detalhePedido.cab.vlrnota)}</strong></div>
                <div style={{ color: bate ? '#166534' : '#B42318', fontWeight:700 }}>
                  {bate ? '✓ Bate certinho' : `⚠ Diferença de R$ ${brl(Math.abs(diferenca))} — ${diferenca > 0 ? 'sobrou linha (o PDF trouxe a mais)' : 'falta linha'}`}
                </div>
              </div>
            )
          })()}

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

      {mostrarConfig && (
        <ConfigRateio
          centros={centrosLista}
          naturezas={naturezasLista}
          onFechar={() => setMostrarConfig(false)}
          onMudou={carregarConfigRateio}
        />
      )}
    </div>
  )
}
