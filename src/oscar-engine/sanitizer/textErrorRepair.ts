/**
 * Reparador de Erros de Extração de PDF e Pré-Leitura (textErrorRepair.ts)
 * 
 * Corrige falhas comuns de OCR/PDF.js antes da síntese de voz:
 * 1. Letras separadas das palavras (drop-caps e tracking, ex: "B RUXA" -> "BRUXA").
 * 2. Ligaduras corrompidas e glifos nulos (ex: "%00echa" -> "flecha").
 * 3. Palavras todas em maiúsculas que a voz tenta soletrar como sigla em vez de ler como palavra.
 * 4. Estrangeirismos e termos técnicos para que sejam pronunciados como palavras fluidas.
 */

// Siglas legítimas em português e internacionais que DEVEM continuar em maiúsculas
export const KNOWN_ACRONYMS = new Set([
  'CPF', 'RG', 'CNPJ', 'STF', 'STJ', 'TSE', 'TRF', 'TRT', 'CLT', 'OAB', 'SUS', 'MEC',
  'USP', 'UFRJ', 'UNICAMP', 'UFMG', 'PIB', 'IPTU', 'IPVA', 'ICMS', 'INSS', 'FGTS',
  'DF', 'SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'ES', 'AM', 'PA',
  'MT', 'MS', 'RN', 'PB', 'AL', 'SE', 'PI', 'MA', 'TO', 'RO', 'AC', 'AP', 'RR',
  'ONU', 'EUA', 'OEA', 'OMS', 'OTAN', 'FMI', 'OMC', 'UNESCO', 'UNICEF',
  'BNDES', 'IBGE', 'IPEA', 'ANVISA', 'ANATEL', 'ANEEL', 'ANP',
  'SENAI', 'SESC', 'SENAC', 'SEST', 'SENAT', 'SEBRAE',
  'PDF', 'HTML', 'CSS', 'URL', 'API', 'HTTP', 'HTTPS', 'SDK', 'SQL',
  'AI', 'IA', 'TI', 'CEO', 'CTO', 'CFO', 'COO', 'MBA', 'DNA', 'RNA',
  'COVID', 'LED', 'USB', 'GPS', 'SMS'
]);

/**
 * 1. Corrige letras separadas das palavras (Drop-caps descolados e tracking de títulos).
 * Ex: "B RUXA" -> "BRUXA", "C A P Í T U L O" -> "CAPÍTULO"
 */
export function repairSeparatedLetters(text: string): string {
  if (!text) return '';
  let res = text;

  // Letras consoantes que NÃO existem como palavras isoladas em português
  // Se estiverem sozinhas antes de uma palavra, são artefatos de capitulares/OCR
  const NON_WORD_LETTERS = '[BCDFGHJKLMNPQRSTVWXYZ]';
  const nonWordRegex = new RegExp(`\\b(${NON_WORD_LETTERS})\\s+([A-ZÀ-Úa-zà-ú]{2,})\\b`, 'g');
  res = res.replace(nonWordRegex, '$1$2');

  // Tracking tipográfico (letras isoladas com espaço único formando títulos):
  // "C A P Í T U L O" -> "CAPÍTULO", "B R U X A" -> "BRUXA"
  const parts = res.split(/(\s{2,}|\n)/);
  for (let i = 0; i < parts.length; i++) {
    // Preserva artigos isolados (O, A, E) antes de uma palavra com tracking
    parts[i] = parts[i].replace(/\b([OAoa])\s+([A-ZÀ-Ú](?:\s[A-ZÀ-Ú]){2,})\b/g, (_m, art, tracked) => {
      return `${art} ${tracked.replace(/\s+/g, '')}`;
    });
    // Une sequências de 3 ou mais letras maiúsculas espaçadas
    parts[i] = parts[i].replace(/\b([A-ZÀ-Ú](?:\s[A-ZÀ-Ú]){2,})\b/g, (match) => {
      return match.replace(/\s+/g, '');
    });
  }

  return parts.join('');
}

/**
 * 2. Corrige ligaduras tipográficas corrompidas de PDFs e glifos com código nulo.
 * Ex: "%00echa" -> "flecha", "%01m" -> "fim"
 */
