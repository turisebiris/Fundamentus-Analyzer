# Fundamentus Analyzer – Regras do Sistema

## Objetivo

Criar um aplicativo web para análise e ranking de ações do mercado brasileiro com base em critérios quantitativos, utilizando dados do site Fundamentus.

A versão inicial contempla apenas **ações**. A arquitetura deve permitir expansão futura para FIIs.

---

## Fonte de dados

https://fundamentus.com.br/

---

## Requisitos gerais

1. O app deve ter interface web acessível por URL
2. Os dados devem ser atualizados **apenas manualmente** por botão “Atualizar dados”
3. Não deve haver atualização automática
4. Caso não seja possível hospedar, gerar projeto pronto para deploy (ex: Netlify)
5. Scraping não deve ocorrer no frontend (devido a CORS)

---

## Fluxo do sistema

1. Coletar dados do Fundamentus
2. Aplicar filtros eliminatórios
3. Calcular ranking por indicador
4. Aplicar pesos
5. Somar pontuação final
6. Gerar ranking geral
7. Exibir apenas as 10 melhores ações

---

## Filtros eliminatórios

A ação só permanece se atender a todos os critérios:

* Dividend Yield ≥ 6%
* P/L entre 3 e 10
* Margem Líquida > 10% (exceto bancos)
* P/VP < 10
* ROE > 12%
* Liquidez média de 2 meses > 1.000.000

---

## Regra especial para bancos

* Bancos **não devem ser eliminados** pelo critério de Margem Líquida
* No ranking de Margem Líquida:

  * Bancos devem receber **rank médio neutro**
  * O rank médio deve ser calculado com base nas demais empresas válidas
* O peso da Margem Líquida deve ser mantido normalmente na pontuação final
* O sistema deve identificar bancos corretamente via setor/subsetor

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

## Método de ranking

* Ranking **ordinal**
* Melhor valor recebe rank 1
* Segundo melhor rank 2, e assim por diante

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

Pontuação total =

(rank_ROE × 2.0) +
(rank_MargemLiquida × 2.0) +
(rank_PL × 1.5) +
(rank_DY × 1.0) +
(rank_PVP × 1.0) +
(rank_Liquidez × 1.0)

* A menor pontuação é a melhor
* O ranking final deve ser ordenado por menor pontuação total

---

## Tratamento de dados

* Não utilizar recalibragem dinâmica por soma de pesos
* Todos os ativos devem permanecer comparáveis
* Dados inválidos ou ausentes devem ser tratados de forma neutra
* Indicadores não aplicáveis devem ser claramente sinalizados no relatório

---

## Desempate

Ordem de desempate:

1. Maior ROE
2. Maior Dividend Yield
3. Menor P/L
4. Maior liquidez

---

## Saída do relatório

O relatório deve conter:

### Informações gerais

* Data e hora da última atualização
* Quantidade total de ações analisadas
* Quantidade que passou nos filtros

### Ranking final (Top 10)

Para cada ação:

* Ticker
* Nome da empresa (se disponível)
* Setor (se disponível)
* Dividend Yield
* P/L
* Margem Líquida
* P/VP
* ROE
* Liquidez
* Rank de cada indicador
* Pontuação total
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
* ranking
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
* ou ser entregue em formato pronto para hospedagem (ex: zip)

---

## Instrução final

Antes de implementar:

* Apresentar plano técnico
* Explicar arquitetura e decisões
* Aguardar confirmação

Somente após aprovação, iniciar implementação
