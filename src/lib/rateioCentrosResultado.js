/**
 * Mapeamento Setor -> Código do Centro de Resultado no Sankhya.
 *
 * Se precisar adicionar/editar/remover um setor, mexa só no objeto
 * MAPA_CENTRO_RESULTADO abaixo — o resto do arquivo (normalização e busca
 * aproximada) não precisa mudar.
 *
 * REGRA DO CÓDIGO (confirmada com exemplo real da tela do Sankhya): tira os
 * pontos do código da árvore de Centro de Resultado e depois o zero à
 * esquerda que sobra. Ex.: "02.04.04.01" -> "02040401" -> "2040401".
 */

export const MAPA_CENTRO_RESULTADO = {
  "Gerência": "2020101",
  "Financeiro": "2020102",
  "Fiscal": "2020103",
  "Recursos Humanos": "2020104",
  "TI": "2020105",
  "Serviços Adm. de Terceiros": "2020106",
  "Tributos e Tarifas Bancárias": "2020107",
  "Receitas e Despesas Financeiras": "2020108",

  "Comercial Vespasiano Adm": "2030101",
  "Comercial Vespasiano Vendas": "2030102",
  "Comercial Pará Adm": "2030201",
  "Comercial Pará Vendas": "2030202",
  "Comercial Engenharia Orçamentos": "2030301",
  "Comercial Marketing": "2030401",
  "Comercial Nordeste Vendas": "2030501",

  "Manufactory Overhead - Manutenção": "2040101",
  "Manufactory Overhead - PCP": "2040102",
  "Manufactory Overhead - Engenharia/Projetos": "2040103",
  "Manufactory Overhead - Expedição": "2040104",
  // atenção: existem DUAS "Qualidade e Segurança" na árvore original do
  // Sankhya (02.04.01.05 e 02.04.02.01) — usando 2040105, confirmado com
  // o usuário como a correta pra uso geral.
  "Qualidade e Segurança": "2040105",
  "Adm Produção": "2040202",

  "Caldeiraria - Mão de Obra": "2040301",
  "Caldeiraria - Maçarico": "2040302",
  "Caldeiraria - Máquina de Solda": "2040303",
  "Caldeiraria - Máquina de Corte": "2040304",
  "Caldeiraria - Plasma": "2040305",
  "Caldeiraria - Stud Weld": "2040306",
  "Caldeiraria - Despesas Gerais": "2040307",

  "Revestimento - Mão de Obra": "2040401",
  "Revestimento - Serra": "2040402",
  "Revestimento - Despesas Gerais": "2040403",

  "Vulcanização - Mão de Obra": "2040501",
  "Vulcanização": "2040501",
  "Vulcanização - Serra": "2040502",
  "Vulcanização - Misturador": "2040503",
  "Vulcanização - Autoclave": "2040504",
  "Vulcanização - Prensa": "2040505",
  "Vulcanização - Despesas Gerais": "2040506",
  "Vulcanização - Stud Weld": "2040507",

  "Pintura - Mão de Obra": "2040601",
  "Pintura - Cabine de Jato": "2040602",

  "Corte Cerâmica - Mão de Obra": "2040801",
  "Corte Cerâmica - Serra": "2040802",
  "Corte Cerâmica - Despesas": "2040803",

  "Corte Chapa - Mão de Obra": "2040901",
  "Corte Chapa - Plasma": "2040902",
  "Corte Chapa - Dobradeira": "2040903",
  "Corte Chapa - Despesas Gerais": "2040904",

  "Supply Compras": "2050101",
  "Supply Almoxarifado": "2050102",
  "Supply Logística": "2050103",
}

/** Remove acentos, deixa minúsculo e tira pontuação extra, pra comparar
 * nomes de setor com folga de formatação. */
export function normalizar(texto) {
  if (!texto) return ''
  let txt = texto.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  txt = txt.toLowerCase().trim()
  txt = txt.replace(/[^a-z0-9 ]/g, ' ')
  txt = txt.replace(/\s+/g, ' ').trim()
  return txt
}

const INDICE_NORMALIZADO = Object.fromEntries(
  Object.entries(MAPA_CENTRO_RESULTADO).map(([k, v]) => [normalizar(k), v])
)

/**
 * Retorna o código (string) ou null se não encontrar correspondência.
 *
 * 1º tenta igualdade exata (normalizada).
 * 2º tenta por conjunto de palavras: só considera match se TODAS as
 *    palavras (com 3+ letras) de um lado estiverem contidas no outro
 *    lado — evita falsos positivos tipo "ti" casando dentro de
 *    "administrative" por ser substring solta.
 */
export function buscarCodigoCentroResultado(setor) {
  const chave = normalizar(setor)
  if (INDICE_NORMALIZADO[chave]) return INDICE_NORMALIZADO[chave]

  const palavrasSetor = new Set(chave.split(' ').filter(p => p.length >= 3))
  if (palavrasSetor.size === 0) return null

  let melhorCodigo = null
  let melhorCobertura = 0

  for (const [k, v] of Object.entries(INDICE_NORMALIZADO)) {
    const palavrasChave = new Set(k.split(' ').filter(p => p.length >= 3))
    if (palavrasChave.size === 0) continue

    const [menor, maior] =
      palavrasSetor.size <= palavrasChave.size
        ? [palavrasSetor, palavrasChave]
        : [palavrasChave, palavrasSetor]

    let contido = true
    for (const p of menor) {
      if (!maior.has(p)) { contido = false; break }
    }

    if (contido) {
      const cobertura = menor.size
      if (cobertura > melhorCobertura) {
        melhorCobertura = cobertura
        melhorCodigo = v
      }
    }
  }

  return melhorCodigo
}

/** Lista [descrição, código] ordenada alfabeticamente — útil pra um
 * combobox/dropdown de seleção manual na interface. */
export function listarCentrosOrdenados() {
  return Object.entries(MAPA_CENTRO_RESULTADO).sort((a, b) =>
    normalizar(a[0]).localeCompare(normalizar(b[0]))
  )
}
