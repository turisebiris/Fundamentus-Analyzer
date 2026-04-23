/**
 * Identificação de tipo de empresa a partir de setor/subsetor do Fundamentus
 * (página detalhes.php). Usado pelo pipeline de ações para aplicar clean
 * exclusion de Margem Líquida a três categorias onde "margem" não é
 * comparável com empresas operacionais comuns:
 *
 *   - Bancos:       resultado vem de spread/tarifas; margem não se aplica.
 *   - Seguradoras:  margem reflete prêmios emitidos vs sinistros/reservas.
 *   - Holdings:     resultado consolidado é dominado por equivalência
 *                   patrimonial das controladas; receita isolada distorce ML.
 *
 * IMPORTANTE — heurística sujeita a correção contra dados reais: as strings
 * de setor/subsetor do Fundamentus não têm especificação pública estável.
 * Os markers abaixo cobrem variações comuns; adicione novos conforme a
 * observação do scrape (ver tickers de referência nos testes).
 */

const BANK_MARKERS = [
  'banco',
  'bancos',
  'intermediarios financeiros',
];

const INSURER_MARKERS = [
  'seguradora',
  'seguradoras',
  'seguros',
  'previdencia e seguros',
];

const HOLDING_MARKERS = [
  'holding',
  'holdings',
  'holdings diversificadas',
];

function normalize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function matchesAny(markers: readonly string[], sector: string, subsector: string): boolean {
  return markers.some(
    (marker) => sector.includes(marker) || subsector.includes(marker),
  );
}

export interface CompanyTypeInput {
  sector: string | null;
  subsector: string | null;
}

export interface CompanyTypeFlags {
  isBank: boolean;
  isInsurer: boolean;
  isHolding: boolean;
}

export function isBank(input: CompanyTypeInput): boolean {
  const sector = normalize(input.sector);
  const subsector = normalize(input.subsector);
  if (!sector && !subsector) return false;
  return matchesAny(BANK_MARKERS, sector, subsector);
}

export function isInsurer(input: CompanyTypeInput): boolean {
  const sector = normalize(input.sector);
  const subsector = normalize(input.subsector);
  if (!sector && !subsector) return false;
  // Evita falso positivo de bancos cujo subsetor é "Intermediários Financeiros":
  // nenhum marker de seguradora colide com os de banco, mas a checagem dupla
  // mantém a classificação simétrica caso alguém adicione aliases genéricos.
  if (matchesAny(BANK_MARKERS, sector, subsector)) return false;
  return matchesAny(INSURER_MARKERS, sector, subsector);
}

export function isHolding(input: CompanyTypeInput): boolean {
  const sector = normalize(input.sector);
  const subsector = normalize(input.subsector);
  if (!sector && !subsector) return false;
  if (matchesAny(BANK_MARKERS, sector, subsector)) return false;
  if (matchesAny(INSURER_MARKERS, sector, subsector)) return false;
  return matchesAny(HOLDING_MARKERS, sector, subsector);
}

export function classifyCompanyType(input: CompanyTypeInput): CompanyTypeFlags {
  return {
    isBank: isBank(input),
    isInsurer: isInsurer(input),
    isHolding: isHolding(input),
  };
}
