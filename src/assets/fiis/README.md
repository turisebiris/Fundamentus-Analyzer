# Módulo FIIs (placeholder)

Este diretório reserva o espaço para o módulo de FIIs (Fundos de Investimento
Imobiliário). A arquitetura do núcleo (`src/core/pipeline.ts`, ranking ordinal,
score ponderado, desempate) é agnóstica ao ativo: basta acrescentar aqui

- `config.ts` com filtros, pesos e direções específicas de FIIs
- `adapter.ts` com parser da página `https://fundamentus.com.br/fii_resultado.php`

e uma rota/pipeline paralelo reusando `core/`, sem alterações no núcleo.
