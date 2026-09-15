import { EvaVoice } from '../audio/EvaVoice.js';
import { SoundSynth } from '../audio/SoundSynth.js';
import { IndustrialMusicEngine } from '../audio/MusicEngine.js';
import { MapEngine } from '../models/MapModel.js';
import { ParticleSystem } from '../models/ParticleSystem.js';
import { Building } from '../models/Building.js';
import { Unit } from '../models/Unit.js';
import { Projectile } from '../models/Projectile.js';
import { SidebarUI } from '../views/SidebarView.js';
import { MultiplayerManager } from './NetworkController.js';
import { rotateTowards, normalizeAngle } from '../utils/MathUtils.js';

export class Engine {
      constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.eva = new EvaVoice();
        this.sounds = new SoundSynth();
        this.music = new IndustrialMusicEngine(this.sounds);
        this.map = new MapEngine(2400, 1800);
        this.particles = new ParticleSystem();

        this.units = [];
        this.buildings = [];
        this.projectiles = [];

        this.credits = 5000;
        this.creditCapacity = 3500;
        this.lastSiloWarning = 0;
        this.powerProduced = 0;
        this.powerConsumed = 0;

        // Facção do jogador ('slot1' por padrão, compatível com 'player')
        this.myFaction = 'slot1';
        this.syncTimer = 0;

        this.camera = { x: 200, y: 250, zoom: 1.0 };
        this.screenShake = 0;

        this.mouse = { screenX: 0, screenY: 0, worldX: 0, worldY: 0, isDown: false, isDragging: false, dragStart: { x: 0, y: 0 } };

        // Grupos de Controle Táticos (Ctrl+1..9 e 1..9)
        this.controlGroups = {};
        this.lastGroupPressTime = {};

        // Configuração dos 4 Slots da Sala
        this.slotConfigs = {
          slot1: 'human',
          slot2: 'ai_medium',
          slot3: 'closed',
          slot4: 'closed'
        };

        // Condição de Vitória ('annihilation', 'assassination', 'tiberium_race', 'king_of_hill')
        this.victoryMode = 'annihilation';
        this.kingOfHillTimer = { faction: null, seconds: 0, target: 180 };
        this.battleStats = {
          startTime: Date.now(),
          kills: 0,
          unitsBuilt: 0,
          structuresDestroyed: 0,
          tiberiumCollected: 0
        };
        this.gameOver = false;
        this.aiTimers = { slot2: 0, slot3: 0, slot4: 0 };

        this.sidebar = new SidebarUI(this);

        // Super-Armas Ativas
        this.activeIonStrike = null; // Canhão de Íons GDI
        this.activeNukeStrike = null; // Míssil Nuclear NOD

        this.initEntities();
        this.initInput();
        this.multiplayer = new MultiplayerManager(this);

