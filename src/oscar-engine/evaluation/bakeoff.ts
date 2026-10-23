/**
 * 🏆 Suíte de Avaliação e Bake-Off do TTS-Utils (bakeoff.ts)
 * 
 * Implementa o benchmark comparativo oficial entre o motor OscarVoice e as
 * referências canônicas do TTS-Utils (Grupo RAIA) e NVIDIA NeMo:
 * 1. Dicionário Completo de Abreviações e UFs Brasileiras
 * 2. Conversão de Moeda Brasileira com Pontuação Real
 * 3. Separação de Números Colados a Grandezas
 * 4. Horários Falados Naturais
 * 5. Métricas de Acurácia, CER, WER, Throughput e Integridade de Spans
 */

import { sanitizeWithProvenance } from '../sanitizer/normalizationMap';
import {
  calculateCER,
  calculateWER,
  normalizeForAcousticComparison,
} from './metrics';

export interface BakeOffCase {
  id: string;
  category: 'currency' | 'measure' | 'datetime' | 'geo' | 'abbreviation' | 'honorific' | 'legal';
  input: string;
  expected: string;
  description: string;
}

export interface BakeOffCaseResult {
  id: string;
  category: string;
  input: string;
  expected: string;
  actual: string;
  cer: number;
  wer: number;
  passed: boolean;
  provenanceSpansCount: number;
  elapsedMs: number;
}

export interface CategoryStats {
  category: string;
  total: number;
  passed: number;
  accuracyPct: number;
  meanCER: number;
  meanWER: number;
}

export interface BakeOffReport {
  timestamp: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  accuracyPct: number;
  meanCER: number;
  meanWER: number;
  totalCharsProcessed: number;
  elapsedMs: number;
  throughputCharsPerSec: number;
  categoryStats: Record<string, CategoryStats>;
  results: BakeOffCaseResult[];
  failures: BakeOffCaseResult[];
}

/**
 * Matriz Canônica de Testes do Bake-Off (NeMo + TTS-Utils).
 * 45+ casos de alta complexidade fonética e sintática brasileira.
 */