export function repairPdfLigatures(text: string): string {
  if (!text) return '';
  let res = text;

  // Exemplo específico fornecido pelo usuário: %00echa -> flecha
  res = res.replace(/%00echa\b/gi, (m) => (m === m.toUpperCase() ? 'FLECHA' : 'flecha'));
  res = res.replace(/\u0000echa\b/gi, 'flecha');

  // Ligadura %00 (geralmente 'fl' em fontes PDF que mapeiam o glifo no índice 0)
  res = res.replace(/%00([a-zà-ú]+)/gi, (_m, rest) => {
    const isUpper = rest === rest.toUpperCase();
    const isTitle = rest[0] === rest[0].toUpperCase();
    const prefix = isUpper ? 'FL' : isTitle ? 'Fl' : 'fl';
    return prefix + rest;
  });
  res = res.replace(/([a-zà-ú]+)%00([a-zà-ú]+)/gi, '$1fl$2');

  // Ligadura %01 (geralmente 'fi' em fontes PDF)
  res = res.replace(/%01([a-zà-ú]+)/gi, (_m, rest) => {
    const isUpper = rest === rest.toUpperCase();
    const isTitle = rest[0] === rest[0].toUpperCase();
    const prefix = isUpper ? 'FI' : isTitle ? 'Fi' : 'fi';
    return prefix + rest;
  });
  res = res.replace(/([a-zà-ú]+)%01([a-zà-ú]+)/gi, '$1fi$2');

  // Ligadura %02 ('ff')
  res = res.replace(/([a-zà-ú]+)%02([a-zà-ú]+)/gi, '$1ff$2');

  // Ligaduras Unicode padrão
  res = res.replace(/\uFB00/g, 'ff');
  res = res.replace(/\uFB01/g, 'fi');
  res = res.replace(/\uFB02/g, 'fl');
  res = res.replace(/\uFB03/g, 'ffi');
  res = res.replace(/\uFB04/g, 'ffl');

  // Remove caracteres nulos residuais de extração
  res = res.replace(/[\u0000\x00]/g, '');

  return res;
}

/**
 * 3. Normaliza termos compostos e estrangeirismos com hífen para que a voz
 * não leia literalmente a palavra "traço" ou "hífen".
 * Ex: "e-book" -> "ebook", "wi-fi" -> "wifi", "e-mail" -> "email"
 */
export function normalizeCompoundLoanwords(text: string): string {
  if (!text) return '';
  let res = text;

  res = res.replace(/\be-books?\b/gi, (m) => (m[0] === 'E' ? 'Ebook' : 'ebook'));
  res = res.replace(/\be-mails?\b/gi, (m) => (m[0] === 'E' ? 'Email' : 'email'));
  res = res.replace(/\bwi-fi\b/gi, 'wifi');
  res = res.replace(/\bcheck-in\b/gi, 'checkin');
  res = res.replace(/\bcheck-out\b/gi, 'checkout');
  res = res.replace(/\bplay-list\b/gi, 'playlist');
  res = res.replace(/\bpop-up\b/gi, 'popup');

  return res;
}

/**
 * 4. Normaliza palavras inteiramente em MAIÚSCULAS para que a voz leia como palavra
 * humana corrida e NÃO soletre letra por letra como se fossem siglas.
 * Ex: "BRUXA" -> "Bruxa", "DESIGN" -> "Design", mas "STF" e "CPF" continuam maiúsculas.
 */
export function normalizeAllCaps(text: string): string {
  if (!text) return '';

  return text.replace(/\b[A-ZÀ-Ú]{2,}\b/g, (match) => {
    // Se for uma sigla reconhecida (como STF, CPF, ONU, etc.), mantém intacta
    if (KNOWN_ACRONYMS.has(match)) {
      return match;
    }
    // Converte para TitleCase para ser pronunciada como palavra completa
    return match.charAt(0) + match.slice(1).toLowerCase();
  });
}

/**
 * Pipeline mestre de pré-leitura: executa todos os reparos de erro antes da síntese.
 */
export function preReadRepair(text: string): string {
  if (!text) return '';

  let res = repairPdfLigatures(text);
  res = repairSeparatedLetters(res);
  res = normalizeCompoundLoanwords(res);
  res = normalizeAllCaps(res);

  return res;
}
