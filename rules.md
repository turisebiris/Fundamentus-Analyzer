# Fundamentus Analyzer – Regras do Sistema

## Objetivo

Criar um aplicativo web para análise e ranking de ações do mercado brasileiro com base em critérios quantitativos, utilizando dados do site Fundamentus.

A versão inicial contempla apenas ações. A arquitetura deve permitir expansão futura para FIIs.

---

## Fonte de dados

https://fundamentus.com.br/

---

## Requisitos gerais

* O app deve ter interface web acessível por URL
* Os dados devem ser atualizados apenas manualmente por botão “Atualizar dados”
* Não deve haver atualização automática
* Caso não seja possível hospedar, gerar projeto pronto para deploy, por exemplo Netlify
* Scraping não deve ocorrer no frontend, devido a CORS

---

## Fluxo do sistema

1. Coletar dados do Fundamentus
2. Aplicar filtros eliminatórios
3. Calcular percentil por indicador
4. Aplicar pesos
5. Calcular score final
6. Gerar ranking geral
7. Exibir apenas as 10 melhores ações

---

## Filtros eliminatórios

A ação só permanece se atender a todos os critérios:

* Dividend Yield ≥ 6%
* P/L entre 3 e 10
* Margem Líquida > 10%, exceto bancos
* P/VP < 10
* ROE > 12%
* Liquidez média de 2 meses > 1.000.000

---

## Regra especial para bancos

* Bancos não devem ser eliminados pelo critério de Margem Líquida
* Margem Líquida não deve ser usada no cálculo da pontuação para bancos
* O sistema deve identificar bancos corretamente via setor e subsetor
* Indicadores não aplicáveis devem ser excluídos do cálculo de forma limpa
* O relatório deve sinalizar claramente quando um indicador foi excluído

---

## Direção dos indicadores

| Indicador      | Melhor |
| -------------- | ------ |
| Dividend Yield | Maior  |
| P/L            | Menor  |
| Margem Líquida | Maior  |
| P/VP           | Menor  |
| ROE            | Maior  |
| Liquidez       | Maior  |

---

## Método de pontuação

### Conversão para percentil

Cada indicador deve ser convertido em uma escala de 0 a 1, considerando apenas as ações aprovadas nos filtros:

* Melhor valor do indicador → 1
* Pior valor → 0
* Valores intermediários → distribuídos proporcionalmente entre 0 e 1

A direção do indicador deve ser respeitada:

* Maior melhor → maior valor recebe maior percentil
* Menor melhor → menor valor recebe maior percentil

---

### Exclusão limpa

Quando um indicador não se aplica a um ativo:

* O indicador deve ser excluído do cálculo
* Nenhum valor neutro ou artificial deve ser atribuído
* Os pesos devem ser ajustados automaticamente considerando apenas os indicadores aplicáveis

---

## Pesos dos indicadores

* ROE = 2.0
* Margem Líquida = 2.0
* P/L = 1.5
* Dividend Yield = 1.0
* P/VP = 1.0
* Liquidez = 1.0

---

## Cálculo da pontuação

Para cada ação, o score final deve ser calculado da seguinte forma:

1. Para cada indicador aplicável:

   * calcular o percentil no intervalo de 0 a 1
   * aplicar o peso correspondente

2. Somar os valores ponderados:
   Soma ponderada = Σ (percentil_indicador × peso_indicador)

3. Somar os pesos dos indicadores utilizados:
   Soma dos pesos = Σ (peso_indicador aplicável)

4. Calcular o score final:
   Score final = Soma ponderada / Soma dos pesos

### Regras do score

* O score final deve variar entre 0 e 1
* Quanto maior o score, melhor a ação
* Indicadores não aplicáveis não entram no cálculo
* Os pesos devem ser recalculados implicitamente pela soma dos pesos utilizados

---

## Tratamento de dados

* Não utilizar ranking ordinal
* Não utilizar rank neutro
* Não utilizar penalidades artificiais
* Dados inválidos devem eliminar o ativo com motivo claro
* Indicadores não aplicáveis devem ser sinalizados no relatório
* Todos os ativos devem permanecer comparáveis através da renormalização dos pesos

---

## Desempate

Ordem de desempate:

1. Maior ROE
2. Maior Dividend Yield
3. Menor P/L
4. Maior liquidez

---

## Saída do relatório

### Informações gerais

* Data e hora da última atualização
* Quantidade total de ações analisadas
* Quantidade que passou nos filtros

### Ranking final (Top 10)

Para cada ação:

* Ticker
* Nome da empresa, se disponível
* Setor, se disponível
* Dividend Yield
* P/L
* Margem Líquida
* P/VP
* ROE
* Liquidez
* Percentil de cada indicador
* Score final
* Posição final

### Ações eliminadas

* Lista das ações excluídas
* Motivo da exclusão

---

## Interface

O sistema deve conter:

* Botão “Atualizar dados”
* Tabela principal com ordenação
* Painel de filtros aplicados
* Painel de ações eliminadas
* Destaque visual para o Top 10
* Layout responsivo

---

## Arquitetura esperada

O código deve ser organizado em módulos:

* coleta de dados
* normalização
* filtros
* pontuação
* interface

Deve permitir expansão futura para FIIs sem alteração do núcleo do sistema.

---

## Qualidade

* Código limpo e modular
* Tratamento de erro robusto
* Parsing isolado e documentado
* Evitar lógica ambígua ou implícita

---

## Entrega

O sistema deve:

* funcionar localmente
* estar pronto para deploy
* ou ser entregue em formato pronto para hospedagem, por exemplo zip

---

## Instrução final

Antes de implementar:

* apresentar plano técnico
* explicar arquitetura e decisões
* aguardar confirmação

Somente após aprovação, iniciar implementação
