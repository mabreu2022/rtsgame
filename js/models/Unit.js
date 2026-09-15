import { rotateTowards, normalizeAngle } from '../utils/MathUtils.js';
import { Projectile } from './Projectile.js';

export class Unit {
      constructor(x, y, type = 'tank', faction = 'player', uid = null) {
        this.uid = uid || (`${faction}_u_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`);
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.type = type;
        this.faction = faction;
        this.selected = false;

        this.angle = 0;
        this.turretAngle = 0;
        this.recoil = 0;
        this.state = 'IDLE';

        this.isAir = false;
        this.altitude = 0;
        this.isInfantry = false;
        this.passengers = [];

        // Sistema de Veterania
        this.kills = 0;
        this.rank = 0; // 0 = Recruta, 1 = Veterano, 2 = Elite

        if (type === 'rifleman') {
          this.name = 'Soldado Fuzileiro';
          this.isInfantry = true;
          this.radius = 8; this.speed = 60; this.turnSpeed = 6.0;
          this.hp = 75; this.range = 140; this.attackDamage = 10;
          this.cooldown = 0; this.maxCooldown = 0.55;
        } else if (type === 'rocket') {
          this.name = 'Lança-Foguetes';
          this.isInfantry = true;
          this.radius = 9; this.speed = 52; this.turnSpeed = 5.0;
          this.hp = 95; this.range = 190; this.attackDamage = 45;
          this.cooldown = 0; this.maxCooldown = 1.8;
        } else if (type === 'engineer') {
          this.name = 'Engenheiro Militar';
          this.isInfantry = true;
          this.radius = 8; this.speed = 55; this.turnSpeed = 5.0;
          this.hp = 65; this.range = 40;
        } else if (type === 'commando') {
          this.name = 'Comando de Elite';
          this.isInfantry = true;
          this.radius = 9; this.speed = 68; this.turnSpeed = 6.0;
          this.hp = 180; this.range = 170; this.attackDamage = 65;
          this.cooldown = 0; this.maxCooldown = 0.9;
        } else if (type === 'tank') {
          this.name = 'Tanque Médio M1';
          this.radius = 16; this.speed = 70; this.turnSpeed = 3.2; this.turretTurnSpeed = 4.5;
          this.hp = 260; this.range = 160; this.attackDamage = 35;
          this.cooldown = 0; this.maxCooldown = 1.1;
        } else if (type === 'mammoth') {
          this.name = 'Tanque Mamute Pesado';
          this.radius = 22; this.speed = 46; this.turnSpeed = 2.0; this.turretTurnSpeed = 3.0;
          this.hp = 680; this.range = 190; this.attackDamage = 75;
          this.cooldown = 0; this.maxCooldown = 1.6;
        } else if (type === 'apc') {
          this.name = 'Transporte APC Blindado';
          this.radius = 18; this.speed = 76; this.turnSpeed = 3.4;
          this.hp = 380; this.range = 130; this.attackDamage = 16;
          this.cooldown = 0; this.maxCooldown = 0.45;
          this.maxPassengers = 5;
        } else if (type === 'transport_helo') {
          this.name = 'Helicóptero de Transporte (Chinook)';
          this.isAir = true; this.altitude = 42; this.radius = 24;
          this.speed = 95; this.turnSpeed = 3.2;
          this.hp = 360; this.range = 0;
          this.maxPassengers = 6;
          this.rotorAngle = 0;
          this.rotorAngle2 = 0;
        } else if (type === 'helicopter') {
          this.name = 'Helicóptero Orca';
          this.isAir = true; this.altitude = 38; this.radius = 18;
          this.speed = 105; this.turnSpeed = 3.8;
          this.hp = 230; this.range = 180; this.attackDamage = 38;
          this.cooldown = 0; this.maxCooldown = 1.2;
          this.rotorAngle = 0;
        } else if (type === 'jet') {
          this.name = 'Caça a Jato de Ataque';
          this.isAir = true; this.altitude = 55; this.radius = 20;
          this.speed = 150; this.turnSpeed = 2.6;
          this.hp = 280; this.range = 220; this.attackDamage = 60;
          this.cooldown = 0; this.maxCooldown = 1.4;
        } else if (type === 'harvester') {
          this.name = 'Colhedora de Tiberium';
          this.radius = 20; this.speed = 52; this.turnSpeed = 2.4;
          this.hp = 480; this.range = 35;
          this.ore = 0; this.maxOre = 100;
          this.targetField = null; this.targetRefinery = null;
          this.harvestTimer = 0; this.drillRot = 0;
        }

        this.maxHp = this.hp;
        this.targetEnemy = null;
        this.targetBuilding = null;
        this.controlGroup = null;
        this.stance = "defensive";
        this.treadTrackDist = 0;
        this.walkCycle = Math.random() * Math.PI * 2;
        this.idleBreath = Math.random() * Math.PI * 2;
        this.tiberiumRadiationTimer = 0;
      }

