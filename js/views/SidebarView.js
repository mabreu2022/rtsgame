import { Building } from '../models/Building.js';
import { Unit } from '../models/Unit.js';

export class SidebarUI {
      constructor(engine) {
        this.engine = engine;
        this.activeTab = 'buildings';
        this.unitQueue = [];
        this.activePlacement = null;
        this.ghostX = 0;
        this.ghostY = 0;
        this.isGhostValid = false;

        // Ferramentas da Base
        this.activeTool = null; // 'repair' | 'sell' | 'ion'

        // Super-Arma Canhão de Íons
        this.ionTimer = 0;
        this.ionCooldown = 75; // 75 segundos
        this.ionReady = false;

        this.initDOM();
      }

      initDOM() {
        const tabB = document.getElementById('tabBuildings');
        const tabI = document.getElementById('tabInfantry');
        const tabV = document.getElementById('tabVehicles');

        tabB.onclick = () => {
          this.activeTab = 'buildings';
          tabB.classList.add('active'); tabI.classList.remove('active'); tabV.classList.remove('active');
          this.renderBuildGrid();
        };

        tabI.onclick = () => {
          this.activeTab = 'infantry';
          tabI.classList.add('active'); tabB.classList.remove('active'); tabV.classList.remove('active');
          this.renderBuildGrid();
        };

        tabV.onclick = () => {
          this.activeTab = 'vehicles';
          tabV.classList.add('active'); tabB.classList.remove('active'); tabI.classList.remove('active');
          this.renderBuildGrid();
        };

        // Ferramenta Reparar
        const btnRepair = document.getElementById('btnToolRepair');
        btnRepair.onclick = () => {
          if (this.activeTool === 'repair') {
            this.activeTool = null;
            btnRepair.classList.remove('active');
            document.getElementById('placement-guide').classList.remove('show');
          } else {
            this.activeTool = 'repair';
            this.activePlacement = null;
            btnRepair.classList.add('active');
            document.getElementById('btnToolSell').classList.remove('active');
            document.getElementById('placement-guide-txt').innerText = '🔧 MODO DE REPARO: CLIQUE EM UMA CONSTRUÇÃO DANIFICADA';
            document.getElementById('placement-guide').classList.add('show');
            this.engine.sounds.playSelect();
          }
        };

        // Ferramenta Vender
        const btnSell = document.getElementById('btnToolSell');
        btnSell.onclick = () => {
          if (this.activeTool === 'sell') {
            this.activeTool = null;
            btnSell.classList.remove('active');
            document.getElementById('placement-guide').classList.remove('show');
          } else {
            this.activeTool = 'sell';
            this.activePlacement = null;
            btnSell.classList.add('active');
            document.getElementById('btnToolRepair').classList.remove('active');
            document.getElementById('placement-guide-txt').innerText = '💲 MODO DE VENDA: CLIQUE EM UMA CONSTRUÇÃO PARA DESMONTAR';
            document.getElementById('placement-guide').classList.add('show');
            this.engine.sounds.playSelect();
          }
        };

        // Super-Arma Canhão de Íons
        const btnIon = document.getElementById('btn-ion-cannon');
        btnIon.onclick = () => {
          if (this.ionReady) {
            this.activeTool = 'ion';
            this.activePlacement = null;
            document.getElementById('placement-guide-txt').innerText = '🛰️ MIRA ORBITAL: CLIQUE NO MAPA PARA ATIVAR O CANHÃO DE ÍONS';
            document.getElementById('placement-guide').classList.add('show');
            this.engine.sounds.playSelect();
          }
        };

        // Toggle Shroud
        const btnShroud = document.getElementById('btnToggleShroud');
        btnShroud.onclick = () => {
          this.engine.map.shroudEnabled = !this.engine.map.shroudEnabled;
          btnShroud.innerText = this.engine.map.shroudEnabled ? '👁️ SHROUD ON' : '👁️ SHROUD OFF';
        };

        // Toggle Música Industrial
        const btnMusic = document.getElementById('btnMusicToggle');
        if (btnMusic) {
          btnMusic.onclick = () => {
            const isPlaying = this.engine.music.toggle();
            btnMusic.innerHTML = isPlaying ? '<span id="music-icon">🎵</span> MÚSICA ON' : '<span id="music-icon">🔇</span> MÚSICA OFF';
          };
        }

        // Minimap
        const radarCanvas = document.getElementById('radarCanvas');
        let isRadarDragging = false;
        const updateCameraFromRadar = (e) => {
          const rect = radarCanvas.getBoundingClientRect();
          const mx = (e.clientX - rect.left) / rect.width;
          const my = (e.clientY - rect.top) / rect.height;
          this.engine.camera.x = mx * this.engine.map.width - (this.engine.canvas.width / this.engine.camera.zoom) / 2;
          this.engine.camera.y = my * this.engine.map.height - (this.engine.canvas.height / this.engine.camera.zoom) / 2;
          this.engine.clampCamera();
        };

        radarCanvas.onmousedown = (e) => { isRadarDragging = true; updateCameraFromRadar(e); };
        window.addEventListener('mousemove', (e) => { if (isRadarDragging) updateCameraFromRadar(e); });
        window.addEventListener('mouseup', () => { isRadarDragging = false; });

        // Desembarque APC
        document.getElementById('btn-unload-passengers').onclick = () => {
          const selectedAPC = this.engine.units.find(u => u.selected && u.type === 'apc' && u.faction === this.engine.myFaction);
          if (selectedAPC && selectedAPC.passengers.length > 0) {
            while (selectedAPC.passengers.length > 0) {
              const soldierType = selectedAPC.passengers.pop();
              const offsetAngle = Math.random() * Math.PI * 2;
              const newSoldier = new Unit(
                selectedAPC.x + Math.cos(offsetAngle) * 28,
                selectedAPC.y + Math.sin(offsetAngle) * 28,
                soldierType, this.engine.myFaction
              );
              this.engine.units.push(newSoldier);
            }
            this.engine.sounds.playOrder();
            this.engine.updateSelectionInspection();
          }
        };

        this.renderBuildGrid();
      }

