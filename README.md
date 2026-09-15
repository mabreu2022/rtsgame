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

### 🗺️ 5 Biomas & Modelos Procedurais de Mapa
- **1. 🏜️ Tiberian Wasteland (Árido Clássico):** Terreno tiberiano clássico argiloso, rodovia sinuosa de asfalto, rochedos de granito e campos verdejantes de Tiberium.
- **2. ❄️ Siberian Permafrost (Ártico & Gelo):** Planície congelada com lagos de gelo translúcido, pinheiros nevados e **predomínio de Tiberium Azul Glacial de Alta Renda (+50% créditos)**.
- **3. 🌋 Volcanic Badlands (Basalto & Lava):** Terreno basáltico escuro com **fissuras de magma incandescente animadas** e cânions estreitos para emboscadas defensivas.
- **4. 🏖️ Desert Oasis (Dunas Douradas):** Dunas de areia fina com ondulações de vento, **oásis paradisíaco central de água turquesa e palmeiras tropicais**, além de desfiladeiros de arenito.
- **5. 🏙️ Megacity Ruins (Metrópole Urbana):** Malha de avenidas com asfalto rachado e escombros de edifícios. **Veículos terrestres ganham +25% de velocidade ao trafegar em estradas**, permitindo comboios rápidos!
- **Seleção no Lobby e no HUD:** Escolha o bioma pelo dropdown da Sala 4 Players (com sincronização P2P para todos os jogadores) ou pelo botão rápido no topo da tela.

### 📹 Videoconferência WebRTC P2P de Comandantes
- **Transmissão Nativa de Webcam e Microfone:** Transmita vídeo e áudio em tempo real diretamente para os outros jogadores conectados na partida usando canais de mídia P2P via PeerJS.
- **Painel Tático Militar (`#tactical-comms-panel`):** 4 telas de monitor CRT com scanlines para cada quadrante de jogador (GDI Azul, NOD Vermelho, GDI Ouro, NOD Roxo), botões de ligar/desligar câmera (`📹`), mutar microfone (`🎙️`) e minimizar painel (`🗕`).
- **Modo Holográfico com Radar:** Caso um jogador não ligue a webcam, o monitor exibe um avatar militar holográfico animado com o brasão da sua facção e barras de radar tático.

### ⚔️ Posturas Militares de Combate (Unit Stances)
- **🛡️ Defensivo (Padrão / Guarda):** Unidades protegem o setor, revidando agressores e perseguindo apenas por uma distância curta (180px) antes de retornar ao seu posto de guarda.
- **⚔️ Agressivo (Attack-Move):** Tropas realizam varredura com **alcance de detecção +50% maior**, perseguindo e aniquilando qualquer inimigo avistado no mapa.
- **🛑 Manter Posição (Hold Ground):** Unidades permanecem **totalmente imóveis sob qualquer condição**, atirando contra qualquer alvo no alcance. Ideal para emboscadas com infantaria e artilharia.

### 🗺️ Radar Tático / Minimap Totalmente Interativo
- **Navegação com Botão Esquerdo:** Clique em qualquer ponto do radar tático para centralizar a câmera imediatamente na área.
- **Movimentação com Botão Direito (Click-to-Move):** Selecione qualquer grupo de tropas ou veículos e clique com o botão direito diretamente no radar para despachá-los ao setor desejado em formação tática, sem precisar mover a câmera.

### 🤝 Sistema de Diplomacia, Alianças & Combate IA vs IA (FFA)
- **Combate Livre IA vs IA (Guerra entre Bots):** Os robôs de IA possuem consciência estratégica multilateral autônoma. Eles não focam apenas no jogador humano: disputam campos de Tiberium, repelem invasões de bots vizinhos e retaliam imediatamente contra quem atacou suas bases.
- **Painel Diplomático em Tempo Real (`#diplomacy-modal`):** Botão no HUD superior **`🤝 DIPLOMACIA`** para firmar pactos de paz e alianças de combate com bots ou jogadores humanos a qualquer momento durante a batalha.
- **Configuração de Times no Lobby:** Organize batalhas cooperativas **2 Humanos vs 2 Bots Brutais**, modos 2v2 (Alfa vs Bravo) ou Free-For-All total (cada um por si).
- **Visão Compartilhada & Proteção de Fogo Amigo:** Facções aliadas compartilham linha de visão no mapa e radar minimap (com contorno dourado) e nunca sofrem dano de projéteis ou esmagamento aliado.

