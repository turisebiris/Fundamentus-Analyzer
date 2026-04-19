# Fundamentus Analyzer

Aplicativo web para análise e ranking de ações brasileiras com dados do
[Fundamentus](https://fundamentus.com.br/). Atualização é feita **apenas
manualmente** por um botão — sem refresh automático.

Regras completas do projeto: [`rules.md`](./rules.md).

## Arquitetura

- **Frontend estático** em TypeScript + Vite (SPA sem framework pesado).
- **Função serverless** (Netlify Functions) atua como proxy de scraping e
  parseia o HTML do Fundamentus. O frontend **nunca** acessa
  `fundamentus.com.br` diretamente (CORS).
- **Núcleo agnóstico de ativo** em `src/core/` (filtros, ranking ordinal,
  pontuação, desempate), reutilizável para FIIs no futuro.
- Persistência local do último snapshot em `localStorage` (recarregar a
  página NÃO dispara nova coleta).

### Pipeline (ordem exata do `rules.md` + ajustes aprovados)

1. `resultado.php` → tabela massiva com todos os papéis.
2. Pré-filtro server-side (tudo exceto Margem Líquida) para decidir quais
   enriquecer — apenas otimização de requisições.
3. Enriquecimento com `detalhes.php?papel=` com **limite de concorrência**
   (6 em paralelo, timeout por request + retries com backoff).
4. No cliente:
   - **Identificação de bancos** por setor/subsetor **antes** do filtro de ML.
   - Aplicação dos filtros eliminatórios. Bancos não são eliminados por ML.
   - **Rank ordinal** por indicador. Valores ausentes/inválidos recebem o
     **pior rank** do indicador.
   - **Rank médio neutro em Margem Líquida** para bancos, calculado
     **apenas a partir das não-bancárias com ML válida**.
   - **Peso de ML permanece 2.0**. Sem recalibragem dinâmica, em nenhum caso.
   - Soma ponderada (menor pontuação = melhor) e desempate: ROE↑ → DY↑ →
     P/L↓ → Liquidez↑.
5. Top 10 renderizado com ranks individuais, pontuação e posição. Seção
   separada lista as ações eliminadas com o motivo.

## Estrutura de arquivos

```
.
├── index.html
├── netlify.toml
├── package.json
├── tsconfig.json
├── vite.config.ts
├── rules.md
├── netlify/
│   └── functions/
│       └── stocks.ts              # proxy + parser Fundamentus
├── src/
│   ├── main.ts
│   ├── shared/stocks/config.ts    # filtros, pesos, direções (fonte única)
│   ├── assets/
│   │   ├── stocks/adapter.ts      # HTML → modelo (resultado + detalhes)
│   │   └── fiis/                  # placeholder de expansão
│   ├── core/
│   │   ├── filters.ts             # identifica bancos ANTES do filtro de ML
│   │   ├── ranking/
│   │   │   ├── ordinal.ts         # dense rank; ausente = pior
│   │   │   └── neutral-bank.ts    # rank médio neutro de ML p/ bancos
│   │   ├── score.ts               # soma ponderada (pesos fixos)
│   │   ├── tiebreak.ts            # ROE → DY → P/L → Liquidez
│   │   ├── pipeline.ts            # orquestrador
│   │   └── types.ts
│   ├── infra/
│   │   ├── api.ts                 # GET /api/stocks
│   │   └── storage.ts             # localStorage (snapshot + timestamp)
│   ├── ui/
│   │   ├── app.ts
│   │   ├── types.ts
│   │   ├── components/
│   │   │   ├── RefreshButton.ts
│   │   │   ├── RankingTable.ts
│   │   │   ├── FiltersPanel.ts
│   │   │   └── RejectedPanel.ts
│   │   └── styles/main.css
│   └── utils/
│       ├── bank-detect.ts
│       └── number-br.ts
└── tests/core/                    # vitest: filtros, ranking, neutral-bank, pipeline
```

## Rodando localmente

Pré-requisitos: Node.js 20+.

```bash
npm install
```

### Opção 1 — Tudo junto (frontend + função) via Netlify CLI

```bash
npx netlify dev
# http://localhost:8888
```

O `netlify dev` sobe o Vite e a função `/api/stocks` no mesmo host, reproduzindo
fielmente o ambiente de produção. O botão "Atualizar dados" dispara a função,
que faz o scraping no servidor e devolve JSON — é esse o único caminho para
obter dados frescos.

### Opção 2 — Apenas o Vite (UI offline)

Útil para trabalhar na interface usando o último snapshot salvo em
`localStorage`:

```bash
npm run dev:vite
```

Nesse modo, o endpoint `/api/stocks` não existe — clicar no botão retorna
erro. Use o Netlify CLI para dados reais.

### Testes

```bash
npm test
```

Cobrem: filtros (com regra especial de bancos), rank ordinal com ausentes
= pior rank, rank médio neutro em ML e pipeline completo (top 10, desempate,
flags).

### Build de produção

```bash
npm run build
```

Gera `dist/` (estático). As Netlify Functions são empacotadas separadamente
no deploy.

## Deploy no Netlify

### A) Conectando o repositório

1. No painel Netlify → **Add new site → Import an existing project** e
   selecione este repositório.
2. Configurações serão detectadas automaticamente via `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   - Node 20.
3. Deploy. Em ~1 minuto o site fica disponível em uma URL `*.netlify.app`.

### B) Deploy manual (zip)

1. `npm install && npm run build` localmente.
2. Crie um zip contendo **a raiz do projeto** (incluindo `dist/`,
   `netlify/functions/`, `netlify.toml`, `package.json`). O Netlify
   precisa das funções-fonte para bundlá-las.
3. No painel Netlify → **Sites → Deploy manually** e solte o zip.

> Observação: um zip contendo apenas `dist/` não inclui a função serverless
> e o botão "Atualizar dados" vai retornar erro. Sempre inclua
> `netlify/functions/` e `netlify.toml`.

## CORS

Fundamentus não serve `Access-Control-Allow-Origin`. A função em
`netlify/functions/stocks.ts` faz a requisição server-side (sem restrição de
CORS) e devolve JSON com `Access-Control-Allow-Origin: *`. O navegador só
conversa com `/api/stocks` do próprio site.

## Tratamento de dados ausentes

- Filtros eliminatórios: campo ausente/inválido ⇒ **eliminação** com motivo
  específico (exceto ML em bancos, que é ignorado no filtro).
- Ranking ordinal: ausentes/`NaN` ⇒ **pior rank** do indicador. Múltiplos
  ausentes compartilham o mesmo pior rank.
- **Não há recalibragem dinâmica** por soma de pesos. Os pesos
  `ROE 2.0 | ML 2.0 | P/L 1.5 | DY 1.0 | P/VP 1.0 | Liquidez 1.0` são
  fixos e aplicados igualmente a bancos e não-bancos.
- Flags no relatório sinalizam bancos com rank médio neutro em ML e
  indicadores ausentes.

## Status

Funcional:

- [x] Coleta via função serverless (resultado.php + detalhes.php)
- [x] Limite de concorrência nas chamadas a detalhes.php
- [x] Identificação de bancos antes do filtro de ML
- [x] Filtros eliminatórios do `rules.md`
- [x] Rank ordinal dense com "ausente = pior rank"
- [x] Rank médio neutro em ML para bancos (calculado apenas sobre não-bancos
      com valor válido); peso de ML permanece 2.0
- [x] Pontuação ponderada com pesos fixos, sem recalibragem
- [x] Desempate ROE → DY → P/L → Liquidez
- [x] UI: botão "Atualizar dados", tabela ordenável, filtros aplicados,
      eliminados, destaque do Top 10, responsivo
- [x] Persistência local do último snapshot (sem dispara coleta no reload)
- [x] Testes do núcleo

Pendente/futuro:

- [ ] Módulo de FIIs (`src/assets/fiis/` já reservado, núcleo pronto para
      reuso)
- [ ] Deploy hospedado — faça você mesmo via Netlify seguindo "Deploy no
      Netlify" acima (a entrega é este repositório pronto para publicação).
