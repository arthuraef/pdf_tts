/**
 * Construtor de SSML (ssmlBuilder.ts)
 * Gera marcação W3C SSML com prosódia, pitch e voice name para o Edge Neural TTS.
 */

export interface SSMLOptions {
  text: string;
  voiceId: string;
  rate?: string;  // Ex: '+10%', '-5%', '+0%'
  pitch?: string; // Ex: '+6%', '-4%', '+0Hz'
  volume?: string;
}

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSSML(options: SSMLOptions): string {
  const {
    text,
    voiceId,
    rate = '+0%',
    pitch = '+0Hz',
    volume = '+0%',
  } = options;

  const escapedText = escapeXml(text);

  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' ` +
    `xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='pt-BR'>` +
    `<voice name='${voiceId}'>` +
    `<prosody rate='${rate}' pitch='${pitch}' volume='${volume}'>` +
    `${escapedText}` +
    `</prosody>` +
    `</voice>` +
    `</speak>`
  );
}
