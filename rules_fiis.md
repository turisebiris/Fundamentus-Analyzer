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
* é apenas filtro

---

## Método de pontuação

### Conversão para percentil

Cada indicador deve ser convertido em uma escala de 0 a 1, considerando apenas os FIIs aprovados nos filtros:

* Melhor valor do indicador → 1
* Pior valor → 0
* Valores intermediários → distribuídos proporcionalmente entre 0 e 1

A direção do indicador deve ser respeitada:

* Maior melhor → maior valor recebe maior percentil
* Menor melhor → menor valor recebe maior percentil

---

### Exclusão limpa

Quando um indicador não se aplica ao FII:

* O indicador deve ser excluído do cálculo
* Nenhum valor neutro ou artificial deve ser atribuído
* Os pesos devem ser ajustados automaticamente considerando apenas os indicadores aplicáveis

#### Aplicação prática

Para FIIs multicategoria:

* Vacância Média deve ser excluída do cálculo
* Qtd de imóveis já não participa do ranking

---

## Pesos dos indicadores

* Dividend Yield = 1.5
* P/VP = 2.0
* Liquidez = 1.0
* Vacância Média = 1.5

---

## Cálculo da pontuação

Para cada FII, o score final deve ser calculado da seguinte forma:

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
* Quanto maior o score, melhor o FII
* Indicadores não aplicáveis não entram no cálculo
* Os pesos são automaticamente renormalizados pela soma dos pesos utilizados

---

## Tratamento de dados

* Não utilizar ranking ordinal
* Não utilizar rank neutro
* Não utilizar penalidades artificiais
* Indicadores não aplicáveis devem ser excluídos do cálculo
* Dados inválidos devem eliminar o FII com motivo claro
* Todos os FIIs devem permanecer comparáveis através da renormalização dos pesos

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

---

### Ranking final

A tabela principal deve exibir **apenas os 10 melhores FIIs (Top 10)**.

Para cada FII:

* Papel
* Segmento
* Cotação
* Dividend Yield
* P/VP
* Liquidez
* Qtd de imóveis
* Vacância Média
* Percentil de cada indicador
* Score final
* Posição

---

### Reprovados

* lista de FIIs eliminados
* motivo da eliminação

---

## Interface

* Criar aba separada para FIIs
* Manter a aba de ações intacta
* Utilizar mesma estrutura visual
* A tabela principal deve ser limitada ao Top 10

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
