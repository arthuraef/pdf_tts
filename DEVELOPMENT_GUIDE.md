# 🛠️ Guia de Implementação & Blindagem de Código — OscarVoice Engine

Este documento contém os contratos de código e regras estritas de engenharia que devem ser seguidos durante a implementação do **OscarVoice Engine** no projeto **PDF Voice**.

---

## 1. Contratos de Dados Obrigatórios (`src/oscar-engine/types.ts`)

Todo o motor deve se comunicar usando exclusivamente estas interfaces:

```typescript
export type SpeakerRole = 'narrator' | 'character_a' | 'character_b' | 'heading' | 'aside';

export interface AcousticProfile {
  spatialPan: number;            // -1.0 (Esquerda) a +1.0 (Direita). Padrão narrador: 0
  injectBreathBefore: boolean;   // Toca sample de respiração 250ms antes da fala
  bionicSpeedMultiplier: number; // Multiplicador automático de complexidade (0.90 a 1.35)
  pauseAfterMs: number;          // Pausa dramática após o fim do áudio
}

export interface ActingScoreChunk {
  id: string;                    // Hash único: `${docId}_p${page}_c${index}`
  pageNumber: number;
  chunkIndex: number;
  rawText: string;               // Texto original extraído do PDF
  cleanText: string;             // Texto higienizado para exibição na UI
  ssmlPayload: string;           // SSML completo para envio ao motor Neural
  role: SpeakerRole;
  voiceId: string;               // Ex: 'pt-BR-FranciscaNeural' | 'pt-BR-AntonioNeural'
  acoustics: AcousticProfile;
}

export interface EngineStateEvents {
  onChunkStart: (chunk: ActingScoreChunk) => void;
  onWordBoundary: (charIndex: number, charLength: number) => void;
  onNetworkFallback: (isOfflineMode: boolean) => void;
  onPageComplete: (pageNumber: number) => void;
  onError: (error: Error, recoverable: boolean) => void;
}
```

---

## 2. As 5 Regras de Ouro Anti-Bugs (Blindagem de Produção)

1. **Prevenção contra Vazamento de Memória (Memory Leak):**
   - A fila em memória RAM (`PrefetchQueue`) deve manter no máximo 5 `AudioBuffer` decodificados (1 anterior, 1 atual, 3 futuros).
   - Sempre que o índice avançar para $N+1$, o buffer $N-2$ deve ser desconectado do `AudioContext` (`source.disconnect()`) e sua referência anulada para coleta do Garbage Collector.

2. **Timeout Estrito de 2.000ms na Rede:**
   - Nenhuma requisição ao endpoint de voz neural pode ficar pendente por mais de 2 segundos.
   - Utilizar `AbortSignal.timeout(2000)`. Se disparar erro de timeout, acionar imediatamente `fallbackNativeTts.speak(chunk.cleanText)` e registrar tentativa de reconexão para os próximos chunks.

3. **Desbloqueio de AudioContext no Mobile (Autoplay Policy):**
   - No iOS Safari e Android Chrome, o `AudioContext` inicia no estado `suspended`.
   - Dentro do evento de clique do botão Play (`onClick` síncrono do usuário), sempre executar:
     ```typescript
     if (audioCtx.state === 'suspended') {
       await audioCtx.resume();
     }
     ```

4. **Processamento Preguiçoso por Página (Lazy Page Parsing):**
   - Nunca higienizar nem gerar a partitura emocional de todas as páginas de um PDF de 500 páginas de uma só vez no upload.
   - Processar sob demanda apenas a página atual e a página atual + 1. O tempo entre o clique em "Play" e o início da fala (Time-to-First-Audio) deve ser inferior a 400ms.

5. **Isolamento Total da Interface (Zero UI Imports):**
   - Nenhum arquivo dentro de `src/oscar-engine/` pode importar `react`, `react-dom` ou componentes visuais. A comunicação com o React deve ocorrer exclusivamente através do hook `useOscarEngine.ts`.

---

## 3. Receita do Dicionário Brasileiro (`ptBrLexicon.ts`)

Implementar as seguintes substituições léxicas antes de gerar o SSML:

| Padrão no PDF (Regex) | Substituição Falada | Motivo |
|---|---|---|
| `/\bArt\.\s*(\d+)º?/gi` | `Artigo $1` | Evita ler "Art ponto cinco grau" |
| `/\b(Século\|Séc\.)\s+XXI\b/gi` | `Século vinte e um` | Pronúncia natural de séculos |
| `/\b(Século\|Séc\.)\s+XX\b/gi` | `Século vinte` | Pronúncia natural de séculos |
| `/\b(Século\|Séc\.)\s+XIX\b/gi` | `Século dezenove` | Pronúncia natural de séculos |
| `/\b(Século\|Séc\.)\s+XVIII\b/gi` | `Século dezoito` | Pronúncia natural de séculos |
| `/\bDr\.\s+/g` / `\bDra\.\s+/g` | ` Doutor ` / ` Doutora ` | Fluidez em diálogos e textos médicos |
| `/\bpág\.\s*(\d+)/gi` | `página $1` | Fluidez em referências bibliográficas |
| `/\bInc\.\s*([IVX]+)/gi` | `Inciso $1` | Essencial para estudantes de Direito |
| `/\b§\s*(\d+)º?/gi` | `Parágrafo $1` | Leitura correta do símbolo de parágrafo legal |

---

## 4. Checklist de Sprints para Execução

- [ ] **Sprint 1 (Sanitizer):** Implementar `dehyphenator.ts`, `headerFooterFilter.ts` e `ptBrLexicon.ts` com testes unitários cobrindo textos jurídicos e literários.
- [ ] **Sprint 2 (Transport & Voz HD):** Implementar `edgeNeuralClient.ts` + `prefetchQueue.ts` com cache no Dexie.js e fallback automático de 2s para Web Speech API.
- [ ] **Sprint 3 (Director & Bionic):** Implementar `emotionalParser.ts` (troca Francisca/Antonio em diálogos) e `bionicSpeed.ts` (modulação automática de velocidade por densidade léxica).
- [ ] **Sprint 4 (3D Stage & MP3):** Implementar `webAudioStage.ts` (panorâmica estéreo + injeção de respiração) e exportador de capítulos em MP3.