      getAvailableItems() {
        if (this.activeTab === 'buildings') {
          return [
            { id: 'power', name: 'Usina de Energia', cost: 300, time: 5, desc: 'Gera +100 GW de energia para a base militar.' },
            { id: 'barracks', name: 'Quartel Militar', cost: 400, time: 6, desc: 'Permite o treinamento de tropas e infantaria.' },
            { id: 'refinery', name: 'Refinaria Tiberium', cost: 800, time: 9, desc: 'Inclui 1 Colhedora. Converte cristais em créditos.' },
            { id: 'silo', name: 'Silo de Armazenamento', cost: 250, time: 5, desc: 'Armazena +$3000 créditos. Evita overflow de recursos.' },
            { id: 'factory', name: 'Fábrica de Guerra', cost: 1000, time: 10, desc: 'Montagem de blindados, helicópteros e caças.' },
            { id: 'turret', name: 'Torre Tesla Laser', cost: 500, time: 6, desc: 'Defesa pesada automática com mira laser.' },
            { id: 'obelisk', name: 'Obelisco de Luz', cost: 1200, time: 12, desc: 'Defesa mortal NOD. Desintegra com laser contínuo.' },
            { id: 'temple', name: 'Templo da Irmandade', cost: 1800, time: 15, desc: 'Desbloqueia a Super-Arma: Míssil Nuclear.' }
          ];
        } else if (this.activeTab === 'infantry') {
          return [
            { id: 'rifleman', name: 'Soldado Fuzileiro', cost: 100, time: 4, desc: 'Infantaria básica com fuzil automático leve.' },
            { id: 'rocket', name: 'Lança-Foguetes', cost: 250, time: 6, desc: 'Dispara mísseis anti-blindagem e anti-aéreos.' },
            { id: 'engineer', name: 'Engenheiro Militar', cost: 300, time: 7, desc: 'Captura prédios inimigos ou repara aliados a 100%.' },
            { id: 'commando', name: 'Comando de Elite', cost: 600, time: 10, desc: 'Super-infantaria armada com explosivos pesados.' }
          ];
        } else {
          return [
            { id: 'tank', name: 'Tanque Médio M1', cost: 500, time: 7, desc: 'Tanque ágil com canhão 75mm e recuo mecânico.' },
            { id: 'mammoth', name: 'Tanque Mamute', cost: 1200, time: 13, desc: 'Super-tanque com canhões duplos de 120mm.' },
            { id: 'apc', name: 'Transporte APC', cost: 550, time: 8, desc: 'Blindado 6x6. Transporta até 5 soldados a pé.' },
            { id: 'transport_helo', name: 'Helicóptero de Transporte', cost: 750, time: 14, icon: '🚁', desc: 'Transporta até 6 tropas pelo ar e pousa em qualquer terreno' },
          { id: 'helicopter', name: 'Helicóptero Orca', cost: 900, time: 10, desc: 'Aeronave que voa sobre obstáculos e lança foguetes.' },
            { id: 'jet', name: 'Caça a Jato de Ataque', cost: 1100, time: 12, desc: 'Alta velocidade e bombardeio supersônico.' },
            { id: 'harvester', name: 'Colhedora Reserva', cost: 650, time: 9, desc: 'Caminhão de extração de Tiberium.' }
          ];
        }
      }

