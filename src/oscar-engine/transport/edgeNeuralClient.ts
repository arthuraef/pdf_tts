/**
 * Cliente Edge Neural TTS (edgeNeuralClient.ts)
 * Conecta diretamente ao endpoint neural da Microsoft (Francisca e Antonio)
 * com suporte a SSML, extração de WordBoundary para karaokê e timeout de 2000ms.
 */

export interface WordBoundaryEvent {
  offset: number; // microssegundos ou ms
  duration: number;
  text: string;
  length: number;
}

export interface SynthesisResult {
  audioBlob: Blob;
  wordBoundaries: WordBoundaryEvent[];
}

export class EdgeNeuralClient {
  private static readonly ENDPOINT =
    'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';

  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Sintetiza SSML em MP3 com timeout estrito de 2000ms.
   * Se falhar ou estourar o tempo, rejeita imediatamente para acionamento do fallback.
   */
  public async synthesizeSSML(
    ssml: string,
    timeoutMs: number = 2000
  ): Promise<SynthesisResult> {
    return new Promise<SynthesisResult>((resolve, reject) => {
      let isCompleted = false;
      const audioChunks: Uint8Array[] = [];
      const wordBoundaries: WordBoundaryEvent[] = [];

      const connectionId = EdgeNeuralClient.generateUUID().replace(/-/g, '');
      const requestId = EdgeNeuralClient.generateUUID().replace(/-/g, '');
      const wsUrl = `${EdgeNeuralClient.ENDPOINT}&ConnectionId=${connectionId}`;

      let ws: WebSocket | null = null;
      let timer: number | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (ws) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          ws = null;
        }
      };

      // 🛡️ Lei 2: Timeout de 2.000ms (Circuit Breaker)
      timer = window.setTimeout(() => {
        if (!isCompleted) {
          isCompleted = true;
          cleanup();
          reject(new Error(`Edge Neural TTS timeout após ${timeoutMs}ms`));
        }
      }, timeoutMs);

      try {
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
      } catch (err) {
        cleanup();
        return reject(err);
      }

      ws.onopen = () => {
        if (isCompleted || !ws) return;

        // 1. Envia configuração de áudio
        const configMsg =
          'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: 'false',
                    wordBoundaryEnabled: 'true',
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          });
        ws.send(configMsg);

        // 2. Envia payload SSML
        const ssmlMsg =
          `X-RequestId:${requestId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          'Path:ssml\r\n\r\n' +
          ssml;
        ws.send(ssmlMsg);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isCompleted) return;

        if (typeof event.data === 'string') {
          const text = event.data;

          // Processa metadados de Karaokê (WordBoundary)
          if (text.includes('Path:audio.metadata')) {
            try {
              const body = text.substring(text.indexOf('\r\n\r\n') + 4);
              const metadata = JSON.parse(body);
              if (metadata?.Metadata) {
                for (const item of metadata.Metadata) {
                  if (item.Type === 'WordBoundary' && item.Data) {
                    wordBoundaries.push({
                      offset: item.Data.Offset / 10000, // 100ns -> ms
                      duration: item.Data.Duration / 10000,
                      text: item.Data.text?.Text || '',
                      length: item.Data.text?.Length || 0,
                    });
                  }
                }
              }
            } catch {
              // ignora parsing malformado de metadata
            }
          }

          // Sinal de finalização da locução do chunk
          if (text.includes('Path:turn.end')) {
            isCompleted = true;
            cleanup();

            const fullBlob = new Blob(
              audioChunks.map((chunk) => chunk as unknown as BlobPart),
              { type: 'audio/mpeg' }
            );
            resolve({
              audioBlob: fullBlob,
              wordBoundaries,
            });
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Mensagem binária: os primeiros 2 bytes são o header length em big-endian
          const dataView = new DataView(event.data);
          if (dataView.byteLength > 2) {
            const headerLength = dataView.getUint16(0);
            const audioDataOffset = 2 + headerLength;
            if (event.data.byteLength > audioDataOffset) {
              const rawAudio = new Uint8Array(event.data, audioDataOffset);
              audioChunks.push(rawAudio);
            }
          }
        }
      };

      ws.onerror = () => {
        if (!isCompleted) {
          isCompleted = true;
          cleanup();
          reject(new Error('Erro na conexão WebSocket com Edge Neural TTS'));
        }
      };

      ws.onclose = () => {
        if (!isCompleted) {
          if (audioChunks.length > 0) {
            // Se já recebeu áudio e fechou normalmente
            isCompleted = true;
            cleanup();
            const fullBlob = new Blob(
              audioChunks.map((chunk) => chunk as unknown as BlobPart),
              { type: 'audio/mpeg' }
            );
            resolve({ audioBlob: fullBlob, wordBoundaries });
          } else {
            isCompleted = true;
            cleanup();
            reject(new Error('Conexão Edge Neural fechada prematuramente sem áudio'));
          }
        }
      };
    });
  }
}

export const edgeNeuralClient = new EdgeNeuralClient();
