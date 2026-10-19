/**
 * Exportador de Áudio de Capítulos (mp3Exporter.ts)
 * Converte AudioBuffers gerados pelo Oscar Engine em arquivo de áudio WAV de estúdio (16-bit PCM)
 * para download direto e escuta offline no carro, smartwatch ou tocadores externos.
 */

export function audioBuffersToWavBlob(buffers: AudioBuffer[]): Blob {
  if (buffers.length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  const sampleRate = buffers[0].sampleRate;
  const numChannels = buffers[0].numberOfChannels;

  // Calcula o total de frames somando todos os buffers
  let totalLength = 0;
  for (const b of buffers) {
    totalLength += b.length;
  }

  // Prepara buffer interleaved
  const interleaved = new Float32Array(totalLength * numChannels);
  let offset = 0;

  for (const b of buffers) {
    const channelData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      channelData.push(b.getChannelData(c));
    }

    for (let i = 0; i < b.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        interleaved[offset++] = channelData[c][i];
      }
    }
  }

  // Codifica para WAV PCM 16-bit
  const bufferBytes = totalLength * numChannels * 2;
  const wavBuffer = new ArrayBuffer(44 + bufferBytes);
  const view = new DataView(wavBuffer);

  // RIFF Chunk Descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + bufferBytes, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Tamanho do sub-chunk fmt (16 para PCM)
  view.setUint16(20, 1, true); // Áudio format 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, bufferBytes, true);

  // Escreve amostras de áudio (float32 para int16)
  let dataIndex = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(dataIndex, intSample, true);
    dataIndex += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Dispara o download no navegador do arquivo de áudio gerado.
 */
export function triggerAudioDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
