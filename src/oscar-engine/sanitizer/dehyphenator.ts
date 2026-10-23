/**
 * Reconecta palavras quebradas por hífen no fim da linha e com artefatos de espaçamento em PDFs.
 * Exemplo: "deso - lação" -> "desolação", "cons-" na linha 1 e "titucional" na linha 2 -> "constitucional".
 * Preserva travessões oracionais legítimos ("O projeto - que foi aprovado - seguiu").
 */

// Conectivos sintáticos, pronomes e artigos que iniciam orações intercaladas legítimas após travessão
const CLAUSE_CONNECTORS = new Set([
  'que', 'mas', 'porém', 'contudo', 'todavia', 'e', 'ou', 'se', 'quando',
  'onde', 'como', 'porque', 'porquanto', 'pois', 'já', 'ainda', 'não', 'sim',
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'este', 'esta', 'esse',
  'essa', 'aquele', 'aquela', 'isto', 'isso', 'aquilo', 'de', 'em', 'para',
  'por', 'com', 'sem', 'sob', 'sobre', 'após', 'desde', 'até', 'entre',
  'disse', 'falou', 'respondeu', 'gritou', 'perguntou', 'afirmou', 'exclamou'
]);

// Sufixos e terminações silábicas comuns de quebra de palavras em português
const BOUND_SUFFIXES = new Set([
  'ção', 'ções', 'mento', 'mentos', 'dade', 'dades', 'mente', 'ência', 'ências',
  'ância', 'âncias', 'ismo', 'ismos', 'ista', 'istas', 'tório', 'tórios', 'tória', 'tórias',
  'ante', 'antes', 'ente', 'entes', 'ivo', 'ivos', 'iva', 'ivas', 'dor', 'dores',
  'dora', 'doras', 'ional', 'ionais', 'ável', 'áveis', 'ível', 'íveis', 'oso', 'osos',
  'osa', 'osas', 'ário', 'ários', 'ária', 'árias', 'ura', 'uras', 'ficação', 'ficações',
  'logia', 'logias', 'nizado', 'nizada', 'tivo', 'tiva', 'tivos', 'tivas', 'gência',
  'gências', 'cedente', 'cedentes', 'tado', 'tados', 'tada', 'tadas', 'grafo', 'grafos',
  'grafa', 'grafas', 'lação', 'lações', 'tucional', 'tucionais', 'prudência', 'prudências'
]);

export function dehyphenate(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove quebras de linha com hífen entre letras (inclui espaços acidentais e hífens Unicode)
  // Ex: "cons -\n titucional" ou "deso-\r\n lação" -> "constitucional" / "desolação"
  cleaned = cleaned.replace(
    /([a-zA-ZÀ-ÿ]+)\s*[-–—\u00AD\u2010\u2011\u2012\u2212]\s*[\r\n]+\s*([a-zA-ZÀ-ÿ]+)/g,
    '$1$2'
  );

  // 2. Remove hífens com espaços inline resultantes de extração achatada de PDF
  // Ex: "deso - lação", "deso -lação", "deso- lação" -> "desolação"
  cleaned = cleaned.replace(
    /([a-zA-ZÀ-ÿ]{2,})\s*[-–—\u00AD\u2010\u2011\u2012\u2212]\s*([a-zA-ZÀ-ÿ]{2,})/g,
    (match, p1: string, p2: string) => {
      const p2Lower = p2.toLowerCase();
      const p1Lower = p1.toLowerCase();

      // Se a segunda parte é um conectivo ou oração com travessão legítimo (" - que "), preserva
      if (CLAUSE_CONNECTORS.has(p2Lower) || (p2[0] === p2[0].toUpperCase() && p2[0] !== p2Lower[0])) {
        return match;
      }

      // Se a segunda parte é um sufixo/morfema gramatical típico de quebra de palavra
      if (
        BOUND_SUFFIXES.has(p2Lower) ||
        /^(?:ção|ções|mento|dade|mente|tucional|tório|tória|tiva|tivo|gência|cedente|nizado|ficação|prudência|laç)/.test(p2Lower)
      ) {
        return p1 + p2;
      }

      // Se a primeira parte é uma sílaba/radical incompleto típico
      if (
        /^(?:deso|inconsti|estabele|transfe|juris|homologa|auto|admi|dispo|pará|sen|proce|recor|apre|deter|compa|signi|recon|obri|impor|inter|subor|neces|repre|traba|conhe|cons|gover|presi)$/i.test(p1Lower)
      ) {
        return p1 + p2;
      }

      // Se nenhuma das partes parece ser uma palavra independente longa isolada (ex: "de - so")
      if (p1.length <= 4 && p2.length <= 4) {
        return p1 + p2;
      }

      return match;
    }
  );

  // 3. Normaliza quebras de linha suaves simples em espaços, preservando parágrafos (\n\n)
  cleaned = cleaned.replace(/([^\n])\n([^\n])/g, '$1 $2');

  // 4. Normaliza espaços múltiplos
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  return cleaned.trim();
}
