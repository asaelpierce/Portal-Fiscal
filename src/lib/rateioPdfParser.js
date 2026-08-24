/**
 * Lê um PDF de rateio (Cesta Básica, Sindicato, Mensalidade, etc.) e
 * extrai pares Setor + Valor. Suporta PDFs com mais de uma tabela na
 * mesma página (soma cada uma separadamente por Total Geral).
 *
 * Depende do pacote "pdfjs-dist" (`npm install pdfjs-dist`). O worker
 * já é configurado uma vez em src/main.jsx — não precisa repetir aqui.
 */

import * as pdfjsLib from 'pdfjs-dist'

const MARCADORES_IGNORAR = [
  'total geral',
  'rótulos de linha',
  'rotulos de linha',
  'soma de',
  'rateio cesta',
  'rateio mensalidade',
  'rateio sindicato',
]

// Padrão de valor no fim da linha: opcionalmente "R$", número com
// separador de milhar/decimal BR, aceitando 1 ou 2 casas decimais
// (ex.: "379,7" além de "379,70" — o Excel às vezes corta o zero à
// direita ao gerar o PDF).
const RE_VALOR_FINAL = /(R\$\s*)?([\d.\s]+,\d{1,2})\s*$/

function limparValor(bruto) {
  let v = bruto.replace(/\s/g, '')
  v = v.replace(/\./g, '') // separador de milhar
  v = v.replace(',', '.')  // separador decimal
  return parseFloat(v)
}

/** Extrai o texto do PDF, tentando reconstruir as linhas na ordem
 * visual (agrupando itens de texto por coordenada Y aproximada) — o
 * pdfjs não devolve quebras de linha prontas. */
async function extrairTextoPdf(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const linhasTotais = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()

    const grupos = []
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue
      const y = item.transform[5]
      const x = item.transform[4]
      let grupo = grupos.find(g => Math.abs(g.y - y) < 2)
      if (!grupo) {
        grupo = { y, itens: [] }
        grupos.push(grupo)
      }
      grupo.itens.push({ x, texto: item.str })
    }

    // topo pra baixo (Y maior = mais acima na página em coordenadas PDF)
    grupos.sort((a, b) => b.y - a.y)
    for (const g of grupos) {
      g.itens.sort((a, b) => a.x - b.x)
      const linha = g.itens
        .map(i => i.texto)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (linha) linhasTotais.push(linha)
    }
  }

  return linhasTotais.join('\n')
}

/**
 * Lê um arquivo PDF (File, do <input type="file">) e retorna a lista
 * de [{setor, valor}], na ordem em que aparecem no PDF. Ignora linhas
 * de total/cabeçalho e linhas sem um valor monetário reconhecível no
 * final.
 */
export async function lerRateioPdf(arquivo) {
  const buffer = await arquivo.arrayBuffer()
  const texto = await extrairTextoPdf(buffer)
  const linhas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  const resultado = []

  for (const linha of linhas) {
    const low = linha.toLowerCase()
    if (MARCADORES_IGNORAR.some(m => low.includes(m))) continue

    // remove número de linha de planilha colado no início (ex: "12 ")
    const semIndice = linha.replace(/^\d+\s+/, '')

    const match = semIndice.match(RE_VALOR_FINAL)
    if (!match || match.index === undefined) continue

    let setor = semIndice.slice(0, match.index).trim()
    setor = setor.replace(/\s*R\$\s*$/, '').trim()
    if (!setor || setor === '(vazio)') continue

    const valor = limparValor(match[2])
    if (Number.isNaN(valor)) continue

    resultado.push({ setor, valor })
  }

  return resultado
}