      addKill() {
        this.kills++;
        if (this.kills >= 5 && this.rank < 2) {
          this.rank = 2; // Elite
          this.maxHp = Math.floor(this.maxHp * 1.35);
          this.hp = this.maxHp;
          this.attackDamage = Math.floor(this.attackDamage * 1.3);
        } else if (this.kills >= 2 && this.rank < 1) {
          this.rank = 1; // Veterano
          this.speed *= 1.15;
          this.maxCooldown *= 0.8;
        }
      }

      moveTo(x, y) {
        this.targetX = x;
        this.targetY = y;
        this.targetEnemy = null;
        if (this.type === 'harvester' && this.state !== 'RETURNING' && this.state !== 'UNLOADING') {
          this.state = 'MOVING';
        } else if (this.type !== 'harvester') {
          this.state = 'MOVING';
        }
      }

      attack(target) {
        if (this.type === 'engineer') {
          this.targetBuilding = target;
          this.targetEnemy = null;
          this.moveTo(target.x, target.y);
          return;
        }
        this.targetEnemy = target;
        this.state = 'ATTACKING';
      }

      update(dt, engine) {
        if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 25);
        if (this.isAir && this.type === 'transport_helo') {
          this.rotorAngle += dt * 38;
          this.rotorAngle2 -= dt * 38;
        }
        if (this.isAir && this.type === 'helicopter') this.rotorAngle += dt * 35;
        if (this.isAir && this.type === 'jet' && Math.random() > 0.3) {
          engine.particles.createJetTrail(this.x - Math.cos(this.angle) * 16, this.y - Math.sin(this.angle) * 16);
        }

