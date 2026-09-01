/**
 * Tipos de Natureza disponíveis e seus códigos (Cód.Natureza no Sankhya).
 *
 * Isso alimenta os botões/select de "tipo de rateio" na interface. Pra
 * adicionar um novo tipo, só acrescente uma linha aqui.
 */
export const NATUREZAS_POR_TIPO = {
  "Alimentação": "170113",
  "Sindicato": "170112",
  "Assistência Médica": "170220",
  "Assistência Odontológica": "170123",
  "Segurança do Trabalho": "170221",
}

// Alias usado como fallback quando a busca ao banco (tabela rateio_naturezas)
// falha - RateioCompras.jsx importa por este nome especificamente.
export const NATUREZAS_POR_TIPO_PADRAO = NATUREZAS_POR_TIPO
