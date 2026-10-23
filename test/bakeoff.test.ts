import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPtBrLexicon,
  convertCurrency,
  convertMeasures,
  convertTimes,
  convertBrazilianUfs,
  applyBrazilianAbbreviations,
  ESTADOS_BRASILEIROS,
} from '../src/oscar-engine/sanitizer/ptBrLexicon.ts';
import { sanitizeWithProvenance } from '../src/oscar-engine/sanitizer/normalizationMap.ts';
import {
  runBakeOff,
  generateMarkdownBakeOffReport,
  TTS_UTILS_BAKEOFF_DATASET,
} from '../src/oscar-engine/evaluation/index.ts';

// ---------------------------------------------------------------------------
// 1. Dicionário Completo de 27 UFs Brasileiras
// ---------------------------------------------------------------------------
test('BakeOff: All 27 Brazilian UFs are present and expanded in context', () => {
  assert.equal(Object.keys(ESTADOS_BRASILEIROS).length, 27);

  // UFs com hífen e barra
  assert.ok(convertBrazilianUfs('São Paulo - SP').includes('São Paulo - São Paulo'));
  assert.ok(convertBrazilianUfs('Curitiba/PR').includes('Curitiba - Paraná'));
  assert.ok(convertBrazilianUfs('Belo Horizonte - MG').includes('Minas Gerais'));
  assert.ok(convertBrazilianUfs('Porto Alegre - RS').includes('Rio Grande do Sul'));
  assert.ok(convertBrazilianUfs('Recife/PE').includes('Pernambuco'));
  assert.ok(convertBrazilianUfs('Salvador - BA').includes('Bahia'));
  assert.ok(convertBrazilianUfs('Brasília - DF').includes('Distrito Federal'));
  assert.ok(convertBrazilianUfs('Manaus/AM').includes('Amazonas'));
  assert.ok(convertBrazilianUfs('Belém - PA').includes('Pará'));
  assert.ok(convertBrazilianUfs('Fortaleza/CE').includes('Ceará'));
  assert.ok(convertBrazilianUfs('Goiânia - GO').includes('Goiás'));
  assert.ok(convertBrazilianUfs('Florianópolis/SC').includes('Santa Catarina'));
  assert.ok(convertBrazilianUfs('Vitória - ES').includes('Espírito Santo'));
  assert.ok(convertBrazilianUfs('Cuiabá/MT').includes('Mato Grosso'));
  assert.ok(convertBrazilianUfs('Campo Grande - MS').includes('Mato Grosso do Sul'));
  assert.ok(convertBrazilianUfs('São Luís/MA').includes('Maranhão'));
  assert.ok(convertBrazilianUfs('João Pessoa - PB').includes('Paraíba'));
  assert.ok(convertBrazilianUfs('Natal/RN').includes('Rio Grande do Norte'));
  assert.ok(convertBrazilianUfs('Maceió - AL').includes('Alagoas'));
  assert.ok(convertBrazilianUfs('Teresina/PI').includes('Piauí'));
  assert.ok(convertBrazilianUfs('Aracaju - SE').includes('Sergipe'));
  assert.ok(convertBrazilianUfs('Porto Velho/RO').includes('Rondônia'));
  assert.ok(convertBrazilianUfs('Palmas - TO').includes('Tocantins'));
  assert.ok(convertBrazilianUfs('Rio Branco/AC').includes('Acre'));
  assert.ok(convertBrazilianUfs('Macapá - AP').includes('Amapá'));
  assert.ok(convertBrazilianUfs('Boa Vista/RR').includes('Roraima'));

  // Órgãos judiciais e institucionais
  assert.ok(convertBrazilianUfs('TJSP').includes('Tribunal de Justiça de São Paulo'));
  assert.ok(convertBrazilianUfs('TJRJ').includes('Tribunal de Justiça de Rio de Janeiro'));
  assert.ok(convertBrazilianUfs('OAB/SP').includes('O A B São Paulo'));
  assert.ok(convertBrazilianUfs('Estado de SP').includes('Estado de São Paulo'));
});

