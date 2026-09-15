# ⚔️ Command & Conquer: Tiberian Assault (HTML5 RTS)

![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![JavaScript ES6+](https://img.shields.io/badge/JavaScript-ES6%2B_MVC-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Synthesizer-4A90E2?style=for-the-badge)
![WebRTC](https://img.shields.io/badge/Multiplayer-WebRTC_P2P-333333?style=for-the-badge&logo=webrtc&logoColor=white)

Um jogo clássico de Estratégia em Tempo Real (RTS) militar no estilo **Command & Conquer / Tiberian Sun**, construído 100% nativo para o navegador em JavaScript puro (Vanilla ES6+), Canvas 2D de alta fidelidade e Web Audio API, arquitetado no padrão **MVC (Model-View-Controller)**.

---

## 🌟 Principais Recursos

### 🪖 Infantaria & Veículos com Animações Fluidas
- **Soldado Fuzileiro:** Farda camuflada verde oliva, capacete tático Kevlar com óculos balísticos, fuzil de assalto longo empunhado com as duas mãos e muzzle flash nos disparos.
- **Lança-Foguetes Pesado:** Traje pesado antichamas ocre/laranja tático, capacete com visor infravermelho, grande bazuca militar de ombro com ogiva visível e mochila com mísseis adicionais.
- **Engenheiro Militar:** Colete amarelo de alta visibilidade com faixas refletivas prateadas. Infiltra em construções inimigas para **capturá-las instantaneamente** ou repara estruturas aliadas a 100%. Carrega maleta de ferramentas e tablet holográfico com luz ciano pulsante.
- **Comando de Elite:** Traje preto stealth de operações especiais, **boina militar vermelha clássica**, pintura facial de camuflagem, faca de combate, fuzil sniper com silenciador e **mira laser pontual vermelha guiada**.
- **Helicóptero de Transporte (Chinook):** Aeronave de rotores duplos tandem capaz de **embarcar até 6 soldados** e desembarcá-los em qualquer terreno do mapa.
- **Tanques e Aeronaves:** Tanque Médio M1 com esmagamento de infantaria, Tanque Mamute Pesado com canhões duplos, Transporte Blindado APC, Helicóptero Orca, Caça a Jato e Colhedoras de Tiberium.

### 🏭 Construções & Economia Tiberiana
- **Centro de Comando (HQ):** Expansão da base militar e alimentação do radar tático.
- **Usinas de Energia:** Geram +100 GW para manter produção acelerada e defesas online.
- **Refinarias & Silos de Tiberium:** Cada silo adiciona **+$3.000 de capacidade** de créditos, com avisos de voz da EVA (*"Silos needed"*).
- **Defesas Avançadas:** Torre de Defesa automática, **Obelisco de Luz NOD** com feixe contínuo laser carmesim (220 dano).
- **Templo de NOD & Super-Arma:** Plataforma de lançamento do **Míssil Nuclear balístico** com sirene militar wailing, tremor de tela e **cogumelo atômico procedural** em expansão térmica.
- **Canhão de Íons GDI:** Super-arma orbital celestial com feixe de plasma devastador.

### 🎵 Jukebox Militar de 4 Trilhas Sonoras Originais & Áudio Pro
- **Catálogo de 4 Trilhas Estilo C&C (Frank Klepacki):**
  - **1. HELL MARCH // TIBERIAN METAL (126 BPM):** Bateria industrial pesada, contratempos metálicos, linha de baixo distorcida em Ré menor e power chords.
  - **2. ACT ON INSTINCT // TACTICAL GROOVE (116 BPM):** Groove militar funk-rock com slap bass em Lá menor, hi-hats com swing e sintetizadores arpejados.
  - **3. LONE TROOPER // DARK AMBIENT (94 BPM):** Atmosfera cinematográfica tensa com sub-graves profundos, rimshots suaves e pads ressonantes envolventes.
  - **4. MECHANICAL RUSH // HIGH VELOCITY (138 BPM):** Ritmo frenético de combate militar, bumbo duplo em semicolcheias e arpejos agressivos para rush tático.
- **HUD Jukebox & Equalizador Visual:** Widget dedicado no topo da tela com botões ⏮ / ▶ / ⏭, mostrador de faixa em tempo real, **equalizador VU Meter animado com 4 barras pulsantes** e controle deslizante de volume (0 a 100%).
- **Voz Tática EVA:** Avisos vocalizados militarmente via Web Speech API (*"Battle control online"*, *"Unit ready"*, *"Mission accomplished"*).
- **Efeitos Sonoros Procedurais:** Disparos, foguetes, canhões, explosões com sub-graves, alarmes e chimes eletrônicos.

### 🗺️ Radar Tático / Minimap Totalmente Interativo
- **Navegação com Botão Esquerdo:** Clique em qualquer ponto do radar tático para centralizar a câmera imediatamente na área.
- **Movimentação com Botão Direito (Click-to-Move):** Selecione qualquer grupo de tropas ou veículos e clique com o botão direito diretamente no radar para despachá-los ao setor desejado em formação tática, sem precisar mover a câmera.

### 🌐 Multiplayer até 4 Jogadores & Bots de IA
- **Topologia Star WebRTC P2P:** Partidas de até 4 jogadores divididos em 4 quadrantes (GDI Azul Noroeste, NOD Vermelho Nordeste, GDI Ouro Sudoeste, NOD Roxo Sudeste).
- **Sem necessidade de abrir portas no roteador:** Tecnologia STUN (`stun:stun.l.google.com:19302`) com NAT Traversal e UDP Hole Punching automático.
- **Bots de IA Configuráveis:** Qualquer slot pode ser definido como **Humano**, **Bot IA (Fácil)**, **Bot IA (Médio)**, **Bot IA (Brutal)** ou **Fechado**.
- **Link de Convite Direto com 1 Clique:** Copie links como `?room=GDI-XXXX` para entrada imediata de amigos.
- **Auto-Descoberta na Rede / Navegador:** Painel de comandantes online em tempo real com convites via toast flutuante.

### 🏆 4 Condições de Vitória Selecionáveis
1. **Aniquilação Total:** Destruição completa de todas as tropas e bases adversárias.
2. **Destruição de HQ:** Neutralização do Centro de Comando inimigo mantendo o seu protegido.
3. **Corrida do Tiberium:** Primeiro comandante a atingir $15.000 créditos vence.
4. **Rei da Colina:** Controle contínuo da Cratera Central de Tiberium por 180 segundos.

---

## 🏗️ Arquitetura do Projeto (Padrão MVC)

O projeto adota a arquitetura **Model-View-Controller (MVC)** com módulos JavaScript ES6+:

```
jogo/
├── index.html                   # Ponto de entrada HTML semântico e leve
├── manual.html                  # Manual tático militar completo ilustrado
├── README.md                    # Documentação do projeto
│
├── css/                         # Folhas de estilo modularizadas
│   ├── main.css                 # Layout principal, viewport, canvas e tipografia
│   ├── hud.css                  # HUD militar superior, medidores de energia/créditos
│   ├── sidebar.css              # Barra lateral tática C&C, abas de produção e cards
│   └── modals.css               # Modais de multiplayer, game over, toasts e chat
│
└── js/                          # Módulos JavaScript (ES6 Modules)
    ├── main.js                  # Inicialização da aplicação no DOM
    │
    ├── utils/
    │   └── MathUtils.js         # Normalização angular, interpolação e utilitários
    │
    ├── audio/                   # Serviços de síntese sonora
    │   ├── EvaVoice.js          # Síntese vocal EVA (Web Speech API)
    │   ├── SoundSynth.js        # Efeitos sonoros procedurais (Web Audio API)
    │   └── MusicEngine.js       # Trilha sonora industrial dinâmica a 126 BPM
    │
    ├── models/                  # MODELOS (Regras de dados, física e entidades)
    │   ├── MapModel.js          # Terreno procedural, Tiberium e Névoa de Guerra
    │   ├── Building.js          # Entidades de estruturas militares e defesas
    │   ├── Unit.js              # Entidades de infantaria, blindados e aeronaves
    │   ├── Projectile.js        # Projéteis, mísseis balísticos e projéteis de canhão
    │   └── ParticleSystem.js    # Partículas de explosões, fumaça e faíscas
    │
    ├── views/                   # VISÕES (Renderização gráfica e interfaces de usuário)
    │   ├── SidebarView.js       # Barra lateral de construção, cards e filas
    │   └── [Views auxiliares]   # Renderização em Canvas 2D
    │
    └── controllers/             # CONTROLADORES (Orquestração e lógica de jogo)
        ├── GameEngine.js        # Controlador central do jogo e Game Loop
        └── NetworkController.js # Gerenciador de rede WebRTC Star P2P e chat
```

---

## ⌨️ Controles e Atalhos de Teclado

| Comando | Ação |
| :--- | :--- |
| **Botão Esquerdo** | Seleciona unidades/prédios ou abre caixa de arrasto |
| **Botão Direito** | Move unidades, ordena ataque, minera ou embarca em transportes |
| **Clique Esquerdo no Radar** | **Centraliza a câmera imediatamente** no local clicado no minimap |
| **Clique Direito no Radar** | **Move as tropas selecionadas diretamente pelo minimap** (Click-to-Move) |
| **Scroll do Mouse** | Zoom in / Zoom out contínuo na câmera |
| **W, A, S, D** | Navegação panorâmica da câmera pelo mapa |
| **Ctrl + 1..9** | Atribui as unidades selecionadas ao **Grupo N** |
| **1..9** | Seleciona instantaneamente o Grupo N |
| **1..9 (Duplo Toque)** | **Centraliza a câmera imediatamente nas tropas do Grupo N** |
| **Jukebox ⏮ / ▶ / ⏭** | Alterna entre as 4 faixas originais ou pausa a música |
| **Volume Slider** | Ajusta o volume linear da trilha sonora (0% a 100%) |
| **Enter** | Abre o rádio tático militar do Chat |
| **Esc** | Cancela posicionamento de prédios ou limpa seleção |

---

## 🚀 Como Executar Localmente

Como o projeto utiliza **Módulos ES6 nativos**, é necessário servir os arquivos via um servidor HTTP local:

### Com Python:
```bash
python -m http.server 8088
```
Acesse no navegador: **`http://localhost:8088/index.html`**

### Com Node.js / npx:
```bash
npx serve . -p 8088
```

---

## 🌐 Como Jogar Online com Amigos

1. Abra o jogo e clique no badge superior **🌐 SALA / 4 PLAYERS**.
2. Clique em **🛰️ CRIAR SALA DE GUERRA**.
3. Clique em **🔗 COPIAR LINK DE CONVITE**.
4. Envie o link gerado (ex: `https://seusite.com/?room=GDI-4821`) para seus amigos.
5. Ao carregar a página, eles entram automaticamente na partida via WebRTC P2P!

---

## 📄 Licença
Distribuído sob a licença MIT. Inspirado na franquia clássica *Command & Conquer* da Westwood Studios / Electronic Arts.
