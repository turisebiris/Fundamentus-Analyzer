import { describe, it, expect } from 'vitest';
import { normalizeFiiName } from '../../src/utils/fii-name-normalize.js';

describe('normalizeFiiName', () => {
  it('trunca a partir de "FUNDO" e remove sufixo jurídico', () => {
    expect(
      normalizeFiiName(
        'IRIDIUM FUNDO DE INVESTIMENTO IMOBILIÁRIO RESPONSABILIDADE LIMITADA',
      ),
    ).toBe('IRIDIUM');
  });

  it('trunca a partir de "FII"', () => {
    expect(normalizeFiiName('CSHG LOGÍSTICA FII')).toBe('CSHG LOGÍSTICA');
  });

  it('trunca a partir de "FIAGRO"', () => {
    expect(normalizeFiiName('VALORA FIAGRO RESPONSABILIDADE LIMITADA')).toBe('VALORA');
  });

  it('trunca a partir de "RESPONSABILIDADE LIMITADA"', () => {
    expect(normalizeFiiName('XPTO CAPITAL RESPONSABILIDADE LIMITADA')).toBe('XPTO CAPITAL');
  });

  it('preserva nomes compostos sem palavras-chave', () => {
    expect(normalizeFiiName('RB CAPITAL RENDA I')).toBe('RB CAPITAL RENDA I');
  });

  it('preserva nome se truncagem produzir vazio (começa com palavra-chave)', () => {
    expect(normalizeFiiName('FII MAXI RENDA')).toBe('FII MAXI RENDA');
  });

  it('faz trim do resultado', () => {
    expect(normalizeFiiName('  KINEA RENDIMENTOS FII  ')).toBe('KINEA RENDIMENTOS');
  });

  it('remove pontuação trailing após truncagem', () => {
    expect(normalizeFiiName('XPTO - FUNDO DE INVESTIMENTO')).toBe('XPTO');
    expect(normalizeFiiName('XPTO, FUNDO DE INVESTIMENTO')).toBe('XPTO');
  });

  it('case-insensitive: trata "Fundo" minúsculo igual', () => {
    expect(normalizeFiiName('Iridium Fundo de Investimento')).toBe('Iridium');
  });

  it('não confunde palavras que contêm a palavra-chave (ex.: PROFUNDO)', () => {
    expect(normalizeFiiName('PROFUNDO CAPITAL')).toBe('PROFUNDO CAPITAL');
  });
});