export const TTS_UTILS_BAKEOFF_DATASET: BakeOffCase[] = [
  // -------------------------------------------------------------------------
  // 1. Moedas Brasileiras com Pontuação Real
  // -------------------------------------------------------------------------
  {
    id: 'bo-curr-01',
    category: 'currency',
    input: 'O valor da taxa unitária é R$ 0,01.',
    expected: 'O valor da taxa unitária é um centavo.',
    description: 'Moeda: valor mínimo singular de um centavo',
  },
  {
    id: 'bo-curr-02',
    category: 'currency',
    input: 'O café custou R$ 0,50 no balcão.',
    expected: 'O café custou cinquenta centavos no balcão.',
    description: 'Moeda: somente centavos no plural',
  },
  {
    id: 'bo-curr-03',
    category: 'currency',
    input: 'O pedágio custa R$ 1,00.',
    expected: 'O pedágio custa um real.',
    description: 'Moeda: um real redondo',
  },
  {
    id: 'bo-curr-04',
    category: 'currency',
    input: 'A passagem subiu para R$ 1,50.',
    expected: 'A passagem subiu para um real e cinquenta centavos.',
    description: 'Moeda: um real com centavos',
  },
  {
    id: 'bo-curr-05',
    category: 'currency',
    input: 'A mensalidade é R$ 50,00.',
    expected: 'A mensalidade é cinquenta reais.',
    description: 'Moeda: dezenas com vírgula zero zero',
  },
  {
    id: 'bo-curr-06',
    category: 'currency',
    input: 'O produto custa R$ 50.',
    expected: 'O produto custa cinquenta reais.',
    description: 'Moeda: sem vírgula ou centavos explícitos',
  },
  {
    id: 'bo-curr-07',
    category: 'currency',
    input: 'Saldo devedor de R$ -10,00 na conta.',
    expected: 'Saldo devedor de menos dez reais na conta.',
    description: 'Moeda: valor negativo com sinal antes do número',
  },
  {
    id: 'bo-curr-08',
    category: 'currency',
    input: 'O total da nota foi R$ 3.200,75.',
    expected: 'O total da nota foi três mil e duzentos reais e setenta e cinco centavos.',
    description: 'Moeda: milhar e centavos',
  },
  {
    id: 'bo-curr-09',
    category: 'currency',
    input: 'O prêmio da loteria atingiu R$ 1.000.000,00.',
    expected: 'O prêmio da loteria atingiu um milhão de reais.',
    description: 'Moeda: milhão redondo com partícula "de reais"',
  },
  {
    id: 'bo-curr-10',
    category: 'currency',
    input: 'A obra foi orçada em R$ 1.500.000,00.',
    expected: 'A obra foi orçada em um milhão e quinhentos mil reais.',
    description: 'Moeda: milhão composto com milhares sem "de"',
  },

  // -------------------------------------------------------------------------
  // 2. Separação de Números Colados a Grandezas e Medidas
  // -------------------------------------------------------------------------
  {
    id: 'bo-meas-01',
    category: 'measure',
    input: 'A caixa pesa 50kg.',
    expected: 'A caixa pesa cinquenta quilos.',
    description: 'Massa: número colado a kg',
  },
  {
    id: 'bo-meas-02',
    category: 'measure',
    input: 'Compre 500g de queijo.',
    expected: 'Compre quinhentos gramas de queijo.',
    description: 'Massa: concordância masculina em gramas',
  },
  {
    id: 'bo-meas-03',
    category: 'measure',
    input: 'A dose prescrita foi de 20mg.',
    expected: 'A dose prescrita foi de vinte miligramas.',
    description: 'Massa: miligramas colados ao número',
  },
  {
    id: 'bo-meas-04',
    category: 'measure',
    input: 'A distância percorrida foi de 10km.',
    expected: 'A distância percorrida foi de dez quilômetros.',
    description: 'Distância: quilômetros colados',
  },
  {
    id: 'bo-meas-05',
    category: 'measure',
    input: 'O comprimento do parafuso é 15cm.',
    expected: 'O comprimento do parafuso é quinze centímetros.',
    description: 'Distância: centímetros colados',
  },
  {
    id: 'bo-meas-06',
    category: 'measure',
    input: 'O terreno tem 100m² de área.',
    expected: 'O terreno tem cem metros quadrados de área.',
    description: 'Área: metros quadrados colados',
  },
  {
    id: 'bo-meas-07',
    category: 'measure',
    input: 'A caixa d água tem volume de 50m³.',
    expected: 'A caixa d água tem volume de cinquenta metros cúbicos.',
    description: 'Volume: metros cúbicos colados',
  },
  {
    id: 'bo-meas-08',
    category: 'measure',
    input: 'O carro viajava a 120km/h na pista.',
    expected: 'O carro viajava a cento e vinte quilômetros por hora na pista.',
    description: 'Velocidade: km/h composto',
  },
  {
    id: 'bo-meas-09',
    category: 'measure',
    input: 'A temperatura na serra registrou 25°C.',
    expected: 'A temperatura na serra registrou vinte e cinco graus celsius.',
    description: 'Temperatura: graus Celsius',
  },
  {
    id: 'bo-meas-10',
    category: 'measure',
    input: 'Frasco com 500ml de xarope.',
    expected: 'Frasco com quinhentos mililitros de xarope.',
    description: 'Volume líquido: mililitros colados',
  },
  {
    id: 'bo-meas-11',
    category: 'measure',
    input: 'A palestra durou 30min no auditório.',
    expected: 'A palestra durou trinta minutos no auditório.',
    description: 'Tempo: minutos colados',
  },
  {
    id: 'bo-meas-12',
    category: 'measure',
    input: 'O arquivo baixado tem 5GB.',
    expected: 'O arquivo baixado tem cinco gigabytes.',
    description: 'Dados: gigabytes colados',
  },
  {
    id: 'bo-meas-13',
    category: 'measure',
    input: 'A tomada opera na tensão de 220V.',
    expected: 'A tomada opera na tensão de duzentos e vinte volts.',
    description: 'Eletricidade: volts colados',
  },
  {
    id: 'bo-meas-14',
    category: 'measure',
    input: 'O ruído ambiental atingiu 80dB.',
    expected: 'O ruído ambiental atingiu oitenta decibéis.',
    description: 'Acústica: decibéis colados',
  },

  // -------------------------------------------------------------------------
  // 3. Horários Falados Naturais
  // -------------------------------------------------------------------------
  {
    id: 'bo-time-01',
    category: 'datetime',
    input: 'A virada do ano ocorre às 00:00.',
    expected: 'A virada do ano ocorre à meia-noite.',
    description: 'Horário natural: meia-noite exata',
  },
  {
    id: 'bo-time-02',
    category: 'datetime',
    input: 'O voo partiu às 00h30.',
    expected: 'O voo partiu à meia-noite e meia.',
    description: 'Horário natural: meia-noite e meia',
  },
  {
    id: 'bo-time-03',
    category: 'datetime',
    input: 'O almoço foi servido às 12:00.',
    expected: 'O almoço foi servido ao meio-dia.',
    description: 'Horário natural: meio-dia exato',
  },
  {
    id: 'bo-time-04',
    category: 'datetime',
    input: 'O intervalo começa às 12h30.',
    expected: 'O intervalo começa ao meio-dia e meia.',
    description: 'Horário natural: meio-dia e meia',
  },
  {
    id: 'bo-time-05',
    category: 'datetime',
    input: 'A reunião foi agendada para 1h da madrugada.',
    expected: 'A reunião foi agendada para uma hora da madrugada.',
    description: 'Horário natural: concordância feminina de uma hora',
  },
  {
    id: 'bo-time-06',
    category: 'datetime',
    input: 'O sino tocou às 2h da tarde.',
    expected: 'O sino tocou às duas horas da tarde.',
    description: 'Horário natural: concordância feminina de duas horas',
  },
  {
    id: 'bo-time-07',
    category: 'datetime',
    input: 'A sessão inicia às 08:05 no plenário.',
    expected: 'A sessão inicia às oito horas e cinco minutos no plenário.',
    description: 'Horário natural: minutos singulares com zero à esquerda',
  },
  {
    id: 'bo-time-08',
    category: 'datetime',
    input: 'A conferência será às 14:30.',
    expected: 'A conferência será às quatorze horas e trinta minutos.',
    description: 'Horário natural: tarde com minutos',
  },
  {
    id: 'bo-time-09',
    category: 'datetime',
    input: 'O jornal começa às 21:00.',
    expected: 'O jornal começa às vinte e uma horas.',
    description: 'Horário natural: concordância feminina vinte e uma horas',
  },
  {
    id: 'bo-time-10',
    category: 'datetime',
    input: 'O prazo final expira às 23:59.',
    expected: 'O prazo final expira às vinte e três horas e cinquenta e nove minutos.',
    description: 'Horário natural: minutos finais',
  },

  // -------------------------------------------------------------------------
  // 4. Dicionário das 27 UFs Brasileiras em Contexto
  // -------------------------------------------------------------------------
  {
    id: 'bo-geo-01',
    category: 'geo',
    input: 'A matriz da empresa fica em São Paulo - SP.',
    expected: 'A matriz da empresa fica em São Paulo - São Paulo.',
    description: 'UF: São Paulo com hífen após cidade',
  },
  {
    id: 'bo-geo-02',
    category: 'geo',
    input: 'A filial opera em Curitiba/PR.',
    expected: 'A filial opera em Curitiba - Paraná.',
    description: 'UF: Paraná com barra após cidade',
  },
  {
    id: 'bo-geo-03',
    category: 'geo',
    input: 'O congresso ocorreu em Salvador - BA.',
    expected: 'O congresso ocorreu em Salvador - Bahia.',
    description: 'UF: Bahia com hífen',
  },
  {
    id: 'bo-geo-04',
    category: 'geo',
    input: 'A reunião ocorreu em Belo Horizonte - MG.',
    expected: 'A reunião ocorreu em Belo Horizonte - Minas Gerais.',
    description: 'UF: Minas Gerais com hífen',
  },
  {
    id: 'bo-geo-05',
    category: 'geo',
    input: 'Sede do governo federal em Brasília - DF.',
    expected: 'Sede do governo federal em Brasília - Distrito Federal.',
    description: 'UF: Distrito Federal',
  },
  {
    id: 'bo-geo-06',
    category: 'geo',
    input: 'Decisão proferida pelo TJSP no processo.',
    expected: 'Decisão proferida pelo Tribunal de Justiça de São Paulo no processo.',
    description: 'UF: Tribunal de Justiça estadual TJSP',
  },
  {
    id: 'bo-geo-07',
    category: 'geo',
    input: 'Inscrito nos quadros da OAB/SP sob o número.',
    expected: 'Inscrito nos quadros da O A B São Paulo sob o número.',
    description: 'UF: Seccional da OAB/SP',
  },
  {
    id: 'bo-geo-08',
    category: 'geo',
    input: 'O evento será realizado no Estado de SP.',
    expected: 'O evento será realizado no Estado de São Paulo.',
    description: 'UF: expressão institucional Estado de SP',
  },

  // -------------------------------------------------------------------------
  // 5. Dicionário Completo de Abreviações Brasileiras
  // -------------------------------------------------------------------------
  {
    id: 'bo-abbrev-01',
    category: 'honorific',
    input: 'O parecer do Dr. Marcos e da Dra. Patrícia.',
    expected: 'O parecer do Doutor Marcos e da Doutora Patrícia.',
    description: 'Abreviação: Doutor e Doutora',
  },
  {
    id: 'bo-abbrev-02',
    category: 'honorific',
    input: 'A aula do Prof. Silva e da Profa. Souza.',
    expected: 'A aula do Professor Silva e da Professora Souza.',
    description: 'Abreviação: Professor e Professora',
  },
  {
    id: 'bo-abbrev-03',
    category: 'honorific',
    input: 'Dirijo-me a V. Exa. com o devido respeito.',
    expected: 'Dirijo-me a Vossa Excelência com o devido respeito.',
    description: 'Abreviação: Vossa Excelência',
  },
  {
    id: 'bo-abbrev-04',
    category: 'abbreviation',
    input: 'Residência na Av. Paulista, nº 1000, apto. 42.',
    expected: 'Residência na Avenida Paulista, número 1000, apartamento 42.',
    description: 'Abreviação: Avenida, número e apartamento',
  },
  {
    id: 'bo-abbrev-05',
    category: 'abbreviation',
    input: 'A empresa Silva & Cia Ltda. foi constituída.',
    expected: 'A empresa Silva & Cia Limitada foi constituída.',
    description: 'Abreviação: Limitada',
  },
  {
    id: 'bo-abbrev-06',
    category: 'abbreviation',
    input: 'Portador do CPF e do CNPJ perante a Receita.',
    expected: 'Portador do C P F e do C N P J perante a Receita.',
    description: 'Abreviação: CPF e CNPJ',
  },
  {
    id: 'bo-abbrev-07',
    category: 'legal',
    input: 'Recurso extraordinário julgado pelo STF.',
    expected: 'Recurso extraordinário julgado pelo éssi tê éfe.',
    description: 'Abreviação jurídica: STF',
  },
  {
    id: 'bo-abbrev-08',
    category: 'legal',
    input: 'Conforme preceitua o Art. 5º da CF/88.',
    expected: 'Conforme preceitua o Artigo quinto da Constituição Federal.',
    description: 'Abreviação jurídica: Artigo quinto e Constituição Federal',
  },
  {
    id: 'bo-abbrev-09',
    category: 'abbreviation',
    input: 'Documentos, certidões, contratos, etc. foram anexados.',
    expected: 'Documentos, certidões, contratos, êti cétera foram anexados.',
    description: 'Abreviação: etc. latino',
  },
  {
    id: 'bo-abbrev-10',
    category: 'abbreviation',
    input: 'O templo foi erguido no século V a.C. pelos gregos.',
    expected: 'O templo foi erguido no século quinto antes de Cristo pelos gregos.',
    description: 'Abreviação: século romano e a.C.',
  },
];