// ---------------------------------------------------------------------------
// 2. Conversão de Moeda Brasileira com Pontuação Real
// ---------------------------------------------------------------------------
test('BakeOff: Brazilian Currency conversion with real punctuation, millions and cents', () => {
  // Centavos e valores mínimos singulares
  assert.equal(convertCurrency('R$ 0,01'), 'um centavo');
  assert.equal(convertCurrency('R$ 0,50'), 'cinquenta centavos');
  assert.equal(convertCurrency('R$ 1,00'), 'um real');
  assert.equal(convertCurrency('R$ 1,50'), 'um real e cinquenta centavos');

  // Valores inteiros simples e com milhar
  assert.equal(convertCurrency('R$ 10,00'), 'dez reais');
  assert.equal(convertCurrency('R$ 50'), 'cinquenta reais');
  assert.equal(convertCurrency('R$ 1.500,00'), 'mil e quinhentos reais');
  assert.equal(convertCurrency('R$ 3.200,75'), 'três mil e duzentos reais e setenta e cinco centavos');

  // Milhões redondos com 'de reais' vs compostos sem 'de'
  assert.equal(convertCurrency('R$ 1.000.000,00'), 'um milhão de reais');
  assert.equal(convertCurrency('R$ 1.000.000,50'), 'um milhão de reais e cinquenta centavos');
  assert.equal(convertCurrency('R$ 2.000.000,00'), 'dois milhões de reais');
  assert.equal(convertCurrency('R$ 1.500.000,00'), 'um milhão e quinhentos mil reais');

  // Negativos
  assert.equal(convertCurrency('-R$ 10,00'), 'menos dez reais');
  assert.equal(convertCurrency('R$ -50,00'), 'menos cinquenta reais');
});

// ---------------------------------------------------------------------------
// 3. Separação de Números Colados a Grandezas
// ---------------------------------------------------------------------------
test('BakeOff: Glued numbers and measures conversion across SI units', () => {
  assert.equal(convertMeasures('50kg'), 'cinquenta quilos');
  assert.equal(convertMeasures('1kg'), 'um quilo');
  assert.equal(convertMeasures('500g'), 'quinhentos gramas');
  assert.equal(convertMeasures('20mg'), 'vinte miligramas');

  assert.equal(convertMeasures('10km'), 'dez quilômetros');
  assert.equal(convertMeasures('15cm'), 'quinze centímetros');
  assert.equal(convertMeasures('30mm'), 'trinta milímetros');
  assert.equal(convertMeasures('100m'), 'cem metros');

  assert.equal(convertMeasures('100m²'), 'cem metros quadrados');
  assert.equal(convertMeasures('50m³'), 'cinquenta metros cúbicos');
  assert.equal(convertMeasures('120km/h'), 'cento e vinte quilômetros por hora');

  assert.equal(convertMeasures('25°C'), 'vinte e cinco graus celsius');
  assert.equal(convertMeasures('-5°C'), 'menos cinco graus celsius');

  assert.equal(convertMeasures('500ml'), 'quinhentos mililitros');
  assert.equal(convertMeasures('2L'), 'dois litros');

  assert.equal(convertMeasures('30min'), 'trinta minutos');
  assert.equal(convertMeasures('45s'), 'quarenta e cinco segundos');
  assert.equal(convertMeasures('80dB'), 'oitenta decibéis');
  assert.equal(convertMeasures('220V'), 'duzentos e vinte volts');
  assert.equal(convertMeasures('5GB'), 'cinco gigabytes');
});

// ---------------------------------------------------------------------------
// 4. Horários Falados Naturais
// ---------------------------------------------------------------------------
test('BakeOff: Natural spoken Brazilian Portuguese times', () => {
  assert.equal(convertTimes('00:00'), 'meia-noite');
  assert.equal(convertTimes('00h30'), 'meia-noite e meia');
  assert.equal(convertTimes('12:00'), 'meio-dia');
  assert.equal(convertTimes('12h30'), 'meio-dia e meia');
  assert.equal(convertTimes('1h'), 'uma hora');
  assert.equal(convertTimes('2h'), 'duas horas');
  assert.equal(convertTimes('08:05'), 'oito horas e cinco minutos');
  assert.equal(convertTimes('14:30'), 'quatorze horas e trinta minutos');
  assert.equal(convertTimes('21:00'), 'vinte e uma horas');
  assert.equal(convertTimes('22:00'), 'vinte e duas horas');
  assert.equal(convertTimes('23:59'), 'vinte e três horas e cinquenta e nove minutos');
});

// ---------------------------------------------------------------------------
// 5. Execução do Bake-Off Completo (Acurácia 100%, CER 0%, WER 0%)
// ---------------------------------------------------------------------------
test('BakeOff: Executes full TTS-Utils benchmark with 100% accuracy and generates report', () => {
  const report = runBakeOff(TTS_UTILS_BAKEOFF_DATASET);

  if (report.failedCases > 0) {
    console.error('Falhas no Bake-Off:', JSON.stringify(report.failures, null, 2));
  }

  assert.equal(
    report.failedCases,
    0,
    `Todos os casos do Bake-Off devem passar (Falhas: ${report.failures.map((f) => f.id).join(', ')})`
  );
  assert.equal(report.accuracyPct, 100.0);
  assert.equal(report.meanCER, 0);
  assert.equal(report.meanWER, 0);
  assert.ok(report.throughputCharsPerSec > 1000, 'Throughput deve ser superior a 1000 caracteres/segundo');

  const markdownReport = generateMarkdownBakeOffReport(report);
  assert.ok(markdownReport.includes('Relatório Oficial de Bake-Off'));
  assert.ok(markdownReport.includes('Status de Qualificação: 100% Aprovado'));
});
