/**
 * Tipos de Natureza disponíveis e seus códigos (Cód.Natureza no Sankhya).
 *
 * A partir de agora isso é editável pela tela (menu Configurações, dentro
 * de Rateio de Compras) e fica na tabela "rateio_naturezas" no Supabase —
 * não precisa mais mexer em código pra adicionar um tipo novo. O objeto
 * abaixo é só o valor padrão de segurança, usado se a busca ao banco falhar.
 */
export const NATUREZAS_POR_TIPO_PADRAO = {
  "Alimentação": "170113",
  "Sindicato": "170112",
  "Assistência Médica": "170220",
  "Assistência Odontológica": "170123",
  "Segurança do Trabalho": "170221",
}