/**
 * Executa o Bake-Off completo comparando o OscarEngine com os padrões canônicos.
 */
export function runBakeOff(dataset: BakeOffCase[] = TTS_UTILS_BAKEOFF_DATASET): BakeOffReport {
  const startTime = performance.now();
  let totalCharsProcessed = 0;

  const results: BakeOffCaseResult[] = [];
  const failures: BakeOffCaseResult[] = [];

  const categoryMap: Record<
    string,
    { total: number; passed: number; sumCER: number; sumWER: number }
  > = {};

  for (const tc of dataset) {
    const t0 = performance.now();
    totalCharsProcessed += tc.input.length;

    const res = sanitizeWithProvenance(tc.input, 1);
    const actualSpoken = res.spokenText;
    const t1 = performance.now();

    const cer = calculateCER(actualSpoken, tc.expected);
    const wer = calculateWER(actualSpoken, tc.expected);

    // Avaliação acústica equitativa: normaliza pontuações periféricas
    const passed =
      normalizeForAcousticComparison(actualSpoken) ===
      normalizeForAcousticComparison(tc.expected);

    const caseResult: BakeOffCaseResult = {
      id: tc.id,
      category: tc.category,
      input: tc.input,
      expected: tc.expected,
      actual: actualSpoken,
      cer,
      wer,
      passed,
      provenanceSpansCount: res.normalizationMap.length,
      elapsedMs: parseFloat((t1 - t0).toFixed(3)),
    };

    results.push(caseResult);
    if (!passed) {
      failures.push(caseResult);
    }

    if (!categoryMap[tc.category]) {
      categoryMap[tc.category] = { total: 0, passed: 0, sumCER: 0, sumWER: 0 };
    }
    categoryMap[tc.category].total++;
    if (passed) categoryMap[tc.category].passed++;
    categoryMap[tc.category].sumCER += cer;
    categoryMap[tc.category].sumWER += wer;
  }

  const endTime = performance.now();
  const elapsedMs = parseFloat((endTime - startTime).toFixed(2));
  const throughputCharsPerSec =
    elapsedMs > 0 ? Math.round((totalCharsProcessed / elapsedMs) * 1000) : totalCharsProcessed;

  const totalCases = dataset.length;
  const passedCases = results.filter((r) => r.passed).length;
  const failedCases = totalCases - passedCases;
  const accuracyPct = parseFloat(((passedCases / totalCases) * 100).toFixed(1));

  const meanCER = parseFloat(
    (results.reduce((acc, r) => acc + r.cer, 0) / totalCases).toFixed(4)
  );
  const meanWER = parseFloat(
    (results.reduce((acc, r) => acc + r.wer, 0) / totalCases).toFixed(4)
  );

  const categoryStats: Record<string, CategoryStats> = {};
  for (const [cat, data] of Object.entries(categoryMap)) {
    categoryStats[cat] = {
      category: cat,
      total: data.total,
      passed: data.passed,
      accuracyPct: parseFloat(((data.passed / data.total) * 100).toFixed(1)),
      meanCER: parseFloat((data.sumCER / data.total).toFixed(4)),
      meanWER: parseFloat((data.sumWER / data.total).toFixed(4)),
    };
  }

  return {
    timestamp: new Date().toISOString(),
    totalCases,
    passedCases,
    failedCases,
    accuracyPct,
    meanCER,
    meanWER,
    totalCharsProcessed,
    elapsedMs,
    throughputCharsPerSec,
    categoryStats,
    results,
    failures,
  };
}

