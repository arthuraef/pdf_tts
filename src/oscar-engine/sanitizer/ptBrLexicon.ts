/**
 * Dicionário Fonético Brasileiro (ptBrLexicon.ts)
 * Converte abreviações, numerais jurídicos, séculos e termos técnicos
 * em texto foneticamente natural antes do envio ao motor de síntese.
 */

// Mapeamento de numerais ordinais comuns no Direito (1º ao 10º)
const ORDINAIS_MASCULINOS: Record<string, string> = {
  '1': 'primeiro',
  '2': 'segundo',
  '3': 'terceiro',
  '4': 'quarto',
  '5': 'quinto',
  '6': 'sexto',
  '7': 'sétimo',
  '8': 'oitavo',
  '9': 'nono',
  '10': 'décimo',
};

// Mapeamento de algarismos romanos para leitura falada natural
const ROMANOS_INCISOS: Record<string, string> = {
  I: 'primeiro',
  II: 'segundo',
  III: 'terceiro',
  IV: 'quarto',
  V: 'quinto',
  VI: 'sexto',
  VII: 'sétimo',
  VIII: 'oitavo',
  IX: 'nono',
  X: 'décimo',
  XI: 'onze',
  XII: 'doze',
  XIII: 'treze',
  XIV: 'quatorze',
  XV: 'quinze',
  XVI: 'dezesseis',
  XVII: 'dezessete',
  XVIII: 'dezoito',
  XIX: 'dezenove',
  XX: 'vinte',
};

export function applyPtBrLexicon(text: string): string {
  if (!text) return '';

  let processed = text;

  // 1. Artigos de Lei (Art. 1º até Art. 9º são lidos como 'Artigo primeiro' a 'nono'; do 10 em diante é cardinal)
  processed = processed.replace(/\bArt\.\s*(\d+)(?:[º°ª])?/gi, (_match, numStr: string) => {
    const num = parseInt(numStr, 10);
    if (num <= 10 && ORDINAIS_MASCULINOS[numStr]) {
      return `Artigo ${ORDINAIS_MASCULINOS[numStr]}`;
    }
    return `Artigo ${num}`;
  });

  // 2. Parágrafos Legais (§ 1º, § 2º, § único)
  processed = processed.replace(/§\s*único\b/gi, 'Parágrafo único');
  processed = processed.replace(/§\s*(\d+)(?:[º°ª])?/g, (_match, numStr: string) => {
    const num = parseInt(numStr, 10);
    if (num <= 10 && ORDINAIS_MASCULINOS[numStr]) {
      return `Parágrafo ${ORDINAIS_MASCULINOS[numStr]}`;
    }
    return `Parágrafo ${num}`;
  });

  // 3. Incisos com algarismos romanos: Inc. IV ou Inciso IV
  processed = processed.replace(/\b(?:Inc\.|Inciso)\s*([IVX]+)\b/gi, (_match, roman: string) => {
    const upperRoman = roman.toUpperCase();
    const spoken = ROMANOS_INCISOS[upperRoman] || upperRoman;
    return `Inciso ${spoken}`;
  });

  // 4. Séculos com algarismos romanos
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XXI\b/gi, 'Século vinte e um');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XX\b/gi, 'Século vinte');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XIX\b/gi, 'Século dezenove');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XVIII\b/gi, 'Século dezoito');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XVII\b/gi, 'Século dezessete');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XVI\b/gi, 'Século dezesseis');
  processed = processed.replace(/\b(?:Século|Séc\.)\s+XV\b/gi, 'Século quinze');

  // 5. Reis e Papas (D. Pedro II, João Paulo II)
  processed = processed.replace(/\bD\.\s+Pedro\s+II\b/g, 'Dom Pedro segundo');
  processed = processed.replace(/\bD\.\s+Pedro\s+I\b/g, 'Dom Pedro primeiro');

  // 6. Abreviações comuns de títulos
  processed = processed.replace(/\bDr\.\s+/g, 'Doutor ');
  processed = processed.replace(/\bDra\.\s+/g, 'Doutora ');
  processed = processed.replace(/\bProf\.\s+/g, 'Professor ');
  processed = processed.replace(/\bProfa\.\s+/g, 'Professora ');
  processed = processed.replace(/\bSr\.\s+/g, 'Senhor ');
  processed = processed.replace(/\bSra\.\s+/g, 'Senhora ');

  // 7. Abreviações acadêmicas e bibliográficas
  processed = processed.replace(/\bpágs?\.\s*(\d+)/gi, (_match, num) => `página ${num}`);
  processed = processed.replace(/\bcap\.\s*(\d+)/gi, (_match, num) => `capítulo ${num}`);
  processed = processed.replace(/\bvol\.\s*(\d+)/gi, (_match, num) => `volume ${num}`);
  processed = processed.replace(/\bex\.:?\s+/gi, 'por exemplo, ');
  processed = processed.replace(/\bobs\.:?\s+/gi, 'observação: ');

  // 8. Moedas (R$ 10,50 -> 10 reais e 50 centavos ou R$ 100 -> 100 reais)
  processed = processed.replace(/R\$\s*(\d+),(\d{2})/g, '$1 reais e $2 centavos');
  processed = processed.replace(/R\$\s*(\d+)/g, '$1 reais');

  return processed;
}
