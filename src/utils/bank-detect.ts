/**
 * Identificação de bancos a partir dos campos setor/subsetor do Fundamentus
 * (página detalhes.php?papel=TICKER).
 *
 * Classificação B3/Fundamentus para bancos tradicionais:
 *   Setor:    "Financeiros"
 *   Subsetor: "Intermediários Financeiros"
 *   Segmento: "Bancos"  (não exposto diretamente em detalhes.php)
 *
 * Usamos o subsetor como sinal primário, com fallback por texto do nome do subsetor,
 * porque Fundamentus mistura "Intermediários Financeiros" no subsetor e, em alguns
 * casos, traz "Bancos" explicitamente. Mantemos a heurística isolada aqui para
 * facilitar ajustes sem tocar no pipeline.
 */

const BANK_SUBSECTOR_MARKERS = [
  'banco',
  'bancos',
  'intermediários financeiros',
  'intermediarios financeiros',
];

function normalize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

export function isBank(input: { sector: string | null; subsector: string | null }): boolean {
  const subsector = normalize(input.subsector);
  const sector = normalize(input.sector);

  if (!subsector && !sector) return false;

  return BANK_SUBSECTOR_MARKERS.some(
    (marker) => subsector.includes(normalize(marker)) || sector.includes(normalize(marker)),
  );
}
