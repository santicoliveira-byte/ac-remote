# 🏎️ AC Remote - Servidor PC (Assetto Corsa) v1.0.0

Pacote completo do servidor local para correr no PC onde tens o **Assetto Corsa** instalado.
Permite ligar o simulador ao teu **iPhone** ou telemóvel pela rede Wi-Fi local para escolher carros, pistas, teleporte para os boxes, controlo de volume e entrar em servidores online!

---

### 📦 O que inclui este pacote (`AC_Remote_PC.zip`):
- **`start_ac_remote.bat`**: Inicia o servidor com janela de consola e mostra o teu endereço IP local.
- **`iniciar_em_segundo_plano.vbs`**: **Executa o servidor 100% em background (silencioso)**, sem nenhuma janela aberta no ecrã a atrapalhar.
- **`parar_ac_remote.bat`**: Encerra o servidor de background quando terminares de jogar.
- **`create_shortcut.bat`**: Cria automaticamente os atalhos com o ícone oficial no teu Ambiente de Trabalho.
- **`app.py`**: Servidor Flask com suporte a Keep-Awake (impede o Windows de suspender), injeção de `race.ini`, controlo em pista (DirectInput) e integração com Content Manager.
- **`requirements.txt`**: Dependências Python necessárias (`flask`, `requests`, `pillow`, `psutil`, `pydirectinput`, `keyboard`).
- **`COMO_USAR_NO_OUTRO_PC.txt`**: Instruções passo a passo em Português.

---

### 🚀 Como usar no teu outro PC de Jogos:
1. Descarrega o ficheiro **`AC_Remote_PC.zip`** dos Assets abaixo.
2. Extrai o ZIP para qualquer pasta no teu computador (ex: `Documentos` ou `C:\AC_Remote`).
3. Clica duas vezes em **`create_shortcut.bat`** para criar os atalhos no Ambiente de Trabalho.
4. Clica duas vezes em **`start_ac_remote.bat`** (ou em **`iniciar_em_segundo_plano.vbs`** para rodar oculto).
5. No teu iPhone, abre o endereço IP indicado no terminal (ex: `http://192.168.1.X:5000`) ou acede à Web App em https://ac-remote-alpha.vercel.app e coloca o IP do teu PC nas Definições.
