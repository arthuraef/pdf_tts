# 📖🔊 PDF Voice

> Leitor de arquivos PDF em voz alta direto no navegador (Web App & PWA offline-first).

Transforme documentos e livros em áudio sem custo, com salvamento automático de progresso e controles de reprodução.

---

## ✨ Funcionalidades do MVP

- 📄 **Upload & Parsing 100% Client-Side:** Processamento local de PDFs com [PDF.js](https://mozilla.github.io/pdf.js/) (nenhum documento é enviado para a nuvem).
- 🔊 **Leitura em Voz Alta:** Reprodução contínua através da [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API).
- ⏩ **Avançar / Voltar 10 Segundos:** Navegação rápida para reouvir ou pular trechos.
- ⚡ **Velocidade Customizada:** Alternância entre **1.0x**, **1.25x** e **1.5x**.
- 💾 **Persistência Automática:** Salva documento e posição exata no [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via Dexie.js para retomar exatamente de onde parou.
- 📱 **PWA Instalável:** Funciona offline e pode ser instalado no celular ou desktop como aplicativo nativo.

---

## 🛠️ Stack Tecnológico

- **Framework:** React 19 + TypeScript
- **Bundler:** Vite 6
- **Estilização:** Tailwind CSS v4
- **PDF Engine:** `pdfjs-dist` (com Web Worker integrado)
- **Persistência:** `dexie` (IndexedDB)
- **PWA:** `vite-plugin-pwa` (Workbox)
- **Ícones:** `lucide-react`

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ (recomendado 20+)
- npm ou pnpm

### Instalação
```bash
# Clone o repositório
git clone https://github.com/arthuraef/pdf_tts.git
cd pdf_tts

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

### Build para Produção & PWA
```bash
npm run build
npm run preview
```

---

## 📄 Licença
Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
