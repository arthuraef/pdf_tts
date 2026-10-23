# 📖🔊 PDF Voice • Audiolivros com OscarVoice Engine v3.0

> **Transforme seus documentos e livros PDF em audiolivros de alta fidelidade diretamente no navegador. 100% Client-Side, Offline-First, Custo Marginal Zero e Privacidade Total.**

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-cyan?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-purple?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline--First-emerald?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Test Suite](https://img.shields.io/badge/Tests-33%2F33%20Passing-brightgreen?logo=node.js&logoColor=white)](https://nodejs.org/api/test.html)
[![License](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)

---

## 🌟 Visão Geral

O **PDF Voice** é um Progressive Web App (PWA) de reprodução e conversão de livros em audiolivro projetado com a filosofia de **privacidade por desenho e custo marginal zero**. Diferente de serviços em nuvem comerciais que cobram por caractere ou exigem envio de dados confidenciais para servidores remotos, o PDF Voice executa **todo o processamento de texto, inteligência de pontuação, normalização semiótica e síntese de voz 100% localmente no dispositivo**.

Equipado com o motor proprietário **OscarVoice Engine v3.0**, o aplicativo reproduz obras longas com cadência humana natural, corrige deformações comuns de PDFs (ligaduras, hífens de quebra de linha e palavras partidas) e conta com o painel acústico **VoiceStudio Enhancer** calibrado especialmente para enriquecer a voz **Google Brasil HD**.

---

## ✨ Funcionalidades Principais

### 🧠 1. OscarVoice Engine v3.0
- **Segmentação Discursiva & Hierárquica:** Fragmentação inteligente do texto em blocos que respeitam a estrutura de parágrafos, orações subordinadas e limites semânticos sem inventar pontuação artificial.
- **Script Stitching Cross-Page:** Costura contínua de orações e palavras cortadas pela virada de página do PDF, garantindo que o fluxo da leitura não seja interrompido abruptamente.
- **Sanitização de Deformações de PDF:**
  - *Cura de Palavras Quebradas / Desifenização:* Reparação automática de termos partidos por quebras de linha ou espaçamentos espúrios (`deso - lação` $\to$ `desolação`, `inconsti - tucional` $\to$ `inconstitucional`), preservando travessões sintáticos legítimos.
  - *Ligaduras Tipográficas:* Normalização de caracteres fundidos de diagramação (`ﬁ` $\to$ `fi`, `ﬂ` $\to$ `fl`, `ﬀ` $\to$ `ff`, `ﬃ` $\to$ `ffi`, `ﬄ` $\to$ `ffl`).
  - *Espaçamento de Letras Avulsas:* Recomposição de títulos espaçados (`C A P Í T U L O` $\to$ `CAPÍTULO`).
  - *Detecção de Cabeçalhos e Rodapés Recorrentes:* Eliminação de numerações e títulos repetitivos no topo/fundo das páginas.
- **Normalização Semiótica PT-BR (Padrão NeMo & TTS-Utils):**
  - Números por extenso com concordância de gênero brasileira (`1.500.000` $\to$ `um milhão e quinhentos mil`).
  - Moedas e valores monetários (`R$ 1.250,50` $\to$ `um mil duzentos e cinquenta reais e cinquenta centavos`).
  - Datas e Horários (`15/03/2026` $\to$ `quinze de março de dois mil e vinte e seis`, `14h30` $\to$ `quatorze horas e trinta minutos`).
  - Medidas e Unidades métricas (`50km/h` $\to$ `cinquenta quilômetros por hora`, `25%` $\to$ `vinte e cinco por cento`).
  - Siglas jurídicas e institucionais com soletração fonética otimizada (`STF` $\to$ `éssi tê éfe`, `TJSP` $\to$ `tê jota ésse pê`).
  - Numerais romanos dinâmicos para reis, séculos e papas (`Século XXI` $\to$ `Século vinte e um`, `D. Pedro II` $\to$ `Dom Pedro segundo`).
  - Expressões latinas e jurídicas pronunciadas sem truncamento (`habeas corpus`, `a priori`, `mutatis mutandis`).
- **Pausas Dramáticas Determinísticas & Bionic Pacing:** Calibração rítmica por papel sintático e adaptação de velocidade baseada na complexidade de cada sentença.

---

### 🎛️ 2. VoiceStudio • Aprimorador de Voz HD
Painel acústico dedicado para afinar o timbre da narração, eliminando a sonoridade metálica/robótica comum de sintetizadores e trazendo presença e calor humano para a voz **Google Brasil HD**:
- **Presets Acústicos Pré-Calibrados:**
  - 🎙️ **Audiolivro Aveludado (Padrão):** *Pitch shift* de `-3%` para encorpar a voz com tom aveludado, cadência respiratória ampliada (`+5%`) e micro-respirações orgânicas humanas.
  - 📻 **Podcast Broadcast FM:** Projeção clara e ágil (`-10%` de pausas) com articulação marcada para audição nítida em fones de ouvido.
  - 🧘 **Leitura Noturna & Suave:** Entonação compassada (`-4%`) e pausas relaxantes (`+20%`) para descanso e concentração profunda.
  - ⚡ **Articulação Rápida (1.5x+):** Afinação equilibrada (`+2%`) e pausas curtas para garantir máxima dicção mesmo em altíssima velocidade.
  - 🎛️ **Personalizado:** Controle milimétrico manual de tom e tempo.
- **Ajustes Finos em Tempo Real:**
  - Slider de *Pitch Shift* (-8% a +8%).
  - Slider de *Cadência de Pausas / Ritmo Respiratório* (0.7x a 1.4x).
  - Alternador de *Micro-respirações Orgânicas*.
- **Player de Preview Interativo:** Teste frases em tempo real antes de aplicar à leitura com persistência local no `localStorage`.

---

### 📚 3. Estante & Biblioteca Pessoal (Bookshelf View)
- **Extração com Web Worker:** Leitura assíncrona com `pdfjs-dist` sem congelar a interface do usuário.
- **Capas 3D Renderizadas Localmente:** Geração automática da capa a partir da primeira página do PDF.
- **Persistência IndexedDB (Dexie.js):** Salva múltiplos livros, total de páginas, progresso percentual exato e última posição ouvida.
- **Retomada Instantânea:** Botão *"Continuar Ouvindo"* em destaque na estante para retomar a reprodução de onde parou.
- **Busca Rápida:** Filtro instantâneo por título do livro na biblioteca.

---

### 🎧 4. Player de Reprodução & Estudo Focado
- **Visualizador Focado Estilo Karaokê:** Exibição da sentença em reprodução atual em destaque, com visualização do trecho anterior e posterior.
- **Barra de Navegação Visual (Scrubber):** Controle deslizante preciso por páginas e blocos de texto.
- **Pular Sentença:** Botões para voltar ou avançar 1 frase com um único clique.
- **3 Estilos de Narração:**
  - *Clássico Neutro*: Estilo tradicional e fluido.
  - *Dramático Expressivo*: Pausas mais marcadas e modulação tonal.
  - *Didático Claro*: Ênfase na dicção e clareza de termos técnicos.
- **Controle Dinâmico de Velocidade:** Slider de velocidade suave (0.5x a 3.0x) com amortecedor (debounce) de áudio.
- **Gaveta de Capítulos:** Navegação direta pela estrutura do PDF (TOC / Outlines).
- **Grifos e Citações:** Salve frases marcantes durante a leitura com botão de estrela para consulta posterior.

---

### 📱 5. Modo Bolso AMOLED & PWA Nativo
- **Modo Bolso (Pure Black):** Tela preta com baixo brilho e botões de toque largo para caminhar, correr ou ouvir na cama sem toques acidentais e com economia extrema de bateria em telas OLED.
- **Media Session API:** Controles nativos na tela de bloqueio do celular, centrais de notificação do iOS/Android e comandos de fone Bluetooth (Play, Pause, Próxima/Anterior).
- **Web Audio Stage & Mobile Audio Unlocking:** Desbloqueio atômico de hardware de áudio no primeiro toque, impedindo cortes de reprodução no Safari/Chrome Mobile.
- **Instalável como App:** Funcionalidade PWA completa com manifesto e Service Worker para carregar sem internet.

---

### 🔒 6. Privacidade Grau Bancário
- Nenhum dado, documento, trecho de texto ou arquivo é enviado para a nuvem.
- Processamento inteiramente realizado na memória local e no armazenamento seguro do seu navegador (`IndexedDB`).

---

## 🛠️ Arquitetura do Sistema

```
src/
├── core/                         # Extração e segmentação de documentos
│   ├── pdf-parser.ts             # Parser PDF.js com Web Worker e junção de hífens
│   └── text-chunker.ts           # Chunker discursivo e costura cross-page
│
├── oscar-engine/                 # Motor Central OscarVoice v3.0
│   ├── audio-stage/              # Gerenciador Web Audio API e desbloqueio mobile
│   │   ├── webAudioStage.ts
│   │   ├── mobileAudioUnlocker.ts
│   │   └── breathInjector.ts     # Injetor acústico de micro-respirações
│   │
│   ├── director/                 # Direção artística e modulação
│   │   ├── emotionalParser.ts    # Parse de pontuação e pausas determinísticas
│   │   └── bionicSpeed.ts        # Cálculo de velocidade bionica contextual
│   │
│   ├── evaluation/               # Suíte de avaliação acústica e semiótica
│   │   ├── goldset.ts            # Goldset PT-BR com casos canônicos
│   │   └── metrics.ts            # Cálculo de CER, WER e distância Levenshtein
│   │
│   ├── sanitizer/                # Normalização textual avançada
│   │   ├── dehyphenator.ts       # Desifenização inteligente e cura de palavras
│   │   ├── normalizationMap.ts   # Mapeamento com rastreamento de proveniência UTF-16
│   │   ├── numberToWordsPtBr.ts  # Numerais cardinais/ordinais brasileiros
│   │   ├── ptBrLexicon.ts        # Léxico de moedas, medidas, datas e siglas
│   │   └── preReadRepair.ts      # Ligaduras e separações de caracteres
│   │
│   ├── transport/                # Camada de síntese Web Speech API
│   │   └── fallbackNativeTts.ts  # Ranking de vozes (Google Brasil HD prioritária)
│   │
│   ├── types.ts                  # Tipagens, esquemas acústicos e VoiceStudio Presets
│   └── index.ts                  # Fachada orquestradora do OscarEngine
│
├── components/                   # Componentes Visuais (React 19 + Tailwind CSS)
│   ├── BookshelfView.tsx         # Estante de livros com capas 3D e busca
│   ├── BookCover.tsx             # Capa com sombras e efeito tridimensional
│   ├── PlayerControls.tsx        # Controles de reprodução, estilos e badges
│   ├── ProgressBar.tsx           # Scrubber visual e karaokê de frases
│   ├── VoiceStudioModal.tsx      # Modal de aprimoramento acústico VoiceStudio
│   ├── PocketModeModal.tsx       # Modo Bolso AMOLED
│   ├── ChapterDrawer.tsx         # Gaveta de capítulos e índice
│   └── HighlightsModal.tsx       # Modal de frases e citações favoritadas
│
├── hooks/
│   ├── useOscarEngine.ts         # Hook de estado reativo do motor e VoiceStudio
│   └── useMediaSession.ts        # Integração com Media Session API do sistema
│
├── storage/
│   └── db.ts                     # Banco local IndexedDB via Dexie.js
│
├── App.tsx                       # Orquestração principal das telas
└── main.tsx                      # Bootstrap do React e PWA
```

---

## 🧪 Garantia de Qualidade & Testes

A integridade do motor é verificada através de uma suíte abrangente de **33 testes automatizados**, incluindo o **Goldset PT-BR** que valida normalização semiótica baseada nas especificações da NVIDIA NeMo e TTS-Utils:

- ✅ **0% CER** (Character Error Rate) e **0% WER** (Word Error Rate) no Goldset canônico.
- ✅ Cura de palavras quebradas por hífens e quebras de linha (`deso - lação`).
- ✅ Preservação de travessões oracionais legítimos.
- ✅ Conversão de moedas (R$), datas, horas, medidas e numerais por extenso.
- ✅ Expansão de siglas jurídicas brasileiras (`STF`, `TJSP`, `OAB`).
- ✅ Presets acústicos do VoiceStudio e modulação de timbre.
- ✅ Desbloqueio atômico de hardware de áudio móvel.

Para executar os testes:
```bash
npm test
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js** 20+
- **npm** ou **pnpm**

### Instalação e Desenvolvimento
```bash
# 1. Clone o repositório
git clone https://github.com/arthuraef/pdf_tts.git
cd pdf_tts

# 2. Instale as dependências
npm install

# 3. Inicie o servidor de desenvolvimento Vite
npm run dev
```

Abra seu navegador em `http://localhost:5173`.

### Compilação para Produção & PWA
```bash
# Executa verificação de tipos e compilação do Vite
npm run build

# Pré-visualize a build de produção localmente
npm run preview
```

---

## 💻 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Linguagem & Tipagem** | TypeScript 6.0 |
| **Framework UI** | React 19.2 |
| **Bundler & Build Tool** | Vite 8.3 |
| **Estilização** | Tailwind CSS v4 |
| **Engine de PDF** | `pdfjs-dist` v6.4 (com Web Worker dedicado) |
| **Persistência Local** | `dexie` v4.4 (IndexedDB) |
| **PWA & Offline** | `vite-plugin-pwa` (Workbox) |
| **Ícones & Design** | `lucide-react` |
| **Test Runner** | Node.js Test Runner nativo (`node:test` + `tsx`) |

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
