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
        this.teams = { slot1: "none", slot2: "none", slot3: "none", slot4: "none" };
    this.diplomacyPacts = new Set();
    this.aiRetaliationTarget = {};
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
        this.aiBuildTimers = { slot2: 0, slot3: 0, slot4: 0 };
        this.aiCredits = { slot2: 3000, slot3: 3000, slot4: 3000 };

        // Controles de Simulação e Táticos
        this.gameSpeed = 1; // 0 = Pausado, 1 = Normal (1x), 2 = Rápido (2x)
        this.attackMoveActive = false;
        this.patrolActive = false;

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
        if (!faction) return false;
        if (faction === this.myFaction) return true;
        if (this.myFaction === 'slot1' && faction === 'player') return true;
        if (this.myFaction === 'slot2' && faction === 'enemy') return true;
        if (this.myFaction === 'player' && faction === 'slot1') return true;
        if (this.myFaction === 'enemy' && faction === 'slot2') return true;
        if (this.teams && this.teams[this.myFaction] && this.teams[faction] && this.teams[this.myFaction] !== 'none' && this.teams[this.myFaction] === this.teams[faction]) return true;
        if (this.diplomacyPacts && (this.diplomacyPacts.has(`${this.myFaction}_${faction}`) || this.diplomacyPacts.has(`${faction}_${this.myFaction}`))) return true;
        return false;
      }

      areEnemies(f1, f2) {
        if (!f1 || !f2) return false;
        if (f1 === f2) return false;
        if ((f1 === 'player' && f2 === 'slot1') || (f1 === 'slot1' && f2 === 'player')) return false;
        if ((f1 === 'enemy' && f2 === 'slot2') || (f1 === 'slot2' && f2 === 'enemy')) return false;
        if (this.teams && this.teams[f1] && this.teams[f2] && this.teams[f1] !== 'none' && this.teams[f1] === this.teams[f2]) return false;
        if (this.diplomacyPacts && (this.diplomacyPacts.has(`${f1}_${f2}`) || this.diplomacyPacts.has(`${f2}_${f1}`))) return false;
        return true;
      }

      areAllied(f1, f2) {
        if (!f1 || !f2) return false;
        return !this.areEnemies(f1, f2);
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

        // Registra as pegadas das estruturas no grid do mapa
        this.buildings.forEach(b => {
          if (this.map) this.map.registerBuilding(b);
        });
        this.aiCredits = { slot2: 3000, slot3: 3000, slot4: 3000 };

        // Revela a visão inicial das tropas e estruturas aliadas
        if (this.map) {
          const friendlyEnts = [...this.units.filter(u => this.isFriendly(u.faction)), ...this.buildings.filter(b => this.isFriendly(b.faction))];
          this.map.updateVision(friendlyEnts);
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
            // 0. Modo Attack-Move ou Patrulha Ativo
            if (this.attackMoveActive) {
              const selectedUnits = this.units.filter(u => u.selected && this.isFriendly(u.faction));
              if (selectedUnits.length > 0) {
                this.sounds.playTacticalRadio();
                selectedUnits.forEach((u, idx) => {
                  const spread = (idx - (selectedUnits.length - 1) / 2) * 22;
                  u.attackMoveTo(this.mouse.worldX + spread, this.mouse.worldY, this);
                });
                this.showEvaMessage('ORDEM DE ATTACK-MOVE CONFIRMADA');
              }
              this.attackMoveActive = false;
              this.canvas.style.cursor = 'crosshair';
              return;
            }

            if (this.patrolActive) {
              const selectedUnits = this.units.filter(u => u.selected && this.isFriendly(u.faction));
              if (selectedUnits.length > 0) {
                this.sounds.playTacticalRadio();
                selectedUnits.forEach((u, idx) => {
                  const spread = (idx - (selectedUnits.length - 1) / 2) * 22;
                  u.patrolTo(this.mouse.worldX + spread, this.mouse.worldY, this);
                });
                this.showEvaMessage('ORDEM DE PATRULHA CONFIRMADA');
              }
              this.patrolActive = false;
              this.canvas.style.cursor = 'crosshair';
              return;
            }

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

                if (clickedBuilding) {
                  this.units.forEach(u => u.selected = false);
                  this.buildings.forEach(b => b.selected = false);
                  if (this.isFriendly(clickedBuilding.faction)) {
                    clickedBuilding.selected = true;
                  }
                  this.sounds.playSelect();
                }
              }
              this.updateSelectionInspection();
            }
          }
        });

        // Clique Direito: Movimento, Ataque, Embarque em APC, Mineração ou Rally Point
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

          // Se nenhuma unidade estiver selecionada, define Rally Point na Fábrica/Quartel selecionado
          if (selectedUnits.length === 0) {
            const selectedBldg = this.buildings.find(b => b.selected && this.isFriendly(b.faction) && (b.type === 'barracks' || b.type === 'factory'));
            if (selectedBldg) {
              selectedBldg.rallyPoint = { x: this.mouse.worldX, y: this.mouse.worldY };
              this.sounds.playRallyPoint();
              this.showEvaMessage(`PONTO DE ENCONTRO DEFINIDO: ${selectedBldg.name.toUpperCase()}`);
            }
            return;
          }

          // 1. Alvo Inimigo
          const enemyTarget = this.units.find(u =>
            !this.isFriendly(u.faction) && Math.hypot(u.x - this.mouse.worldX, u.y - this.mouse.worldY) <= u.radius + 8 && (this.map.isVisible(u.x, u.y) || !this.map.shroudEnabled)
          ) || this.buildings.find(b =>
            !this.isFriendly(b.faction) && Math.abs(b.x - this.mouse.worldX) <= b.width/2 && Math.abs(b.y - this.mouse.worldY) <= b.height/2 && (this.map.isVisible(b.x, b.y) || !this.map.shroudEnabled)
          );

          if (enemyTarget) {
            if (e.shiftKey) {
              selectedUnits.forEach(u => u.queueOrder({ type: 'ATTACK', target: enemyTarget }, this));
              this.sounds.playTacticalRadio();
              this.showEvaMessage('ORDEM DE ATAQUE NA FILA (SHIFT)');
            } else {
              selectedUnits.forEach(u => u.attack(enemyTarget));
              this.sounds.playOrder();
            }
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

          // 4. Movimento tático com formação e A* Pathfinding
          this.sounds.playTacticalRadio();
          selectedUnits.forEach((u, idx) => {
            if (u.type === 'harvester' && clickedField) {
              u.targetField = clickedField;
              u.state = 'HARVESTING';
            } else {
              const spread = (idx - (selectedUnits.length - 1) / 2) * 24;
              const tx = this.mouse.worldX + spread;
              const ty = this.mouse.worldY;
              if (e.shiftKey) {
                u.queueOrder({ type: 'MOVE', x: tx, y: ty, isAttackMove: this.attackMoveActive }, this);
              } else if (this.attackMoveActive) {
                u.attackMoveTo(tx, ty, this);
              } else {
                u.moveTo(tx, ty, this);
              }
            }
          });

          if (e.shiftKey) {
            this.showEvaMessage('WAYPOINT ADICIONADO À FILA (SHIFT)');
          }
          this.attackMoveActive = false;
          this.canvas.style.cursor = 'crosshair';

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
          this.camera.zoom = newZoom;
          this.clampCamera();
        }, { passive: false });

        // Teclado: Grupos de Controle (Ctrl+1..9 e 1..9), Pan, Attack-Move, Pausa e Save/Load
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

          // Tecla A: Ativa Attack-Move quando unidades amigas estão selecionadas
          if (e.key === 'a' || e.key === 'A') {
            const selected = this.units.filter(u => u.selected && this.isFriendly(u.faction));
            if (selected.length > 0) {
              this.attackMoveActive = !this.attackMoveActive;
              this.patrolActive = false;
              this.canvas.style.cursor = this.attackMoveActive ? 'crosshair' : 'default';
              this.showEvaMessage(this.attackMoveActive ? '⚔️ ATTACK-MOVE: CLIQUE NO DESTINO' : 'ATTACK-MOVE CANCELADO');
              this.sounds.playSelect();
              return;
            }
          }

          // Tecla P: Ativa Patrulha quando unidades amigas estão selecionadas
          if (e.key === 'p' || e.key === 'P') {
            const selected = this.units.filter(u => u.selected && this.isFriendly(u.faction));
            if (selected.length > 0) {
              this.patrolActive = !this.patrolActive;
              this.attackMoveActive = false;
              this.showEvaMessage(this.patrolActive ? '🛡️ PATRULHA: CLIQUE NO PONTO DE RETORNO' : 'PATRULHA CANCELADA');
              this.sounds.playSelect();
              return;
            }
          }

          // Tecla Espaço: Pausa / Despausa partida
          if (e.key === ' ') {
            e.preventDefault();
            this.togglePause();
            return;
          }

          // F5: Salvamento Rápido
          if (e.key === 'F5') {
            e.preventDefault();
            this.quickSave();
            return;
          }

          // F9: Carregamento Rápido
          if (e.key === 'F9') {
            e.preventDefault();
            this.quickLoad();
            return;
          }

          if (e.key === 'Escape') {
            this.closePowerGridModal();
            this.sidebar.cancelPlacement(true);
            this.sidebar.activeTool = null;
            this.attackMoveActive = false;
            this.patrolActive = false;
            this.canvas.style.cursor = 'crosshair';
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

                                // Botão Abrir / Fechar Modal de Diplomacia
        const btnOpenDiplo = document.getElementById('btnOpenDiplomacy');
        const modalDiplo = document.getElementById('diplomacy-modal');
        const btnCloseDiplo = document.getElementById('btnCloseDiplomacy');

        if (btnOpenDiplo && modalDiplo) {
          btnOpenDiplo.onclick = () => {
            this.renderDiplomacyModal();
            modalDiplo.style.display = 'flex';
            this.sounds.playSelect();
          };
        }
        if (btnCloseDiplo && modalDiplo) {
          btnCloseDiplo.onclick = () => {
            modalDiplo.style.display = 'none';
          };
        }

        // Painel e Modal de Diagnóstico da Rede Elétrica & Silos
        const powerContainer = document.getElementById('power-container');
        const economyContainer = document.getElementById('economy-container');
        const btnClosePowerGrid = document.getElementById('btnClosePowerGrid');
        const modalPowerGrid = document.getElementById('power-grid-modal');

        if (powerContainer) {
          powerContainer.onclick = () => {
            this.openPowerGridModal();
            this.sounds.playSelect();
          };
        }
        if (economyContainer) {
          economyContainer.onclick = () => {
            this.openPowerGridModal();
            this.sounds.playSelect();
          };
        }
        if (btnClosePowerGrid && modalPowerGrid) {
          btnClosePowerGrid.onclick = () => {
            this.closePowerGridModal();
          };
        }

        // Alternador Rápido de Bioma de Mapa no HUD
        const btnMapSelect = document.getElementById('btnQuickMapSelect');
        if (btnMapSelect) {
          btnMapSelect.onclick = () => {
            const themes = ['wasteland', 'snow', 'volcanic', 'desert', 'urban'];
            const cur = this.currentMapTheme || 'wasteland';
            const nextIdx = (themes.indexOf(cur) + 1) % themes.length;
            this.changeMapTheme(themes[nextIdx], true);
            this.sounds.playSelect();
          };
        }

        // Painel de Comms de Vídeo WebRTC
        const btnCommsToggle = document.getElementById('btnToggleComms');
        const commsPanel = document.getElementById('tactical-comms-panel');
        const btnMinimizeComms = document.getElementById('btnMinimizeComms');
        const btnToggleCam = document.getElementById('btnToggleCam');
        const btnToggleMic = document.getElementById('btnToggleMic');

        if (btnCommsToggle && commsPanel) {
          
        // Sistema de Arrastar e Mover Janela de Videoconferência (Drag & Drop)
        const commsHeader = commsPanel ? commsPanel.querySelector('.comms-header') : null;
        if (commsPanel && commsHeader) {
          let isDraggingComms = false;
          let dragStartX = 0;
          let dragStartY = 0;
          let initialLeft = 0;
          let initialTop = 0;

          commsHeader.addEventListener('mousedown', (e) => {
            if (e.target.closest('.comms-actions') || e.target.tagName === 'BUTTON') return;

            isDraggingComms = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const rect = commsPanel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            commsPanel.style.bottom = 'auto';
            commsPanel.style.right = 'auto';
            commsPanel.style.left = initialLeft + 'px';
            commsPanel.style.top = initialTop + 'px';

            document.body.style.userSelect = 'none';
            commsHeader.style.cursor = 'grabbing';
          });

          window.addEventListener('mousemove', (e) => {
            if (!isDraggingComms) return;
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            const maxLeft = Math.max(0, window.innerWidth - commsPanel.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - commsPanel.offsetHeight);

            newLeft = Math.max(0, Math.min(maxLeft, newLeft));
            newTop = Math.max(0, Math.min(maxTop, newTop));

            commsPanel.style.left = newLeft + 'px';
            commsPanel.style.top = newTop + 'px';
          });

          window.addEventListener('mouseup', () => {
            if (isDraggingComms) {
              isDraggingComms = false;
              document.body.style.userSelect = '';
              commsHeader.style.cursor = 'grab';
            }
          });
        }

        btnCommsToggle.onclick = () => {
            commsPanel.classList.toggle('show');
            this.sounds.playSelect();
          };
        }

        if (btnMinimizeComms && commsPanel) {
          btnMinimizeComms.onclick = () => {
            commsPanel.classList.toggle('minimized');
            btnMinimizeComms.innerText = commsPanel.classList.contains('minimized') ? '🗖' : '🗕';
          };
        }

        if (btnToggleCam) {
          btnToggleCam.onclick = () => {
            if (this.multiplayer) this.multiplayer.toggleCamera();
          };
        }

        if (btnToggleMic) {
          btnToggleMic.onclick = () => {
            if (this.multiplayer) this.multiplayer.toggleMic();
          };
        }

        // Botões de Postura Militar (Unit Stances)
        const btnStanceDef = document.getElementById('btnStanceDefensive');
        const btnStanceAgg = document.getElementById('btnStanceAggressive');
        const btnStanceHold = document.getElementById('btnStanceHold');

        const setStance = (stance) => {
          const selected = this.units.filter(u => u.selected && this.isFriendly(u.faction));
          if (selected.length > 0) {
            selected.forEach(u => u.stance = stance);
            this.sounds.playOrder();
            const labels = {
              defensive: 'DEFENSIVO',
              aggressive: 'AGRESSIVO (ATTACK-MOVE)',
              hold: 'MANTER POSIÇÃO'
            };
            this.showEvaMessage(`POSTURA DAS TROPAS: ${labels[stance]}`);
            this.eva.speak(stance);
            [btnStanceDef, btnStanceAgg, btnStanceHold].forEach(b => b && b.classList.remove('active'));
            if (stance === 'defensive' && btnStanceDef) btnStanceDef.classList.add('active');
            if (stance === 'aggressive' && btnStanceAgg) btnStanceAgg.classList.add('active');
            if (stance === 'hold' && btnStanceHold) btnStanceHold.classList.add('active');
          }
        };

        if (btnStanceDef) btnStanceDef.onclick = () => setStance('defensive');
        if (btnStanceAgg) btnStanceAgg.onclick = () => setStance('aggressive');
        if (btnStanceHold) btnStanceHold.onclick = () => setStance('hold');

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

        // Controles de Velocidade de Jogo (Pausa, 1x, 2x)
        const btnSpdPause = document.getElementById('btnSpeedPause');
        const btnSpd1x = document.getElementById('btnSpeed1x');
        const btnSpd2x = document.getElementById('btnSpeed2x');
        if (btnSpdPause) btnSpdPause.onclick = () => this.togglePause();
        if (btnSpd1x) btnSpd1x.onclick = () => this.setGameSpeed(1);
        if (btnSpd2x) btnSpd2x.onclick = () => this.setGameSpeed(2);

        // Botões de QuickSave e QuickLoad
        const btnSave = document.getElementById('btnQuickSave');
        const btnLoad = document.getElementById('btnQuickLoad');
        if (btnSave) btnSave.onclick = () => this.quickSave();
        if (btnLoad) btnLoad.onclick = () => this.quickLoad();

        // Botão HUD Attack-Move
        const btnAtkMove = document.getElementById('btnHudAttackMove');
        if (btnAtkMove) {
          btnAtkMove.onclick = () => {
            const selected = this.units.filter(u => u.selected && this.isFriendly(u.faction));
            if (selected.length > 0) {
              this.attackMoveActive = !this.attackMoveActive;
              this.patrolActive = false;
              this.canvas.style.cursor = this.attackMoveActive ? 'crosshair' : 'default';
              this.showEvaMessage(this.attackMoveActive ? '⚔️ ATTACK-MOVE: CLIQUE NO DESTINO' : 'ATTACK-MOVE CANCELADO');
              this.sounds.playSelect();
            } else {
              this.showEvaMessage('SELECIONE UNIDADES PARA ATTACK-MOVE');
            }
          };
        }

        // Botão HUD Patrol
        const btnPatrol = document.getElementById('btnHudPatrol');
        if (btnPatrol) {
          btnPatrol.onclick = () => {
            const selected = this.units.filter(u => u.selected && this.isFriendly(u.faction));
            if (selected.length > 0) {
              this.patrolActive = !this.patrolActive;
              this.attackMoveActive = false;
              this.canvas.style.cursor = this.patrolActive ? 'crosshair' : 'default';
              this.showEvaMessage(this.patrolActive ? '🛡️ PATRULHA: CLIQUE NO PONTO DE RETORNO' : 'PATRULHA CANCELADA');
              this.sounds.playSelect();
            } else {
              this.showEvaMessage('SELECIONE UNIDADES PARA PATRULHAR');
            }
          };
        }
      }

      changeMapTheme(newTheme, regenerate = true) {
        this.currentMapTheme = newTheme;
        if (this.map) {
          this.map.theme = newTheme;
          if (regenerate && typeof this.map.generateWorld === 'function') {
            this.map.generateWorld();
          }
        }
        const btn = document.getElementById('btnQuickMapSelect');
        if (btn) btn.innerHTML = `🗺️ BIOMA: ${newTheme.toUpperCase()}`;
      }

      quickSave() {
        try {
          const saveData = {
            version: 1,
            time: Date.now(),
            credits: this.credits,
            creditCapacity: this.creditCapacity,
            myFaction: this.myFaction,
            victoryMode: this.victoryMode,
            currentMapTheme: this.currentMapTheme || 'wasteland',
            battleStats: this.battleStats,
            camera: { x: this.camera.x, y: this.camera.y, zoom: this.camera.zoom },
            units: this.units.map(u => ({
              x: u.x, y: u.y, type: u.type, faction: u.faction, uid: u.uid,
              hp: u.hp, maxHp: u.maxHp, angle: u.angle, rank: u.rank, kills: u.kills,
              ore: u.ore || 0, stance: u.stance
            })),
            buildings: this.buildings.map(b => ({
              x: b.x, y: b.y, type: b.type, faction: b.faction, uid: b.uid,
              hp: b.hp, maxHp: b.maxHp, isConstructing: b.isConstructing,
              constructProgress: b.constructProgress,
              rallyPoint: b.rallyPoint ? { x: b.rallyPoint.x, y: b.rallyPoint.y } : null
            })),
            slotConfigs: this.slotConfigs,
            aiCredits: this.aiCredits
          };

          localStorage.setItem('tiberian_assault_quicksave', JSON.stringify(saveData));
          this.sounds.playSaveLoadChime(true);
          this.eva.speak('Game saved.');
          this.showEvaMessage('💾 PARTIDA SALVA NO LOCALSTORAGE (F5)');
        } catch (err) {
          console.error('Erro ao salvar partida:', err);
        }
      }

      quickLoad() {
        try {
          const raw = localStorage.getItem('tiberian_assault_quicksave');
          if (!raw) {
            this.showEvaMessage('NENHUM SALVAMENTO ENCONTRADO');
            return;
          }
          const data = JSON.parse(raw);

          this.credits = data.credits;
          this.creditCapacity = data.creditCapacity;
          this.myFaction = data.myFaction;
          this.victoryMode = data.victoryMode;
          this.battleStats = data.battleStats;
          this.slotConfigs = data.slotConfigs || this.slotConfigs;
          this.aiCredits = data.aiCredits || { slot2: 3000, slot3: 3000, slot4: 3000 };

          if (data.currentMapTheme && data.currentMapTheme !== this.currentMapTheme) {
            this.changeMapTheme(data.currentMapTheme, false);
          }

          // Limpa e reconstitui prédios
          this.buildings = [];
          data.buildings.forEach(bd => {
            const b = new Building(bd.x, bd.y, bd.type, bd.faction, bd.isConstructing, bd.uid);
            b.hp = bd.hp;
            b.maxHp = bd.maxHp;
            b.constructProgress = bd.constructProgress;
            if (bd.rallyPoint) b.rallyPoint = bd.rallyPoint;
            this.buildings.push(b);
            if (this.map) this.map.registerBuilding(b);
          });

          // Limpa e reconstitui unidades
          this.units = [];
          data.units.forEach(ud => {
            const u = new Unit(ud.x, ud.y, ud.type, ud.faction, ud.uid);
            u.hp = ud.hp;
            u.maxHp = ud.maxHp;
            u.angle = ud.angle;
            u.rank = ud.rank;
            u.kills = ud.kills;
            if (ud.ore) u.ore = ud.ore;
            if (ud.stance) u.stance = ud.stance;
            this.units.push(u);
          });

          this.projectiles = [];
          this.activeIonStrike = null;
          this.activeNukeStrike = null;

          if (data.camera) {
            this.camera.x = data.camera.x;
            this.camera.y = data.camera.y;
            this.camera.zoom = data.camera.zoom;
            this.clampCamera();
          }

          this.recalculatePower();
          this.updateEconomyDisplay();
          this.updateSelectionInspection();

          this.sounds.playSaveLoadChime(false);
          this.eva.speak('Game loaded.');
          this.showEvaMessage('📂 PARTIDA CARREGADA COM SUCESSO (F9)');
        } catch (err) {
          console.error('Erro ao carregar partida:', err);
        }
      }

      togglePause() {
        this.gameSpeed = this.gameSpeed === 0 ? 1 : 0;
        this.updateSpeedUI();
        const msg = this.gameSpeed === 0 ? '⏸ SIMULAÇÃO PAUSADA' : '▶ SIMULAÇÃO RETOMADA (1X)';
        this.showEvaMessage(msg);
      }

      setGameSpeed(speed) {
        this.gameSpeed = speed;
        this.updateSpeedUI();
        const label = speed === 0 ? 'PAUSADO' : (speed === 2 ? '2X (RÁPIDO)' : '1X (NORMAL)');
        this.showEvaMessage(`VELOCIDADE: ${label}`);
      }

      updateSpeedUI() {
        const btnPause = document.getElementById('btnSpeedPause');
        const btn1x = document.getElementById('btnSpeed1x');
        const btn2x = document.getElementById('btnSpeed2x');
        [btnPause, btn1x, btn2x].forEach(b => b && b.classList.remove('active'));
        if (this.gameSpeed === 0 && btnPause) btnPause.classList.add('active');
        else if (this.gameSpeed === 1 && btn1x) btn1x.classList.add('active');
        else if (this.gameSpeed === 2 && btn2x) btn2x.classList.add('active');
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

        if (this.map) {
          this.map.unregisterBuilding(b);
          this.map.addBuildingRubble(b.x, b.y, b.width, b.height);
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

      getPowerGridBreakdown(faction = 'player') {
        const friendlyBuildings = this.buildings.filter(b => this.isFriendly(b.faction) && b.hp > 0 && !b.isConstructing);

        let totalProduced = 0;
        let totalConsumed = 0;
        let siloCount = 0;

        const producers = [];
        const consumers = [];
        const prodMap = new Map();
        const consMap = new Map();

        friendlyBuildings.forEach(b => {
          if (b.powerGen > 0) {
            const isDamaged = (b.type === 'power' && b.hp < b.maxHp * 0.5);
            const actualGen = isDamaged ? Math.floor(b.powerGen * 0.5) : b.powerGen;
            totalProduced += actualGen;

            const key = b.type;
            if (!prodMap.has(key)) {
              prodMap.set(key, {
                type: b.type,
                name: b.name,
                count: 0,
                baseGen: b.powerGen,
                actualTotal: 0,
                damagedCount: 0
              });
            }
            const item = prodMap.get(key);
            item.count++;
            item.actualTotal += actualGen;
            if (isDamaged) item.damagedCount++;
          }

          if (b.powerCons > 0) {
            totalConsumed += b.powerCons;
            const key = b.type;
            if (!consMap.has(key)) {
              consMap.set(key, {
                type: b.type,
                name: b.name,
                count: 0,
                eachCons: b.powerCons,
                totalCons: 0
              });
            }
            const item = consMap.get(key);
            item.count++;
            item.totalCons += b.powerCons;
          }

          if (b.type === 'silo') {
            siloCount++;
          }
        });

        prodMap.forEach(v => producers.push(v));
        consMap.forEach(v => consumers.push(v));

        const baseCap = 3500;
        const siloCap = siloCount * 3000;
        const totalCap = baseCap + siloCap;
        const credits = Math.floor(this.credits);
        const fillRatio = totalCap > 0 ? (credits / totalCap) : 0;
        const fillPct = Math.round(fillRatio * 100);
        const isOverflow = credits >= totalCap;

        return {
          totalProduced,
          totalConsumed,
          surplus: totalProduced - totalConsumed,
          isCritical: totalConsumed > totalProduced,
          efficiency: totalProduced > 0 ? Math.min(1.0, totalProduced / Math.max(1, totalConsumed)) : 0,
          producers,
          consumers,
          silos: {
            count: siloCount,
            baseCapacity: baseCap,
            siloCapacity: siloCap,
            totalCapacity: totalCap,
            credits,
            fillRatio,
            fillPct,
            isOverflow
          }
        };
      }

      openPowerGridModal() {
        const modal = document.getElementById('power-grid-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        this.renderPowerGridModal();
      }

      closePowerGridModal() {
        const modal = document.getElementById('power-grid-modal');
        if (modal) modal.style.display = 'none';
      }

      renderPowerGridModal() {
        const modal = document.getElementById('power-grid-modal');
        if (!modal || modal.style.display === 'none') return;

        const data = this.getPowerGridBreakdown();

        const banner = document.getElementById('pwr-modal-summary-banner');
        if (banner) {
          banner.className = `pwr-summary-banner ${data.isCritical ? 'critical' : 'stable'}`;
          const diffText = data.surplus >= 0 ? `+${data.surplus} GW (EXCEDENTE)` : `${data.surplus} GW (DÉFICIT)`;
          const statusDesc = data.isCritical
            ? 'SOBRECARGA ELÉTRICA: Velocidade de treino e recarga de defesas reduzidas em 50%!'
            : 'REDE ESTABILIZADA: Todas as fábricas, radares e defesas operando com 100% de eficiência.';
          banner.innerHTML = `
            <div class="pwr-summary-main">
              <span class="pwr-summary-title" style="color: ${data.isCritical ? '#ff3344' : '#00ff66'}">
                ${data.isCritical ? '⚠️ ALERTA DE REDE: DÉFICIT ENERGÉTICO' : '⚡ STATUS DA REDE: ENERGIZADA & ESTÁVEL'}
              </span>
              <span class="pwr-summary-desc">${statusDesc}</span>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; color: #8da4ba; font-family: var(--font-tech);">BALANÇO LÍQUIDO</div>
              <div style="font-size: 16px; font-weight: 900; font-family: var(--font-tech); color: ${data.isCritical ? '#ff3344' : '#00ff66'}">${diffText}</div>
            </div>
          `;
        }

        const badgeProduced = document.getElementById('pwr-total-produced-badge');
        const badgeConsumed = document.getElementById('pwr-total-consumed-badge');
        if (badgeProduced) badgeProduced.innerText = `+${data.totalProduced} GW`;
        if (badgeConsumed) badgeConsumed.innerText = `-${data.totalConsumed} GW`;

        const prodList = document.getElementById('pwr-producers-list');
        if (prodList) {
          if (data.producers.length === 0) {
            prodList.innerHTML = '<div class="pwr-item-row" style="color: #8da4ba;">Nenhuma fonte geradora ativa!</div>';
          } else {
            prodList.innerHTML = data.producers.map(p => {
              const damagedBadge = p.damagedCount > 0 ? `<span style="color:#ffaa00; font-size:10px;">(${p.damagedCount} avariada(s): 50% pot.)</span>` : '';
              return `
                <div class="pwr-item-row">
                  <div class="pwr-item-name">
                    <span>⚡</span>
                    <span><strong>${p.count}x</strong> ${p.name} ${damagedBadge}</span>
                  </div>
                  <div class="pwr-item-val gain">+${p.actualTotal} GW</div>
                </div>
              `;
            }).join('');
          }
        }

        const consList = document.getElementById('pwr-consumers-list');
        if (consList) {
          if (data.consumers.length === 0) {
            consList.innerHTML = '<div class="pwr-item-row" style="color: #8da4ba;">Nenhuma estrutura consumidora ativa.</div>';
          } else {
            consList.innerHTML = data.consumers.map(c => `
              <div class="pwr-item-row">
                <div class="pwr-item-name">
                  <span>🔌</span>
                  <span><strong>${c.count}x</strong> ${c.name} <span style="color:#6a8096; font-size:10px;">(-${c.eachCons} GW cada)</span></span>
                </div>
                <div class="pwr-item-val drain">-${c.totalCons} GW</div>
              </div>
            `).join('');
          }
        }

        const siloStatusBadge = document.getElementById('pwr-silo-status-badge');
        const siloModalFill = document.getElementById('pwr-silo-modal-fill');
        const siloCredits = document.getElementById('pwr-silo-credits-stored');
        const siloCapacity = document.getElementById('pwr-silo-capacity-total');
        const siloPct = document.getElementById('pwr-silo-pct');
        const siloAlert = document.getElementById('pwr-silo-overflow-alert');

        const { silos } = data;
        if (siloStatusBadge) {
          siloStatusBadge.className = `silo-status-tag ${silos.isOverflow ? 'overflow' : ''}`;
          siloStatusBadge.innerText = `${silos.count} SILO(S) ATIVO(S) - ${silos.fillPct}%`;
        }
        if (siloModalFill) {
          siloModalFill.style.width = `${Math.min(100, silos.fillPct)}%`;
          siloModalFill.className = `pwr-silo-bar-fill ${silos.fillPct >= 95 ? 'overflow' : (silos.fillPct >= 80 ? 'warning' : '')}`;
        }
        if (siloCredits) siloCredits.innerText = `ARMAZENADO: $ ${silos.credits.toLocaleString('en-US')}`;
        if (siloCapacity) siloCapacity.innerText = `CAPACIDADE MÁXIMA: $ ${silos.totalCapacity.toLocaleString('en-US')} (HQ $3.500 + Silos $${silos.siloCapacity.toLocaleString('en-US')})`;
        if (siloPct) siloPct.innerText = `LOTAÇÃO: ${silos.fillPct}%`;

        if (siloAlert) {
          if (silos.isOverflow) {
            siloAlert.className = 'pwr-alert-box overflow';
            siloAlert.innerHTML = `⚠️ <strong>ALERTA DE CAPACIDADE MÁXIMA:</strong> Seus silos e HQ estão com capacidade total atingida! Construa mais <strong>Silos de Tiberium</strong> na aba de Estruturas para evitar perda de recursos coletados.`;
          } else if (silos.fillPct >= 80) {
            siloAlert.className = 'pwr-alert-box overflow';
            siloAlert.innerHTML = `⚠️ <strong>AVISO DE ARMAZENAMENTO:</strong> 80%+ da capacidade atingida. Considere construir Silos de Tiberium adicionais.`;
          } else {
            siloAlert.className = 'pwr-alert-box ok';
            const freeCredits = Math.max(0, silos.totalCapacity - silos.credits);
            siloAlert.innerHTML = `✅ <strong>CAPACIDADE ESTÁVEL:</strong> Há espaço livre para mais <strong>$ ${freeCredits.toLocaleString('en-US')} créditos</strong> em Tiberium líquido nos tanques.`;
          }
        }
      }

      recalculatePower() {
        const breakdown = this.getPowerGridBreakdown();
        const produced = breakdown.totalProduced;
        const consumed = breakdown.totalConsumed;
        const siloCount = breakdown.silos.count;

        this.creditCapacity = breakdown.silos.totalCapacity;
        this.powerProduced = produced;
        this.powerConsumed = consumed;

        const powerBar = document.getElementById('power-bar-fill');
        const powerNeedle = document.getElementById('power-needle');
        const powerDisplay = document.getElementById('powerDisplay');
        const baseStatus = document.getElementById('hud-base-status');
        const sustainingSubtext = document.getElementById('power-sustaining-subtext');
        const powerGridTag = document.getElementById('power-grid-summary-tag');
        const siloBadge = document.getElementById('silo-summary-badge');
        const siloBar = document.getElementById('silo-meter-fill');

        if (powerDisplay) powerDisplay.innerText = `${produced} / ${consumed} GW`;

        const ratio = produced > 0 ? (consumed / produced) : 1;
        const fillHeight = Math.max(10, Math.min(100, (produced / 200) * 100));
        const needlePos = Math.max(5, Math.min(95, ratio * 100));

        if (powerBar) powerBar.style.height = `${fillHeight}%`;
        if (powerNeedle) powerNeedle.style.bottom = `${needlePos}%`;

        if (baseStatus) {
          if (consumed > produced) {
            baseStatus.innerText = `ENERGIA CRÍTICA (-${consumed - produced} GW)`;
            baseStatus.style.color = '#ff3344';
          } else {
            baseStatus.innerText = `ENERGIZADA (100% | +${produced - consumed} GW)`;
            baseStatus.style.color = '#00ff66';
          }
        }

        if (sustainingSubtext) {
          if (breakdown.consumers.length === 0) {
            sustainingSubtext.innerText = `Sustentando: Base em Espera (+${produced} GW livre)`;
          } else {
            const listStr = breakdown.consumers.map(c => `${c.count}x ${c.name.split(' ')[0]}`).join(', ');
            const diffStr = breakdown.surplus >= 0 ? `+${breakdown.surplus} GW livre` : `Déficit: ${breakdown.surplus} GW!`;
            sustainingSubtext.innerText = `Sustentando: ${listStr} (${diffStr})`;
          }
        }

        if (powerGridTag) {
          if (breakdown.isCritical) {
            powerGridTag.className = 'pwr-grid-tag critical';
            powerGridTag.innerText = `SOBRECARGA`;
          } else {
            powerGridTag.className = 'pwr-grid-tag';
            powerGridTag.innerText = `REDE 100%`;
          }
        }

        const fillPct = breakdown.silos.fillPct;
        if (siloBadge) {
          siloBadge.className = `silo-badge ${breakdown.silos.isOverflow ? 'overflow' : ''}`;
          siloBadge.innerText = `${siloCount} SILO(S) (${fillPct}%)`;
        }
        if (siloBar) {
          siloBar.style.width = `${Math.min(100, fillPct)}%`;
          if (breakdown.silos.isOverflow) {
            siloBar.style.background = '#ff3344';
          } else if (fillPct >= 80) {
            siloBar.style.background = '#ffaa00';
          } else {
            siloBar.style.background = 'var(--tiberium)';
          }
        }

        this.renderPowerGridModal();
      }

      updateEconomyDisplay() {
        const creditDisplay = document.getElementById('creditDisplay');
        if (creditDisplay) {
          creditDisplay.innerText = `$ ${Math.floor(this.credits).toLocaleString('en-US')} / $ ${this.creditCapacity.toLocaleString('en-US')}`;
          creditDisplay.classList.add('flash');
          setTimeout(() => creditDisplay.classList.remove('flash'), 300);
        }

        const siloBadge = document.getElementById('silo-summary-badge');
        const siloBar = document.getElementById('silo-meter-fill');
        const fillRatio = this.creditCapacity > 0 ? (this.credits / this.creditCapacity) : 0;
        const fillPct = Math.round(fillRatio * 100);
        const isOverflow = this.credits >= this.creditCapacity;

        if (siloBadge) {
          const siloCount = this.buildings.filter(b => this.isFriendly(b.faction) && b.type === 'silo' && b.hp > 0 && !b.isConstructing).length;
          siloBadge.className = `silo-badge ${isOverflow ? 'overflow' : ''}`;
          siloBadge.innerText = `${siloCount} SILO(S) (${fillPct}%)`;
        }
        if (siloBar) {
          siloBar.style.width = `${Math.min(100, fillPct)}%`;
          if (isOverflow) {
            siloBar.style.background = '#ff3344';
          } else if (fillPct >= 80) {
            siloBar.style.background = '#ffaa00';
          } else {
            siloBar.style.background = 'var(--tiberium)';
          }
        }

        this.renderPowerGridModal();
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
        const isHostOrSolo = (!this.multiplayer || !this.multiplayer.connected || this.multiplayer.isHost);
        if (!isHostOrSolo) return;

        if (!this.aiCredits || typeof this.aiCredits !== 'object') {
          this.aiCredits = { slot2: 3000, slot3: 3000, slot4: 3000 };
        }
        if (!this.aiBuildTimers || typeof this.aiBuildTimers !== 'object') {
          this.aiBuildTimers = { slot2: 0, slot3: 0, slot4: 0 };
        }

        ['slot2', 'slot3', 'slot4'].forEach(slot => {
          const cfg = this.slotConfigs[slot];
          if (!cfg || !cfg.startsWith('ai_')) return;

          // Renda econômica passiva + mineração de colhedoras do bot
          const botHarvesters = this.units.filter(u => u.faction === slot && u.type === 'harvester' && u.hp > 0);
          const incomeRate = (cfg === 'ai_brutal' ? 45 : (cfg === 'ai_medium' ? 30 : 18)) + (botHarvesters.length * 20);
          this.aiCredits[slot] = Math.min(10000, (this.aiCredits[slot] || 0) + incomeRate * dt);

          // 1. GESTÃO ESTRATÉGICA DE INFRAESTRUTURA (CONSTRUÇÃO / RECONSTRUÇÃO)
          this.aiBuildTimers[slot] = (this.aiBuildTimers[slot] || 0) + dt;
          if (this.aiBuildTimers[slot] >= (cfg === 'ai_brutal' ? 10 : 16)) {
            this.aiBuildTimers[slot] = 0;

            const botBuildings = this.buildings.filter(b => b.faction === slot && b.hp > 0);
            const hq = botBuildings.find(b => b.type === 'hq');
            const pwr = botBuildings.find(b => b.type === 'power');
            const ref = botBuildings.find(b => b.type === 'refinery');
            const bar = botBuildings.find(b => b.type === 'barracks');
            const fac = botBuildings.find(b => b.type === 'factory');
            const turrets = botBuildings.filter(b => b.type === 'turret' || b.type === 'obelisk');

            const baseAnchor = hq || fac || ref || botBuildings[0];

            if (baseAnchor) {
              // A) Prioridade 1: Reconstruir Usina se sem energia ou sem usina
              if (!pwr && this.aiCredits[slot] >= 300) {
                this.aiCredits[slot] -= 300;
                const nb = new Building(baseAnchor.x - 110, baseAnchor.y - 40, 'power', slot, true);
                this.buildings.push(nb);
                if (this.map) this.map.registerBuilding(nb);
              }
              // B) Prioridade 2: Reconstruir Refinaria se destruída
              else if (!ref && this.aiCredits[slot] >= 800) {
                this.aiCredits[slot] -= 800;
                const nb = new Building(baseAnchor.x - 80, baseAnchor.y + 110, 'refinery', slot, true);
                this.buildings.push(nb);
                if (this.map) this.map.registerBuilding(nb);
              }
              // C) Prioridade 3: Reconstruir Fábrica de Guerra se destruída
              else if (!fac && this.aiCredits[slot] >= 1000) {
                this.aiCredits[slot] -= 1000;
                const nb = new Building(baseAnchor.x + 100, baseAnchor.y + 90, 'factory', slot, true);
                this.buildings.push(nb);
                if (this.map) this.map.registerBuilding(nb);
              }
              // D) Prioridade 4: Reconstruir Quartel se destruído
              else if (!bar && this.aiCredits[slot] >= 400) {
                this.aiCredits[slot] -= 400;
                const nb = new Building(baseAnchor.x, baseAnchor.y + 120, 'barracks', slot, true);
                this.buildings.push(nb);
                if (this.map) this.map.registerBuilding(nb);
              }
              // E) Prioridade 5: Fortificação Perimetral (Torres Tesla ou Obelisco NOD)
              else if (turrets.length < (cfg === 'ai_brutal' ? 4 : 2) && this.aiCredits[slot] >= 600) {
                this.aiCredits[slot] -= 500;
                const offsetAngle = turrets.length * (Math.PI / 2);
                const tx = baseAnchor.x + Math.cos(offsetAngle) * 160;
                const ty = baseAnchor.y + Math.sin(offsetAngle) * 160;
                const bType = (cfg === 'ai_brutal' && Math.random() > 0.5) ? 'obelisk' : 'turret';
                const nb = new Building(tx, ty, bType, slot, true);
                this.buildings.push(nb);
                if (this.map) this.map.registerBuilding(nb);
              }
            }
          }

          // 2. GESTÃO DE COLHEDORAS (Reposição Econômica Vital)
          if (botHarvesters.length === 0) {
            const fac = this.buildings.find(b => b.type === 'factory' && b.faction === slot && b.hp > 0 && !b.isConstructing);
            if (fac && this.aiCredits[slot] >= 800) {
              this.aiCredits[slot] -= 800;
              const newHarv = new Unit(fac.spawnX, fac.spawnY, 'harvester', slot);
              this.units.push(newHarv);
            }
          }

          // 3. TREINAMENTO DE TROPAS E ATAQUES DE PELOTÃO
          let buildInterval = 18;
          let squadThreshold = 4;
          if (cfg === 'ai_easy') { buildInterval = 30; squadThreshold = 3; }
          if (cfg === 'ai_brutal') { buildInterval = 9; squadThreshold = 6; }

          this.aiTimers[slot] = (this.aiTimers[slot] || 0) + dt;
          if (this.aiTimers[slot] >= buildInterval) {
            this.aiTimers[slot] = 0;

            const fac = this.buildings.find(b => b.type === 'factory' && b.faction === slot && b.hp > 0 && !b.isConstructing);
            const bar = this.buildings.find(b => b.type === 'barracks' && b.faction === slot && b.hp > 0 && !b.isConstructing);

            if (fac && this.aiCredits[slot] >= 400) {
              const types = cfg === 'ai_brutal' ? ['tank', 'mammoth', 'rocket', 'helicopter'] : ['tank', 'rocket', 'rifleman'];
              const chosen = types[Math.floor(Math.random() * types.length)];
              this.aiCredits[slot] -= 400;
              const newBotUnit = new Unit(fac.spawnX, fac.spawnY, chosen, slot);
              if (fac.rallyPoint) {
                newBotUnit.moveTo(fac.rallyPoint.x, fac.rallyPoint.y, this);
              }
              this.units.push(newBotUnit);
            } else if (bar && this.aiCredits[slot] >= 150) {
              this.aiCredits[slot] -= 150;
              const chosen = Math.random() > 0.4 ? 'rifleman' : 'rocket';
              const newBotUnit = new Unit(bar.spawnX, bar.spawnY, chosen, slot);
              if (bar.rallyPoint) {
                newBotUnit.moveTo(bar.rallyPoint.x, bar.rallyPoint.y, this);
              }
              this.units.push(newBotUnit);
            }

            // Pelotão formado ataca inimigos
            const squad = this.units.filter(u => u.faction === slot && u.type !== 'harvester' && u.hp > 0);
            if (squad.length >= squadThreshold) {
              const enemyBuildings = this.buildings.filter(b => b.hp > 0 && this.areEnemies(b.faction, slot));
              const enemyUnits = this.units.filter(u => u.hp > 0 && this.areEnemies(u.faction, slot) && u.type !== 'harvester');

              let oppTarget = null;
              const retaliateSlot = this.aiRetaliationTarget && this.aiRetaliationTarget[slot];
              if (retaliateSlot && this.areEnemies(retaliateSlot, slot)) {
                oppTarget = enemyBuildings.find(b => b.faction === retaliateSlot) ||
                            enemyUnits.find(u => u.faction === retaliateSlot);
              }

              if (!oppTarget && (enemyBuildings.length > 0 || enemyUnits.length > 0)) {
                const facObj = this.buildings.find(b => b.type === 'factory' && b.faction === slot);
                const basePos = facObj ? { x: facObj.x, y: facObj.y } : (squad[0] ? { x: squad[0].x, y: squad[0].y } : { x: 1200, y: 900 });
                let bestScore = Infinity;

                [...enemyBuildings, ...enemyUnits].forEach(ent => {
                  const dist = Math.hypot(ent.x - basePos.x, ent.y - basePos.y);
                  const priorityBonus = ent.type === 'hq' ? -150 : (ent.type === 'factory' ? -80 : 0);
                  const score = dist + priorityBonus + (Math.random() * 250);
                  if (score < bestScore) {
                    bestScore = score;
                    oppTarget = ent;
                  }
                });
              }

              if (oppTarget) {
                squad.forEach(u => u.attack(oppTarget));
                if (this.areAllied(oppTarget.faction, this.myFaction)) {
                  this.eva.speak('Our base is under attack.', 14000);
                  this.showEvaMessage(`ALERTA: FORÇAS DE ${slot.toUpperCase()} ATACANDO ALIANÇA ALIADA!`);
                  this.sounds.playEvaChime('alert');
                  if (this.map) this.map.addRadarPing(oppTarget.x, oppTarget.y, '#ff3344', 4.0);
                }
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
        if (!radarCanvas) return;
        const rctx = radarCanvas.getContext('2d');
        const rw = radarCanvas.width, rh = radarCanvas.height;

        // Fundo base
        rctx.fillStyle = '#060a0e';
        rctx.fillRect(0, 0, rw, rh);

        const sx = rw / this.map.width;
        const sy = rh / this.map.height;

        // Renderiza o terreno real no radar minimap!
        if (this.map && this.map.terrainCanvas) {
          rctx.drawImage(this.map.terrainCanvas, 0, 0, rw, rh);
        }

        // Shroud no radar (sombra escura para áreas inexploradas)
        if (this.map && this.map.shroudEnabled && this.map.shroud) {
          rctx.fillStyle = 'rgba(6, 10, 16, 0.72)';
          const cellW = rw / this.map.cols;
          const cellH = rh / this.map.rows;
          for (let r = 0; r < this.map.rows; r += 2) {
            for (let c = 0; c < this.map.cols; c += 2) {
              if (this.map.shroud[r * this.map.cols + c] === 0) {
                rctx.fillRect(c * cellW, r * cellH, cellW * 2, cellH * 2);
              }
            }
          }
        }

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

        // Pings de Alerta Tático no Radar
        if (this.map && this.map.radarPings && this.map.radarPings.length > 0) {
          this.map.radarPings.forEach(ping => {
            rctx.save();
            rctx.strokeStyle = ping.color || '#ff3344';
            rctx.lineWidth = 1.8;
            rctx.beginPath();
            rctx.arc(ping.x * sx, ping.y * sy, Math.max(3, ping.radius * sx), 0, Math.PI * 2);
            rctx.stroke();
            rctx.restore();
          });
        }

        const viewW = (this.canvas.width / this.camera.zoom) * sx;
        const viewH = (this.canvas.height / this.camera.zoom) * sy;
        rctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        rctx.lineWidth = 1;
        rctx.strokeRect(this.camera.x * sx, this.camera.y * sy, viewW, viewH);
      }

      gameLoop(time) {
        const rawDt = Math.min(0.1, (time - this.lastTime) / 1000);
        this.lastTime = time;

        if (this.map && this.map.updateRadarPings) {
          this.map.updateRadarPings(rawDt);
        }

        // Se pausado (gameSpeed === 0), desenha o frame mas interrompe simulação
        if (this.gameSpeed === 0) {
          this.render();
          requestAnimationFrame((t) => this.gameLoop(t));
          return;
        }

        const dt = rawDt * this.gameSpeed;

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
            if (this.isFriendly(b.faction)) {
              this.eva.speak('Our base is under attack.', 12000);
              if (this.map) this.map.addRadarPing(b.x, b.y, '#ff3344', 4.5);
            } else {
              this.battleStats.structuresDestroyed++;
            }
            if (this.map) {
              this.map.unregisterBuilding(b);
              this.map.addBuildingRubble(b.x, b.y, b.width, b.height);
            }
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
              if (u.type === 'harvester') {
                this.eva.speak('Harvester under attack.', 10000);
                if (this.map) this.map.addRadarPing(u.x, u.y, '#ff3344', 4.5);
              } else {
                this.eva.speak('Unit lost.', 8000);
              }
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