        this.resize();
        this.recalculatePower();
        this.updateEconomyDisplay();

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));

        // Saudação inicial da EVA
        setTimeout(() => {
          this.eva.speak('Battle control online.');
        }, 1200);
      }

      isFriendly(faction) {
        if (faction === this.myFaction) return true;
        if (this.myFaction === 'slot1' && faction === 'player') return true;
        if (this.myFaction === 'slot2' && faction === 'enemy') return true;
        if (this.myFaction === 'player' && faction === 'slot1') return true;
        if (this.myFaction === 'enemy' && faction === 'slot2') return true;
        return false;
      }

      resize() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.clampCamera();
      }

      clampCamera() {
        const viewW = this.canvas.width / this.camera.zoom;
        const viewH = this.canvas.height / this.camera.zoom;
        this.camera.x = Math.max(0, Math.min(this.map.width - viewW, this.camera.x));
        this.camera.y = Math.max(0, Math.min(this.map.height - viewH, this.camera.y));
      }

      screenToWorld(sx, sy) {
        return {
          x: this.camera.x + sx / this.camera.zoom,
          y: this.camera.y + sy / this.camera.zoom
        };
      }

      initEntities(slotConfigs = null) {
        if (slotConfigs) {
          this.slotConfigs = { ...this.slotConfigs, ...slotConfigs };
        }

        this.units = [];
        this.buildings = [];
        this.projectiles = [];
        this.controlGroups = {};
        this.activeIonStrike = null;
        this.activeNukeStrike = null;
        this.gameOver = false;
        this.battleStats = {
          startTime: Date.now(),
          kills: 0,
          unitsBuilt: 0,
          structuresDestroyed: 0,
          tiberiumCollected: 0
        };
        this.kingOfHillTimer = { faction: null, seconds: 0, target: 180 };

        // BASE 1: NOROESTE (SLOT 1 - GDI AZUL)
        this.buildings.push(new Building(380, 420, 'hq', 'slot1', false, 's1_hq'));
        this.buildings.push(new Building(510, 380, 'power', 'slot1', false, 's1_pwr'));
        this.buildings.push(new Building(350, 560, 'barracks', 'slot1', false, 's1_bar'));
        this.buildings.push(new Building(520, 680, 'factory', 'slot1', false, 's1_fac'));
        this.buildings.push(new Building(500, 530, 'refinery', 'slot1', false, 's1_ref'));
        this.buildings.push(new Building(630, 450, 'turret', 'slot1', false, 's1_tur'));

        this.units.push(new Unit(530, 560, 'harvester', 'slot1', 's1_harv'));
        this.units.push(new Unit(380, 520, 'rifleman', 'slot1', 's1_rif'));
        this.units.push(new Unit(400, 520, 'rocket', 'slot1', 's1_roc'));
        this.units.push(new Unit(450, 480, 'tank', 'slot1', 's1_tank'));
        this.units.push(new Unit(490, 460, 'apc', 'slot1', 's1_apc'));

        // BASE 2: NORDESTE (SLOT 2 - NOD VERMELHO)
        if (this.slotConfigs.slot2 !== 'closed') {
          this.buildings.push(new Building(1950, 400, 'hq', 'slot2', false, 's2_hq'));
          this.buildings.push(new Building(1820, 380, 'power', 'slot2', false, 's2_pwr'));
          this.buildings.push(new Building(1950, 560, 'barracks', 'slot2', false, 's2_bar'));
          this.buildings.push(new Building(1850, 520, 'refinery', 'slot2', false, 's2_ref'));
          this.buildings.push(new Building(2050, 540, 'factory', 'slot2', false, 's2_fac'));
          this.buildings.push(new Building(1740, 460, 'turret', 'slot2', false, 's2_tur'));

          this.units.push(new Unit(1880, 550, 'harvester', 'slot2', 's2_harv'));
          this.units.push(new Unit(1780, 480, 'tank', 'slot2', 's2_tank'));
          this.units.push(new Unit(1800, 500, 'rocket', 'slot2', 's2_roc'));
          this.units.push(new Unit(1750, 520, 'rifleman', 'slot2', 's2_rif'));
        }

        // BASE 3: SUDOESTE (SLOT 3 - GDI OURO)
        if (this.slotConfigs.slot3 !== 'closed') {
          this.buildings.push(new Building(380, 1400, 'hq', 'slot3', false, 's3_hq'));
          this.buildings.push(new Building(510, 1360, 'power', 'slot3', false, 's3_pwr'));
          this.buildings.push(new Building(350, 1540, 'barracks', 'slot3', false, 's3_bar'));
          this.buildings.push(new Building(500, 1500, 'refinery', 'slot3', false, 's3_ref'));
          this.buildings.push(new Building(520, 1660, 'factory', 'slot3', false, 's3_fac'));
          this.buildings.push(new Building(630, 1420, 'turret', 'slot3', false, 's3_tur'));

          this.units.push(new Unit(530, 1530, 'harvester', 'slot3', 's3_harv'));
          this.units.push(new Unit(450, 1460, 'tank', 'slot3', 's3_tank'));
          this.units.push(new Unit(400, 1500, 'rocket', 'slot3', 's3_roc'));
          this.units.push(new Unit(380, 1500, 'rifleman', 'slot3', 's3_rif'));
        }

        // BASE 4: SUDESTE (SLOT 4 - NOD ROXO)
        if (this.slotConfigs.slot4 !== 'closed') {
          this.buildings.push(new Building(1950, 1400, 'hq', 'slot4', false, 's4_hq'));
          this.buildings.push(new Building(1820, 1360, 'power', 'slot4', false, 's4_pwr'));
          this.buildings.push(new Building(1950, 1540, 'barracks', 'slot4', false, 's4_bar'));
          this.buildings.push(new Building(1850, 1500, 'refinery', 'slot4', false, 's4_ref'));
          this.buildings.push(new Building(2050, 1520, 'factory', 'slot4', false, 's4_fac'));
          this.buildings.push(new Building(1740, 1440, 'turret', 'slot4', false, 's4_tur'));

          this.units.push(new Unit(1880, 1530, 'harvester', 'slot4', 's4_harv'));
          this.units.push(new Unit(1780, 1460, 'tank', 'slot4', 's4_tank'));
          this.units.push(new Unit(1800, 1500, 'rocket', 'slot4', 's4_roc'));
          this.units.push(new Unit(1750, 1500, 'rifleman', 'slot4', 's4_rif'));
        }

        // Posiciona a câmera inicial na base correspondente
        this.centerOnBase();
        this.recalculatePower();
        this.updateEconomyDisplay();
      }

      initInput() {
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          this.mouse.screenX = e.clientX - rect.left;
          this.mouse.screenY = e.clientY - rect.top;
          const world = this.screenToWorld(this.mouse.screenX, this.mouse.screenY);
          this.mouse.worldX = world.x;
          this.mouse.worldY = world.y;

          if (this.mouse.isDown) {
            if (Math.hypot(this.mouse.screenX - this.mouse.dragStart.x, this.mouse.screenY - this.mouse.dragStart.y) > 6) {
              this.mouse.isDragging = true;
            }
          }
        });

        this.canvas.addEventListener('mousedown', (e) => {
          if (e.button === 0) {
            // 1. Super-Arma Ativa (Canhão de Íons ou Míssil Nuclear)
            if (this.sidebar.activeTool === 'ion') {
              const isNod = this.myFaction === 'slot2' || this.myFaction === 'enemy' || this.myFaction === 'slot4' || this.buildings.some(b => b.type === 'temple' && this.isFriendly(b.faction));
              if (isNod) {
                this.triggerNukeStrike(this.mouse.worldX, this.mouse.worldY);
              } else {
                this.triggerIonCannon(this.mouse.worldX, this.mouse.worldY);
              }
              return;
            }

            // 2. Modo Construção Ativo
            if (this.sidebar.activePlacement) {
              this.sidebar.confirmPlacement();
              return;
            }

            // 3. Ferramentas Reparar ou Vender
            if (this.sidebar.activeTool === 'repair') {
              const targetB = this.buildings.find(b =>
                this.isFriendly(b.faction) && Math.abs(b.x - this.mouse.worldX) <= b.width/2 && Math.abs(b.y - this.mouse.worldY) <= b.height/2
              );
              if (targetB) {
                targetB.isRepairing = true;
                this.sounds.playOrder();
                if (this.multiplayer) {
                  this.multiplayer.send({
                    type: 'CMD_REPAIR',
                    uid: targetB.uid,
                    isRepairing: true
                  });
                }
              }
              return;
            }

            if (this.sidebar.activeTool === 'sell') {
              const targetB = this.buildings.find(b =>
                this.isFriendly(b.faction) && Math.abs(b.x - this.mouse.worldX) <= b.width/2 && Math.abs(b.y - this.mouse.worldY) <= b.height/2
              );
              if (targetB) {
                this.sellBuilding(targetB);
              }
              return;
            }

            this.mouse.isDown = true;
            this.mouse.isDragging = false;
            this.mouse.dragStart = { x: this.mouse.screenX, y: this.mouse.screenY };
          }
        });

        this.canvas.addEventListener('mouseup', (e) => {
          if (e.button === 0 && this.mouse.isDown) {
            this.mouse.isDown = false;

            if (this.mouse.isDragging) {
              this.mouse.isDragging = false;
              const w1 = this.screenToWorld(this.mouse.dragStart.x, this.mouse.dragStart.y);
              const w2 = this.screenToWorld(this.mouse.screenX, this.mouse.screenY);
              const minX = Math.min(w1.x, w2.x), maxX = Math.max(w1.x, w2.x);
              const minY = Math.min(w1.y, w2.y), maxY = Math.max(w1.y, w2.y);

              let selectedAny = false;
              this.units.forEach(u => {
                if (this.isFriendly(u.faction)) {
                  u.selected = (u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY);
                  if (u.selected) selectedAny = true;
                }
              });

              if (selectedAny) {
                this.buildings.forEach(b => b.selected = false);
                this.sounds.playSelect();
              }
              this.updateSelectionInspection();
            } else {
              let clickedUnit = null;
              this.units.forEach(u => {
                if (Math.hypot(u.x - this.mouse.worldX, u.y - this.mouse.worldY) <= u.radius + 6) clickedUnit = u;
              });

              if (clickedUnit) {
                this.units.forEach(u => u.selected = false);
                this.buildings.forEach(b => b.selected = false);
                if (this.isFriendly(clickedUnit.faction)) {
                  clickedUnit.selected = true;
                }
                this.sounds.playSelect();
              } else {
                let clickedBuilding = null;
                this.buildings.forEach(b => {
                  if (Math.abs(b.x - this.mouse.worldX) <= b.width/2 && Math.abs(b.y - this.mouse.worldY) <= b.height/2) {
                    clickedBuilding = b;
                  }
                });

                this.units.forEach(u => u.selected = false);
                this.buildings.forEach(b => b.selected = false);

                if (clickedBuilding) {
                  if (this.isFriendly(clickedBuilding.faction)) {
                    clickedBuilding.selected = true;
                    this.showEvaMessage(`ESTRUTURA SELECIONADA: ${clickedBuilding.name.toUpperCase()}`);
                    this.eva.speak(clickedBuilding.name);
                    if (clickedBuilding.type === 'barracks') {
                      document.getElementById('tabInfantry').click();
                    } else if (clickedBuilding.type === 'factory') {
                      document.getElementById('tabVehicles').click();
                    }
                  }
                  this.sounds.playSelect();
                }
              }
              this.updateSelectionInspection();
            }
          }
        });

        // Clique Direito: Movimento, Ataque, Embarque em APC ou Mineração
        this.canvas.addEventListener('contextmenu', (e) => {
          e.preventDefault();

          if (this.sidebar.activePlacement) {
            this.sidebar.cancelPlacement(true);
            return;
          }
          if (this.sidebar.activeTool) {
            this.sidebar.activeTool = null;
            document.getElementById('btnToolRepair').classList.remove('active');
            document.getElementById('btnToolSell').classList.remove('active');
            document.getElementById('placement-guide').classList.remove('show');
            this.sounds.playSelect();
            return;
          }

          const selectedUnits = this.units.filter(u => u.selected && this.isFriendly(u.faction));
          if (selectedUnits.length === 0) return;

          // 1. Alvo Inimigo
          const enemyTarget = this.units.find(u =>
            !this.isFriendly(u.faction) && Math.hypot(u.x - this.mouse.worldX, u.y - this.mouse.worldY) <= u.radius + 8 && (this.map.isVisible(u.x, u.y) || !this.map.shroudEnabled)
          ) || this.buildings.find(b =>
            !this.isFriendly(b.faction) && Math.abs(b.x - this.mouse.worldX) <= b.width/2 && Math.abs(b.y - this.mouse.worldY) <= b.height/2 && (this.map.isVisible(b.x, b.y) || !this.map.shroudEnabled)
          );

          if (enemyTarget) {
            selectedUnits.forEach(u => u.attack(enemyTarget));
            this.sounds.playOrder();
            if (this.multiplayer) {
              this.multiplayer.send({
                type: 'CMD_ATTACK',
                uids: selectedUnits.map(u => u.uid),
                targetType: enemyTarget instanceof Unit ? 'unit' : 'building',
                targetUid: enemyTarget.uid
              });
            }
            return;
          }

          // 2. Embarque de infantaria no APC
          const targetTransport = this.units.find(u =>
            this.isFriendly(u.faction) && (u.type === 'apc' || u.type === 'transport_helo') && Math.hypot(u.x - this.mouse.worldX, u.y - this.mouse.worldY) <= u.radius + 14
          );
          if (targetTransport) {
            selectedUnits.forEach(u => {
              if (u.isInfantry && targetTransport.passengers.length < targetTransport.maxPassengers) {
                targetTransport.passengers.push(u.type);
                u.hp = 0;
                const vName = targetTransport.type === 'transport_helo' ? 'HELICÓPTERO' : 'APC';
                this.showEvaMessage(`TROPAS EMBARCADAS NO ${vName}`);
                this.sounds.playOrder();
              }
            });
            this.updateSelectionInspection();
            return;
          }

          // 3. Mineração de Tiberium
          const clickedField = this.map.tiberiumFields.find(f => Math.hypot(f.x - this.mouse.worldX, f.y - this.mouse.worldY) < 120);
          const fieldIndex = clickedField ? this.map.tiberiumFields.indexOf(clickedField) : -1;

          // 4. Movimento com formação
          this.sounds.playOrder();
          selectedUnits.forEach((u, idx) => {
            if (u.type === 'harvester' && clickedField) {
              u.targetField = clickedField;
              u.state = 'HARVESTING';
            } else {
              const spread = (idx - (selectedUnits.length - 1) / 2) * 25;
              u.moveTo(this.mouse.worldX + spread, this.mouse.worldY);
            }
          });

          if (this.multiplayer) {
            this.multiplayer.send({
              type: 'CMD_MOVE',
              uids: selectedUnits.map(u => u.uid),
              targetX: this.mouse.worldX,
              targetY: this.mouse.worldY,
              isHarvesting: !!clickedField,
              fieldIndex: fieldIndex
            });
          }
        });

        // Zoom e Pan
        this.canvas.addEventListener('wheel', (e) => {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
          const newZoom = Math.max(0.55, Math.min(1.85, this.camera.zoom * zoomFactor));
          const before = this.screenToWorld(this.mouse.screenX, this.mouse.screenY);
          this.camera.zoom = newZoom;
          const after = this.screenToWorld(this.mouse.screenX, this.mouse.screenY);
          this.camera.x += before.x - after.x;
          this.camera.y += before.y - after.y;
          this.clampCamera();
        }, { passive: false });

        // Teclado: Grupos de Controle (Ctrl+1..9 e 1..9), Pan e Cancelamento
        window.addEventListener('keydown', (e) => {
          if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
            return;
          }

          // Atribuição de Grupos de Controle (Ctrl + 1..9)
          if (e.key >= '1' && e.key <= '9') {
            const groupNum = parseInt(e.key);
            if (e.ctrlKey) {
              e.preventDefault();
              const selected = this.units.filter(u => u.selected && this.isFriendly(u.faction));
              if (selected.length > 0) {
                this.controlGroups[groupNum] = selected.map(u => u.uid);
                this.units.forEach(u => {
                  if (this.isFriendly(u.faction) && u.controlGroup === groupNum && !this.controlGroups[groupNum].includes(u.uid)) {
                    u.controlGroup = null;
                  }
                });
                selected.forEach(u => u.controlGroup = groupNum);
                this.sounds.playSelect();
                this.eva.speak(`Group ${groupNum} assigned.`);
                this.showEvaMessage(`GRUPO DE COMBATE [${groupNum}] ATRIBUÍDO (${selected.length} UNIDADES)`);
              }
              return;
            } else if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
              // Seleção do Grupo de Controle (1..9)
              const uids = this.controlGroups[groupNum];
              if (uids && uids.length > 0) {
                const matched = this.units.filter(u => uids.includes(u.uid) && u.hp > 0 && this.isFriendly(u.faction));
                if (matched.length > 0) {
                  e.preventDefault();
                  this.units.forEach(u => u.selected = false);
                  this.buildings.forEach(b => b.selected = false);
                  matched.forEach(u => u.selected = true);
                  this.sounds.playSelect();
                  this.updateSelectionInspection();

                  const now = performance.now();
                  const lastPress = this.lastGroupPressTime[groupNum] || 0;
                  if (now - lastPress < 350) {
                    // Duplo toque: centraliza câmera no grupo
                    const avgX = matched.reduce((sum, u) => sum + u.x, 0) / matched.length;
                    const avgY = matched.reduce((sum, u) => sum + u.y, 0) / matched.length;
                    this.camera.x = avgX - (this.canvas.width / this.camera.zoom) / 2;
                    this.camera.y = avgY - (this.canvas.height / this.camera.zoom) / 2;
                    this.clampCamera();
                  } else {
                    this.eva.speak(`Group ${groupNum}.`);
                  }
                  this.lastGroupPressTime[groupNum] = now;
                }
              }
              return;
            }
          }

          if (e.key === 'Escape') {
            this.sidebar.cancelPlacement(true);
            this.sidebar.activeTool = null;
            document.getElementById('btnToolRepair').classList.remove('active');
            document.getElementById('btnToolSell').classList.remove('active');
            document.getElementById('placement-guide').classList.remove('show');
            this.units.forEach(u => u.selected = false);
            this.buildings.forEach(b => b.selected = false);
            this.updateSelectionInspection();
          }

          const panSpeed = 32 / this.camera.zoom;
          if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { this.camera.x -= panSpeed; this.clampCamera(); }
          if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { this.camera.x += panSpeed; this.clampCamera(); }
          if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { this.camera.y -= panSpeed; this.clampCamera(); }
          if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { this.camera.y += panSpeed; this.clampCamera(); }
        });

        document.getElementById('btnZoomIn').onclick = () => { this.camera.zoom = Math.min(1.85, this.camera.zoom * 1.25); this.clampCamera(); };
        document.getElementById('btnZoomOut').onclick = () => { this.camera.zoom = Math.max(0.55, this.camera.zoom * 0.8); this.clampCamera(); };
        document.getElementById('btnCenterBase').onclick = () => this.centerOnBase();

                // Controles do Jukebox de Trilha Sonora
        const btnJukePlay = document.getElementById('btnMusicPlay');
        const btnJukeNext = document.getElementById('btnMusicNext');
        const btnJukePrev = document.getElementById('btnMusicPrev');
        const volSlider = document.getElementById('musicVolumeSlider');

        if (btnJukePlay) {
          btnJukePlay.onclick = () => {
            this.music.toggle();
            this.music.updateHUDTrackDisplay();
          };
        }
        if (btnJukeNext) btnJukeNext.onclick = () => this.music.nextTrack();
        if (btnJukePrev) btnJukePrev.onclick = () => this.music.prevTrack();
        if (volSlider) {
          volSlider.oninput = (e) => {
            this.music.setVolume(e.target.value / 100);
          };
        }

        // Auto-iniciar música e áudio no primeiro clique do usuário no jogo
        const autoStartMusic = () => {
          if (!this.musicStarted) {
            this.musicStarted = true;
            this.music.start();
          }
          window.removeEventListener('click', autoStartMusic);
          window.removeEventListener('keydown', autoStartMusic);
        };
        window.addEventListener('click', autoStartMusic);
        window.addEventListener('keydown', autoStartMusic);

        // Interatividade Completa no Radar Tático (Minimap)
        const radar = document.getElementById('radarCanvas');
        if (radar) {
          // Clique Esquerdo no Radar: Centraliza a câmera no local clicado
          radar.addEventListener('click', (e) => {
            const rect = radar.getBoundingClientRect();
            const rx = (e.clientX - rect.left) / radar.width;
            const ry = (e.clientY - rect.top) / radar.height;
            const targetWorldX = rx * this.map.width;
            const targetWorldY = ry * this.map.height;

            this.camera.x = targetWorldX - (this.canvas.width / this.camera.zoom) / 2;
            this.camera.y = targetWorldY - (this.canvas.height / this.camera.zoom) / 2;
            this.clampCamera();
            this.sounds.playSelect();
          });

          // Clique Direito no Radar: Move as unidades selecionadas para o ponto do mapa!
          radar.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = radar.getBoundingClientRect();
            const rx = (e.clientX - rect.left) / radar.width;
            const ry = (e.clientY - rect.top) / radar.height;
            const targetWorldX = rx * this.map.width;
            const targetWorldY = ry * this.map.height;

            const selectedUnits = this.units.filter(u => u.selected && this.isFriendly(u.faction));
            if (selectedUnits.length > 0) {
              this.sounds.playOrder();
              selectedUnits.forEach((u, idx) => {
                const spread = (idx - (selectedUnits.length - 1) / 2) * 25;
                u.moveTo(targetWorldX + spread, targetWorldY);
              });
              if (this.multiplayer) {
                this.multiplayer.send({
                  type: 'CMD_MOVE',
                  uids: selectedUnits.map(u => u.uid),
                  targetX: targetWorldX,
                  targetY: targetWorldY
                });
              }
            }
          });
        }

        // Botão de Áudio
        const audioBtn = document.getElementById('btnAudioToggle');
        if (audioBtn) {
          audioBtn.onclick = () => {
            const isMuted = this.sounds.toggleMute();
            document.getElementById('audio-icon').innerText = isMuted ? '🔇' : '🔊';
            audioBtn.innerText = isMuted ? '🔇 ÁUDIO OFF' : '🔊 ÁUDIO ON';
          };
        }

        // Botão de Trilha Sonora Industrial Dinâmica
        const musicBtn = document.getElementById('btnMusicToggle');
        if (musicBtn) {
          musicBtn.onclick = () => {
            const isPlaying = this.music.toggle();
            musicBtn.innerText = isPlaying ? '🎵 TRILHA: LIGADA (126 BPM)' : '🔇 TRILHA: DESLIGADA';
            musicBtn.style.borderColor = isPlaying ? 'var(--hud-cyan)' : '#445566';
            musicBtn.style.color = isPlaying ? '#fff' : '#8899aa';
          };
        }

        // Botão Reiniciar do Modal de Game Over
        const btnRestart = document.getElementById('btnRestartGame');
        if (btnRestart) {
          btnRestart.onclick = () => {
            document.getElementById('game-over-modal').style.display = 'none';
            this.initEntities();
          };
        }

        // Botão Configurar Partida do Modal de Game Over
        const btnBackLobby = document.getElementById('btnBackToLobby');
        if (btnBackLobby) {
          btnBackLobby.onclick = () => {
            document.getElementById('game-over-modal').style.display = 'none';
            document.getElementById('multiplayer-modal').style.display = 'flex';
          };
        }
      }

      centerOnBase() {
        const hq = this.buildings.find(b => b.type === 'hq' && this.isFriendly(b.faction));
        if (hq) {
          this.camera.x = hq.x - (this.canvas.width / this.camera.zoom) / 2;
          this.camera.y = hq.y - (this.canvas.height / this.camera.zoom) / 2;
          this.clampCamera();
        }
      }

      sellBuilding(b, broadcast = true) {
        if (!b) return;
        const refund = Math.floor(b.cost * 0.5);
        if (this.isFriendly(b.faction)) {
          this.credits += refund;
          this.updateEconomyDisplay();
          this.showFloatingCredit(b.x, b.y - 15, `+$${refund}`);
        }

        for (let i = 0; i < 2; i++) {
          const survivor = new Unit(b.x + (i * 20 - 10), b.y + b.height/2 + 15, 'rifleman', b.faction);
          this.units.push(survivor);
        }

        this.particles.createExplosion(b.x, b.y, 1.0);
        this.sounds.playExplosion();
        if (this.isFriendly(b.faction)) {
          this.eva.speak('Structure sold.');
          this.showEvaMessage(`ESTRUTURA VENDIDA (+$${refund})`);
        }

        const idx = this.buildings.indexOf(b);
        if (idx !== -1) this.buildings.splice(idx, 1);

        this.recalculatePower();
        this.updateSelectionInspection();

        if (broadcast && this.multiplayer) {
          this.multiplayer.send({
            type: 'CMD_SELL',
            uid: b.uid
          });
        }
      }

      triggerIonCannon(targetX, targetY, broadcast = true) {
        this.sidebar.activeTool = null;
        this.sidebar.ionReady = false;
        this.sidebar.ionTimer = 0;
        const btn = document.getElementById('btn-ion-cannon');
        if (btn) btn.classList.remove('ready');
        const guide = document.getElementById('placement-guide');
        if (guide) guide.classList.remove('show');

        this.eva.speak('Ion cannon activated.');
        this.showEvaMessage('DISPARO DO CANHÃO DE ÍONS CONFIRMADO');
        this.sounds.playIonCannon();

        this.activeIonStrike = {
          x: targetX,
          y: targetY,
          timer: 0,
          duration: 1.8,
          damaged: false
        };

        if (broadcast && this.multiplayer) {
          this.multiplayer.send({
            type: 'CMD_ION',
            x: targetX,
            y: targetY
          });
        }
      }

      triggerNukeStrike(targetX, targetY, broadcast = true) {
        this.sidebar.activeTool = null;
        this.sidebar.ionReady = false;
        this.sidebar.ionTimer = 0;
        const btn = document.getElementById('btn-ion-cannon');
        if (btn) btn.classList.remove('ready');
        const guide = document.getElementById('placement-guide');
        if (guide) guide.classList.remove('show');

        this.sounds.playNuclearAlarm();
        this.sounds.playNukeLaunch();
        this.eva.speak('Nuclear warhead approaching.');
        this.showEvaMessage('☢️ ALERTA: LANÇAMENTO DE MÍSSIL NUCLEAR DETECTADO!');

        this.activeNukeStrike = {
          x: targetX,
          y: targetY,
          timer: 0,
          duration: 4.8,
          rocketY: targetY - 650,
          detonated: false
        };

        if (broadcast && this.multiplayer) {
          this.multiplayer.send({
            type: 'CMD_NUKE',
            x: targetX,
            y: targetY
          });
        }
      }

      addCredits(amount, faction = 'slot1') {
        if (this.isFriendly(faction)) {
          this.battleStats.tiberiumCollected += amount;
          if (this.credits + amount > this.creditCapacity) {
            this.credits = this.creditCapacity;
            const now = Date.now();
            if (now - this.lastSiloWarning > 20000) {
              this.lastSiloWarning = now;
              this.eva.speak('Silos needed.');
              this.showEvaMessage('SILOS DE TIBERIUM NECESSÁRIOS (ARMAZENAMENTO NO LIMITE)');
              this.sounds.playEvaChime('alert');
            }
          } else {
            this.credits += amount;
          }
          this.updateEconomyDisplay();
        }
      }

      recalculatePower() {
        let produced = 0, consumed = 0;
        let siloCount = 0;
        this.buildings.forEach(b => {
          if (this.isFriendly(b.faction) && b.hp > 0 && !b.isConstructing) {
            produced += b.powerGen;
            consumed += b.powerCons;
            if (b.type === 'silo') siloCount++;
          }
        });

        this.creditCapacity = 3500 + siloCount * 3000;
        this.powerProduced = produced;
        this.powerConsumed = consumed;

        const powerBar = document.getElementById('power-bar-fill');
        const powerNeedle = document.getElementById('power-needle');
        const powerDisplay = document.getElementById('powerDisplay');
        const baseStatus = document.getElementById('hud-base-status');

        if (powerDisplay) powerDisplay.innerText = `${produced} / ${consumed} GW`;

        const ratio = produced > 0 ? (consumed / produced) : 1;
        const fillHeight = Math.max(10, Math.min(100, (produced / 200) * 100));
        const needlePos = Math.max(5, Math.min(95, ratio * 100));

        if (powerBar) powerBar.style.height = `${fillHeight}%`;
        if (powerNeedle) powerNeedle.style.bottom = `${needlePos}%`;

        if (baseStatus) {
          if (consumed > produced) {
            baseStatus.innerText = 'ENERGIA CRÍTICA (BAIXA)'; baseStatus.style.color = '#ff3344';
          } else {
            baseStatus.innerText = 'ENERGIZADA (100%)'; baseStatus.style.color = '#00ff66';
          }
        }
      }

      updateEconomyDisplay() {
        const creditDisplay = document.getElementById('creditDisplay');
        if (creditDisplay) {
          creditDisplay.innerText = `$ ${Math.floor(this.credits).toLocaleString('en-US')} / $ ${this.creditCapacity.toLocaleString('en-US')}`;
          creditDisplay.classList.add('flash');
          setTimeout(() => creditDisplay.classList.remove('flash'), 300);
        }
      }

      showFloatingCredit(worldX, worldY, text) {
        const screen = {
          x: (worldX - this.camera.x) * this.camera.zoom,
          y: (worldY - this.camera.y) * this.camera.zoom
        };
        const el = document.createElement('div');
        el.className = 'floating-credit';
        el.innerText = text;
        el.style.left = `${screen.x}px`; el.style.top = `${screen.y}px`;
        document.getElementById('game-container').appendChild(el);
        setTimeout(() => el.remove(), 1500);
      }

      showEvaMessage(msg) {
        const banner = document.getElementById('eva-banner');
        if (banner) {
          banner.innerText = msg;
          banner.classList.add('show');
          clearTimeout(this.evaTimeout);
          this.evaTimeout = setTimeout(() => banner.classList.remove('show'), 2800);
        }
      }

      updateSelectionInspection() {
        const selectedUnit = this.units.find(u => u.selected && this.isFriendly(u.faction));
        const selectedBuilding = this.buildings.find(b => b.selected && this.isFriendly(b.faction));

        const nameTxt = document.getElementById('unit-name-txt');
        const subTxt = document.getElementById('unit-subtext');
        const typeBadge = document.getElementById('unit-type-badge');
        const hpBar = document.getElementById('unit-hp-bar-fill');
        const unloadBtn = document.getElementById('btn-unload-passengers');
        if (unloadBtn) {
          unloadBtn.onclick = () => {
            const transport = this.units.find(u => u.selected && (u.type === 'apc' || u.type === 'transport_helo') && this.isFriendly(u.faction));
            if (transport && transport.passengers.length > 0) {
              this.eva.speak('Troops deployed.');
              const vName = transport.type === 'transport_helo' ? 'DO HELICÓPTERO' : 'DO APC';
              this.showEvaMessage(`DESEMBARQUE DE TROPAS ${vName} CONCLUÍDO`);
              this.sounds.playOrder();
              while (transport.passengers.length > 0) {
                const pType = transport.passengers.pop();
                const spreadX = transport.x + (Math.random() - 0.5) * 36;
                const spreadY = transport.y + (Math.random() - 0.5) * 36;
                const soldier = new Unit(spreadX, spreadY, pType, transport.faction);
                this.units.push(soldier);
              }
              this.updateSelectionInspection();
            }
          };
        }
        const portrait = document.getElementById('unit-portrait');
        const pctx = portrait.getContext('2d');
        pctx.clearRect(0, 0, 48, 48);

        unloadBtn.style.display = 'none';

        if (selectedUnit) {
          nameTxt.innerText = selectedUnit.name;
          const rankLabel = selectedUnit.rank === 2 ? ' ★ ELITE' : (selectedUnit.rank === 1 ? ' ▲ VETERANO' : '');
          if (selectedUnit.type === 'rifleman') {
            typeBadge.innerText = 'INFANTARIA DE ASSALTO' + rankLabel;
            typeBadge.style.background = 'rgba(75, 107, 51, 0.85)';
          } else if (selectedUnit.type === 'rocket') {
            typeBadge.innerText = 'LANÇA-FOGUETES PESADO' + rankLabel;
            typeBadge.style.background = 'rgba(211, 84, 0, 0.85)';
          } else if (selectedUnit.type === 'engineer') {
            typeBadge.innerText = 'ENGENHEIRO // SUPORTE & CAPTURA';
            typeBadge.style.background = 'rgba(243, 156, 18, 0.85)';
          } else if (selectedUnit.type === 'commando') {
            typeBadge.innerText = 'FORÇAS ESPECIAIS & SNIPER' + rankLabel;
            typeBadge.style.background = 'rgba(192, 57, 43, 0.85)';
          } else {
            typeBadge.innerText = (selectedUnit.rank === 2 ? 'ELITE' : (selectedUnit.rank === 1 ? 'VETERANO' : 'UNIDADE'));
            typeBadge.style.background = 'var(--hud-panel-dark)';
          }
          const hpP = Math.max(0, (selectedUnit.hp / selectedUnit.maxHp) * 100);
          hpBar.style.width = `${hpP}%`;

          if (selectedUnit.type === 'apc' || selectedUnit.type === 'transport_helo') {
            const maxCap = selectedUnit.maxPassengers || 5;
            subTxt.innerText = `Passageiros: ${selectedUnit.passengers.length}/${maxCap} tropas | HP: ${Math.floor(selectedUnit.hp)}/${selectedUnit.maxHp}`;
            if (selectedUnit.passengers.length > 0) unloadBtn.style.display = 'block';
          } else {
            subTxt.innerText = `Kills: ${selectedUnit.kills} | Estado: ${selectedUnit.state} | HP: ${Math.floor(selectedUnit.hp)}/${selectedUnit.maxHp}`;
          }

          pctx.save();
          pctx.translate(24, 24);
          this.sidebar.drawCardIcon(selectedUnit.type);
          pctx.restore();
        } else if (selectedBuilding) {
          nameTxt.innerText = selectedBuilding.name;

          let bBadge = 'ESTRUTURA MILITAR';
          let bColor = 'var(--hud-cyan)';
          let bDesc = '';

          if (selectedBuilding.type === 'hq') {
            bBadge = 'CENTRO DE COMANDO (HQ)';
            bColor = '#00e5ff';
            bDesc = 'Radar Tático & Produção de Base';
          } else if (selectedBuilding.type === 'power') {
            bBadge = 'USINA DE ENERGIA (+100 GW)';
            bColor = '#00ff66';
            bDesc = 'Gera energia vital para toda a base';
          } else if (selectedBuilding.type === 'barracks') {
            bBadge = 'QUARTEL DE TROPAS';
            bColor = '#e67e22';
            bDesc = 'Treinamento de Infantaria & Engenheiros';
          } else if (selectedBuilding.type === 'factory') {
            bBadge = 'FÁBRICA DE GUERRA';
            bColor = '#2980b9';
            bDesc = 'Produção de Blindados, APCs & Aeronaves';
          } else if (selectedBuilding.type === 'refinery') {
            bBadge = 'REFINARIA DE TIBERIUM';
            bColor = '#27ae60';
            bDesc = 'Descarga de Minério & Refino Financeiro';
          } else if (selectedBuilding.type === 'turret') {
            bBadge = 'TORRE DE DEFESA TÁTICA';
            bColor = '#e74c3c';
            bDesc = 'Defesa Perimetral Automática';
          } else if (selectedBuilding.type === 'silo') {
            bBadge = 'SILO DE TIBERIUM (+3.000)';
            bColor = '#f39c12';
            bDesc = 'Expansão de Armazenamento de Créditos';
          } else if (selectedBuilding.type === 'obelisk') {
            bBadge = 'OBELISCO DE LUZ NOD';
            bColor = '#c0392b';
            bDesc = 'Defesa Laser de Alta Energia (220 Dano)';
          } else if (selectedBuilding.type === 'temple') {
            bBadge = 'TEMPLO DE NOD // NUCLEAR';
            bColor = '#8e44ad';
            bDesc = 'Super-Arma: Plataforma de Míssil Nuclear';
          }

          typeBadge.innerText = bBadge;
          typeBadge.style.background = bColor;

          const hpP = Math.max(0, (selectedBuilding.hp / selectedBuilding.maxHp) * 100);
          hpBar.style.width = `${hpP}%`;

          const statusText = selectedBuilding.isConstructing
            ? '⏳ Em Montagem...'
            : (selectedBuilding.isRepairing ? '🔧 Em Reparo...' : '✅ Operacional (100%)');

          subTxt.innerText = `${statusText} | ${bDesc} | Integridade: ${Math.floor(selectedBuilding.hp)}/${selectedBuilding.maxHp} HP`;

          // Desenha o ícone detalhado do edifício no portrait
          pctx.save();
          pctx.translate(24, 24);
          this.sidebar.drawCardIcon(selectedBuilding.type);
          pctx.restore();
        } else {
          nameTxt.innerText = 'Comando Central';
          typeBadge.innerText = 'PRONTO';
          hpBar.style.width = '100%';
          subTxt.innerText = 'Selecione tropas com o Botão Esquerdo';
        }
      }

      updateAI(dt) {
        // Se formos o Host ou em Modo Solo, rodamos a IA para slots configurados com robôs
        const isHostOrSolo = (!this.multiplayer || !this.multiplayer.connected || this.multiplayer.isHost);
        if (!isHostOrSolo) return;

        ['slot2', 'slot3', 'slot4'].forEach(slot => {
          const cfg = this.slotConfigs[slot];
          if (!cfg || !cfg.startsWith('ai_')) return;

          // Intervalo de produção baseado na dificuldade
          let buildInterval = 24;
          let squadThreshold = 4;
          if (cfg === 'ai_easy') { buildInterval = 38; squadThreshold = 3; }
          if (cfg === 'ai_brutal') { buildInterval = 13; squadThreshold = 6; }

          this.aiTimers[slot] = (this.aiTimers[slot] || 0) + dt;
          if (this.aiTimers[slot] >= buildInterval) {
            this.aiTimers[slot] = 0;

            const fac = this.buildings.find(b => b.type === 'factory' && b.faction === slot && b.hp > 0);
            if (fac) {
              const types = cfg === 'ai_brutal' ? ['tank', 'mammoth', 'rocket', 'helicopter'] : ['tank', 'rocket', 'rifleman'];
              const chosen = types[Math.floor(Math.random() * types.length)];
              const newBotUnit = new Unit(fac.spawnX, fac.spawnY, chosen, slot);
              this.units.push(newBotUnit);
              if (this.multiplayer && this.multiplayer.connected) {
                this.multiplayer.send({
                  type: 'CMD_TRAIN',
                  uid: newBotUnit.uid,
                  unitType: chosen,
                  spawnX: fac.spawnX,
                  spawnY: fac.spawnY,
                  targetX: fac.spawnX,
                  targetY: fac.spawnY,
                  faction: slot
                });
              }
            }

            // Unidades de ataque formam pelotão e marcham
            const squad = this.units.filter(u => u.faction === slot && u.type !== 'harvester');
            const oppTarget = this.buildings.find(b => b.faction !== slot && b.hp > 0) || this.units.find(u => u.faction !== slot && u.hp > 0);

            if (oppTarget && squad.length >= squadThreshold) {
              squad.forEach(u => u.attack(oppTarget));
              if (oppTarget.faction === this.myFaction) {
                this.eva.speak('Our base is under attack.', 14000);
                this.showEvaMessage('ALERTA: BASE SOB ATAQUE INIMIGO');
                this.sounds.playEvaChime('alert');
              }
            }
          }
        });
      }

      updateVictory(dt) {
        if (this.gameOver) return;

        const myUnits = this.units.filter(u => this.isFriendly(u.faction) && u.hp > 0);
        const myBuildings = this.buildings.filter(b => this.isFriendly(b.faction) && b.hp > 0);
        const enemyUnits = this.units.filter(u => !this.isFriendly(u.faction) && u.hp > 0);
        const enemyBuildings = this.buildings.filter(b => !this.isFriendly(b.faction) && b.hp > 0);

        if (myUnits.length === 0 && myBuildings.length === 0) {
          this.endGame(false, 'MISSÃO FALHOU // DERROTA TOTAL', 'Todas as suas forças e instalações militares foram aniquiladas.');
          return;
        }

        if (this.victoryMode === 'annihilation') {
          if (enemyUnits.length === 0 && enemyBuildings.length === 0) {
            this.endGame(true, 'MISSÃO CUMPRIDA // VITÓRIA TOTAL', 'Todas as forças e bases inimigas no setor foram eliminadas.');
            return;
          }
        } else if (this.victoryMode === 'assassination') {
          const myHq = myBuildings.find(b => b.type === 'hq');
          const enemyHqs = enemyBuildings.filter(b => b.type === 'hq');
          if (!myHq) {
            this.endGame(false, 'MISSÃO FALHOU // HQ DESTRUÍDO', 'O seu Centro de Comando Principal foi neutralizado.');
            return;
          }
          if (enemyHqs.length === 0) {
            this.endGame(true, 'MISSÃO CUMPRIDA // HQs INIMIGOS ELIMINADOS', 'Todos os Centros de Comando inimigos foram destruídos.');
            return;
          }
        } else if (this.victoryMode === 'tiberium_race') {
          if (this.credits >= 15000) {
            this.endGame(true, 'MISSÃO CUMPRIDA // CORRIDA TIBERIANA VENCIDA', 'Sua facção atingiu a meta financeira de $15.000 créditos.');
            return;
          }
          const badge = document.getElementById('hud-victory-val');
          if (badge) badge.innerText = `$ ${Math.floor(this.credits)} / $ 15.000`;
        } else if (this.victoryMode === 'king_of_hill') {
          const cx = 1200, cy = 900, cr = 200;
          const myIn = myUnits.filter(u => Math.hypot(u.x - cx, u.y - cy) <= cr).length;
          const enIn = enemyUnits.filter(u => Math.hypot(u.x - cx, u.y - cy) <= cr).length;

          if (myIn > 0 && enIn === 0) {
            if (this.kingOfHillTimer.faction !== this.myFaction) {
              this.kingOfHillTimer.faction = this.myFaction;
              this.kingOfHillTimer.seconds = 0;
              this.showEvaMessage('CRATERA CENTRAL CONTROLADA POR SUAS FORÇAS');
            }
            this.kingOfHillTimer.seconds += dt;
            const left = Math.max(0, Math.ceil(this.kingOfHillTimer.target - this.kingOfHillTimer.seconds));
            const badge = document.getElementById('hud-victory-val');
            if (badge) badge.innerText = `CRATERA: ${left}S RESTANTES`;
            if (this.kingOfHillTimer.seconds >= this.kingOfHillTimer.target) {
              this.endGame(true, 'MISSÃO CUMPRIDA // CONTROLE DA COLINA', 'Sua facção dominou a cratera de Tiberium pelo tempo necessário.');
              return;
            }
          } else if (enIn > 0 && myIn === 0) {
            if (this.kingOfHillTimer.faction !== 'enemy') {
              this.kingOfHillTimer.faction = 'enemy';
              this.kingOfHillTimer.seconds = 0;
              this.showEvaMessage('ALERTA: INIMIGO ASSUMIU CONTROLE DA CRATERA');
            }
            this.kingOfHillTimer.seconds += dt;
            const left = Math.max(0, Math.ceil(this.kingOfHillTimer.target - this.kingOfHillTimer.seconds));
            const badge = document.getElementById('hud-victory-val');
            if (badge) badge.innerText = `INIMIGO DOMINANDO: ${left}S`;
            if (this.kingOfHillTimer.seconds >= this.kingOfHillTimer.target) {
              this.endGame(false, 'MISSÃO FALHOU // INIMIGO DOMINOU A COLINA', 'Forças inimigas sustentaram o controle da cratera central.');
              return;
            }
          } else {
            const badge = document.getElementById('hud-victory-val');
            if (badge) badge.innerText = (myIn > 0 && enIn > 0) ? 'CRATERA EM DISPUTA!' : 'CRATERA VAZIA';
          }
        }
      }

      endGame(isVictory, title, reason) {
        if (this.gameOver) return;
        this.gameOver = true;

        if (isVictory) {
          this.eva.speak('Mission accomplished.');
        } else {
          this.eva.speak('Mission failed.');
        }

        const modal = document.getElementById('game-over-modal');
        const hdr = document.getElementById('gameOverHeader');
        const tEl = document.getElementById('gameOverTitle');
        const subEl = document.getElementById('gameOverSubtitle');

        if (tEl) tEl.innerText = isVictory ? `🏆 ${title}` : `💀 ${title}`;
        if (subEl) subEl.innerText = reason;
        if (hdr) hdr.className = `modal-header game-over-header ${isVictory ? 'victory' : 'defeat'}`;

        const now = Date.now();
        const battleSec = Math.floor((now - this.battleStats.startTime) / 1000);
        const timeStr = `${String(Math.floor(battleSec / 60)).padStart(2, '0')}:${String(battleSec % 60).padStart(2, '0')}`;

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setVal('statBattleTime', timeStr);
        setVal('statTiberiumCredits', `$ ${this.battleStats.tiberiumCollected.toLocaleString('en-US')}`);
        setVal('statUnitsBuilt', this.battleStats.unitsBuilt);
        setVal('statKills', this.battleStats.kills);
        setVal('statStructuresDestroyed', this.battleStats.structuresDestroyed);
        setVal('statObjectiveMode', this.victoryMode.toUpperCase().replace('_', ' '));

        if (modal) modal.style.display = 'flex';
      }

      drawRadar() {
        const radarCanvas = document.getElementById('radarCanvas');
        const rctx = radarCanvas.getContext('2d');
        const rw = radarCanvas.width, rh = radarCanvas.height;

        rctx.fillStyle = '#060a0e';
        rctx.fillRect(0, 0, rw, rh);

        const sx = rw / this.map.width;
        const sy = rh / this.map.height;

        // Tiberium
        rctx.fillStyle = '#00ff77';
        this.map.tiberiumFields.forEach(f => {
          if (!this.map.shroudEnabled || this.map.shroud[Math.floor(f.y / this.map.tileSize) * this.map.cols + Math.floor(f.x / this.map.tileSize)] > 0) {
            rctx.beginPath(); rctx.arc(f.x * sx, f.y * sy, 4, 0, Math.PI * 2); rctx.fill();
          }
        });

        // Estruturas
        this.buildings.forEach(b => {
          if (this.isFriendly(b.faction) || !this.map.shroudEnabled || this.map.isVisible(b.x, b.y)) {
            rctx.fillStyle = this.isFriendly(b.faction) ? '#00e5ff' : '#ff3344';
            rctx.fillRect((b.x - b.width/2) * sx, (b.y - b.height/2) * sy, Math.max(3, b.width * sx), Math.max(3, b.height * sy));
          }
        });

        // Unidades
        this.units.forEach(u => {
          if (this.isFriendly(u.faction) || !this.map.shroudEnabled || this.map.isVisible(u.x, u.y)) {
            rctx.fillStyle = this.isFriendly(u.faction) ? '#00ff66' : '#ff3344';
            rctx.fillRect(u.x * sx - 1, u.y * sy - 1, 3, 3);
          }
        });

        const viewW = (this.canvas.width / this.camera.zoom) * sx;
        const viewH = (this.canvas.height / this.camera.zoom) * sy;
        rctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        rctx.lineWidth = 1;
        rctx.strokeRect(this.camera.x * sx, this.camera.y * sy, viewW, viewH);
      }

      gameLoop(time) {
        const dt = Math.min(0.1, (time - this.lastTime) / 1000);
        this.lastTime = time;

        this.sidebar.update(dt);
        this.updateAI(dt);
        this.updateVictory(dt);
        this.particles.update(dt);

        // Heartbeat de sincronização de estado se for o Host
        if (this.multiplayer && this.multiplayer.connected && this.multiplayer.isHost) {
          this.syncTimer = (this.syncTimer || 0) + dt;
          if (this.syncTimer >= 3.0) {
            this.syncTimer = 0;
            this.multiplayer.sendStateSync();
          }
        }

        // Névoa de Guerra
        const friendlyEnts = [...this.units.filter(u => this.isFriendly(u.faction)), ...this.buildings.filter(b => this.isFriendly(b.faction))];
        this.map.updateVision(friendlyEnts);

        // Atualiza Edifícios
        for (let i = this.buildings.length - 1; i >= 0; i--) {
          const b = this.buildings[i];
          b.update(dt, this);
          if (b.hp <= 0) {
            if (this.isFriendly(b.faction)) this.eva.speak('Our base is under attack.', 12000);
            else this.battleStats.structuresDestroyed++;
            this.buildings.splice(i, 1);
            this.recalculatePower();
            this.updateSelectionInspection();
          }
        }

        // Atualiza Unidades
        for (let i = this.units.length - 1; i >= 0; i--) {
          const u = this.units[i];
          u.update(dt, this);
          if (u.hp <= 0) {
            if (this.isFriendly(u.faction)) {
              if (u.type === 'harvester') this.eva.speak('Harvester under attack.', 10000);
              else this.eva.speak('Unit lost.', 8000);
            } else {
              this.battleStats.kills++;
            }
            this.units.splice(i, 1);
            this.updateSelectionInspection();
          }
        }

        // Atualiza Projéteis
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
          const p = this.projectiles[i];
          p.update(dt, this);
          if (p.dead) this.projectiles.splice(i, 1);
        }

        // Atualiza Tremor de Tela
        if (this.screenShake > 0) {
          this.screenShake = Math.max(0, this.screenShake - dt * 2.5);
        }

        // Atualiza Canhão de Íons
        if (this.activeIonStrike) {
          this.activeIonStrike.timer += dt;
          this.screenShake = 10;
          if (this.activeIonStrike.timer > 0.5 && !this.activeIonStrike.damaged) {
            this.activeIonStrike.damaged = true;
            const ix = this.activeIonStrike.x, iy = this.activeIonStrike.y;
            this.map.addScorchMark(ix, iy, 70);
            this.particles.createExplosion(ix, iy, 2.5);

            this.units.forEach(u => {
              if (Math.hypot(u.x - ix, u.y - iy) <= 140) u.hp -= 900;
            });
            this.buildings.forEach(b => {
              if (Math.hypot(b.x - ix, b.y - iy) <= 140) b.hp -= 1100;
            });
          }
          if (this.activeIonStrike.timer >= this.activeIonStrike.duration) {
            this.activeIonStrike = null;
          }
        }

        // Atualiza Míssil Nuclear NOD
        if (this.activeNukeStrike) {
          const nuke = this.activeNukeStrike;
          nuke.timer += dt;
          if (!nuke.detonated) {
            nuke.rocketY += 520 * dt;
            this.particles.createTreadDust(nuke.x + (Math.random() - 0.5) * 8, nuke.rocketY - 15);
            if (nuke.rocketY >= nuke.y) {
              nuke.detonated = true;
              nuke.detonateTime = nuke.timer;
              this.sounds.playNukeDetonation();
              this.screenShake = 24;
              this.map.addScorchMark(nuke.x, nuke.y, 110);
              for (let i = 0; i < 28; i++) {
                this.particles.createExplosion(
                  nuke.x + (Math.random() - 0.5) * 120,
                  nuke.y + (Math.random() - 0.5) * 80,
                  1.8
                );
              }
              this.units.forEach(u => {
                if (Math.hypot(u.x - nuke.x, u.y - nuke.y) <= 220) u.hp -= 1500;
              });
              this.buildings.forEach(b => {
                if (Math.hypot(b.x - nuke.x, b.y - nuke.y) <= 220) b.hp -= 2200;
              });
            }
          }
          if (nuke.timer >= nuke.duration) {
            this.activeNukeStrike = null;
          }
        }

        // RENDERIZAÇÃO
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.screenShake > 0) {
          const shakeX = (Math.random() - 0.5) * this.screenShake * 3;
          const shakeY = (Math.random() - 0.5) * this.screenShake * 3;
          ctx.translate(shakeX, shakeY);
        }

        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);

        const viewport = {
          x: this.camera.x, y: this.camera.y,
          w: this.canvas.width / this.camera.zoom, h: this.canvas.height / this.camera.zoom
        };

        // 1. Terreno
        this.map.draw(ctx, viewport);

        // 2. Edifícios
        this.buildings.forEach(b => {
          if (this.isFriendly(b.faction) || !this.map.shroudEnabled || this.map.isVisible(b.x, b.y)) {
            b.draw(ctx);
          }
        });

        // 3. Unidades
        this.units.forEach(u => {
          if (this.isFriendly(u.faction) || !this.map.shroudEnabled || this.map.isVisible(u.x, u.y)) {
            u.draw(ctx);
          }
        });

        // 4. Projéteis e Partículas
        this.projectiles.forEach(p => p.draw(ctx));
        this.particles.draw(ctx);

        // 5. Efeito Visual do Canhão de Íons
        if (this.activeIonStrike) {
          const strike = this.activeIonStrike;
          ctx.save();
          const strikeAlpha = Math.sin((strike.timer / strike.duration) * Math.PI);
          const beamGrad = ctx.createLinearGradient(strike.x - 25, 0, strike.x + 25, 0);
          beamGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
          beamGrad.addColorStop(0.3, `rgba(0, 229, 255, ${strikeAlpha * 0.8})`);
          beamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${strikeAlpha})`);
          beamGrad.addColorStop(0.7, `rgba(0, 229, 255, ${strikeAlpha * 0.8})`);
          beamGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
          ctx.fillStyle = beamGrad;
          ctx.fillRect(strike.x - 30, 0, 60, strike.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${strikeAlpha})`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(strike.x, strike.y, strike.timer * 80, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // 6. Efeito Visual do Míssil Nuclear NOD & Cogumelo Atômico
        if (this.activeNukeStrike) {
          const nuke = this.activeNukeStrike;
          ctx.save();
          if (!nuke.detonated) {
            ctx.save();
            ctx.translate(nuke.x, nuke.rocketY);
            ctx.rotate(Math.PI);
            ctx.fillStyle = '#2b2b2b';
            ctx.fillRect(-6, -24, 12, 48);
            ctx.fillStyle = '#ff2233';
            ctx.beginPath();
            ctx.moveTo(-6, 24); ctx.lineTo(0, 36); ctx.lineTo(6, 24); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.fillRect(-10, -24, 4, 12);
            ctx.fillRect(6, -24, 4, 12);
            const fLen = 15 + Math.random() * 12;
            const fGrad = ctx.createLinearGradient(0, -24, 0, -24 - fLen);
            fGrad.addColorStop(0, '#ffff00');
            fGrad.addColorStop(0.5, '#ff4400');
            fGrad.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = fGrad;
            ctx.beginPath();
            ctx.moveTo(-5, -24); ctx.lineTo(0, -24 - fLen); ctx.lineTo(5, -24); ctx.closePath(); ctx.fill();
            ctx.restore();
          } else {
            const elapsed = nuke.timer - (nuke.detonateTime || 1);
            const progress = Math.min(1, elapsed / 3.4);
            const alpha = 1.0 - progress * 0.7;

            // Onda de choque no solo
            ctx.strokeStyle = `rgba(255, 180, 50, ${alpha * 0.8})`;
            ctx.lineWidth = 6 * (1 - progress);
            ctx.beginPath();
            ctx.arc(nuke.x, nuke.y, progress * 240, 0, Math.PI * 2);
            ctx.stroke();

            // Coluna de fogo e fumaça subindo
            const stemH = progress * 220;
            const stemGrad = ctx.createLinearGradient(nuke.x, nuke.y, nuke.x, nuke.y - stemH);
            stemGrad.addColorStop(0, `rgba(255, 60, 0, ${alpha * 0.9})`);
            stemGrad.addColorStop(0.4, `rgba(200, 100, 20, ${alpha * 0.8})`);
            stemGrad.addColorStop(1, `rgba(40, 40, 40, ${alpha * 0.7})`);
            ctx.fillStyle = stemGrad;
            ctx.beginPath();
            ctx.moveTo(nuke.x - 22 * (1 + progress), nuke.y);
            ctx.quadraticCurveTo(nuke.x - 12, nuke.y - stemH * 0.5, nuke.x - 28 * progress, nuke.y - stemH);
            ctx.lineTo(nuke.x + 28 * progress, nuke.y - stemH);
            ctx.quadraticCurveTo(nuke.x + 12, nuke.y - stemH * 0.5, nuke.x + 22 * (1 + progress), nuke.y);
            ctx.closePath();
            ctx.fill();

            // Chapéu do Cogumelo
            const capY = nuke.y - stemH;
            const capR = 40 + progress * 95;
            const capGrad = ctx.createRadialGradient(nuke.x, capY, 10, nuke.x, capY, capR);
            capGrad.addColorStop(0, `rgba(255, 220, 100, ${alpha})`);
            capGrad.addColorStop(0.35, `rgba(255, 80, 0, ${alpha * 0.9})`);
            capGrad.addColorStop(0.7, `rgba(80, 30, 20, ${alpha * 0.85})`);
            capGrad.addColorStop(1, 'rgba(30, 30, 30, 0)');
            ctx.fillStyle = capGrad;
            ctx.beginPath();
            ctx.arc(nuke.x, capY, capR, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 7. Shroud / Névoa de Guerra
        this.map.drawShroud(ctx, viewport);

        // 8. Holograma fantasma de posicionamento no cursor
        this.sidebar.drawGhost(ctx, this.mouse.worldX, this.mouse.worldY);

        ctx.restore();

        // 9. Caixa de seleção militar
        if (this.mouse.isDragging) {
          const x = Math.min(this.mouse.dragStart.x, this.mouse.screenX);
          const y = Math.min(this.mouse.dragStart.y, this.mouse.screenY);
          const w = Math.abs(this.mouse.dragStart.x - this.mouse.screenX);
          const h = Math.abs(this.mouse.dragStart.y - this.mouse.screenY);

          ctx.fillStyle = 'rgba(0, 255, 102, 0.12)';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 1;
          ctx.strokeRect(x, y, w, h);

          const cLen = Math.min(10, w / 2, h / 2);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, y + cLen); ctx.lineTo(x, y); ctx.lineTo(x + cLen, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + w - cLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cLen); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y + h - cLen); ctx.lineTo(x, y + h); ctx.lineTo(x + cLen, y + h); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + w - cLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cLen); ctx.stroke();
        }

        this.drawRadar();
        requestAnimationFrame((t) => this.gameLoop(t));
      }
    }