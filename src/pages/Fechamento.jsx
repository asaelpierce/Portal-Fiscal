import React, { useEffect, useMemo, useState } from 'react'
import { sbFetch, SUPABASE_URL, SUPABASE_ANON_KEY, brl, int, dBR, classeDe } from '../config.js'
import { Spinner, Btn } from '../components/UI.jsx'
import DrawerDetalhe from '../components/DrawerDetalhe.jsx'

const SYNC_KEY = 'kb2026sync!'

const ACAO_ESTILO = {
  'CONFERE': { cor:'#12805C', bg:'#D1FAE5', icone:'✓' },
  'AUMENTAR CUSTO': { cor:'#1D5BBF', bg:'#DBEAFE', icone:'▲' },
  'DIMINUIR CUSTO': { cor:'#B54708', bg:'#FEF3C7', icone:'▼' },
}
const MESES_BR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// ─── helpers de data ──────────────────────────────────────────────────────────
function isoParaBR(iso) {
  const [y,m,d] = String(iso).slice(0,10).split('-')
  return `${d}/${m}/${y}`
}
function hojeISO() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`
}
function primeiroDiaDoMes(iso) {
  return `${String(iso).slice(0,7)}-01`
}

// Chama o fechamento-sync sob demanda pra uma data que ainda não foi
// sincronizada (o usuário escolheu no seletor de período uma posição que
// não existia previamente em fechamento_saldos).
//
// FIX: pedimos incluir_detalhe:false aqui -- essa busca manual só precisa
// do resumo (rápido) pra mostrar os números da tela; o detalhe histórico
// completo (desde 2022, usado só em auditoria/exportação futura) não é lido
// por nenhuma tela hoje e deixava a busca do usuário lenta à toa. A
// importação automática de 4 em 4h continua calculando o detalhe completo
// normalmente, sem mudança.
async function sincronizarPosicao(dataISO) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fechamento-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, 'x-api-key': SYNC_KEY },
    body: JSON.stringify({ data_posicao: isoParaBR(dataISO), incluir_detalhe: false }),
  })
  const dados = await res.json()
  if (!dados.ok) throw new Error(dados.erro || 'Erro ao sincronizar posição')
  return dados
}

// ─── Card de nota clicável ────────────────────────────────────────────────────
function CardNota({ nota, onNota }) {
  const cls = classeDe(nota.classe_divergencia)
  const dif = Number(nota.diferenca || 0)
  return (
    <button onClick={() => onNota(nota)}
      style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, width:'100%',
        padding:'11px 20px', background:'none', border:'none',
        borderBottom:'1px solid #F3F4F6', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}
      onMouseOver={e => e.currentTarget.style.background = '#F9FAFB'}
      onMouseOut={e => e.currentTarget.style.background = 'none'}
    >
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ fontSize:13, fontWeight:700 }}>NF {nota.nota_fiscal}</span>
          <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 6px', borderRadius:4,
            background:cls.bg, color:cls.cor }}>{cls.icone} {cls.rot}</span>
        </div>
        <div style={{ fontSize:11.5, color:'#6B7280' }}>{nota.descr_top}</div>
        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:1 }}>{dBR(nota.data_entrada_saida)}</div>
        {nota.motivo_calculado && nota.classe_divergencia !== 'OK' && (
          <div style={{ fontSize:11, color:cls.cor, marginTop:2 }}>{nota.motivo_calculado}</div>
        )}
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:2, whiteSpace:'nowrap' }}>Custo / Contábil</div>
        <div style={{ fontSize:11.5, fontVariantNumeric:'tabular-nums', color:'#374151', whiteSpace:'nowrap' }}>
          {brl(nota.saldo_dash)} / {brl(nota.saldo_contabil)}
        </div>
        {Math.abs(dif) > 0.005 && (
          <div style={{ fontSize:13, fontWeight:700, fontVariantNumeric:'tabular-nums',
            color:cls.cor, whiteSpace:'nowrap' }}>
            {dif > 0 ? '+' : ''}R$ {brl(dif)}
          </div>
        )}
        <div style={{ fontSize:10.5, color:'#1D5BBF', marginTop:3 }}>ver detalhes →</div>
      </div>
    </button>
  )
}

// ─── Painel lateral de notas da conta ────────────────────────────────────────
function PainelNotas({ conta, dataFechamento, onClose, onNota }) {
  const [fase, setFase] = useState('carregando')
  const [porMes, setPorMes] = useState([])
  const [mesAberto, setMesAberto] = useState(null)
  const [verOkMes, setVerOkMes] = useState({}) // {mesKey: bool}
  const [aba, setAba] = useState('mes') // 'mes' | 'todos'

  // Mês do fechamento selecionado: '2026-07'
  const mesFechamento = dataFechamento ? dataFechamento.slice(0, 7) : null
  const labelMes = mesFechamento
    ? `${MESES_BR[parseInt(mesFechamento.split('-')[1]) - 1]}/${mesFechamento.split('-')[0]}`
    : 'Mês'

  useEffect(() => {
    if (!conta) return
    setFase('carregando'); setPorMes([])
    // FIX: antes agrupava pelo mês do FIM do período de cada importação
    // (imp.periodo_fim) — isso funcionava enquanto as importações eram
    // sempre um mês calendário fechado, mas agora que existe a janela
    // móvel automática (últimos 7 dias, que frequentemente atravessa a
    // virada do mês) uma nota de 31/08 podia entrar numa importação cujo
    // período vai até 01/09, e era rotulada inteira como "Set/2026" mesmo
    // sendo uma nota de agosto. Agora agrupamos pela data REAL de cada
    // nota (data_entrada_saida/data_negociacao), não pelo período da
    // importação que trouxe o dado.
    sbFetch(`lancamentos_conciliacao?conta_contabil=eq.${encodeURIComponent(conta)}&select=*&order=data_entrada_saida.desc`)
      .then(lancs => {
        const porMesMap = new Map()
        ;(lancs || []).forEach(n => {
          const dataRef = n.data_entrada_saida || n.data_negociacao
          if (!dataRef) return
          const mesKey = String(dataRef).slice(0, 7) // 'YYYY-MM'
          if (!porMesMap.has(mesKey)) porMesMap.set(mesKey, [])
          porMesMap.get(mesKey).push(n)
        })

        const grupos = [...porMesMap.entries()]
          .sort((a, b) => b[0].localeCompare(a[0])) // mês mais recente primeiro
          .map(([mesKey, notas]) => {
            const [y, m] = mesKey.split('-')
            const comDif = notas.filter(n => n.classe_divergencia !== 'OK')
            // Separa: problema real (investigar/critico) vs ajuste de custo medio (esperado, ja no saldo)
            const investigar = comDif.filter(n => ['INVESTIGAR','CRITICO'].includes(n.classe_divergencia))
            const ajuste = comDif.filter(n => n.classe_divergencia === 'AJUSTE_CUSTO')
            return {
              mesKey,
              label: `${MESES_BR[parseInt(m) - 1]}/${y}`,
              notas,
              comDif,
              investigar,
              ajuste,
              somaDif: comDif.reduce((s, n) => s + Number(n.diferenca || 0), 0),
              somaInvestigar: investigar.reduce((s, n) => s + Number(n.diferenca || 0), 0),
              somaAjuste: ajuste.reduce((s, n) => s + Number(n.diferenca || 0), 0),
            }
          })

        // Abre automaticamente o mês mais recente com diferença
        const primeiro = grupos.find(g => g.comDif.length > 0)
        if (primeiro) setMesAberto(primeiro.mesKey)
        setPorMes(grupos)
        setFase('pronto')
      })
      .catch(() => setFase('erro'))
  }, [conta])

  const totalDif = porMes.reduce((s, g) => s + g.somaDif, 0)
  const mesSelecionado = porMes.find(g => g.mesKey === mesFechamento)
  const qtdInvestigarMes = mesSelecionado?.investigar.length || 0
  const qtdInvestigarTotal = porMes.reduce((s, g) => s + g.investigar.length, 0)

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'min(560px,92vw)',
      background:'#fff', borderLeft:'1px solid #E5E7EB', zIndex:35,
      display:'flex', flexDirection:'column',
      boxShadow:'-6px 0 30px rgba(16,24,40,.12)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #F3F4F6', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:3 }}>NOTAS DA CONTA</div>
            <div style={{ fontSize:18, fontWeight:800 }}>{conta}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:6, color:'#6B7280' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Diferença acumulada */}
        {fase === 'pronto' && (
          <div style={{ padding:'9px 12px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, marginBottom:12 }}>
            <div style={{ fontSize:10.5, color:'#92400E', fontWeight:600, marginBottom:2 }}>
              Diferença acumulada (todos os meses)
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:'#B54708', fontVariantNumeric:'tabular-nums' }}>
              {totalDif > 0 ? '+' : ''}R$ {brl(totalDif)}
            </div>
          </div>
        )}

        {/* Abas */}
        {fase === 'pronto' && (
          <div style={{ display:'flex', borderBottom:'1px solid #E5E7EB' }}>
            {[
              { id:'mes', label: labelMes, qtd: qtdInvestigarMes },
              { id:'todos', label: 'Todos os meses', qtd: qtdInvestigarTotal },
            ].map(a => (
              <button key={a.id} onClick={() => setAba(a.id)} style={{
                flex:1, padding:'8px 4px', fontSize:12.5, fontWeight: aba === a.id ? 700 : 400,
                border:'none', borderBottom:`2px solid ${aba === a.id ? '#1D5BBF' : 'transparent'}`,
                background:'none', cursor:'pointer', fontFamily:'inherit',
                color: aba === a.id ? '#1D5BBF' : '#6B7280',
              }}>
                {a.label}
                {a.qtd > 0 && (
                  <span style={{ marginLeft:5, fontSize:10, fontWeight:700, padding:'1px 5px',
                    borderRadius:8, background:'#FEF3C7', color:'#B54708' }}>
                    {a.qtd}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {fase === 'carregando' && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'32px 20px', color:'#9CA3AF', fontSize:13 }}>
            <div style={{ width:20, height:20, border:'3px solid #E5E7EB', borderTopColor:'#1D5BBF',
              borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
            Carregando…
          </div>
        )}

        {/* ABA: mês selecionado */}
        {fase === 'pronto' && aba === 'mes' && (() => {
          const g = mesSelecionado
          if (!g) return (
            <div style={{ padding:'32px 20px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>
              Sem dados de conciliação para {labelMes}.
            </div>
          )
          const verOk = verOkMes['__mes__']
          return (
            <div>
              {/* Bloco: problemas reais */}
              {g.investigar.length > 0 ? (
                <div>
                  <div style={{ padding:'10px 20px', background:'#FFFBEB', borderBottom:'1px solid #FDE68A' }}>
                    <span style={{ fontSize:11.5, fontWeight:700, color:'#92400E' }}>
                      ⚠ {g.investigar.length} nota{g.investigar.length>1?'s':''} para investigar
                    </span>
                    <span style={{ fontSize:11, color:'#92400E', marginLeft:8, opacity:.8 }}>
                      diferença real · R$ {brl(g.somaInvestigar)}
                    </span>
                  </div>
                  {g.investigar.map((nota, i) => <CardNota key={nota.id || i} nota={nota} onNota={onNota} />)}
                </div>
              ) : (
                <div style={{ margin:'16px', padding:'16px', textAlign:'center',
                  background:'#F0FDF4', borderRadius:8, fontSize:12.5, color:'#166534' }}>
                  ✅ Nenhuma nota para investigar em {labelMes}.
                </div>
              )}

              {/* Bloco: ajuste de custo (esperado, não é problema) */}
              {g.ajuste.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ padding:'10px 20px', background:'#F9FAFB', borderTop:'1px solid #F3F4F6', borderBottom:'1px solid #F3F4F6' }}>
                    <span style={{ fontSize:11.5, fontWeight:700, color:'#6B7280' }}>
                      ⚙ {g.ajuste.length} ajuste{g.ajuste.length>1?'s':''} de custo médio
                    </span>
                    <span style={{ fontSize:11, color:'#9CA3AF', marginLeft:8 }}>
                      já refletido no saldo da conta · não requer ação
                    </span>
                  </div>
                  {g.ajuste.map((nota, i) => <CardNota key={nota.id || i} nota={nota} onNota={onNota} />)}
                </div>
              )}

              {/* Ver conciliadas */}
              {g.notas.length > g.comDif.length && (
                <button onClick={() => setVerOkMes(p => ({ ...p, '__mes__': !p['__mes__'] }))}
                  style={{ width:'100%', padding:'9px 20px', background:'#F9FAFB', border:'none',
                    borderTop:'1px solid #F3F4F6', cursor:'pointer', textAlign:'left',
                    fontFamily:'inherit', fontSize:11.5, color:'#9CA3AF' }}>
                  {verOk
                    ? `▲ Ocultar conciliadas (${g.notas.length - g.comDif.length})`
                    : `▼ Ver conciliadas (${g.notas.length - g.comDif.length})`}
                </button>
              )}
              {verOk && g.notas.filter(n=>n.classe_divergencia==='OK').map((nota,i)=>(
                <CardNota key={nota.id||i} nota={nota} onNota={onNota} />
              ))}
            </div>
          )
        })()}

        {/* ABA: todos os meses (accordion) */}
        {fase === 'pronto' && aba === 'todos' && porMes.map(g => {
          const aberto = mesAberto === g.mesKey
          const verOk = verOkMes[g.mesKey]
          return (
            <div key={g.mesKey} style={{ borderBottom:'2px solid #F3F4F6' }}>
              {/* Cabeçalho do mês */}
              <button onClick={() => setMesAberto(aberto ? null : g.mesKey)}
                style={{ width:'100%', padding:'12px 20px',
                  background: aberto ? '#F0F7FF' : '#fff',
                  border:'none', borderBottom:`1px solid ${aberto ? '#DBEAFE' : 'transparent'}`,
                  cursor:'pointer', textAlign:'left', fontFamily:'inherit',
                  display:'flex', justifyContent:'space-between', alignItems:'center' }}
                onMouseOver={e => { if (!aberto) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseOut={e => { if (!aberto) e.currentTarget.style.background = '#fff' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:700, color: aberto ? '#1D5BBF' : '#101828' }}>
                    {g.label}
                  </span>
                  {g.investigar.length > 0 && (
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 7px', borderRadius:4,
                      background:'#FEF3C7', color:'#B54708' }}>
                      ⚠ {g.investigar.length} investigar
                    </span>
                  )}
                  {g.ajuste.length > 0 && (
                    <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:4,
                      background:'#F3F4F6', color:'#6B7280' }}>
                      ⚙ {g.ajuste.length} ajuste
                    </span>
                  )}
                  {g.comDif.length === 0 && (
                    <span style={{ fontSize:11, padding:'2px 7px', borderRadius:4,
                      background:'#D1FAE5', color:'#12805C' }}>✓ conciliado</span>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {g.investigar.length > 0 && (
                    <span style={{ fontSize:13, fontWeight:700, color:'#B54708', fontVariantNumeric:'tabular-nums' }}>
                      {g.somaInvestigar > 0 ? '+' : ''}R$ {brl(g.somaInvestigar)}
                    </span>
                  )}
                  <span style={{ fontSize:12, color:'#9CA3AF' }}>{aberto ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Notas do mês */}
              {aberto && (
                <div>
                  {g.comDif.length === 0 && (
                    <div style={{ padding:'16px 20px', fontSize:12.5, color:'#12805C' }}>
                      ✅ Nenhuma nota com diferença neste mês.
                    </div>
                  )}
                  {g.investigar.map((nota, i) => <CardNota key={nota.id || i} nota={nota} onNota={onNota} />)}
                  {g.ajuste.length > 0 && (
                    <div style={{ padding:'7px 20px 7px 28px', background:'#F9FAFB', fontSize:11, color:'#9CA3AF' }}>
                      ⚙ {g.ajuste.length} ajuste(s) de custo médio — já refletido no saldo, não requer ação
                    </div>
                  )}
                  {g.ajuste.map((nota, i) => <CardNota key={nota.id || i} nota={nota} onNota={onNota} />)}
                  {g.notas.length > g.comDif.length && (
                    <button onClick={() => setVerOkMes(p => ({ ...p, [g.mesKey]: !p[g.mesKey] }))}
                      style={{ width:'100%', padding:'8px 20px 8px 28px', background:'#F9FAFB', border:'none',
                        borderTop:'1px solid #F3F4F6', cursor:'pointer', textAlign:'left',
                        fontFamily:'inherit', fontSize:11.5, color:'#9CA3AF' }}>
                      {verOk
                        ? `▲ Ocultar conciliadas (${g.notas.length - g.comDif.length})`
                        : `▼ Ver conciliadas (${g.notas.length - g.comDif.length})`}
                    </button>
                  )}
                  {verOk && g.notas.filter(n=>n.classe_divergencia==='OK').map((nota,i)=>(
                    <CardNota key={nota.id||i} nota={nota} onNota={onNota} />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {fase === 'pronto' && !porMes.length && (
          <div style={{ padding:'32px', textAlign:'center', color:'#9CA3AF', fontSize:13 }}>
            Nenhum lançamento encontrado para esta conta.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tela principal de Fechamento ─────────────────────────────────────────────
export default function Fechamento() {
  const [fase, setFase] = useState('carregando')
  const [erro, setErro] = useState('')
  const [datas, setDatas] = useState([])           // datas já sincronizadas (existem em fechamento_saldos)
  // Período escolhido pelo usuário. "fim" é a posição que realmente importa
  // pro cálculo (cumulativo até essa data); "inicio" é só pra rotular o
  // período visualmente, não muda o resultado.
  const [periodoInicio, setPeriodoInicio] = useState(primeiroDiaDoMes(hojeISO()))
  const [periodoFim, setPeriodoFim] = useState(hojeISO())
  const [data, setData] = useState('')             // data efetivamente carregada (fechamento_analitico)
  const [linhas, setLinhas] = useState([])
  const [contaAberta, setContaAberta] = useState(null)
  const [notaAberta, setNotaAberta] = useState(null)
  const [sincronizando, setSincronizando] = useState(false)
  const [erroSync, setErroSync] = useState('')
  const [datasCarregadas, setDatasCarregadas] = useState(false)

  // Carrega a lista de datas já sincronizadas (pra saber se precisa sincronizar
  // sob demanda ou se já pode carregar direto do banco).
  useEffect(() => {
    sbFetch('fechamento_saldos?select=data_posicao&order=data_posicao.desc')
      .then(r => {
        const u = [...new Set((r || []).map(x => x.data_posicao))]
        setDatas(u)
        if (u.length) {
          setPeriodoFim(u[0])
          setPeriodoInicio(primeiroDiaDoMes(u[0]))
        } else {
          setFase('vazio')
        }
        setDatasCarregadas(true)
      })
      .catch(e => { setErro(e.message); setFase('erro') })
  }, [])

  // Sempre que o "até" do período mudar, garante que essa posição existe —
  // sincroniza na hora com o Sankhya se ainda não tiver sido calculada antes.
  // Só roda depois que a lista inicial de datas já carregou, senão dispararia
  // uma sincronização desnecessária logo de cara (achando que nada existe
  // ainda, porque "datas" começa vazio antes do primeiro fetch terminar).
  useEffect(() => {
    if (!periodoFim || !datasCarregadas) return
    let cancelado = false

    async function carregar() {
      setErroSync('')
      const jaExiste = datas.includes(periodoFim)

      if (!jaExiste) {
        setSincronizando(true)
        try {
          await sincronizarPosicao(periodoFim)
          if (cancelado) return
          setDatas(prev => prev.includes(periodoFim) ? prev : [periodoFim, ...prev])
        } catch (e) {
          if (!cancelado) { setErroSync(e.message); setSincronizando(false) }
          return
        }
        setSincronizando(false)
      }

      setFase('carregando')
      try {
        const r = await sbFetch(`fechamento_analitico?data_posicao=eq.${periodoFim}&select=*&order=grupo.asc`)
        if (cancelado) return
        setLinhas(r || [])
        setData(periodoFim)
        setFase('pronto')
      } catch (e) {
        if (!cancelado) { setErro(e.message); setFase('erro') }
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [periodoFim, datasCarregadas]) // eslint-disable-line react-hooks/exhaustive-deps

  const tot = useMemo(() => {
    const est = linhas.reduce((s, l) => s + Number(l.saldo_estoque || 0), 0)
    const ctb = linhas.reduce((s, l) => s + Number(l.saldo_contabil || 0), 0)
    return { est, ctb, dif: est - ctb, conferem: linhas.filter(l => l.confere).length }
  }, [linhas])

  const fechou = Math.abs(tot.dif) < 0.10 && tot.conferem === linhas.length
  const maxDif = Math.max(1, ...linhas.map(l => Math.abs(Number(l.diferenca) || 0)))
  const fmt = s => isoParaBR(s)

  const exportar = () => {
    const cols = ['contas','descr_conta','descr_local','saldo_estoque','saldo_contabil','diferenca','acao']
    const csv = [cols.join(';'), ...linhas.map(l => cols.map(k => String(l[k]??'').replace(/;/g,',')).join(';'))].join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}))
    const a = document.createElement('a'); a.href=url; a.download=`fechamento-${data}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Seletor de período — "De" só rotula o período; "Até" é a posição
          calculada (cumulativa desde sempre até essa data). Se a data
          escolhida em "Até" ainda não tiver sido sincronizada, o sistema
          sincroniza automaticamente com o Sankhya antes de mostrar. */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <label style={{ fontSize:12, color:'#6B7280' }}>Período:</label>
        <span style={{ fontSize:12, color:'#9CA3AF' }}>de</span>
        <input type="date" value={periodoInicio} max={periodoFim}
          onChange={e => setPeriodoInicio(e.target.value)}
          style={{ fontFamily:'inherit', fontSize:13, padding:'6px 10px', border:'1px solid #E5E7EB', borderRadius:6 }}
        />
        <span style={{ fontSize:12, color:'#9CA3AF' }}>até</span>
        <input type="date" value={periodoFim} max={hojeISO()}
          onChange={e => setPeriodoFim(e.target.value)}
          style={{ fontFamily:'inherit', fontSize:13, padding:'6px 10px', border:'1px solid #E5E7EB', borderRadius:6 }}
        />
        {sincronizando && (
          <span style={{ fontSize:12, color:'#1D5BBF', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:12, height:12, border:'2px solid #BFDBFE', borderTopColor:'#1D5BBF',
              borderRadius:'50%', animation:'spin .8s linear infinite', display:'inline-block' }}/>
            Sincronizando posição de {fmt(periodoFim)} com o Sankhya… pode levar um minuto.
          </span>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {erroSync && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', color:'#B42318', fontSize:12.5 }}>
          Não foi possível sincronizar essa posição: {erroSync}
        </div>
      )}

      {fase === 'carregando' && !sincronizando && <Spinner/>}
      {fase === 'erro' && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:16, color:'#B42318' }}>
          Erro: {erro}
        </div>
      )}

      {fase === 'pronto' && (
        <>
          {/* Veredito */}
          <div style={{
            background: fechou ? '#F0FDF4' : '#FFFBEB',
            border:`1px solid ${fechou ? '#BBF7D0' : '#FDE68A'}`,
            borderRadius:8, padding:'16px 20px',
            display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14,
          }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color: fechou ? '#166534' : '#92400E', marginBottom:3 }}>
                {fechou
                  ? `✅ Saldo conciliado — posição de ${fmt(data)}`
                  : `⚙ ${linhas.filter(l => !l.confere).length} conta(s) pendente(s)`}
              </div>
              <div style={{ fontSize:12.5, color: fechou ? '#166534' : '#92400E', opacity:.85 }}>
                {tot.conferem} de {linhas.length} contas conferem · clique numa conta para ver as notas
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10.5, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em' }}>Diferença geral</div>
              <div style={{ fontSize:25, fontWeight:800, fontVariantNumeric:'tabular-nums',
                color: fechou ? '#12805C' : '#B54708' }}>
                {tot.dif > 0 ? '+' : ''}R$ {brl(tot.dif)}
              </div>
            </div>
          </div>

          {/* Totais */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1px 1fr', background:'#fff',
            border:'1px solid #E5E7EB', borderRadius:8, padding:'16px 22px' }}>
            <div>
              <div style={{ fontSize:10.5, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 }}>
                Estoque · posição apurada
              </div>
              <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>R$ {brl(tot.est)}</div>
            </div>
            <div style={{ background:'#E5E7EB' }}/>
            <div style={{ paddingLeft:22 }}>
              <div style={{ fontSize:10.5, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 }}>
                Contabilidade · saldo do razão
              </div>
              <div style={{ fontSize:24, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>R$ {brl(tot.ctb)}</div>
            </div>
          </div>

          {/* Tabela de contas */}
          <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid #F3F4F6',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <span style={{ fontSize:14, fontWeight:600 }}>Conciliação por conta</span>
                <span style={{ fontSize:12, color:'#9CA3AF', marginLeft:10 }}>clique para ver as notas</span>
              </div>
              <Btn small onClick={exportar}>↓ CSV</Btn>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['Conta','Descrição','Estoque','Contábil','Diferença','','Ação'].map((h, k) => (
                    <th key={k} style={{
                      padding:'10px 14px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB',
                      textAlign:['Estoque','Contábil','Diferença'].includes(h) ? 'right' : 'left',
                      fontSize:10.5, fontWeight:600, color:'#6B7280',
                      textTransform:'uppercase', letterSpacing:'.04em', whiteSpace:'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => {
                  const dif = Number(l.diferenca || 0)
                  const est = ACAO_ESTILO[l.acao] || ACAO_ESTILO['CONFERE']
                  const ativa = contaAberta === l.contas
                  return (
                    <tr key={l.grupo}
                      onClick={() => setContaAberta(ativa ? null : l.contas)}
                      style={{
                        background: ativa ? '#EBF2FC' : l.confere ? '#fff' : '#FFFDF7',
                        cursor:'pointer',
                        borderLeft:`3px solid ${ativa ? '#1D5BBF' : 'transparent'}`,
                      }}
                      onMouseOver={e => { if (!ativa) e.currentTarget.style.background = '#F9FAFB' }}
                      onMouseOut={e => { if (!ativa) e.currentTarget.style.background = l.confere ? '#fff' : '#FFFDF7' }}
                    >
                      <td style={{ ...TD, fontWeight:700, fontVariantNumeric:'tabular-nums', fontSize:12, whiteSpace:'nowrap' }}>
                        {l.contas}
                      </td>
                      <td style={TD}>
                        <div style={{ fontWeight:500 }}>{l.descr_conta}</div>
                        {l.descr_local && <div style={{ fontSize:11, color:'#9CA3AF' }}>{l.descr_local}</div>}
                      </td>
                      <td style={{ ...TD, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(l.saldo_estoque)}</td>
                      <td style={{ ...TD, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(l.saldo_contabil)}</td>
                      <td style={{ ...TD, textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums',
                        color: l.confere ? '#12805C' : '#B54708' }}>
                        {dif > 0 ? '+' : ''}R$ {brl(dif)}
                      </td>
                      <td style={{ ...TD, width:80, padding:'10px 6px' }}>
                        <div style={{ height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:3,
                            width:`${Math.min(100, (Math.abs(dif) / maxDif) * 100)}%`,
                            background: l.confere ? '#12805C' : '#B54708' }}/>
                        </div>
                      </td>
                      <td style={TD}>
                        <span style={{ fontSize:10.5, fontWeight:700, padding:'3px 8px', borderRadius:5,
                          background:est.bg, color:est.cor, whiteSpace:'nowrap' }}>
                          {est.icone} {l.acao}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#F9FAFB', fontWeight:700 }}>
                  <td style={{ ...TD, borderTop:'2px solid #E5E7EB' }} colSpan={2}>TOTAL GERAL</td>
                  <td style={{ ...TD, borderTop:'2px solid #E5E7EB', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(tot.est)}</td>
                  <td style={{ ...TD, borderTop:'2px solid #E5E7EB', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>R$ {brl(tot.ctb)}</td>
                  <td style={{ ...TD, borderTop:'2px solid #E5E7EB', textAlign:'right', fontVariantNumeric:'tabular-nums',
                    color: fechou ? '#12805C' : '#B54708' }}>R$ {brl(tot.dif)}</td>
                  <td style={{ ...TD, borderTop:'2px solid #E5E7EB' }} colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Overlay */}
      {contaAberta && (
        <div onClick={() => setContaAberta(null)}
          style={{ position:'fixed', inset:0, background:'rgba(16,24,40,.2)', zIndex:34 }}/>
      )}

      {/* Painel lateral de notas */}
      {contaAberta && (
        <PainelNotas
          conta={contaAberta}
          dataFechamento={data}
          onClose={() => setContaAberta(null)}
          onNota={nota => { setContaAberta(null); setNotaAberta(nota) }}
        />
      )}

      {/* Drawer de detalhe */}
      <DrawerDetalhe nota={notaAberta} onClose={() => setNotaAberta(null)} />
    </div>
  )
}

const TD = { padding:'10px 14px', borderBottom:'1px solid #F3F4F6', fontSize:13 }
