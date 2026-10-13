# 🏎️ AC Remote (Assetto Corsa Mobile Controller)

Web App completa em Python (Flask) desenhada como uma **PWA Mobile-First** para iPhone e dispositivos móveis, com visual **Dark Mode estilo Consola/Gaming**, desenvolvida para controlar e lançar sessões do **Assetto Corsa** no PC remotamente.

Pronta para correr **localmente na rede Wi-Fi** ou ser publicada na **Vercel** (Cloud 24/7)!

---

## ⚡ Como manter o PC sempre ligado (Keep-Awake)

O **AC Remote** inclui suporte nativo à API do Windows (`SetThreadExecutionState`) para **impedir que o computador entre em suspensão ou desligue a placa de rede** enquanto o servidor estiver em execução:

1. Executa o ficheiro [`run.bat`](file:///c:/Users/santi/Documents/REMOTE/run.bat).
2. O terminal confirmará:
   ```text
   [ENERGIA] Modo Keep-Awake ATIVADO: O PC estará sempre ligado (não irá suspender).
   ```
3. O computador permanecerá acordado e pronto para responder aos comandos do iPhone a qualquer momento!

---

## ☁️ Como publicar na Vercel (Online 24/7 com HTTPS)

Ter a app na Vercel permite ter um link fixo público com **HTTPS** (ex: `https://ac-remote-seunome.vercel.app`), ideal para instalar no iPhone sem avisos de segurança e com carregamento instantâneo.

### Passo 1: Enviar para o GitHub
1. Cria um repositório no [GitHub](https://github.com/new).
2. Na pasta do projeto (`c:\Users\santi\Documents\REMOTE`):
   ```bash
   git init
   git add .
   git commit -m "AC Remote Vercel ready"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/ac-remote.git
   git push -u origin main
   ```

### Passo 2: Importar na Vercel
1. Vai a [vercel.com](https://vercel.com) e clica em **"Add New Project"**.
2. Seleciona o repositório do GitHub criado.
3. A Vercel irá detetar automaticamente o ficheiro `vercel.json` e `requirements.txt`.
4. Clica em **Deploy**.

---

## 📱 Como ligar a Vercel ao teu PC

Como o simulador **Assetto Corsa** está instalado no teu computador físico:
1. Inicia o servidor local no PC clicando duas vezes em [`run.bat`](file:///c:/Users/santi/Documents/REMOTE/run.bat).
2. No teu iPhone, abre a tua app da Vercel (ex: `https://ac-remote.vercel.app`).
3. Toca na aba **Definições**.
4. No campo **"Endereço do PC (IP Local ou Túnel)"**:
   - Se estiveres no mesmo Wi-Fi: coloca `http://192.168.1.192:5000` (o IP mostrado no teu terminal).
   - Se quiseres aceder de fora de casa (4G/5G): podes usar um túnel gratuito como o **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:5000`) ou **Ngrok** (`ngrok http 5000`) e colar o link gerado!
5. Toca em **"Guardar Definições"**.
6. A app na Vercel passará a comunicar diretamente com o teu PC através do nosso proxy transparente!

---

## 🎮 Instalar no iPhone (Ecrã Total sem barras do Safari)
1. No Safari do iPhone, abre o link (local ou da Vercel).
2. Toca no botão de **Partilhar** do Safari (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>).
3. Escolhe **"Adicionar ao Ecrã Principal"**.
4. Abre o ícone **AC Remote**: funcionará como uma **aplicação nativa iOS** em ecrã total!