        // Regeneração passiva no nível Elite (Rank 2)
        if (this.rank === 2 && this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + dt * 2.5);
        }

        // Toxicidade do Tiberium em Infantaria a pé
        if (this.isInfantry) {
          this.idleBreath = (this.idleBreath || 0) + dt * 2.8;
          if (this.state !== 'MOVING') {
            this.walkCycle = rotateTowards(this.walkCycle, Math.round(this.walkCycle / (Math.PI * 2)) * (Math.PI * 2), dt * 8);
          }
          this.tiberiumRadiationTimer += dt;
          if (this.tiberiumRadiationTimer > 0.4) {
            this.tiberiumRadiationTimer = 0;
            const onTiberium = engine.map.tiberiumFields.some(f =>
              Math.hypot(f.x - this.x, f.y - this.y) < 80
            );
            if (onTiberium) {
              this.hp -= 4;
              engine.particles.createToxicCloud(this.x, this.y);
            }
          }
        }

        // Esmagamento de Infantaria Inimiga por Veículos Pesados (Tank Crushing)
        if (!this.isInfantry && !this.isAir && this.state === 'MOVING') {
          engine.units.forEach(other => {
            if (other.isInfantry && other.faction !== this.faction && other.hp > 0) {
              if (Math.hypot(other.x - this.x, other.y - this.y) < this.radius + other.radius) {
                other.hp = 0;
                engine.sounds.playSquish();
                engine.particles.createExplosion(other.x, other.y, 0.3);
                engine.map.addScorchMark(other.x, other.y, 14);
                this.addKill();
                if (this.faction === 'player' || this.faction === 'slot1') engine.showEvaMessage('INVASOR ESMAGADO');
              }
            }
          });
        }

        // Lógica de Engenheiro Militar (Captura e Reparo de Estruturas)
        if (this.type === 'engineer') {
          if (this.state === 'MOVING') {
            this.moveTowardsTarget(dt, engine);
            if (this.targetBuilding) {
              const b = this.targetBuilding;
              if (b.hp <= 0) {
                this.targetBuilding = null;
                this.state = 'IDLE';
              } else if (Math.hypot(b.x - this.x, b.y - this.y) <= (b.width / 2 + 20)) {
                if (b.faction !== this.faction) {
                  // Captura de Estrutura Inimiga!
                  b.faction = this.faction;
                  b.hp = b.maxHp;
                  engine.sounds.playCapture();
                  engine.eva.speak('Building captured.');
                  engine.showEvaMessage(`ESTRUTURA INIMIGA CAPTURADA: ${b.name.toUpperCase()}!`);
                  for (let i = 0; i < 16; i++) {
                    engine.particles.createHarvestSparks(b.x + (Math.random() - 0.5) * b.width, b.y + (Math.random() - 0.5) * b.height);
                  }
                  if (engine.multiplayer) {
                    engine.multiplayer.send({
                      type: 'CMD_CAPTURE',
                      bldgUid: b.uid,
                      newFaction: this.faction
                    });
                  }
                } else if (b.hp < b.maxHp) {
                  // Reparo Instantâneo de Estrutura Aliada
                  b.hp = b.maxHp;
                  engine.sounds.playOrder();
                  engine.eva.speak('Structure repaired.');
                  engine.showEvaMessage(`ESTRUTURA REPARADA A 100%: ${b.name.toUpperCase()}`);
                  if (engine.multiplayer) {
                    engine.multiplayer.send({
                      type: 'CMD_REPAIR_FULL',
                      bldgUid: b.uid
                    });
                  }
                }
                this.hp = 0; // O engenheiro é consumido na operação
                this.targetBuilding = null;
              }
            }
          }
        }

        // Combate
        if (this.attackDamage && this.type !== 'harvester') {
          this.cooldown = Math.max(0, this.cooldown - dt);

          if (this.targetEnemy) {
            if (this.targetEnemy.hp <= 0) {
              this.targetEnemy = null;
              this.state = 'IDLE';
            } else {
              const dist = Math.hypot(this.targetEnemy.x - this.x, this.targetEnemy.y - this.y);
              const angleToTarget = Math.atan2(this.targetEnemy.y - this.y, this.targetEnemy.x - this.x);

              if (this.turretTurnSpeed) {
                this.turretAngle = rotateTowards(this.turretAngle, angleToTarget, this.turretTurnSpeed * dt);
              } else {
                this.angle = rotateTowards(this.angle, angleToTarget, this.turnSpeed * dt);
              }

              if (dist <= this.range) {
                if (this.cooldown <= 0) {
                  this.fireWeapon(engine);
                  this.cooldown = this.maxCooldown;
                }
              } else {
                this.targetX = this.targetEnemy.x;
                this.targetY = this.targetEnemy.y;
                this.moveTowardsTarget(dt, engine);
              }
            }
          } else if (this.state === 'MOVING') {
            this.moveTowardsTarget(dt, engine);
            if (this.turretTurnSpeed) {
              this.turretAngle = rotateTowards(this.turretAngle, this.angle, this.turretTurnSpeed * dt);
            }
          } else {
            const autoTarget = engine.units.find(u =>
              u.faction !== this.faction && u.hp > 0 && Math.hypot(u.x - this.x, u.y - this.y) <= this.range * 1.15
            ) || engine.buildings.find(b =>
              b.faction !== this.faction && b.hp > 0 && Math.hypot(b.x - this.x, b.y - this.y) <= this.range * 1.15
            );
            if (autoTarget) this.attack(autoTarget);
          }
        }

        // FSM Harvester
        if (this.type === 'harvester') {
          this.drillRot += dt * 8;
          if (this.state === 'IDLE') {
            this.findNearestTiberiumField(engine);
          } else if (this.state === 'MOVING') {
            this.moveTowardsTarget(dt, engine);
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 20) {
              this.state = this.targetField ? 'HARVESTING' : 'IDLE';
            }
          } else if (this.state === 'HARVESTING') {
            this.harvestTiberium(dt, engine);
          } else if (this.state === 'RETURNING') {
            if (!this.targetRefinery || this.targetRefinery.hp <= 0) this.findNearestRefinery(engine);
            if (this.targetRefinery) {
              this.targetX = this.targetRefinery.dockX;
              this.targetY = this.targetRefinery.dockY;
              this.moveTowardsTarget(dt, engine);
              if (Math.hypot(this.targetRefinery.dockX - this.x, this.targetRefinery.dockY - this.y) < 15) {
                this.state = 'UNLOADING';
                this.angle = -Math.PI / 2;
              }
            }
          } else if (this.state === 'UNLOADING') {
            this.unloadTiberium(dt, engine);
          }
        }
      }

      moveTowardsTarget(dt, engine) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
          const desiredAngle = Math.atan2(dy, dx);
          this.angle = rotateTowards(this.angle, desiredAngle, this.turnSpeed * dt);

          const angleDiff = Math.abs(normalizeAngle(this.angle - desiredAngle));
          if (angleDiff < 0.95 || this.isAir) {
            let curSpeed = this.speed;
            if (!this.isAir && engine.map && engine.map.isRoad(this.x, this.y)) curSpeed *= 1.25;
            const moveStep = curSpeed * dt;
            const nextX = this.x + Math.cos(this.angle) * moveStep;
            const nextY = this.y + Math.sin(this.angle) * moveStep;

            if (this.isInfantry) this.walkCycle += dt * 10;

            if (this.isAir) {
              this.x = nextX; this.y = nextY;
            } else {
              const col = Math.floor(nextX / engine.map.tileSize);
              const row = Math.floor(nextY / engine.map.tileSize);
              if (engine.map.getGrid(col, row) !== 1) {
                this.x = nextX; this.y = nextY;
                this.treadTrackDist += moveStep;
                if (this.treadTrackDist > 16) {
                  this.treadTrackDist = 0;
                  if (!this.isInfantry) {
                    engine.map.addTreadMark(this.x, this.y, this.angle);
                    if (Math.random() > 0.4) engine.particles.createTreadDust(this.x, this.y);
                  }
                }
              } else {
                this.state = 'IDLE';
              }
            }
          }
        } else {
          this.x = this.targetX; this.y = this.targetY;
          if (this.state === 'MOVING') this.state = 'IDLE';
        }
      }

      fireWeapon(engine) {
        this.recoil = 7;
        const fireAngle = this.turretTurnSpeed ? this.turretAngle : this.angle;
        engine.particles.createMuzzleFlash(
          this.x + Math.cos(fireAngle) * (this.radius + 8),
          this.y + Math.sin(fireAngle) * (this.radius + 8),
          fireAngle
        );

        if (this.type === 'rifleman' || this.type === 'commando' || this.type === 'apc') {
          engine.sounds.playRifleShot();
          engine.projectiles.push(new Projectile(this.x, this.y, this.targetEnemy, this.attackDamage, 'bullet', this.faction, this));
        } else if (this.type === 'rocket' || this.type === 'helicopter' || this.type === 'jet') {
          engine.sounds.playRocketLaunch();
          engine.projectiles.push(new Projectile(this.x, this.y, this.targetEnemy, this.attackDamage, 'rocket', this.faction, this));
        } else if (this.type === 'tank' || this.type === 'mammoth') {
          engine.sounds.playCannon();
          engine.projectiles.push(new Projectile(this.x, this.y, this.targetEnemy, this.attackDamage, 'shell', this.faction, this));
        }
      }

      findNearestTiberiumField(engine) {
        let nearestDist = Infinity;
        let bestField = null;
        engine.map.tiberiumFields.forEach(field => {
          if (field.crystals.some(c => c.health > 0)) {
            const d = Math.hypot(field.x - this.x, field.y - this.y);
            if (d < nearestDist) { nearestDist = d; bestField = field; }
          }
        });
        if (bestField) {
          this.targetField = bestField;
          this.targetX = bestField.x + (Math.random() - 0.5) * 40;
          this.targetY = bestField.y + (Math.random() - 0.5) * 40;
          this.state = 'MOVING';
        }
      }

      findNearestRefinery(engine) {
        this.targetRefinery = engine.buildings.find(b => b.type === 'refinery' && b.faction === this.faction && b.hp > 0);
      }

      harvestTiberium(dt, engine) {
        if (this.ore >= this.maxOre) {
          this.findNearestRefinery(engine);
          this.state = 'RETURNING';
          return;
        }
        const activeCrystal = this.targetField?.crystals.find(c => c.health > 0 && Math.hypot(c.x - this.x, c.y - this.y) < 70);
        if (activeCrystal) {
          this.harvestTimer += dt;
          if (this.harvestTimer > 0.15) {
            this.harvestTimer = 0;
            activeCrystal.health -= 3;
            this.ore = Math.min(this.maxOre, this.ore + 3);
            engine.sounds.playCrystalChime();
            engine.particles.createHarvestSparks(this.x + Math.cos(this.angle) * 18, this.y + Math.sin(this.angle) * 18);
          }
        } else {
          this.findNearestTiberiumField(engine);
        }
      }

      unloadTiberium(dt, engine) {
        if (this.ore > 0) {
          this.ore = Math.max(0, this.ore - dt * 40);
          const earned = Math.floor(dt * 300);
          if (earned > 0) {
            engine.addCredits(earned, this.faction);
            engine.sounds.playCreditTick();
          }
        } else {
          if (this.faction === 'player') {
            engine.showFloatingCredit(this.x, this.y - 20, '+$700');
            engine.showEvaMessage('CARGA DE TIBERIUM PROCESSADA');
          }
          this.findNearestTiberiumField(engine);
        }
      }

      draw(ctx) {
        ctx.save();

        let hullCol = '#4c6541'; // Slot 1 / GDI Azul
        if (this.faction === 'slot2' || this.faction === 'enemy') hullCol = '#7b2e2e'; // Slot 2 / NOD Vermelho
        else if (this.faction === 'slot3') hullCol = '#75601d'; // Slot 3 / GDI Ouro
        else if (this.faction === 'slot4') hullCol = '#5d267a'; // Slot 4 / NOD Roxo

        // Sombra realista anatômica para humanos ou volumétrica para veículos
        ctx.save();
        if (this.isInfantry) {
          ctx.translate(this.x + 2, this.y + 3);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 6.5, 4.5, this.angle * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const shadowOffset = this.isAir ? this.altitude : 5;
          ctx.translate(this.x + shadowOffset * 0.5, this.y + shadowOffset);
          ctx.rotate(this.angle);
          ctx.fillStyle = this.isAir ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(-this.radius, -this.radius * 0.7, this.radius * 2, this.radius * 1.4);
        }
        ctx.restore();

        ctx.translate(this.x, this.y);

        if (this.isInfantry) {
          ctx.save();
          ctx.rotate(this.angle);

          const isMoving = (this.state === 'MOVING');
          const walkSpeed = isMoving ? this.walkCycle : 0;

          // Animação de caminhada com passadas alternadas para frente e para trás
          const leftStrideX = isMoving ? Math.sin(walkSpeed) * 4.2 : -0.8;
          const rightStrideX = isMoving ? Math.sin(walkSpeed + Math.PI) * 4.2 : -0.8;
          const leftStrideY = -3.8;
          const rightStrideY = 3.8;

          // Oscilação vertical e lateral do tronco durante a marcha
          const torsoBob = isMoving ? Math.abs(Math.sin(walkSpeed * 2)) * 0.8 : (Math.sin(this.idleBreath || 0) * 0.35);
          const torsoSway = isMoving ? Math.sin(walkSpeed) * 0.08 : 0;

          // Cores da Facção para braçadeiras militares nos ombros
          let factionArmband = '#00e5ff'; // GDI Azul
          if (this.faction === 'slot2' || this.faction === 'enemy') factionArmband = '#ff3344'; // NOD Vermelho
          else if (this.faction === 'slot3') factionArmband = '#ffd700'; // GDI Ouro
          else if (this.faction === 'slot4') factionArmband = '#cc44ff'; // NOD Roxo

          // Cores e Equipamentos distintos por Categoria
          let uniformCol, pantsCol, vestCol, helmetCol, visorCol;
          if (this.type === 'rifleman') {
            // CATEGORIA: SOLDADO FUZILEIRO (Verde Militar / Camuflagem Tática)
            uniformCol = '#3f562b';
            pantsCol = '#2a3b1d';
            vestCol = '#4b6b33';
            helmetCol = '#374c25';
            visorCol = '#151d10';
          } else if (this.type === 'rocket') {
            // CATEGORIA: LANÇADOR DE FOGUETES (Traje Pesado Laranja Tático Antichamas)
            uniformCol = '#a04000';
            pantsCol = '#6e2c00';
            vestCol = '#d35400';
            helmetCol = '#873600';
            visorCol = '#e74c3c';
          } else if (this.type === 'engineer') {
            // CATEGORIA: ENGENHEIRO MILITAR (Amarelo Alta Visibilidade / Faixas Refletivas)
            uniformCol = '#d4ac0d';
            pantsCol = '#7d6608';
            vestCol = '#f1c40f';
            helmetCol = '#f39c12';
            visorCol = '#ffffff';
          } else if (this.type === 'commando') {
            // CATEGORIA: COMANDO DE ELITE (Preto Stealth / Boina Vermelha)
            uniformCol = '#17202a';
            pantsCol = '#11171d';
            vestCol = '#212f3d';
            helmetCol = '#c0392b'; // Boina vermelha clássica
            visorCol = '#f1948a';
          } else {
            uniformCol = '#3f562b';
            pantsCol = '#2a3b1d';
            vestCol = '#4b6b33';
            helmetCol = '#374c25';
            visorCol = '#151d10';
          }

          // 1. PERNAS E BOTAS MILITARES ARTICULADAS
          // Perna Esquerda
          ctx.fillStyle = pantsCol;
          ctx.beginPath();
          ctx.ellipse(leftStrideX, leftStrideY, 3.2, 1.8, isMoving ? leftStrideX * 0.1 : 0, 0, Math.PI * 2);
          ctx.fill();
          // Bota Esquerda
          ctx.fillStyle = '#111213';
          ctx.fillRect(leftStrideX + 1.2, leftStrideY - 1.2, 3.2, 2.4);

          // Perna Direita
          ctx.fillStyle = pantsCol;
          ctx.beginPath();
          ctx.ellipse(rightStrideX, rightStrideY, 3.2, 1.8, isMoving ? rightStrideX * 0.1 : 0, 0, Math.PI * 2);
          ctx.fill();
          // Bota Direita
          ctx.fillStyle = '#111213';
          ctx.fillRect(rightStrideX + 1.2, rightStrideY - 1.2, 3.2, 2.4);

          // 2. TORSO, OMBROS E COLETE BALÍSTICO
          ctx.save();
          ctx.translate(torsoBob * 0.2, 0);
          ctx.rotate(torsoSway);

          // Sombra suave sob o tronco
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(-1, 0, 5, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Base dos ombros / Uniforme
          ctx.fillStyle = uniformCol;
          ctx.beginPath();
          ctx.ellipse(-0.5, 0, 4.2, 5.8, 0, 0, Math.PI * 2);
          ctx.fill();

          // Braçadeiras da Facção
          ctx.fillStyle = factionArmband;
          ctx.fillRect(-2, -6.0, 3.2, 1.6);
          ctx.fillRect(-2, 4.4, 3.2, 1.6);

          // Colete Balístico Kevlar
          ctx.fillStyle = vestCol;
          ctx.beginPath();
          ctx.ellipse(0, 0, 3.5, 4.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Detalhes únicos no peitoral
          if (this.type === 'engineer') {
            // Faixa refletiva prateada
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(-2.5, -3.2, 5.0, 1.5);
            ctx.fillRect(-2.5, 1.7, 5.0, 1.5);
          } else if (this.type === 'rocket') {
            // Fivelas reforçadas anti-impacto
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(-1.5, -2.5, 1.2, 5.0);
          } else if (this.type === 'rifleman') {
            // Bolsas de cartuchos
            ctx.fillStyle = '#1e2915';
            ctx.fillRect(-1.5, -2.8, 2.5, 1.8);
            ctx.fillRect(-1.5, 1.0, 2.5, 1.8);
          } else if (this.type === 'commando') {
            // Faca de combate no ombro
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(-2.8, -4.5, 4.2, 1.2);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-0.5, -2.0, 1.5, 4.0);
          }

          // 3. MOCHILAS / EQUIPAMENTO COSTAL
          if (this.type === 'rocket') {
            // Mochila de foguetes com 2 ogivas sobressalentes
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-5.5, -3.5, 2.8, 7.0);
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(-6.2, -2.0, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-6.2, 2.0, 1.2, 0, Math.PI * 2); ctx.fill();
          } else if (this.type === 'engineer') {
            // Mochila de ferramentas
            ctx.fillStyle = '#34495e';
            ctx.fillRect(-5.5, -3.0, 2.5, 6.0);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(-6.2, -1.0, 1.2, 2.0);
          } else {
            // Mochila tática de campanha
            ctx.fillStyle = '#1a2217';
            ctx.fillRect(-4.8, -2.8, 2.2, 5.6);
          }

          // 4. BRAÇOS E ARMAMENTO DA CATEGORIA
          const recoilKick = (this.recoil > 0) ? -this.recoil * 0.4 : 0;

          if (this.type === 'rifleman') {
            // FUZIL DE ASSALTO COM AS DUAS MÃOS
            ctx.fillStyle = uniformCol;
            ctx.beginPath(); ctx.ellipse(2, -3.6, 3.2, 1.6, 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(1 + recoilKick, 3.6, 3.0, 1.6, -0.3, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#151515';
            ctx.beginPath(); ctx.arc(4.5, -1.8, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(3.0 + recoilKick, 1.8, 1.2, 0, Math.PI * 2); ctx.fill();

            // Fuzil tático longo
            ctx.fillStyle = '#1a1f24';
            ctx.fillRect(1.5 + recoilKick, -1.2, 10.5, 2.4);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(4.0 + recoilKick, -1.8, 3.5, 3.6);
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(11.5 + recoilKick, -0.6, 2.2, 1.2);

            if (this.recoil > 2.5) {
              ctx.fillStyle = '#f39c12';
              ctx.beginPath(); ctx.arc(14.5 + recoilKick, 0, 3.0, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ffff66';
              ctx.beginPath(); ctx.arc(14.5 + recoilKick, 0, 1.6, 0, Math.PI * 2); ctx.fill();
            }

          } else if (this.type === 'rocket') {
            // LANÇADOR DE FOGUETES PESADO DE OMBRO
            ctx.fillStyle = uniformCol;
            ctx.beginPath(); ctx.ellipse(1, -3.8, 3.4, 1.8, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2, 3.4, 3.4, 1.8, -0.4, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(-4.0, 1.2, 16.0, 3.8);
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(4.0, 1.2, 2.0, 3.8);
            ctx.fillRect(8.0, 1.2, 2.0, 3.8);
            ctx.fillStyle = '#1a252f';
            ctx.fillRect(-5.2, 0.7, 1.8, 4.8);
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(12.5, 3.1, 1.9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillRect(12.5, 2.6, 2.0, 1.0);

          } else if (this.type === 'engineer') {
            // MALETA TÁTICA E SCANNER ELETRÔNICO
            ctx.fillStyle = uniformCol;
            ctx.beginPath(); ctx.ellipse(1, -3.6, 3.0, 1.6, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(1, 3.6, 3.0, 1.6, -0.3, 0, Math.PI * 2); ctx.fill();

            // Mão Esquerda: Scanner Holográfico
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(3.5, -4.5, 4.5, 3.0);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(4.0, -4.0, 3.5, 2.0);
            const scanPulse = Math.sin((this.idleBreath || 0) * 4) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(0, 255, 255, ${scanPulse * 0.4})`;
            ctx.beginPath();
            ctx.arc(8.5, -3.0, 4.0, -0.5, 0.5);
            ctx.fill();

            // Mão Direita: Maleta de Ferramentas
            ctx.fillStyle = '#34495e';
            ctx.fillRect(2.8, 2.5, 5.5, 3.8);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(3.5, 3.0, 4.0, 1.2);

          } else if (this.type === 'commando') {
            // FUZIL SNIPER SUPRIMIDO COM MIRA LASER
            ctx.fillStyle = uniformCol;
            ctx.beginPath(); ctx.ellipse(2, -3.2, 3.4, 1.6, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(2 + recoilKick, 3.2, 3.4, 1.6, -0.3, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#0f1419';
            ctx.fillRect(1.5 + recoilKick, -1.2, 13.5, 2.4);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(4.5 + recoilKick, -2.2, 4.5, 4.4);
            ctx.fillStyle = '#34495e';
            ctx.fillRect(14.0 + recoilKick, -1.6, 3.2, 3.2);

            // Mira laser tática pontual
            ctx.strokeStyle = 'rgba(255, 0, 50, 0.75)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(17.5 + recoilKick, 0);
            ctx.lineTo(28.0 + recoilKick, 0);
            ctx.stroke();
            ctx.fillStyle = '#ff0033';
            ctx.beginPath(); ctx.arc(28.0 + recoilKick, 0, 1.5, 0, Math.PI * 2); ctx.fill();

            if (this.recoil > 2.5) {
              ctx.fillStyle = '#ffff99';
              ctx.beginPath(); ctx.arc(18.0 + recoilKick, 0, 2.5, 0, Math.PI * 2); ctx.fill();
            }
          }

          // 5. CABEÇA, CAPACETE OU BOINA
          ctx.fillStyle = '#d4a373';
          ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();

          if (this.type === 'commando') {
            // BOINA MILITAR VERMELHA CLÁSSICA
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.arc(-0.5, 0.5, 3.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#922b21';
            ctx.beginPath(); ctx.ellipse(0.5, 2.2, 2.2, 1.4, 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(0.2, -1.5, 1.4, 1.4);
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(1.5, -1.2, 1.2, 2.4);

          } else if (this.type === 'engineer') {
            // CAPACETE AMARELO COM ABA
            ctx.fillStyle = helmetCol;
            ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#d68910';
            ctx.beginPath(); ctx.ellipse(2.2, 0, 1.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f9e79f';
            ctx.fillRect(-3.0, -0.7, 5.8, 1.4);

          } else if (this.type === 'rocket') {
            // CAPACETE PESADO COM PROTETOR DE OUVIDO E VISOR
            ctx.fillStyle = helmetCol;
            ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a252f';
            ctx.fillRect(-1.5, -4.2, 2.8, 1.4);
            ctx.fillRect(-1.5, 2.8, 2.8, 1.4);
            ctx.fillStyle = visorCol;
            ctx.fillRect(1.6, -1.8, 1.5, 3.6);

          } else {
            // CAPACETE KEVLAR VERDE COM ÓCULOS/VISEIRA TÁTICA
            ctx.fillStyle = helmetCol;
            ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#253519';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = visorCol;
            ctx.fillRect(1.8, -1.8, 1.4, 3.6);
            ctx.fillStyle = '#34495e';
            ctx.fillRect(2.0, -1.2, 0.8, 2.4);
          }

          ctx.restore();
          ctx.restore();

        } else if (this.type === 'helicopter') {
          ctx.save();
          ctx.rotate(this.angle);

          ctx.fillStyle = hullCol;
          ctx.beginPath();
          ctx.moveTo(18, 0); ctx.lineTo(-14, -12); ctx.lineTo(-18, 0); ctx.lineTo(-14, 12);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#1a2217'; ctx.lineWidth = 1.5; ctx.stroke();

          ctx.fillStyle = '#263038';
          ctx.fillRect(-8, -16, 16, 6); ctx.fillRect(-8, 10, 16, 6);

          ctx.save();
          ctx.rotate(this.rotorAngle);
          ctx.strokeStyle = 'rgba(200, 220, 240, 0.45)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-22, 0); ctx.lineTo(22, 0);
          ctx.moveTo(0, -22); ctx.lineTo(0, 22);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = '#00e5ff';
          ctx.beginPath(); ctx.arc(6, 0, 4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();

        } else if (this.type === 'jet') {
          ctx.save();
          ctx.rotate(this.angle);
          ctx.fillStyle = hullCol;
          ctx.beginPath();
          ctx.moveTo(22, 0); ctx.lineTo(-16, -18); ctx.lineTo(-10, 0); ctx.lineTo(-16, 18);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#1b2218'; ctx.lineWidth = 2; ctx.stroke();

          ctx.fillStyle = '#111';
          ctx.fillRect(0, -2.5, 8, 5);
          ctx.restore();

        } else if (this.type === 'apc') {
          ctx.save();
          ctx.rotate(this.angle);
          ctx.fillStyle = '#111';
          [-12, 0, 12].forEach(wx => {
            ctx.fillRect(wx - 4, -15, 8, 4);
            ctx.fillRect(wx - 4, 11, 8, 4);
          });
          ctx.fillStyle = hullCol;
          ctx.fillRect(-16, -11, 32, 22);
          ctx.strokeStyle = '#1b2618'; ctx.lineWidth = 2; ctx.strokeRect(-16, -11, 32, 22);

          ctx.fillStyle = '#333';
          ctx.beginPath(); ctx.arc(2, 0, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(2, -1.5, 10, 3);
          ctx.restore();

        } else {
          ctx.save();
          ctx.rotate(this.angle);

          if (this.type === 'tank') {
            ctx.fillStyle = '#1a2026';
            ctx.fillRect(-16, -13, 32, 6); ctx.fillRect(-16, 7, 32, 6);
            ctx.fillStyle = hullCol;
            ctx.fillRect(-14, -8, 28, 16);
            ctx.strokeStyle = '#1b2618'; ctx.lineWidth = 1.5; ctx.strokeRect(-14, -8, 28, 16);
          } else if (this.type === 'mammoth') {
            ctx.fillStyle = '#1a2026';
            ctx.fillRect(-22, -18, 44, 8); ctx.fillRect(-22, 10, 44, 8);
            ctx.fillStyle = hullCol;
            ctx.fillRect(-18, -11, 36, 22);
            ctx.strokeStyle = '#1a1f18'; ctx.lineWidth = 2; ctx.strokeRect(-18, -11, 36, 22);
          } else if (this.type === 'harvester') {
            ctx.fillStyle = '#222830';
            ctx.fillRect(-20, -15, 40, 30);
            ctx.fillStyle = '#14181f';
            ctx.fillRect(-18, -11, 20, 22);
            if (this.ore > 0) {
              ctx.fillStyle = '#00ff77';
              ctx.fillRect(-18, -11, 20 * (this.ore / this.maxOre), 22);
            }
            ctx.save();
            ctx.translate(18, 0); ctx.rotate(this.drillRot);
            ctx.fillStyle = '#7f8c8d'; ctx.fillRect(-4, -14, 8, 28);
            ctx.restore();
          }
          ctx.restore();

          if (this.type === 'tank' || this.type === 'mammoth') {
            ctx.save();
            ctx.rotate(this.turretAngle);
            if (this.type === 'tank') {
              ctx.fillStyle = '#333e48';
              ctx.fillRect(0 - this.recoil, -2.5, 20, 5);
              ctx.fillStyle = hullCol;
              ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
            } else if (this.type === 'mammoth') {
              ctx.fillStyle = '#263038';
              ctx.fillRect(0 - this.recoil, -7, 26, 4.5);
              ctx.fillRect(0 - this.recoil, 2.5, 26, 4.5);
              ctx.fillStyle = hullCol;
              ctx.fillRect(-8, -10, 18, 20);
            }
            ctx.restore();
          }
        }

        // Anel militar de seleção HUD
        if (this.selected) {
          ctx.strokeStyle = '#00ff66';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Barra de integridade e divisas de veterania
        if (this.selected || this.hp < this.maxHp || this.rank > 0) {
          const barW = Math.max(16, this.radius * 2);
          const barH = 3;
          const barY = -this.radius - 8;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(-barW/2, barY, barW, barH);
          const hpPercent = Math.max(0, this.hp / this.maxHp);
          ctx.fillStyle = hpPercent > 0.5 ? '#00ff66' : (hpPercent > 0.25 ? '#ffaa00' : '#ff3344');
          ctx.fillRect(-barW/2, barY, barW * hpPercent, barH);

          // Divisas de Veterania (Chevrons)
          if (this.rank === 1) {
            // 1 Chevron Dourado
            ctx.fillStyle = '#f1c40f';
            ctx.font = '8px monospace';
            ctx.fillText('▲', -3, barY - 2);
          } else if (this.rank === 2) {
            // 3 Chevrons Vermelhos/Dourados de Elite
            ctx.fillStyle = '#e74c3c';
            ctx.font = '9px monospace';
            ctx.fillText('★', -4, barY - 2);
          }

          // Indicador de Time / Grupo de Controle [1]..[9]
          if (this.controlGroup) {
            ctx.fillStyle = '#00e5ff';
            ctx.font = 'bold 8px monospace';
            ctx.fillText(`[${this.controlGroup}]`, barW/2 + 2, barY + 3);
          }
        }

        ctx.restore();
      }
    }