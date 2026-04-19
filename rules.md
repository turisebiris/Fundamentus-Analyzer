Crie um aplicativo web para análise e ranking de ações e FIIs do mercado brasileiro, com foco em filtros quantitativos e atualização manual dos dados.

Objetivo geral:
O app deve coletar dados fundamentalistas do mercado brasileiro a partir do site Fundamentus e gerar rankings com base em critérios quantitativos definidos por mim. A prioridade inicial é implementar o módulo de ações. Depois poderemos expandir para FIIs.

Fonte de dados:
Use como fonte principal o site Fundamentus:
https://fundamentus.com.br/

Requisitos gerais:

1. O app deve ter interface web.
2. O relatório precisa poder ser acessado por URL em qualquer dispositivo.
3. Os dados não devem atualizar automaticamente em segundo plano. A atualização deve acontecer apenas quando eu clicar em um botão do tipo “Atualizar dados”.
4. Caso você não consiga hospedar o app, gere um projeto pronto para deploy estático, com arquivos organizados e um index funcional, empacotado em .zip, para que eu possa subir no Netlify.
5. Se for necessário usar API externa, scraping estruturado, proxy, backend serverless ou integração com alguma chave, me informe exatamente o que precisa. Se precisar, posso fornecer chave via Google AI Studio.

Escopo inicial:
Implemente primeiro apenas o ranking de ações brasileiras.
Estruture o código de forma que futuramente seja fácil adicionar um módulo separado para FIIs.

Lógica do ranking de ações:
O sistema deve:

1. Coletar os dados das ações no Fundamentus.
2. Aplicar os filtros eliminatórios abaixo.
3. Para as ações aprovadas, calcular ranking por indicador.
4. Somar as pontuações dos indicadores com pesos definidos.
5. Gerar um ranking geral final.
6. Limitar a saída às 10 melhores ações aprovadas.

Filtros eliminatórios para ações:
A ação só permanece na análise se passar nestes critérios:

* Dividend Yield >= 6%
* P/L entre 3 e 10
* Margem Líquida > 10%
* P/VP < 10
* ROE > 12%
* Liquidez média de 2 meses > 1.000.000
* CAGR de receita > 10%, mas se esse dado não existir, manter a ação mesmo assim

Regra especial para bancos:

* Para bancos, ignorar o filtro de Margem Líquida, porque esse indicador pode não ser aplicável ou vir zerado nessa fonte
* Mesmo ignorando o filtro para bancos, trate esse caso com consistência também na etapa de ranking, evitando penalização injusta por campo ausente ou estruturalmente inválido

Direção de preferência de cada indicador:
Considere como “melhor”:

* Dividend Yield: maior é melhor
* P/L: menor é melhor
* Margem Líquida: maior é melhor
* P/VP: menor é melhor
* ROE: maior é melhor
* Liquidez 2 meses: maior é melhor
* CAGR de receita: maior é melhor

Método de pontuação:
Após aplicar os filtros, faça um ranking ordinal por indicador entre as ações restantes.

Exemplo:

* A melhor ação em Dividend Yield recebe nota 1
* A segunda melhor recebe nota 2
* E assim por diante

Importante:

* A menor pontuação total deve representar a melhor ação
* Ou seja, menor soma final = melhor colocação no ranking geral

Pesos de cada indicador:
A nota de cada indicador deve ser multiplicada pelo peso abaixo antes da soma final:

* ROE = peso 2.0
* Margem Líquida = peso 2.0
* P/L = peso 1.5
* Dividend Yield = peso 1.0
* P/VP = peso 1.0
* CAGR de receita = peso 1.0
* Liquidez 2 meses = peso 1.0

Fórmula conceitual:
Pontuação total =
(rank_ROE × 2.0) +
(rank_MargemLiquida × 2.0) +
(rank_PL × 1.5) +
(rank_DY × 1.0) +
(rank_PVP × 1.0) +
(rank_CAGR × 1.0) +
(rank_Liquidez × 1.0)

Tratamento de dados ausentes:
Defina regras explícitas e robustas para dados faltantes, inválidos ou não aplicáveis.

Regras desejadas:

1. Se CAGR de receita não existir, a ação não deve ser eliminada.
2. Na etapa de ranking, se CAGR estiver ausente, escolha uma estratégia consistente e documentada. Preferência:

   * ou excluir o indicador daquela ação e recalibrar de forma justa,
   * ou atribuir penalidade padronizada claramente definida.
3. Para bancos, a Margem Líquida não deve causar eliminação nem distorcer injustamente o ranking.
4. O app deve registrar no resultado quando algum indicador foi ignorado, ausente ou tratado por regra especial.

Desempate:
Se duas ações tiverem a mesma pontuação total, desempate nesta ordem:

1. Maior ROE
2. Maior Dividend Yield
3. Menor P/L
4. Maior liquidez de 2 meses

Saída esperada no relatório:
O relatório final deve mostrar:

1. Data e hora da última atualização
2. Quantidade total de ações analisadas
3. Quantidade que passou pelos filtros
4. Ranking final das 10 melhores ações
5. Para cada ação listada, mostrar:

   * ticker
   * nome da empresa, se disponível
   * setor, se disponível
   * Dividend Yield
   * P/L
   * Margem Líquida
   * P/VP
   * ROE
   * Liquidez 2 meses
   * CAGR de receita
   * nota/rank de cada indicador
   * pontuação ponderada total
   * posição final no ranking
6. Mostrar também o motivo de exclusão das ações reprovadas, idealmente em uma aba ou seção separada

Interface desejada:
Crie uma interface limpa e objetiva com:

* botão “Atualizar dados”
* tabela principal com ordenação
* opção de visualizar os filtros aplicados
* opção de visualizar as ações eliminadas e o motivo
* destaque visual para o top 10
* layout responsivo para desktop e mobile

Arquitetura desejada:
Quero um app organizado e fácil de manter. Estruture em módulos, por exemplo:

* coleta e parsing de dados
* normalização e limpeza
* aplicação de filtros
* cálculo dos ranks
* cálculo da pontuação ponderada
* geração de relatório
* interface

Qualidade e robustez:

1. O código deve ser legível e bem organizado.
2. Trate falhas de scraping, timeout, bloqueio, mudança de estrutura HTML e campos ausentes.
3. Documente claramente onde os seletores/parsers do Fundamentus estão sendo usados.
4. Evite lógica obscura. Prefira funções pequenas e explícitas.
5. Se houver limitação do Fundamentus para scraping direto no front-end, implemente abordagem adequada com backend ou função serverless.

Entrega:
Quero que você faça uma destas duas opções:

1. Hospede e me entregue uma URL funcional, ou
2. Gere um projeto completo pronto para deploy, com index e estrutura correta, empacotado em zip para Netlify

Antes de começar a codar, descreva em poucas linhas:

* a arquitetura que você vai usar
* como vai coletar os dados
* como vai lidar com CORS / scraping / atualização manual
* como vai tratar dados ausentes e regras especiais para bancos

Depois disso, implemente o projeto.
