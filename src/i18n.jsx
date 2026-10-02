// ============================================================================
// Tradução PT/EN das telas que vão para a matriz.
//
// Existe porque a apresentação do ganho de automação é feita em inglês, e
// traduzir na hora, oralmente, perde precisão justamente nos termos que
// importam — "horas devolvidas ao time" não é "saved hours", é o tempo que
// voltou para a pessoa fazer outra coisa.
//
// Guardado em memória, não em localStorage: artefato do portal não usa
// armazenamento do navegador.
// ============================================================================
import React, { createContext, useContext, useState } from 'react'

export const TEXTOS = {
  pt: {
    // cabeçalho
    horasDevolvidas: 'Horas devolvidas ao time',
    porMes: 'Por mês', porAno: 'Por ano',
    automacoes: 'Automações', tarefas: 'Tarefas',
    itensProcessados: 'Itens processados',
    mapa: 'Mapa', numeros: 'Números',
    // blocos
    pesoCadaAutomacao: 'O peso de cada automação',
    comoEconomiaCresceu: 'Como a economia foi crescendo',
    quemGanhouTempo: 'Quem ganhou esse tempo',
    oQueCustava: 'O que cada tarefa custava, e o que custa hoje',
    comoApurado: 'Como cada número foi apurado',
    ganhosSemHora: 'Ganhos que não viram hora',
    mapaProcessos: 'Mapa dos processos',
    // tabela
    tarefa: 'Tarefa', automacao: 'Automação', volume: 'Volume',
    minItem: 'Min/item', horasMes: 'Horas/mês', horasAcum: 'Horas acum.',
    desde: 'Desde', meses: 'Meses', total: 'Total', acumulado: 'Acumulado',
    entrandoMes: 'Entrando/mês',
    // etiquetas
    medido: 'medido', estimado: 'estimado',
    eficiencia: 'Eficiência', material: 'Material', risco: 'Risco',
    folhasNaoImpressas: 'Folhas não impressas',
    jaEconomizado: 'Já economizado', ritmoAtual: 'Ritmo atual',
    projecaoAnual: 'Projeção anual',
    recursoFisico: 'Recurso físico que deixou de ser consumido',
    idadesDiferentes: 'Idades diferentes: ',
    procedencia: 'Procedência: ',
    // ações e estados
    imprimir: 'Imprimir ou salvar em PDF',
    tentarDeNovo: 'Tentar de novo',
    carregando: 'Carregando…',
    semTarefa: 'Nenhuma tarefa medida ainda',
    naoCarregou: 'Não foi possível carregar',
    // medição parada
    fonteParada: 'sem registro há',
    dias: 'dias',
  },
  en: {
    horasDevolvidas: 'Hours returned to the team',
    porMes: 'Per month', porAno: 'Per year',
    automacoes: 'Automations', tarefas: 'Tasks',
    itensProcessados: 'Items processed',
    mapa: 'Map', numeros: 'Figures',
    pesoCadaAutomacao: 'Weight of each automation',
    comoEconomiaCresceu: 'How the savings built up',
    quemGanhouTempo: 'Who gained this time',
    oQueCustava: 'What each task used to cost, and what it costs now',
    comoApurado: 'How each figure was measured',
    ganhosSemHora: 'Gains not counted as hours',
    mapaProcessos: 'Process map',
    tarefa: 'Task', automacao: 'Automation', volume: 'Volume',
    minItem: 'Min/item', horasMes: 'Hours/month', horasAcum: 'Hours to date',
    desde: 'Since', meses: 'Months', total: 'Total', acumulado: 'To date',
    entrandoMes: 'Added/month',
    medido: 'measured', estimado: 'estimated',
    eficiencia: 'Efficiency', material: 'Material', risco: 'Risk',
    folhasNaoImpressas: 'Sheets not printed',
    jaEconomizado: 'Saved so far', ritmoAtual: 'Current pace',
    projecaoAnual: 'Annual projection',
    recursoFisico: 'Physical resource no longer consumed',
    idadesDiferentes: 'Different ages: ',
    procedencia: 'Source: ',
    imprimir: 'Print or save as PDF',
    tentarDeNovo: 'Try again',
    carregando: 'Loading…',
    semTarefa: 'No task measured yet',
    naoCarregou: 'Could not load',
    fonteParada: 'no record for',
    dias: 'days',
  },
}

const Ctx = createContext({ lang: 'pt', setLang: () => {}, t: (k) => TEXTOS.pt[k] ?? k })

export function IdiomaProvider({ children }) {
  const [lang, setLang] = useState('pt')
  const t = (k) => TEXTOS[lang]?.[k] ?? TEXTOS.pt[k] ?? k
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useIdioma = () => useContext(Ctx)

// Número e data seguem o idioma: a matriz lê 1,730.0 e não 1.730,0.
export const fmtNum = (v, lang, casas = 1) =>
  Number(v ?? 0).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR',
    { minimumFractionDigits: casas, maximumFractionDigits: casas })

export const fmtInt = (v, lang) =>
  Number(v ?? 0).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR')

export const fmtData = (d, lang) => {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d.length <= 10 ? d + 'T00:00:00' : d) : d
  return dt.toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR',
    { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function BotaoIdioma({ compacto }) {
  const { lang, setLang } = useIdioma()
  return (
    <span style={{ display: 'inline-flex', border: '1px solid #E4E1DC', borderRadius: 6, overflow: 'hidden' }}>
      {[['pt', 'PT'], ['en', 'EN']].map(([k, r]) => (
        <button key={k} onClick={() => setLang(k)}
          aria-pressed={lang === k}
          style={{
            fontFamily: 'inherit', fontSize: compacto ? 11 : 12, fontWeight: 600,
            cursor: 'pointer', padding: compacto ? '4px 9px' : '6px 12px', border: 'none',
            background: lang === k ? '#1A1A18' : '#fff',
            color: lang === k ? '#FBFAF8' : '#6E6A64',
          }}>{r}</button>
      ))}
    </span>
  )
}