/**
 * Formata um relatório visual completo do Bake-Off em formato Markdown.
 */
export function generateMarkdownBakeOffReport(report: BakeOffReport): string {
  const lines: string[] = [
    `# 🏆 Relatório Oficial de Bake-Off • TTS-Utils vs OscarVoice Engine`,
    ``,
    `> **Data de Execução:** ${report.timestamp}  `,
    `> **Throughput:** ${report.throughputCharsPerSec.toLocaleString()} caracteres/segundo (${report.elapsedMs}ms total)  `,
    `> **Acurácia Global:** **${report.accuracyPct}%** | **Mean CER:** ${report.meanCER} | **Mean WER:** ${report.meanWER}`,
    ``,
    `---`,
    ``,
    `## 📊 Sumário Executivo por Categoria Semiótica`,
    ``,
    `| Categoria Semiótica | Casos de Teste | Aprovados | Acurácia (%) | Mean CER | Mean WER |`,
    `| :--- | :---: | :---: | :---: | :---: | :---: |`,
  ];

  for (const stats of Object.values(report.categoryStats)) {
    lines.push(
      `| \`${stats.category}\` | ${stats.total} | ${stats.passed} | **${stats.accuracyPct}%** | ${stats.meanCER} | ${stats.meanWER} |`
    );
  }

  lines.push(
    `| **TOTAL GERAL** | **${report.totalCases}** | **${report.passedCases}** | **${report.accuracyPct}%** | **${report.meanCER}** | **${report.meanWER}** |`
  );

  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  if (report.failedCases > 0) {
    lines.push(`## ⚠️ Falhas Detectadas (${report.failedCases})`);
    lines.push(``);
    for (const f of report.failures) {
      lines.push(`- **[${f.id}] (${f.category})**:`);
      lines.push(`  - *Original:* \`${f.input}\``);
      lines.push(`  - *Esperado:* \`${f.expected}\``);
      lines.push(`  - *Obtido:*   \`${f.actual}\``);
      lines.push(`  - *CER:* ${f.cer} | *WER:* ${f.wer}`);
    }
  } else {
    lines.push(`## ✅ Status de Qualificação: 100% Aprovado`);
    lines.push(
      `Todos os ${report.totalCases} casos canônicos foram normalizados com correspondência fonética estrita (0% CER, 0% WER) em conformidade com as diretrizes do Grupo RAIA (TTS-Utils) e NVIDIA NeMo.`
    );
  }

  return lines.join('\n');
}
