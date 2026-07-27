# Portal Conciliação Contábil × Custos — Kalenborn

## Pré-requisitos
- Node.js 18+ instalado (https://nodejs.org)

## Como rodar (desenvolvimento)

```bash
# 1. Entre na pasta
cd portal-conciliacao

# 2. Instale as dependências (só na primeira vez)
npm install

# 3. Rode o servidor de desenvolvimento
npm run dev
```

Acesse: http://localhost:5173

## Como gerar build de produção

```bash
npm run build
```

Os arquivos ficam em `/dist` — pode ser servido por qualquer servidor estático
(Nginx, Vercel, Netlify, etc).

## Configuração

As credenciais do Supabase estão em `src/config.js`:

```js
export const SUPABASE_URL = 'https://sqsrvhlpvnojatlqnred.supabase.co'
export const SUPABASE_ANON_KEY = '...'
```

São chaves públicas (anon key) — seguro deixar no frontend.

## Funcionalidades

- **Visão geral**: KPIs, gráfico de composição, barras por conta, tendência, maiores divergências
- **Divergências**: fila ordenada pelo maior desvio, com detalhe completo de cada nota
- **Lançamentos**: tabela com filtros (conta, situação, local, busca livre), exportação CSV
- **Contas contábeis**: cards por conta com barra de divergência, clique filtra lançamentos
- **Histórico**: evolução da diferença ao longo das sincronizações
- **Drawer de detalhe**: ao clicar em qualquer linha, abre painel com todos os dados da nota (identificação + composição fiscal + CTes)
