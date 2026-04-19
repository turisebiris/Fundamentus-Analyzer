# Fundamentus Analyzer – Regras do Sistema para FIIs

## Objetivo

Criar uma aba separada para análise e ranking de FIIs do mercado brasileiro, com regras próprias e independentes do módulo de ações.

A fonte de dados será exclusivamente o Fundamentus.

---

## Fonte de dados

https://fundamentus.com.br/

As colunas utilizadas devem ser **exatamente**:

* Papel
* Segmento
* Cotação
* Dividend Yield
* P/VP
* Liquidez
* Qtd de imóveis
* Vacância Média

Nenhum outro campo deve ser utilizado nesta versão.

---

## Requisitos gerais

1. A aba de FIIs deve ser separada da aba de ações
2. O pipeline de FIIs deve ser independente
3. Os dados devem atualizar apenas manualmente por botão
4. Não deve haver atualização automática
5. Não utilizar dados externos ao Fundamentus
6. Caso alguma dessas colunas não esteja disponível, o sistema deve falhar com erro claro

---

## Segmentos considerados

Serão analisados apenas FIIs com:

* Segmento = **Logística**
* Segmento = **Multicategoria**

Todos os outros segmentos devem ser excluídos.

---

## Classificação dos FIIs

* FIIs com segmento **Logística**:

  * tratados como FIIs de tijolo
  * utilizam todos os indicadores normalmente

* FIIs com segmento **Multicategoria**:

  * tratados como FIIs híbridos
  * NÃO devem utilizar:

    * Vacância Média
    * Qtd de imóveis (somente filtro em logística)

---

## Filtros eliminatórios gerais

O FII só permanece se atender a todos os critérios:

* Dividend Yield ≥ 7%
* Liquidez ≥ 500000
* P/VP entre 0.7 e 1.1

---

## Regras específicas para FIIs de logística

Além dos filtros gerais:

* Qtd de imóveis > 3
* Vacância Média ≤ 10%

Se qualquer desses critérios não for atendido:

* o FII deve ser eliminado

---

## Regras para FIIs multicategoria

* Qtd de imóveis não é considerada
* Vacância Média não é considerada

### Tratamento neutro

Para Vacância Média:

* calcular o rank médio dos FIIs logísticos válidos
* arredondar para o inteiro mais próximo
* atribuir ao FII multicategoria

---

## Direção dos indicadores

| Indicador      | Melhor |
| -------------- | ------ |
| Dividend Yield | Maior  |
| P/VP           | Menor  |
| Liquidez       | Maior  |
| Vacância Média | Menor  |

**Observação:**

* Qtd de imóveis NÃO participa do ranking

---

## Método de ranking

* Ranking ordinal (dense ranking)
* Melhor valor recebe rank 1
* Não utilizar valores contínuos diretamente

### Tratamento neutro

Para indicadores não aplicáveis:

* calcular o rank médio das observações válidas
* arredondar para o inteiro mais próximo
* atribuir ao FII

---

## Pesos dos indicadores

* Dividend Yield = 1.5
* P/VP = 2.0
* Liquidez = 1.0
* Vacância Média = 1.5

---

## Cálculo da pontuação

Pontuação total =

(rank_DY × 1.5) +
(rank_PVP × 2.0) +
(rank_Liquidez × 1.0) +
(rank_Vacancia × 1.5)

* Menor pontuação = melhor FII

---

## Tratamento de dados

* Não utilizar recalibragem dinâmica
* Não ajustar pesos por ausência de dados
* Indicadores não aplicáveis devem usar rank neutro
* Caso uma coluna obrigatória não exista, o sistema deve falhar com erro explícito

---

## Desempate

Ordem:

1. Menor P/VP
2. Maior Dividend Yield
3. Maior liquidez
4. Menor vacância

---

## Saída do relatório

### Informações gerais

* data e hora da última atualização
* quantidade de FIIs analisados
* quantidade aprovados

### Ranking final

Para cada FII:

* Papel
* Segmento
* Cotação
* Dividend Yield
* P/VP
* Liquidez
* Qtd de imóveis
* Vacância Média
* Rank por indicador
* Pontuação final
* Posição

### Reprovados

* lista de FIIs eliminados
* motivo da eliminação

---

## Interface

* Criar aba separada para FIIs
* Manter a aba de ações intacta
* Utilizar mesma estrutura visual

---

## Arquitetura

* Criar módulo separado: `assets/fiis/`
* Não reutilizar regras de ações
* Reutilizar apenas infraestrutura comum (UI, fetch, pipeline base)

---

## Instrução final

Antes de implementar:

1. Validar que todas as colunas existem no Fundamentus
2. Confirmar que Segmento, Vacância e Qtd de imóveis são consistentes
3. Só após validação, iniciar implementação

Nenhuma suposição deve ser feita fora desses dados