      renderBuildGrid() {
        const container = document.getElementById('build-grid-container');
        container.innerHTML = '';
        const items = this.getAvailableItems();

        items.forEach(item => {
          const card = document.createElement('div');
          card.className = 'build-card';
          card.id = `card-${item.id}`;

          const isTraining = this.unitQueue.find(q => q.id === item.id);
          const isPlacing = this.activePlacement && this.activePlacement.id === item.id;

          if (isTraining || isPlacing) card.classList.add('building');

          const badgeHtml = isPlacing
            ? '<span class="build-status-badge badge-placing">📐 POSICIONAR</span>'
            : (isTraining ? '<span class="build-status-badge badge-training">⏳ TREINANDO...</span>' : '');

          card.innerHTML = `
            <div class="icon-wrapper">
              <canvas class="icon-canvas" id="icon-${item.id}" width="50" height="50"></canvas>
              <div class="radial-sweep-overlay" id="sweep-${item.id}"></div>
            </div>
            <div class="build-info">
              <div class="build-row-top">
                <div class="build-name" title="${item.name}">${item.name}</div>
                <div class="build-cost">$ ${item.cost}</div>
              </div>
              <div class="build-desc">${item.desc}</div>
              <div class="build-row-bottom" id="row-status-${item.id}">
                ${badgeHtml}
              </div>
            </div>
          `;

          card.onclick = () => this.handleCardClick(item);
          container.appendChild(card);
          this.drawCardIcon(item.id);
        });
      }

