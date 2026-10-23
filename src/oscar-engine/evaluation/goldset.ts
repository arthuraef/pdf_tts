/**
 * 🎯 Goldset de Referência Fonética PT-BR (goldset.ts)
 * Base de pares de teste oficiais derivados do NeMo Text-Processing (NVIDIA),
 * do TTS-Utils (Grupo RAIA) e do Plano de Qualificação de Leitores de PDF
 * (tts-ptbr-goldset-source-matrix-v0.1.md).
 */

import type { GoldsetItem } from './metrics';

export const PTBR_TTS_GOLDSET: GoldsetItem[] = [
  // --- 1. Moedas Brasileiras e Estrangeiras (TTS-Utils) ---
  {
    id: 'goldset-curr-01',
    category: 'currency',
    original: 'O valor da taxa foi R$ 10,00.',
    expectedSpoken: 'O valor da taxa foi dez reais.',
    description: 'Valor inteiro simples em Reais',
  },
  {
    id: 'goldset-curr-02',
    category: 'currency',
    original: 'A fatura totalizou R$ 3.200,75.',
    expectedSpoken: 'A fatura totalizou três mil e duzentos reais e setenta e cinco centavos.',
    description: 'Valor com separador de milhar e centavos',
  },
  {
    id: 'goldset-curr-03',
    category: 'currency',
    original: 'Pagou R$ 1.500,00 de entrada.',
    expectedSpoken: 'Pagou mil e quinhentos reais de entrada.',
    description: 'Valor com milhar exato',
  },
  {
    id: 'goldset-curr-04',
    category: 'currency',
    original: 'O custo unitário é R$ 0,50.',
    expectedSpoken: 'O custo unitário é cinquenta centavos.',
    description: 'Valor somente com centavos',
  },
  {
    id: 'goldset-curr-05',
    category: 'currency',
    original: 'Cobra taxa de USD 100 por serviço.',
    expectedSpoken: 'Cobra taxa de cem dólares por serviço.',
    description: 'Moeda estrangeira USD',
  },

  // --- 2. Datas e Horários (NeMo + TTS-Utils) ---
  {
    id: 'goldset-datetime-01',
    category: 'datetime',
    original: 'A audiência ocorreu em 23/10/2026.',
    expectedSpoken: 'A audiência ocorreu em vinte e três de outubro de dois mil e vinte e seis.',
    description: 'Data completa dia/mês/ano',
  },
  {
    id: 'goldset-datetime-02',
    category: 'datetime',
    original: 'O feriado é em 01/05/2024.',
    expectedSpoken: 'O feriado é em primeiro de maio de dois mil e vinte e quatro.',
    description: 'Data com primeiro dia do mês (primeiro em vez de um)',
  },
  {
    id: 'goldset-datetime-03',
    category: 'datetime',
    original: 'A reunião começará às 14h30 no plenário.',
    expectedSpoken: 'A reunião começará às quatorze horas e trinta minutos no plenário.',
    description: 'Horário com horas e minutos',
  },
  {
    id: 'goldset-datetime-04',
    category: 'datetime',
    original: 'O expediente se encerra às 18:00 em ponto.',
    expectedSpoken: 'O expediente se encerra às dezoito horas em ponto.',
    description: 'Horário exato formato hh:mm',
  },

  // --- 3. Grandezas e Medidas (NeMo + TTS-Utils) ---
  {
    id: 'goldset-measure-01',
    category: 'measure',
    original: 'A encomenda pesa 10kg.',
    expectedSpoken: 'A encomenda pesa dez quilos.',
    description: 'Número grudado em unidade de peso',
  },
  {
    id: 'goldset-measure-02',
    category: 'measure',
    original: 'O veículo trafegava a 80km/h na rodovia.',
    expectedSpoken: 'O veículo trafegava a oitenta quilômetros por hora na rodovia.',
    description: 'Velocidade com unidade composta',
  },
  {
    id: 'goldset-measure-03',
    category: 'measure',
    original: 'O imóvel possui área de 100m².',
    expectedSpoken: 'O imóvel possui área de cem metros quadrados.',
    description: 'Área com expoente quadrado',
  },
  {
    id: 'goldset-measure-04',
    category: 'measure',
    original: 'A temperatura atingiu 25°C na sombra.',
    expectedSpoken: 'A temperatura atingiu vinte e cinco graus celsius na sombra.',
    description: 'Temperatura em graus Celsius',
  },
  {
    id: 'goldset-measure-05',
    category: 'measure',
    original: 'Frasco contendo 500ml de solução.',
    expectedSpoken: 'Frasco contendo quinhentos mililitros de solução.',
    description: 'Volume em mililitros',
  },

  // --- 4. Decimais e Porcentagens (NeMo) ---
  {
    id: 'goldset-decimal-01',
    category: 'decimal_percentage',
    original: 'O índice subiu 12,5% no último trimestre.',
    expectedSpoken: 'O índice subiu doze vírgula cinco por cento no último trimestre.',
    description: 'Porcentagem com casa decimal',
  },
  {
    id: 'goldset-decimal-02',
    category: 'decimal_percentage',
    original: 'A proporção calculada foi de 1,5 para cada caso.',
    expectedSpoken: 'A proporção calculada foi de um vírgula cinco para cada caso.',
    description: 'Número decimal isolado',
  },

  // --- 5. Endereços e UFs Brasileiras (TTS-Utils) ---
  {
    id: 'goldset-address-01',
    category: 'address_geo',
    original: 'Residência situada na Av. Paulista, nº 1000.',
    expectedSpoken: 'Residência situada na Avenida Paulista, número 1000.',
    description: 'Abreviatura de Avenida e número de imóvel',
  },
  {
    id: 'goldset-address-02',
    category: 'address_geo',
    original: 'O escritório fica em São Paulo - SP.',
    expectedSpoken: 'O escritório fica em São Paulo - São Paulo.',
    description: 'Sigla de estado SP após hífen',
  },
  {
    id: 'goldset-address-03',
    category: 'address_geo',
    original: 'Comarca de Belo Horizonte - MG.',
    expectedSpoken: 'Comarca de Belo Horizonte - Minas Gerais.',
    description: 'Sigla de estado MG em contexto geográfico',
  },
  {
    id: 'goldset-address-04',
    category: 'address_geo',
    original: 'Tribunal sediado em Brasília - DF.',
    expectedSpoken: 'Tribunal sediado em Brasília - Distrito Federal.',
    description: 'Distrito Federal DF em contexto geográfico',
  },

  // --- 6. Expressões Latinas e Abreviaturas (TTS-Utils) ---
  {
    id: 'goldset-latin-01',
    category: 'latin_abbreviation',
    original: 'Documentos, certidões, contratos, etc. foram juntados.',
    expectedSpoken: 'Documentos, certidões, contratos, êti cétera foram juntados.',
    description: 'Latinismo etc. com pronúncia fonética legível',
  },
  {
    id: 'goldset-latin-02',
    category: 'latin_abbreviation',
    original: 'No processo Silva vs. Souza restou provada a culpa.',
    expectedSpoken: 'No processo Silva versus Souza restou provada a culpa.',
    description: 'Latinismo judicial versus',
  },
  {
    id: 'goldset-latin-03',
    category: 'latin_abbreviation',
    original: 'O império prosperou no século V a.C. até a invasão.',
    expectedSpoken: 'O império prosperou no século quinto antes de Cristo até a invasão.',
    description: 'Abreviatura cronológica a.C.',
  },

  // --- 7. Formas de Tratamento (TTS-Utils) ---
  {
    id: 'goldset-honorific-01',
    category: 'honorific',
    original: 'O parecer do Dr. Marcos e da Dra. Patrícia foi acolhido.',
    expectedSpoken: 'O parecer do Doutor Marcos e da Doutora Patrícia foi acolhido.',
    description: 'Abreviaturas de Doutor e Doutora',
  },
  {
    id: 'goldset-honorific-02',
    category: 'honorific',
    original: 'O depoimento do Sr. Oliveira e da Sra. Silva.',
    expectedSpoken: 'O depoimento do Senhor Oliveira e da Senhora Silva.',
    description: 'Abreviaturas de Senhor e Senhora',
  },

  // --- 8. Reparos Pré-Leitura e OCR (Diretrizes do Usuário) ---
  {
    id: 'goldset-repair-01',
    category: 'pre_read_repair',
    original: 'A B RUXA preparou o feitiço antigo.',
    expectedSpoken: 'A bruxa preparou o feitiço antigo.',
    description: 'Reparo de drop-cap com letra separada da palavra',
  },
  {
    id: 'goldset-repair-02',
    category: 'pre_read_repair',
    original: 'O caçador disparou uma %00echa certeira.',
    expectedSpoken: 'O caçador disparou uma flecha certeira.',
    description: 'Reparo de ligadura corrompida de PDF',
  },
  {
    id: 'goldset-repair-03',
    category: 'pre_read_repair',
    original: 'Leu o e-book conectado na rede wi-fi.',
    expectedSpoken: 'Leu o ebook conectado na rede wifi.',
    description: 'Estrangeirismos de informática simplificados',
  },
];
