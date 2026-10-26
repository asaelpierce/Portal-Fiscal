import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js'

// ============================================================================
// Matéria-prima em orçamento
//
// Substitui a automação de desktop que achava os botões do Sankhya por
// reconhecimento de imagem e clicava neles. Aquela para se a tela muda, se a
// resolução é outra ou se alguém mexe no mouse — e prende a máquina.
//
// REGRA DO SANKHYA: ou o item tem produto cadastrado, ou tem descrição
// genérica. Nunca os dois. Linha com código vira produto; linha só com nome
// vira genérica.
// ============================================================================

const PAPEL = '#FBFAF8', TINTA = '#1A1A18', TRACO = '#E4E1DC', SUAVE = '#6E6A64'
const VERDE = '#12805C', VERM = '#B42318', AMBAR = '#B45309', AZUL = '#1F60A8'

const GRUPOS = [
  { cod: 'DM', nome: 'Direct Material Cost' },
  { cod: 'PC', nome: 'Packaging Cost' },
  { cod: 'CF', nome: 'Costs of Freight' },
  { cod: 'DL', nome: 'Direct Labour Cost' },
]

const brl = (v) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Custo unitário pode passar de duas casas: a base tem 6299,2125 e
// 50,369984. Arredondar para duas apagaria a precisão que o Sankhya
// guarda, e o total sairia diferente do dele.
const num = (v) => {
  const n = Number(v ?? 0)
  if (!isFinite(n)) return '0,00'
  const casas = (String(v ?? '').split('.')[1] || '').length
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.max(2, Math.min(casas, 6)),
  })
}
const dh = (v) => v ? new Date(v).toLocaleString('pt-BR',
  { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// Lê o que foi colado da planilha. Aceita cabeçalho pelo NOME das colunas,
// como o programa antigo fazia — assim a ordem não importa.
const ALIAS = {
  codigo: 'codigo', cod: 'codigo',
  item: 'item', descricao: 'item', produto: 'item', material: 'item',
  precounidade: 'valor', valorunitario: 'valor', custounit: 'valor',
  custounitario: 'valor', valor: 'valor', preco: 'valor',
  quantidade: 'qtd', qtd: 'qtd', qtde: 'qtd',
  unidade: 'unidade', un: 'unidade',
  grupo: 'grupo', grupomateriaprima: 'grupo', grupodemateriaprima: 'grupo',
  // A planilha que a engenharia preenche chama a coluna do grupo de
  // 'descrição de matéria prima' e põe o ÍNDICE (1 a 4), não o nome.
  descricaodemateriaprima: 'grupo', descricaomateriaprima: 'grupo',
  descrmateriaprima: 'grupo', materiaprima: 'grupo',
}
const normalizar = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

const numero = (s) => {
  const t = String(s ?? '').trim().replace(/[R$\s]/g, '')
  if (!t) return 0
  // vírgula decimal quando existe; senão o ponto já é o decimal
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(limpo)
  return isFinite(n) ? n : 0
}

// O grupo chega de três jeitos: o código (DM), o nome inteiro
// (Direct Material Cost) ou o índice 1 a 4, que é como a planilha da
// engenharia preenche.
function resolverGrupo(valor) {
  const t = String(valor ?? '').trim()
  if (!t) return 'DM'
  if (/^[1-4]$/.test(t)) return GRUPOS[Number(t) - 1].cod
  const porCod = GRUPOS.find(g => g.cod === t.toUpperCase())
  if (porCod) return porCod.cod
  const porNome = GRUPOS.find(g => normalizar(g.nome) === normalizar(t))
  return porNome ? porNome.cod : 'DM'
}

function lerColado(texto) {
  const linhas = String(texto || '').split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim())
  if (!linhas.length) return { itens: [], cabecalho: null }

  const partir = (l) => l.includes('\t') ? l.split('\t') : l.split(/ {2,}|;/)
  const primeira = partir(linhas[0]).map(normalizar)
  const reconhecidas = primeira.filter(c => c in ALIAS).length
  const temCabecalho = reconhecidas >= 2

  let mapa = null
  if (temCabecalho) {
    mapa = {}
    primeira.forEach((c, i) => { if (ALIAS[c]) mapa[ALIAS[c]] = i })
  }

  const corpo = temCabecalho ? linhas.slice(1) : linhas
  const itens = corpo.map((l, i) => {
    const c = partir(l).map(x => String(x).trim())
    let codigo, item, valor, qtd, unidade, grupo
    if (mapa) {
      codigo = mapa.codigo != null ? c[mapa.codigo] : ''
      item = mapa.item != null ? c[mapa.item] : ''
      valor = mapa.valor != null ? c[mapa.valor] : '0'
      qtd = mapa.qtd != null ? c[mapa.qtd] : '0'
      unidade = mapa.unidade != null ? c[mapa.unidade] : ''
      grupo = mapa.grupo != null ? c[mapa.grupo] : ''
    } else {
      // Sem cabeçalho: o código é opcional na frente. Linha que começa
      // com a coluna de código VAZIA (tabulação logo no início) também
      // é válida — é o caso do item que não tem cadastro.
      const temCod = /^\d+$/.test(c[0] || '')
      const comecaVazio = c.length > 1 && !c[0]
      codigo = temCod ? c[0] : ''
      const d = (temCod || comecaVazio) ? c.slice(1) : c
      item = d[0] || ''; valor = d[1] || '0'; qtd = d[2] || '0'; unidade = d[3] || ''
    }
    return {
      linha: i + 1,
      codigo: String(codigo || '').trim(),
      item: String(item || '').trim(),
      custo_unit: numero(valor),
      qtd: numero(qtd),
      cod_vol: String(unidade || '').trim().toUpperCase(),
      grupo_mat: resolverGrupo(grupo),
      cod_prod: /^\d+$/.test(String(codigo || '').trim()) ? Number(codigo) : null,
      descr_prod: '', descr_gen: '', resolvido: false, opcoes: [],
    }
  }).filter(x => x.item || x.codigo)

  return { itens, cabecalho: temCabecalho ? primeira : null }
}

export default function OrcamentoMaterial({ sessao }) {
  const [termo, setTermo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [achados, setAchados] = useState([])
  const [orc, setOrc] = useState(null)
  const [jaNoOrc, setJaNoOrc] = useState([])
  const [produtosOrc, setProdutosOrc] = useState([])
  const [seq, setSeq] = useState(null)        // produto escolhido
  const [arrastando, setArrastando] = useState(false)
  const [verColar, setVerColar] = useState(false)
  const [colado, setColado] = useState('')
  const [itens, setItens] = useState([])
  const [resolvendo, setResolvendo] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [verHistorico, setVerHistorico] = useState(false)
  const [historico, setHistorico] = useState([])
  const [lotes, setLotes] = useState([])

  // Arrastar o arquivo evita o copiar-colar, que é onde a pessoa erra:
  // seleciona demais, seleciona de menos, perde o cabeçalho.
  const lerArquivo = async (arq) => {
    if (!arq) return
    const nome = String(arq.name || '').toLowerCase()
    if (nome.endsWith('.csv') || nome.endsWith('.txt') || nome.endsWith('.tsv')) {
      setColado(await arq.text())
      return
    }
    setResultado({ ok: false,
      erro: `Não leio ${nome.split('.').pop()} direto. No Excel, salve como CSV ou selecione as células e cole aqui.` })
  }

  const aoSoltar = (e) => {
    e.preventDefault(); setArrastando(false)
    const arq = e.dataTransfer?.files?.[0]
    if (arq) lerArquivo(arq)
  }

  const chamar = async (corpo) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/sankhya-orcamento-material`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY,
                 Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ ...corpo, usuario: sessao?.email || '' }),
    })
    return r.json()
  }

  const carregarHistorico = async () => {
    try {
      const [h, l] = await Promise.all([
        sbFetch('orcamento_item_lancado?select=*&order=feito_em.desc&limit=300'),
        sbFetch('orcamento_lote?select=*&limit=60'),
      ])
      setHistorico(h || []); setLotes(l || [])
    } catch { /* histórico vazio não impede o resto */ }
  }
  useEffect(() => { carregarHistorico() }, [])

  const buscar = async () => {
    if (termo.trim().length < 2) return
    setBuscando(true); setResultado(null)
    try {
      const d = await chamar({ modo: 'buscar', termo: termo.trim() })
      setAchados(d.achados || [])
      if ((d.achados || []).length === 1) escolher(d.achados[0])
    } catch (e) { setResultado({ ok: false, erro: String(e?.message ?? e) }) }
    setBuscando(false)
  }

  // A matéria-prima entra NUM PRODUTO do orçamento, não no orçamento
  // inteiro. Há orçamento com 267 produtos: gravar no errado seria
  // trabalhoso de desfazer.
  const escolherProduto = async (o, sequencia) => {
    setSeq(sequencia); setJaNoOrc([])
    try {
      const d = await chamar({ modo: 'itens', nureg: (o || orc).nureg, sequencia })
      setJaNoOrc(d.itens || [])
    } catch { /* segue sem a lista */ }
  }

  const escolher = async (o) => {
    setOrc(o); setAchados([]); setJaNoOrc([]); setProdutosOrc([]); setSeq(null)
    try {
      const d = await chamar({ modo: 'produtos_orc', nureg: o.nureg })
      const ps = d.produtos || []
      setProdutosOrc(ps)
      // um produto só: não faz sentido perguntar
      if (ps.length === 1) escolherProduto(o, ps[0].sequencia)
    } catch { /* segue sem a lista */ }
  }

  const interpretar = async () => {
    const { itens: lidos } = lerColado(colado)
    if (!lidos.length) { setResultado({ ok: false, erro: 'Não consegui ler nenhuma linha.' }); return }
    setResultado(null)

    // Nome no campo Item é descrição genérica, ponto. Só quem veio com
    // código precisa ir ao cadastro, e só para pegar a descrição.
    const comCodigo = lidos.filter(x => x.cod_prod)
    if (!comCodigo.length) {
      setItens(lidos.map(x => ({ ...x, descr_gen: x.item, resolvido: true })))
      return
    }

    setItens(lidos)
    setResolvendo(true)
    try {
      const d = await chamar({ modo: 'produtos', nomes: comCodigo.map(x => String(x.cod_prod)) })
      const porCod = new Map((d.produtos || []).map(p => [String(p.nome), p.achados?.[0] || null]))
      setItens(lidos.map(x => {
        if (!x.cod_prod) return { ...x, descr_gen: x.item, resolvido: true }
        const a = porCod.get(String(x.cod_prod))
        return a
          ? { ...x, descr_prod: a.descr_prod, cod_vol: x.cod_vol || a.cod_vol,
              item: '', descr_gen: '', resolvido: true, naoAchado: false }
          : { ...x, cod_prod: null, resolvido: false, naoAchado: true }
      }))
    } catch (e) { setResultado({ ok: false, erro: String(e?.message ?? e) }) }
    setResolvendo(false)
  }

  const LINHA_VAZIA = {
    linha: 0, codigo: '', item: '', custo_unit: 0, qtd: 0, cod_vol: '',
    grupo_mat: 'DM', cod_prod: null, descr_prod: '', descr_gen: '',
    resolvido: false, opcoes: [],
  }

  const adicionarLinha = () =>
    setItens(xs => [...xs, { ...LINHA_VAZIA, linha: xs.length + 1 }])

  // Busca SÓ pelo código, e só para mostrar o nome do produto na tela.
  // Nome digitado no campo Item é descrição genérica por definição: não
  // se procura no cadastro. Tentar adivinhar dava ruído — 'Cola' trazia
  // seis produtos diferentes e 'Chemitac CH110' não trazia nenhum.
  const buscarCodigo = async (i) => {
    const cod = String(itens[i]?.codigo || '').trim()
    if (!/^\d+$/.test(cod)) return
    try {
      const d = await chamar({ modo: 'produtos', nomes: [cod] })
      const achado = d.produtos?.[0]?.achados?.[0]
      setItens(xs => xs.map((y, j) => j !== i ? y : (achado
        ? { ...y, cod_prod: achado.cod_prod, descr_prod: achado.descr_prod,
            item: '', descr_gen: '', cod_vol: y.cod_vol || achado.cod_vol,
            resolvido: true, naoAchado: false }
        : { ...y, cod_prod: null, descr_prod: '', resolvido: false, naoAchado: true })))
    } catch { /* a pessoa vê o campo sem descrição e corrige */ }
  }

  const mudar = (i, campo, valor) =>
    setItens(xs => xs.map((x, j) => {
      if (j !== i) return x
      const y = { ...x, [campo]: valor }
      // digitou nome: é genérico, e limpa qualquer produto que estivesse ali
      if (campo === 'item') {
        y.descr_gen = valor
        if (valor.trim()) { y.cod_prod = null; y.descr_prod = ''; y.codigo = '' }
        y.resolvido = !!valor.trim()
      }
      // limpou o código: volta a ser genérico se houver nome
      if (campo === 'codigo' && !String(valor).trim()) {
        y.cod_prod = null; y.descr_prod = ''; y.naoAchado = false
        y.descr_gen = y.item; y.resolvido = !!y.item.trim()
      }
      return y
    }))



  // a mesma regra que a função valida no servidor, para a pessoa ver antes
  const problema = (x) => {
    const temCod = !!x.cod_prod
    const temGen = !!String(x.descr_gen || '').trim()
    if (temCod && temGen) return 'código e descrição genérica juntos'
    if (!temCod && !temGen) return 'escolha o produto ou marque como genérico'
    if (!(Number(x.qtd) > 0)) return 'quantidade precisa ser maior que zero'
    return null
  }

  const prontos = useMemo(() => itens.filter(x => !problema(x)), [itens])
  const comProblema = useMemo(() => itens.filter(x => problema(x)), [itens])

  const gravar = async () => {
    setConfirmando(false); setGravando(true); setResultado(null)
    try {
      const d = await chamar({
        modo: 'lancar', nureg: orc.nureg, sequencia: seq,
        itens: prontos.map(x => ({
          cod_prod: x.cod_prod || null,
          descr_prod: x.descr_prod || '',
          descr_gen: x.cod_prod ? '' : (x.descr_gen || x.item),
          cod_vol: x.cod_vol || '', grupo_mat: x.grupo_mat || 'DM',
          qtd: x.qtd, custo_unit: x.custo_unit,
        })),
      })
      setResultado(d)
      if (d.ok) {
        setItens([]); setColado('')
        await Promise.all([escolherProduto(orc, seq), carregarHistorico()])
      }
    } catch (e) { setResultado({ ok: false, erro: String(e?.message ?? e) }) }
    setGravando(false)
  }

  const td = { padding: '3px 6px', fontSize: 12, borderBottom: '1px solid #F2F0EC',
               verticalAlign: 'middle' }
  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 500, color: '#9A958E',
               textAlign: 'left', borderBottom: `1px solid ${TRACO}`, whiteSpace: 'nowrap' }
  const inp = { fontFamily: 'inherit', fontSize: 12, padding: '5px 7px',
                border: `1px solid ${TRACO}`, borderRadius: 4, background: '#fff' }

  // Campo de planilha: sem moldura até receber o foco. Uma tabela com
  // trinta caixas desenhadas vira ruído; o que importa é o valor.
  const cel = (extra = {}) => ({
    fontFamily: 'inherit', fontSize: 12.5, color: TINTA,
    padding: '7px 8px', border: '1px solid transparent', borderRadius: 4,
    background: 'transparent', width: '100%', outline: 'none',
    transition: 'background .1s, border-color .1s', ...extra,
  })
  const foco = (e) => { e.target.style.background = '#fff'; e.target.style.borderColor = AZUL }
  const desfoco = (e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent' }

  // Número no campo: cru enquanto se digita, com vírgula quando se sai.
  // Mostrar 0.7186 cortado, com ponto, obriga a pessoa a desconfiar do
  // que o portal entendeu.
  const [editando, setEditando] = useState(null)   // 'i-campo' em edição
  const mostrarNum = (i, campo, valor) =>
    editando === `${i}-${campo}` ? (valor ?? '') : (Number(valor) ? num(valor) : '')

  return (
    <div style={{ background: PAPEL,
                  margin: 'calc(var(--pad-y) * -1) calc(var(--pad-x) * -1) calc(var(--pad-b) * -1)',
                  padding: 'calc(var(--pad-y) + 8px) var(--pad-x) calc(var(--pad-b) - 4px)',
                  minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, color: TINTA }}>
            Matéria-prima em orçamento
          </h2>
          <p style={{ margin: '6px 0 16px', fontSize: 12.5, color: SUAVE, maxWidth: 760, lineHeight: 1.6 }}>
            Busque o orçamento pelo BR ou pelo número único, cole a planilha e confira antes de gravar.
            O lançamento vai direto para o Sankhya.
          </p>
        </div>
        <button onClick={() => setVerHistorico(v => !v)}
          style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '8px 14px',
                   border: `1px solid ${verHistorico ? TINTA : TRACO}`, borderRadius: 6,
                   background: verHistorico ? TINTA : '#fff', color: verHistorico ? PAPEL : SUAVE }}>
          Histórico{lotes.length ? ` (${lotes.length})` : ''}
        </button>
      </div>

      {verHistorico && (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, marginBottom: 20 }}>
          <div style={{ padding: '11px 15px', borderBottom: `1px solid ${TRACO}`,
                        fontSize: 12, color: SUAVE, lineHeight: 1.55 }}>
            Cada envio fica registrado com o orçamento, quem mandou e o que o Sankhya respondeu.
          </div>
          {lotes.length === 0 ? (
            <div style={{ padding: '20px 15px', fontSize: 13, color: SUAVE }}>Nada lançado ainda.</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 440 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead><tr>
                  {['Quando', 'Quem', 'Orçamento', 'Itens', 'Gravados', 'Com erro', 'Valor'].map((h, i) => (
                    <th key={h} style={{ ...th, textAlign: i >= 3 ? 'right' : 'left',
                                         position: 'sticky', top: 0, background: '#fff' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {lotes.map(l => (
                    <tr key={l.lote}>
                      <td style={{ ...td, color: SUAVE, whiteSpace: 'nowrap' }}>{dh(l.quando)}</td>
                      <td style={{ ...td, color: SUAVE }}>{String(l.quem || '').split('@')[0]}</td>
                      <td style={{ ...td, fontWeight: 600, color: TINTA }}>{l.nureg}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{l.itens}</td>
                      <td style={{ ...td, textAlign: 'right', color: VERDE, fontWeight: 600 }}>{l.gravados}</td>
                      <td style={{ ...td, textAlign: 'right', color: l.com_erro ? VERM : SUAVE }}>{l.com_erro}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        R$ {brl(l.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {historico.some(h => h.resultado === 'erro') && (
            <div style={{ padding: '12px 15px', borderTop: `1px solid ${TRACO}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: VERM, marginBottom: 7 }}>
                ITENS RECUSADOS PELO SANKHYA
              </div>
              {historico.filter(h => h.resultado === 'erro').slice(0, 12).map(h => (
                <div key={h.id} style={{ fontSize: 11.5, color: SUAVE, lineHeight: 1.6 }}>
                  <b style={{ color: TINTA }}>{h.descr_prod || h.descr_gen}</b> · orç. {h.nureg} · {h.mensagem}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── busca ─── */}
      <div style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '15px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={termo} onChange={e => setTermo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            placeholder="BR14659 ou nº único 123443"
            style={{ ...inp, fontSize: 13, padding: '8px 11px', width: 260 }} />
          <button onClick={buscar} disabled={buscando || termo.trim().length < 2}
            style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                     cursor: buscando ? 'default' : 'pointer', padding: '8px 16px',
                     border: 'none', borderRadius: 6,
                     background: buscando ? SUAVE : TINTA, color: PAPEL }}>
            {buscando ? 'Buscando…' : 'Buscar orçamento'}
          </button>
          {orc && (
            <button onClick={() => { setOrc(null); setItens([]); setColado(''); setJaNoOrc([]) }}
              style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '7px 12px',
                       border: `1px solid ${TRACO}`, borderRadius: 6, background: '#fff', color: SUAVE }}>
              trocar
            </button>
          )}
        </div>

        {achados.length > 0 && (
          <div style={{ marginTop: 12, border: `1px solid ${TRACO}`, borderRadius: 6, overflow: 'hidden' }}>
            {achados.map(a => (
              <button key={a.nureg} onClick={() => escolher(a)}
                style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px 90px',
                         gap: 12, width: '100%', textAlign: 'left', alignItems: 'center',
                         padding: '10px 13px', border: 'none', borderBottom: '1px solid #F0EEEA',
                         background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: TINTA }}>{a.identificacao}</span>
                <span style={{ fontSize: 12, color: SUAVE, overflow: 'hidden',
                               textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.cliente}</span>
                <span style={{ fontSize: 11.5, color: SUAVE }}>nº {a.nunota || '—'}</span>
                <span style={{ fontSize: 11, color: a.itens_material ? AZUL : SUAVE, textAlign: 'right' }}>
                  {a.itens_material} itens
                </span>
              </button>
            ))}
          </div>
        )}

        {orc && (
          <div style={{ marginTop: 13, padding: '12px 14px', background: '#EAF1FA',
                        border: '1px solid #C9DCF0', borderRadius: 7 }}>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#19477F' }}>{orc.identificacao}</span>
              <span style={{ fontSize: 12.5, color: '#19477F' }}>{orc.cliente}</span>
              <span style={{ fontSize: 11.5, color: '#4A7CB5' }}>
                registro {orc.nureg} · nº único {orc.nunota || '—'}
                {produtosOrc.length > 0 && ` · ${produtosOrc.length} produto(s)`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── escolher o produto do orçamento ─── */}
      {orc && produtosOrc.length > 1 && (
        <div style={{ background: '#fff', border: `1px solid ${seq == null ? AMBAR : TRACO}`,
                      padding: '15px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, color: seq == null ? AMBAR : SUAVE, marginBottom: 10,
                        fontWeight: seq == null ? 600 : 400 }}>
            {seq == null
              ? `Este orçamento tem ${produtosOrc.length} produtos. Escolha em qual a matéria-prima vai entrar.`
              : 'Produto escolhido:'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
            {produtosOrc.map(p => {
              const sel = seq === p.sequencia
              return (
                <button key={p.sequencia} onClick={() => escolherProduto(orc, p.sequencia)}
                  style={{ display: 'grid', gridTemplateColumns: '42px 1fr 90px 110px',
                           gap: 12, alignItems: 'center', textAlign: 'left', width: '100%',
                           padding: '9px 12px', borderRadius: 6, cursor: 'pointer',
                           fontFamily: 'inherit',
                           border: `1px solid ${sel ? VERDE : TRACO}`,
                           background: sel ? '#E9F7F1' : '#fff' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: sel ? VERDE : SUAVE }}>
                    {p.sequencia}
                  </span>
                  <span style={{ fontSize: 12.5, color: TINTA, overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.descr_prod}
                  </span>
                  <span style={{ fontSize: 11.5, color: SUAVE, textAlign: 'right',
                                 fontVariantNumeric: 'tabular-nums' }}>
                    {p.quantidade} {p.cod_vol}
                  </span>
                  <span style={{ fontSize: 11, color: p.materiais ? AZUL : SUAVE, textAlign: 'right' }}>
                    {p.materiais} material(is)
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── colar ou arrastar ─── */}
      {orc && seq != null && (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, padding: '15px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={adicionarLinha}
              style={{ fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                       padding: '10px 18px', border: 'none', borderRadius: 7,
                       background: TINTA, color: PAPEL }}>
              Adicionar item
            </button>
            <button onClick={() => setVerColar(v => !v)}
              style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
                       padding: '10px 14px', border: `1px solid ${TRACO}`, borderRadius: 7,
                       background: '#fff', color: SUAVE }}>
              {verColar ? 'fechar' : 'colar da planilha'}
            </button>
          </div>

          {verColar && <>
          <div style={{ fontSize: 11.5, color: SUAVE, margin: '13px 0 8px', lineHeight: 1.6 }}>
            Copie as células do Excel e cole aqui, ou arraste um arquivo CSV.
            Reconhece as colunas <i>Item, Preço/unidade, Unidade, Quantidade</i> e
            <i> descrição de matéria prima</i> pelo nome, em qualquer ordem.
          </div>
          <div onDragOver={e => { e.preventDefault(); setArrastando(true) }}
               onDragLeave={() => setArrastando(false)}
               onDrop={aoSoltar}
               style={{ position: 'relative', border: `2px dashed ${arrastando ? VERDE : TRACO}`,
                        borderRadius: 8, background: arrastando ? '#E9F7F1' : '#FBFAF8',
                        transition: 'all .12s' }}>
            <textarea value={colado} onChange={e => setColado(e.target.value)}
              rows={7}
              placeholder={'Cole aqui, ou arraste um arquivo CSV\n\nItem\tQuantidade\tPreço/unidade\tUnidade\nCHEMITAC 26N\t3\t12,50\tLT\nPEÇA SOB MEDIDA\t2\t1.250,00\tUN'}
              style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: 12,
                       padding: 12, border: 'none', borderRadius: 7, background: 'transparent',
                       resize: 'vertical', outline: 'none', color: TINTA }} />
            {arrastando && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 14, fontWeight: 600, color: VERDE,
                            background: 'rgba(233,247,241,.92)', borderRadius: 7, pointerEvents: 'none' }}>
                solte o arquivo
              </div>
            )}
          </div>

          <div style={{ marginTop: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
            <label style={{ fontSize: 11.5, color: AZUL, cursor: 'pointer' }}>
              escolher um arquivo
              <input type="file" accept=".csv,.txt,.tsv"
                onChange={e => lerArquivo(e.target.files?.[0])}
                style={{ display: 'none' }} />
            </label>
            <button onClick={interpretar} disabled={resolvendo || !colado.trim()}
              style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                       cursor: resolvendo || !colado.trim() ? 'default' : 'pointer',
                       padding: '7px 14px', border: 'none', borderRadius: 6,
                       background: resolvendo || !colado.trim() ? '#E4E1DC' : TINTA,
                       color: resolvendo || !colado.trim() ? SUAVE : PAPEL }}>
              {resolvendo ? 'procurando…' : 'ler o que foi colado'}
            </button>
          </div>
          </>}

        </div>
      )}

      {resultado && (
        <div style={{ background: resultado.ok ? '#E9F7F1' : '#FDECEA',
                      border: `1px solid ${resultado.ok ? '#B6E3CE' : '#F5C6C0'}`, borderRadius: 8,
                      padding: '12px 15px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.6,
                      color: resultado.ok ? '#0C6349' : '#8A1C14' }}>
          {resultado.ok
            ? `${resultado.gravados} item(ns) gravado(s)${resultado.erros ? `, ${resultado.erros} com erro` : ''}.`
            : `Falhou: ${resultado.erro}`}
          {resultado.detalhe?.filter(d => !d.ok).slice(0, 8).map((d, i) => (
            <div key={i} style={{ fontSize: 11.5, marginTop: 4 }}>{d.descricao}: {d.erro}</div>
          ))}
          {resultado.invalidos?.map((v, i) => (
            <div key={i} style={{ fontSize: 11.5, marginTop: 4 }}>Linha {v.linha}: {v.erro}</div>
          ))}
        </div>
      )}

      {/* ─── conferência ─── */}
      {orc && seq != null && itens.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}`, marginBottom: 16 }}>
          <div style={{ padding: '12px 15px', borderBottom: `1px solid ${TRACO}`,
                        display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: TINTA }}>
              {itens.length} item{itens.length > 1 ? 's' : ''} para lançar
            </span>
            {comProblema.length > 0 && (
              <span style={{ fontSize: 12, color: AMBAR }}>
                {comProblema.length} precisa{comProblema.length > 1 ? 'm' : ''} de atenção
              </span>
            )}
            <span style={{ fontSize: 11.5, color: SUAVE, marginLeft: 'auto' }}>
              Com código, vira produto do cadastro. Só com nome, vira descrição genérica.
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
              <thead><tr>
                {['', 'Código', 'Material', 'Como entra', 'Unid.', 'Grupo', 'Qtd', 'Custo unit.', 'Total', ''].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i >= 6 && i <= 8 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {itens.map((x, i) => {
                  const p = problema(x)
                  return (
                    <tr key={i} style={{ background: p ? '#FDF3E7' : '#fff' }}>
                      <td style={{ ...td, color: SUAVE }}>{x.linha}</td>
                      <td style={{ ...td }}>
                        <input value={x.codigo} onChange={e => mudar(i, 'codigo', e.target.value)}
                          onFocus={foco} onBlur={e => { desfoco(e); buscarCodigo(i) }}
                          placeholder="—"
                          style={cel({ width: 72, textAlign: 'right',
                                       fontVariantNumeric: 'tabular-nums', color: SUAVE })} />
                      </td>
                      <td style={{ ...td, maxWidth: 300 }}>
                        {x.descr_prod ? (
                          <div style={{ color: TINTA }}>{x.descr_prod}</div>
                        ) : (
                          <input value={x.item} onChange={e => mudar(i, 'item', e.target.value)}
                            onFocus={foco} onBlur={desfoco}
                            placeholder="nome do material, se não tiver código"
                            style={cel({ minWidth: 220 })} />
                        )}
                        {p && <div style={{ fontSize: 10.5, color: AMBAR, marginTop: 2 }}>{p}</div>}
                        {x.naoAchado && (
                          <div style={{ fontSize: 10.5, color: VERM, marginTop: 2 }}>
                            código {x.codigo} não existe no cadastro
                          </div>
                        )}
                      </td>
                      <td style={{ ...td }}>
                        {x.cod_prod ? (
                          <span style={{ fontSize: 11, color: VERDE }}>
                            cadastrado
                          </span>
                        ) : x.descr_gen ? (
                          <span style={{ fontSize: 11, color: AZUL }}>
                            texto livre
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: AMBAR }}>falta definir</span>
                        )}
                      </td>
                      <td style={{ ...td }}>
                        <input value={x.cod_vol} onChange={e => mudar(i, 'cod_vol', e.target.value.toUpperCase())}
                          onFocus={foco} onBlur={desfoco} placeholder="—"
                          style={cel({ width: 52, textAlign: 'center' })} /></td>
                      <td style={{ ...td }}>
                        <select value={x.grupo_mat} onChange={e => mudar(i, 'grupo_mat', e.target.value)}
                          onFocus={foco} onBlur={desfoco}
                          style={cel({ width: 146, cursor: 'pointer' })}>
                          {GRUPOS.map(g => <option key={g.cod} value={g.cod}>{g.cod} — {g.nome}</option>)}
                        </select></td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <input value={mostrarNum(i, 'qtd', x.qtd)}
                          onChange={e => mudar(i, 'qtd', numero(e.target.value))}
                          onFocus={e => { foco(e); setEditando(`${i}-qtd`) }}
                          onBlur={e => { desfoco(e); setEditando(null) }}
                          placeholder="0"
                          style={cel({ width: 92, textAlign: 'right',
                                       fontVariantNumeric: 'tabular-nums' })} /></td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <input value={mostrarNum(i, 'custo', x.custo_unit)}
                          onChange={e => mudar(i, 'custo_unit', numero(e.target.value))}
                          onFocus={e => { foco(e); setEditando(`${i}-custo`) }}
                          onBlur={e => { desfoco(e); setEditando(null) }}
                          placeholder="0,00" title="aceita mais de duas casas"
                          style={cel({ width: 96, textAlign: 'right',
                                       fontVariantNumeric: 'tabular-nums' })} /></td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 600,
                                   color: (Number(x.qtd) * Number(x.custo_unit)) > 0 ? TINTA : '#C9C5BE',
                                   fontVariantNumeric: 'tabular-nums' }}>
                        {(Number(x.qtd) * Number(x.custo_unit)) > 0
                          ? brl(Number(x.qtd) * Number(x.custo_unit)) : '—'}</td>
                      <td style={{ ...td }}>
                        <button onClick={() => setItens(xs => xs.filter((_, j) => j !== i))}
                          title="tirar esta linha"
                          style={{ fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', padding: '2px 7px',
                                   border: 'none', background: 'none', color: SUAVE }}>×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 15px', borderTop: `1px solid ${TRACO}`, display: 'flex',
                        gap: 11, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={adicionarLinha}
              style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '7px 13px',
                       border: `1px solid ${TRACO}`, borderRadius: 6, background: '#fff', color: TINTA }}>
              + linha
            </button>
            {!confirmando ? (
              <button onClick={() => setConfirmando(true)} disabled={gravando || !prontos.length}
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                         cursor: gravando || !prontos.length ? 'default' : 'pointer', padding: '9px 18px',
                         border: 'none', borderRadius: 6,
                         background: gravando || !prontos.length ? SUAVE : VERDE, color: '#fff' }}>
                {gravando ? 'Gravando…'
                  : prontos.length === 1 ? 'Lançar 1 item no Sankhya'
                  : `Lançar ${prontos.length} itens no Sankhya`}
              </button>
            ) : (
              <span style={{ display: 'flex', gap: 9, alignItems: 'center', background: '#E9F7F1',
                             padding: '8px 13px', borderRadius: 6 }}>
                <span style={{ fontSize: 12.5, color: '#0C6349' }}>
                  Gravar {prontos.length} item(ns) em {orc.identificacao}
                  {produtosOrc.length > 1 && `, produto ${seq}`}?
                </span>
                <button onClick={gravar}
                  style={{ fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                           padding: '6px 14px', border: 'none', borderRadius: 5,
                           background: VERDE, color: '#fff' }}>Sim</button>
                <button onClick={() => setConfirmando(false)}
                  style={{ fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', padding: '6px 9px',
                           border: 'none', background: 'none', color: SUAVE }}>cancelar</button>
              </span>
            )}
            <span style={{ fontSize: 12, color: SUAVE, fontVariantNumeric: 'tabular-nums' }}>
              total R$ {brl(prontos.reduce((s, x) => s + Number(x.qtd) * Number(x.custo_unit), 0))}
            </span>
            {comProblema.length > 0 && (
              <span style={{ fontSize: 12, color: AMBAR }}>
                {comProblema.length} linha(s) ficam de fora até serem resolvidas
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── o que já está no orçamento ─── */}
      {orc && seq != null && jaNoOrc.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${TRACO}` }}>
          <div style={{ padding: '11px 15px', borderBottom: `1px solid ${TRACO}`, fontSize: 11,
                        color: SUAVE, fontWeight: 600 }}>
            JÁ CADASTRADO {produtosOrc.length > 1 ? `NO PRODUTO ${seq}` : 'NESTE ORÇAMENTO'} ({jaNoOrc.length})
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr>
                {['Seq', 'Item', 'Unid.', 'Grupo', 'Qtd', 'Custo unit.', 'Total'].map((h, i) => (
                  <th key={h} style={{ ...th, textAlign: i >= 4 ? 'right' : 'left',
                                       position: 'sticky', top: 0, background: '#fff' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {jaNoOrc.map(it => (
                  <tr key={it.seqmat}>
                    <td style={{ ...td, color: SUAVE }}>{it.seqmat}</td>
                    <td style={{ ...td, color: TINTA }}>
                      {it.descr_prod || it.descr_gen}
                      {!it.cod_prod && <span style={{ fontSize: 10, color: AZUL }}> · genérico</span>}
                    </td>
                    <td style={{ ...td, color: SUAVE }}>{it.cod_vol}</td>
                    <td style={{ ...td, color: SUAVE }}>{it.grupo_mat}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{it.qtd}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(it.custo_unit)}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {num(it.custo_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