      drawCardIcon(id) {
        const canvas = document.getElementById(`icon-${id}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f151c';
        ctx.fillRect(0, 0, 50, 50);

        ctx.save();
        ctx.translate(25, 25);
        ctx.scale(0.5, 0.5);

        if (id === 'power') {
          ctx.fillStyle = '#1e2833'; ctx.fillRect(-20, -20, 40, 40);
          ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        } else if (id === 'barracks') {
          ctx.fillStyle = '#2d3d2e'; ctx.fillRect(-22, -18, 44, 36);
          ctx.fillStyle = '#947545'; ctx.fillRect(-18, 10, 36, 6);
        } else if (id === 'refinery') {
          ctx.fillStyle = '#222f3e'; ctx.fillRect(-26, -18, 52, 36);
          ctx.fillStyle = '#00ff77'; ctx.fillRect(-10, -8, 20, 16);
        } else if (id === 'silo') {
          ctx.fillStyle = '#1b242e'; ctx.fillRect(-20, -16, 40, 32);
          ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(-8, 0, 8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(8, 0, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#00ff77'; ctx.fillRect(-10, -5, 4, 10); ctx.fillRect(6, -5, 4, 10);
        } else if (id === 'factory') {
          ctx.fillStyle = '#34495e'; ctx.fillRect(-28, -20, 56, 40);
          ctx.fillStyle = '#e67e22'; ctx.fillRect(-16, 8, 32, 8);
        } else if (id === 'turret') {
          ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#7f8c8d'; ctx.fillRect(0, -3, 20, 6);
        } else if (id === 'obelisk') {
          ctx.fillStyle = '#0f141a'; ctx.beginPath();
          ctx.moveTo(0, -24); ctx.lineTo(14, 20); ctx.lineTo(-14, 20); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ff3344'; ctx.beginPath(); ctx.arc(0, -22, 5, 0, Math.PI * 2); ctx.fill();
        } else if (id === 'temple') {
          ctx.fillStyle = '#1c1f24'; ctx.fillRect(-22, -22, 44, 44);
          ctx.fillStyle = '#ff3344'; ctx.fillRect(-12, -12, 24, 24);
          ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        } else if (id === 'rifleman') {
          ctx.fillStyle = '#374c25'; ctx.beginPath(); ctx.arc(-2, 0, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#151d10'; ctx.fillRect(2, -4, 3, 8);
          ctx.fillStyle = '#4b6b33'; ctx.fillRect(-10, -6, 8, 12);
          ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, -2, 14, 4);
          ctx.fillStyle = '#7f8c8d'; ctx.fillRect(12, -1, 3, 2);
        } else if (id === 'rocket') {
          ctx.fillStyle = '#873600'; ctx.beginPath(); ctx.arc(-3, -2, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e74c3c'; ctx.fillRect(1, -5, 3, 6);
          ctx.fillStyle = '#2c3e50'; ctx.fillRect(-8, 3, 20, 6);
          ctx.fillStyle = '#f39c12'; ctx.fillRect(4, 3, 3, 6);
          ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(13, 6, 3, 0, Math.PI * 2); ctx.fill();
        } else if (id === 'engineer') {
          ctx.fillStyle = '#f39c12'; ctx.beginPath(); ctx.arc(-2, 0, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#d68910'; ctx.fillRect(2, -4, 3, 8);
          ctx.fillStyle = '#ecf0f1'; ctx.fillRect(-8, -2, 6, 4);
          ctx.fillStyle = '#34495e'; ctx.fillRect(2, 2, 8, 6);
          ctx.fillStyle = '#00ffff'; ctx.fillRect(4, -8, 6, 4);
        } else if (id === 'commando') {
          ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(-2, 0, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f1c40f'; ctx.fillRect(0, -3, 3, 3);
          ctx.fillStyle = '#17202a'; ctx.fillRect(-10, -6, 8, 12);
          ctx.fillStyle = '#0f1419'; ctx.fillRect(0, -2, 16, 4);
          ctx.fillStyle = '#ff0033'; ctx.fillRect(15, -1, 4, 2);
        } else if (id === 'tank') {
          ctx.fillStyle = '#4c6541'; ctx.fillRect(-16, -10, 32, 20);
          ctx.fillStyle = '#222'; ctx.fillRect(0, -3, 20, 6);
        } else if (id === 'mammoth') {
          ctx.fillStyle = '#4c6541'; ctx.fillRect(-20, -14, 40, 28);
          ctx.fillStyle = '#222'; ctx.fillRect(0, -7, 24, 4); ctx.fillRect(0, 3, 24, 4);
        } else if (id === 'apc') {
          ctx.fillStyle = '#4c6541'; ctx.fillRect(-18, -12, 36, 24);
          ctx.fillStyle = '#111'; ctx.fillRect(-14, -14, 28, 4); ctx.fillRect(-14, 10, 28, 4);
        } else if (id === 'transport_helo') {
          ctx.fillStyle = '#4c6541'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#00e5ff'; ctx.fillRect(10, -3, 5, 6);
          ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(-10, 0, 2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(8, 0, 2, 0, Math.PI * 2); ctx.fill();
        } else if (id === 'helicopter') {
          ctx.fillStyle = '#4c6541'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
        } else if (id === 'jet') {
          ctx.fillStyle = '#4c6541';
          ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-14, -14); ctx.lineTo(-8, 0); ctx.lineTo(-14, 14); ctx.closePath(); ctx.fill();
        } else if (id === 'harvester') {
          ctx.fillStyle = '#2c3e50'; ctx.fillRect(-18, -12, 36, 24);
          ctx.fillStyle = '#00ff77'; ctx.fillRect(-14, -8, 14, 16);
        }
        ctx.restore();
      }

      handleCardClick(item) {
        if (this.activeTab === 'buildings') {
          if (this.engine.credits >= item.cost) {
            this.activePlacement = item;
            this.activeTool = null;
            document.getElementById('btnToolRepair').classList.remove('active');
            document.getElementById('btnToolSell').classList.remove('active');
            document.getElementById('placement-guide-txt').innerText = '📐 ESCOLHA O LOCAL NO MAPA COM O BOTÃO ESQUERDO | BOTÃO DIREITO CANCELA';
            document.getElementById('placement-guide').classList.add('show');
            this.engine.sounds.playSelect();
            this.renderBuildGrid();
          } else {
            this.engine.eva.speak('Insufficient funds.');
            this.engine.showEvaMessage('FUNDOS INSUFICIENTES');
            this.engine.sounds.playEvaChime('alert');
          }
          return;
        }

        if (this.activeTab === 'infantry') {
          const hasBarracks = this.engine.buildings.some(b => b.type === 'barracks' && b.faction === this.engine.myFaction && b.hp > 0 && !b.isConstructing);
          if (!hasBarracks) {
            this.engine.showEvaMessage('REQUER QUARTEL MILITAR ATIVO');
            this.engine.sounds.playEvaChime('alert');
            return;
          }
        }

        if (this.activeTab === 'vehicles') {
          const hasFactory = this.engine.buildings.some(b => b.type === 'factory' && b.faction === this.engine.myFaction && b.hp > 0 && !b.isConstructing);
          if (!hasFactory) {
            this.engine.showEvaMessage('REQUER FÁBRICA DE GUERRA ATIVA');
            this.engine.sounds.playEvaChime('alert');
            return;
          }
        }

        if (this.unitQueue.some(q => q.id === item.id)) return;

        if (this.engine.credits >= item.cost) {
          this.engine.credits -= item.cost;
          this.engine.updateEconomyDisplay();

          this.unitQueue.push({ ...item, progress: 0 });
          this.engine.sounds.playSelect();
          this.renderBuildGrid();
        } else {
          this.engine.eva.speak('Insufficient funds.');
          this.engine.showEvaMessage('FUNDOS INSUFICIENTES');
          this.engine.sounds.playEvaChime('alert');
        }
      }

      update(dt) {
        // Atualiza estilo e título da Super-Arma (GDI Íons vs NOD Míssil Nuclear)
        const isNod = this.engine.myFaction === 'slot2' || this.engine.myFaction === 'enemy' || this.engine.myFaction === 'slot4' || this.engine.buildings.some(b => b.type === 'temple' && b.faction === this.engine.myFaction);
        const titleEl = document.getElementById('superweapon-title');
        const btnTextEl = document.getElementById('superweapon-btn-text');
        const btnIon = document.getElementById('btn-ion-cannon');
        if (titleEl && btnTextEl && btnIon) {
          if (isNod) {
            titleEl.innerText = 'SUPER-ARMA NUCLEAR';
            btnTextEl.innerText = '☢️ MÍSSIL NUCLEAR NOD';
            btnIon.classList.add('nuke-weapon');
          } else {
            titleEl.innerText = 'SUPER-ARMA ORBITAL';
            btnTextEl.innerText = '🛰️ CANHÃO DE ÍONS GDI';
            btnIon.classList.remove('nuke-weapon');
          }
        }

        // Atualiza temporizador do Canhão de Íons / Míssil Nuclear
        if (!this.ionReady) {
          this.ionTimer = Math.min(this.ionCooldown, this.ionTimer + dt);
          const percent = Math.floor((this.ionTimer / this.ionCooldown) * 100);
          document.getElementById('ion-progress-fill').style.width = `${percent}%`;
          document.getElementById('ion-status-badge').innerText = `${percent}%`;
          document.getElementById('ion-timer-txt').innerText = `${Math.ceil(this.ionCooldown - this.ionTimer)}S`;

          if (this.ionTimer >= this.ionCooldown) {
            this.ionReady = true;
            document.getElementById('btn-ion-cannon').classList.add('ready');
            document.getElementById('ion-status-badge').innerText = 'PRONTO';
            document.getElementById('ion-timer-txt').innerText = 'PRONTO';
            if (isNod) {
              this.engine.eva.speak('Nuclear missile ready.');
              this.engine.showEvaMessage('MÍSSIL NUCLEAR NOD PRONTO PARA LANÇAMENTO');
            } else {
              this.engine.eva.speak('Ion cannon ready.');
              this.engine.showEvaMessage('CANHÃO DE ÍONS PRONTO PARA DISPARO');
            }
          }
        }

        // Atualiza Fila de Produção
        const powerRatio = this.engine.powerProduced > 0 ? (this.engine.powerProduced / Math.max(1, this.engine.powerConsumed)) : 1;
        const speedMult = powerRatio < 1 ? 0.5 : 1.0;

        for (let i = this.unitQueue.length - 1; i >= 0; i--) {
          const item = this.unitQueue[i];
          item.progress += (dt / item.time) * speedMult;

          const sweepEl = document.getElementById(`sweep-${item.id}`);
          if (sweepEl) {
            const pct = Math.min(100, Math.floor(item.progress * 100));
            sweepEl.style.setProperty('--progress', `${pct}%`);
            const statusRow = document.getElementById(`row-status-${item.id}`);
            if (statusRow) {
              statusRow.innerHTML = `<span class="build-status-badge badge-training">⏳ TREINANDO ${pct}%</span>`;
            }
          }

          if (item.progress >= 1.0) {
            this.unitQueue.splice(i, 1);
            this.spawnCompletedUnit(item.id);
            this.engine.sounds.playEvaChime('ready');
            this.engine.eva.speak('Unit ready.');
            this.engine.showEvaMessage(`${item.name.toUpperCase()} PRONTO`);
            this.renderBuildGrid();
          }
        }
      }

      spawnCompletedUnit(unitId) {
        let spawnX = 450, spawnY = 550;
        if (this.engine.myFaction === 'slot2' || this.engine.myFaction === 'enemy') { spawnX = 1900; spawnY = 540; }
        else if (this.engine.myFaction === 'slot3') { spawnX = 450; spawnY = 1450; }
        else if (this.engine.myFaction === 'slot4') { spawnX = 1900; spawnY = 1450; }

        const isInf = ['rifleman', 'rocket', 'engineer', 'commando'].includes(unitId);
        let producerBldg = null;
        if (isInf) {
          const barracks = this.engine.buildings.find(b => b.type === 'barracks' && b.faction === this.engine.myFaction && b.hp > 0);
          if (barracks) {
            spawnX = barracks.spawnX;
            spawnY = barracks.spawnY;
            producerBldg = barracks;
          }
        } else {
          const factory = this.engine.buildings.find(b => b.type === 'factory' && b.faction === this.engine.myFaction && b.hp > 0);
          if (factory) {
            factory.doorOpen = 1.0;
            spawnX = factory.spawnX;
            spawnY = factory.spawnY;
            producerBldg = factory;
          }
        }

        const uid = `${this.engine.myFaction}_u_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const newUnit = new Unit(spawnX, spawnY, unitId, this.engine.myFaction, uid);

        // Despacha automaticamente para o Rally Point se configurado
        if (producerBldg && producerBldg.rallyPoint) {
          const rSpreadX = producerBldg.rallyPoint.x + (Math.random() - 0.5) * 35;
          const rSpreadY = producerBldg.rallyPoint.y + (Math.random() - 0.5) * 35;
          newUnit.moveTo(rSpreadX, rSpreadY, this.engine);
        } else {
          const targetSpreadX = spawnX + (Math.random() - 0.5) * 50;
          const targetSpreadY = spawnY + (spawnY < 900 ? 60 : -60) + Math.random() * 30;
          newUnit.moveTo(targetSpreadX, targetSpreadY, this.engine);
        }
        this.engine.units.push(newUnit);

        if (this.engine.multiplayer) {
          this.engine.multiplayer.send({
            type: 'CMD_TRAIN',
            uid: uid,
            unitType: unitId,
            spawnX: spawnX,
            spawnY: spawnY,
            targetX: targetSpreadX,
            targetY: targetSpreadY,
            faction: this.engine.myFaction
          });
        }
      }

      drawGhost(ctx, mouseWorldX, mouseWorldY) {
        if (!this.activePlacement) return;

        const gridX = Math.round(mouseWorldX / 32) * 32;
        const gridY = Math.round(mouseWorldY / 32) * 32;
        this.ghostX = gridX;
        this.ghostY = gridY;

        let size = 64;
        if (this.activePlacement.id === 'hq' || this.activePlacement.id === 'factory' || this.activePlacement.id === 'temple') size = 96;
        if (this.activePlacement.id === 'turret' || this.activePlacement.id === 'obelisk' || this.activePlacement.id === 'silo') size = 48;
        if (this.activePlacement.id === 'barracks') size = 80;

        const isTerrainFree = this.engine.map.isAreaFree(gridX, gridY, size * 0.45);
        const isNearBase = this.engine.buildings.some(b => b.faction === this.engine.myFaction && Math.hypot(b.x - gridX, b.y - gridY) < 420);
        const noOverlap = !this.engine.buildings.some(b => Math.hypot(b.x - gridX, b.y - gridY) < (b.width + size) * 0.45);

        this.isGhostValid = isTerrainFree && isNearBase && noOverlap;

        ctx.save();
        ctx.translate(gridX, gridY);

        ctx.fillStyle = this.isGhostValid ? 'rgba(0, 255, 102, 0.28)' : 'rgba(255, 51, 68, 0.35)';
        ctx.strokeStyle = this.isGhostValid ? '#00ff66' : '#ff3344';
        ctx.lineWidth = 2;

        ctx.fillRect(-size/2, -size/2, size, size);
        ctx.strokeRect(-size/2, -size/2, size, size);

        ctx.beginPath();
        ctx.moveTo(-size/2, 0); ctx.lineTo(size/2, 0);
        ctx.moveTo(0, -size/2); ctx.lineTo(0, size/2);
        ctx.stroke();

        ctx.restore();
      }

      confirmPlacement() {
        if (this.activePlacement && this.isGhostValid) {
          this.engine.credits -= this.activePlacement.cost;
          this.engine.updateEconomyDisplay();

          const uid = `${this.engine.myFaction}_b_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const newB = new Building(this.ghostX, this.ghostY, this.activePlacement.id, this.engine.myFaction, true, uid);
          this.engine.buildings.push(newB);
          if (this.engine.map) this.engine.map.registerBuilding(newB);

          for (let i = 0; i < 15; i++) {
            this.engine.particles.createTreadDust(
              this.ghostX + (Math.random() - 0.5) * newB.width,
              this.ghostY + (Math.random() - 0.5) * newB.height
            );
          }

          this.engine.sounds.playOrder();
          this.engine.eva.speak('Construction underway.');
          this.engine.showEvaMessage(`INICIADA CONSTRUÇÃO: ${this.activePlacement.name.toUpperCase()}`);

          if (this.engine.multiplayer) {
            this.engine.multiplayer.send({
              type: 'CMD_BUILD',
              uid: uid,
              buildingType: this.activePlacement.id,
              x: this.ghostX,
              y: this.ghostY,
              faction: this.engine.myFaction
            });
          }

          this.cancelPlacement(false);
          this.renderBuildGrid();
        } else {
          this.engine.eva.speak('Unable to build there.');
          this.engine.sounds.playEvaChime('alert');
          this.engine.showEvaMessage('LOCAL DE CONSTRUÇÃO BLOQUEADO OU DISTANTE');
        }
      }

      cancelPlacement(playSound = true) {
        if (this.activePlacement) {
          this.activePlacement = null;
          document.getElementById('placement-guide').classList.remove('show');
          if (playSound) this.engine.sounds.playSelect();
          this.renderBuildGrid();
        }
      }
    }