### 🌐 Multiplayer até 4 Jogadores & Bots de IA
- **Topologia Star WebRTC P2P:** Partidas de até 4 jogadores divididos em 4 quadrantes (GDI Azul Noroeste, NOD Vermelho Nordeste, GDI Ouro Sudoeste, NOD Roxo Sudeste).
- **Sem necessidade de abrir portas no roteador:** Tecnologia STUN (`stun:stun.l.google.com:19302`) com NAT Traversal e UDP Hole Punching automático.
- **Bots de IA Configuráveis:** Qualquer slot pode ser definido como **Humano**, **Bot IA (Fácil)**, **Bot IA (Médio)**, **Bot IA (Brutal)** ou **Fechado**.
- **Link de Convite Direto com 1 Clique:** Copie links como `?room=GDI-XXXX` para entrada imediata de amigos.
- **Auto-Descoberta na Rede / Navegador:** Painel de comandantes online em tempo real com convites via toast flutuante.

### ⚔️ Física Tática, Pathfinding A* & Controles Militares Avançados
- **Pathfinding A* (A-Star) 8-Way com Line-of-Sight Smoothing:** Navegação inteligente contornando obstáculos, montanhas e pegadas físicas de edifícios (`setGrid`), com alisamento de trajetória por raycasting Bresenham.
- **Flocking & Repulsão Física Suave (Anti-Death-Stack):** Separação elástica entre tropas terrestres aliadas para evitar sobreposição artificial de unidades.
- **Attack-Move (`A` / Botão HUD):** Deslocamento agressivo onde o esquadrão interrompe a marcha para atacar qualquer ameaça avistada.
- **Patrulha Militar (`P` / Botão HUD):** As tropas realizam vigília contínua de ida e volta entre a posição de origem e o destino.
- **Fila de Waypoints (`Shift + Clique Dir.`):** Encadeamento de rotas e ordens de combate sequenciais.
- **Rally Points (Pontos de Encontro):** Clique com botão direito tendo Quartel ou Fábrica selecionada para definir onde as novas tropas recém-produzidas se reúnem (com guia tracejada e bandeira animada).
- **Simulação & QuickSave/Load:** Pausa estratégica com `Espaço`, velocidades 1x/2x no HUD, e salvamento instantâneo com `F5` e carregamento com `F9` via `localStorage`.
- **IA Estratégica Completa com Reconstrução:** Bots acumulam economia, repõem usinas de energia, reconstroem refinarias e fábricas caídas, treinam novas colhedoras e constroem defesas de perímetro.
- **Partículas de Dano Crítico & Escombros:** Fumaça e faíscas em tropas com < 35% HP, chamas em prédios avariados e escombros (rubble) queimados permanentes no solo.

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
| **A / Botão HUD** | **Attack-Move:** Move as tropas atacando alvos no caminho |
| **P / Botão HUD** | **Patrulha Militar:** Patrulha contínua ida e volta |
| **Shift + Clique Direito** | **Fila de Waypoints:** Encadeia múltiplos destinos e ordens |
| **Clique Dir. (Quartel/Fábrica)** | **Rally Point:** Define ponto de encontro de novas tropas com guia tracejada |
| **Espaço / Botão HUD** | **Pausar Simulação:** Congela o tempo para planejamento calmo |
| **1x / 2x (HUD)** | **Velocidade da Batalha:** Simulação normal ou acelerada 2x |
| **F5 / Botão HUD** | **QuickSave:** Salva o estado completo no `localStorage` |
| **F9 / Botão HUD** | **QuickLoad:** Restaura instantaneamente o save |
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
