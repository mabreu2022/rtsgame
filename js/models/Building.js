import { rotateTowards, normalizeAngle } from '../utils/MathUtils.js';

export class Building {
      constructor(x, y, type, faction = 'player', isUnderConstruction = false, uid = null) {
        this.uid = uid || (`${faction}_b_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`);
        this.x = x;
        this.y = y;
        this.type = type;
        this.faction = faction;
        this.selected = false;

        this.isConstructing = isUnderConstruction;
        this.constructProgress = isUnderConstruction ? 0 : 1;
        this.constructTotalTime = 6;
        this.isRepairing = false;

        if (type === 'hq') {
          this.name = 'Centro de Comando';
          this.cost = 2000; this.width = 96; this.height = 96; this.hp = 1800;
          this.powerGen = 50; this.powerCons = 0;
        } else if (type === 'power') {
          this.name = 'Usina de Energia';
          this.cost = 300; this.width = 64; this.height = 64; this.hp = 750;
          this.powerGen = 100; this.powerCons = 0;
        } else if (type === 'barracks') {
          this.name = 'Quartel Militar';
          this.cost = 400; this.width = 80; this.height = 64; this.hp = 850;
          this.powerGen = 0; this.powerCons = 15;
          this.spawnX = this.x; this.spawnY = this.y + 45;
        } else if (type === 'refinery') {
          this.name = 'Refinaria de Tiberium';
          this.cost = 800; this.width = 96; this.height = 72; this.hp = 1100;
          this.powerGen = 0; this.powerCons = 20;
          this.dockX = this.x + 28; this.dockY = this.y + 16;
        } else if (type === 'factory') {
          this.name = 'Fábrica de Guerra';
          this.cost = 1000; this.width = 96; this.height = 80; this.hp = 1200;
          this.powerGen = 0; this.powerCons = 30;
          this.spawnX = this.x; this.spawnY = this.y + 52;
          this.doorOpen = 0;
        } else if (type === 'turret') {
          this.name = 'Torre de Defesa Tesla';
          this.cost = 500; this.width = 48; this.height = 48; this.hp = 550;
          this.powerGen = 0; this.powerCons = 25;
          this.range = 220; this.cooldown = 0; this.maxCooldown = 38;
          this.turretAngle = 0;
        } else if (type === 'silo') {
          this.name = 'Silo de Tiberium';
          this.cost = 250; this.width = 48; this.height = 48; this.hp = 500;
          this.powerGen = 0; this.powerCons = 5;
        } else if (type === 'obelisk') {
          this.name = 'Obelisco de Luz';
          this.cost = 1200; this.width = 48; this.height = 64; this.hp = 950;
          this.powerGen = 0; this.powerCons = 50;
          this.range = 340; this.cooldown = 0; this.maxCooldown = 3.6;
          this.isCharging = false; this.chargeTimer = 0; this.targetUnit = null;
        } else if (type === 'temple') {
          this.name = 'Templo da Irmandade';
          this.cost = 1800; this.width = 96; this.height = 96; this.hp = 2200;
          this.powerGen = 0; this.powerCons = 60;
        }

        this.maxHp = this.hp;
        if (this.isConstructing) this.hp = 50;
        this.smokeTimer = 0;
        this.repairTick = 0;
        this.animPhase = Math.random() * Math.PI * 2;

        // Ponto de Encontro Tático (Rally Point)
        this.rallyPoint = null;
        if (type === 'barracks' || type === 'factory') {
          this.rallyPoint = { x: this.spawnX, y: this.spawnY + 55 };
        }
      }

      update(dt, engine) {
        this.animPhase += dt * 3;

        // Animação de montagem
        if (this.isConstructing) {
          this.constructProgress += dt / this.constructTotalTime;
          this.hp = Math.floor(this.maxHp * Math.min(1, this.constructProgress));
          if (Math.random() > 0.6) {
            engine.particles.createHarvestSparks(
              this.x + (Math.random() - 0.5) * this.width,
              this.y + (Math.random() - 0.5) * this.height
            );
          }
          if (this.constructProgress >= 1.0) {
            this.isConstructing = false;
            this.constructProgress = 1.0;
            this.hp = this.maxHp;
            engine.sounds.playEvaChime('ready');
            engine.eva.speak('Construction complete.');
            engine.showEvaMessage(`${this.name.toUpperCase()} OPERACIONAL`);
            if (engine.map) engine.map.registerBuilding(this);
            engine.recalculatePower();
          }
          return;
        }

        // Modo de Reparo Ativo
        if (this.isRepairing && this.hp < this.maxHp) {
          this.repairTick += dt;
          if (this.repairTick > 0.5) {
            this.repairTick = 0;
            if (engine.credits >= 6) {
              engine.credits -= 6;
              this.hp = Math.min(this.maxHp, this.hp + 25);
              engine.updateEconomyDisplay();
              engine.sounds.playCreditTick();
            } else {
              this.isRepairing = false;
            }
          }
        } else if (this.hp >= this.maxHp) {
          this.isRepairing = false;
        }

        // Fumaça e chamas se danificada (<50% e <35%)
        if (this.hp < this.maxHp * 0.5 && this.hp > 0) {
          this.smokeTimer += dt;
          if (this.smokeTimer > 0.12) {
            this.smokeTimer = 0;
            if (this.hp < this.maxHp * 0.35) {
              engine.particles.createBuildingFire(this.x, this.y, this.width, this.height);
            } else {
              engine.particles.particles.push({
                x: this.x + (Math.random() - 0.5) * (this.width * 0.6),
                y: this.y + (Math.random() - 0.5) * (this.height * 0.6),
                vx: (Math.random() - 0.5) * 8, vy: -25 - Math.random() * 20,
                type: 'smoke', radius: 12, growth: 10, life: 0.9, maxLife: 0.9, color: 'rgba(30, 30, 30,'
              });
            }
          }
        }

        // Torre de Defesa Tesla
        if (this.type === 'turret') {
          this.cooldown = Math.max(0, this.cooldown - dt);
          const target = engine.units.find(u =>
            u.faction !== this.faction && u.hp > 0 && Math.hypot(u.x - this.x, u.y - this.y) <= this.range
          );

          if (target) {
            this.turretAngle = Math.atan2(target.y - this.y, target.x - this.x);
            if (this.cooldown <= 0) {
              engine.sounds.playLaser();
              engine.projectiles.push(new Projectile(this.x, this.y, target, 35, 'laser', this.faction));
              this.cooldown = this.maxCooldown / 60;
            }
          } else {
            this.turretAngle += dt * 0.8;
          }
        }

        // Obelisco de Luz (Arma de Laser Contínuo Devastador NOD)
        if (this.type === 'obelisk') {
          this.cooldown = Math.max(0, this.cooldown - dt);
          if (!this.targetUnit || this.targetUnit.hp <= 0 || Math.hypot(this.targetUnit.x - this.x, this.targetUnit.y - this.y) > this.range) {
            this.targetUnit = engine.units.find(u =>
              u.faction !== this.faction && u.hp > 0 && Math.hypot(u.x - this.x, u.y - this.y) <= this.range
            ) || null;
            this.isCharging = false;
            this.chargeTimer = 0;
          }

          if (this.targetUnit) {
            if (this.cooldown <= 0) {
              if (!this.isCharging) {
                this.isCharging = true;
                this.chargeTimer = 0;
                engine.sounds.playObeliskCharge();
              } else {
                this.chargeTimer += dt;
                if (this.chargeTimer >= 1.05) {
                  this.isCharging = false;
                  this.chargeTimer = 0;
                  this.cooldown = this.maxCooldown;
                  engine.sounds.playObeliskFire();
                  engine.projectiles.push(new Projectile(this.x, this.y - 28, this.targetUnit, 220, 'laser', this.faction));
                  for (let i = 0; i < 10; i++) {
                    engine.particles.createHarvestSparks(this.x, this.y - 28);
                  }
                }
              }
            }
          }
        }

        if (this.doorOpen > 0) this.doorOpen = Math.max(0, this.doorOpen - dt);
      }

      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(-this.width/2 + 8, -this.height/2 + 8, this.width, this.height);

        ctx.fillStyle = '#1e242b';
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        const factionColor = (this.faction === 'slot2' || this.faction === 'enemy' || this.faction === 'slot4') ? '#ff3344' : (this.faction === 'slot3' ? '#ffd700' : '#00e5ff');
        ctx.strokeStyle = factionColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(-this.width/2, -this.height/2, this.width, this.height);

        if (this.isConstructing) {
          ctx.fillStyle = 'rgba(243, 156, 18, 0.2)';
          ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
          ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-this.width/2, -this.height/2); ctx.lineTo(this.width/2, this.height/2);
          ctx.moveTo(this.width/2, -this.height/2); ctx.lineTo(-this.width/2, this.height/2);
          ctx.stroke();

          const barW = this.width;
          ctx.fillStyle = '#090d12';
          ctx.fillRect(-barW/2, -this.height/2 - 14, barW, 6);
          ctx.fillStyle = '#f39c12';
          ctx.fillRect(-barW/2, -this.height/2 - 14, barW * this.constructProgress, 6);

          ctx.restore();
          return;
        }

        if (this.type === 'hq') {
          ctx.fillStyle = '#2c3742';
          ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#4b6175'; ctx.lineWidth = 2; ctx.stroke();

          ctx.save();
          ctx.rotate(this.animPhase * 0.8);
          ctx.fillStyle = '#8ca3b8';
          ctx.fillRect(-4, -18, 8, 36);
          ctx.fillStyle = '#00ff66';
          ctx.fillRect(0, -18, 3, 6);
          ctx.restore();

        } else if (this.type === 'power') {
          ctx.fillStyle = '#17202a';
          ctx.fillRect(-22, -22, 44, 44);
          ctx.strokeStyle = '#394e63'; ctx.lineWidth = 3; ctx.strokeRect(-22, -22, 44, 44);

          const glowPulse = 0.6 + Math.sin(this.animPhase * 2) * 0.4;
          const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
          coreGrad.addColorStop(0, `rgba(255, 255, 255, ${glowPulse})`);
          coreGrad.addColorStop(0.5, `rgba(0, 229, 255, ${glowPulse * 0.8})`);
          coreGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
          ctx.fillStyle = coreGrad;
          ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();

          ctx.fillStyle = '#00e5ff';
          ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();

          // MARCADOR TÁTICO DE ENERGIA DA USINA (Power Plant Energy Marker)
          const actualGen = (this.hp < this.maxHp * 0.5) ? Math.floor(this.powerGen * 0.5) : this.powerGen;
          const badgeY = (this.selected || this.hp < this.maxHp) ? (-this.height / 2 - 27) : (-this.height / 2 - 17);
          const badgeW = 68;
          const badgeH = 14;

          ctx.save();
          // Fundo do badge com visual cyber militar
          ctx.fillStyle = 'rgba(7, 14, 22, 0.88)';
          ctx.fillRect(-badgeW / 2, badgeY, badgeW, badgeH);
          ctx.strokeStyle = actualGen < this.powerGen ? '#ffaa00' : '#00e5ff';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-badgeW / 2, badgeY, badgeW, badgeH);

          // Efeito de pulso de circuito
          const ledX = -badgeW / 2 + 7;
          ctx.fillStyle = actualGen < this.powerGen ? '#ffaa00' : (glowPulse > 0.7 ? '#00ff66' : '#00e5ff');
          ctx.beginPath();
          ctx.arc(ledX, badgeY + badgeH / 2, 3, 0, Math.PI * 2);
          ctx.fill();

          // Texto com geração de GW
          ctx.font = 'bold 8.5px "Orbitron", monospace, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = actualGen < this.powerGen ? '#ffbb33' : '#00e5ff';
          const statusText = actualGen < this.powerGen ? `⚡ +${actualGen} GW [!]` : `⚡ +${actualGen} GW`;
          ctx.fillText(statusText, 4, badgeY + badgeH / 2);
          ctx.restore();

        } else if (this.type === 'barracks') {
          ctx.fillStyle = '#223026';
          ctx.fillRect(-34, -26, 68, 52);
          ctx.strokeStyle = '#3a4e3f'; ctx.lineWidth = 2; ctx.strokeRect(-34, -26, 68, 52);

          ctx.fillStyle = '#947545';
          for (let sx = -30; sx <= 20; sx += 12) {
            ctx.fillRect(sx, 18, 10, 6);
          }

          ctx.fillStyle = '#0f141a';
          ctx.fillRect(-12, 10, 24, 16);
          ctx.fillStyle = '#00ff66';
          ctx.fillRect(-2, 8, 4, 3);

        } else if (this.type === 'refinery') {
          ctx.fillStyle = '#1c2833';
          ctx.beginPath(); ctx.arc(-24, -12, 16, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#27ae60'; ctx.stroke();

          ctx.fillStyle = '#00ff77';
          ctx.fillRect(-27, -15, 6, 8);

          ctx.fillStyle = '#0b0f14';
          ctx.fillRect(8, -26, 32, 52);
          ctx.save();
          ctx.beginPath(); ctx.rect(8, -26, 32, 52); ctx.clip();
          ctx.lineWidth = 4; ctx.strokeStyle = '#f1c40f';
          for (let l = -30; l < 50; l += 10) {
            ctx.beginPath(); ctx.moveTo(8 + l, -26); ctx.lineTo(24 + l, 26); ctx.stroke();
          }
          ctx.restore();

        } else if (this.type === 'factory') {
          ctx.fillStyle = '#222b35';
          ctx.fillRect(-this.width/2 + 6, -this.height/2 + 6, this.width - 12, this.height - 24);

          const doorOffset = this.doorOpen > 0 ? 16 : 0;
          ctx.fillStyle = '#0f141a';
          ctx.fillRect(-26, 12, 52, 20);
          ctx.fillStyle = '#4a5b6d';
          ctx.fillRect(-26, 12, 52, 20 - doorOffset);

          ctx.fillStyle = this.doorOpen > 0 ? '#00ff66' : '#ffaa00';
          ctx.beginPath(); ctx.arc(0, 10, 3, 0, Math.PI * 2); ctx.fill();

        } else if (this.type === 'turret') {
          ctx.fillStyle = '#2b3642';
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const px = Math.cos(a) * 18; const py = Math.sin(a) * 18;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#3f4f61'; ctx.stroke();

          ctx.save();
          ctx.rotate(this.turretAngle);
          ctx.fillStyle = '#161d24'; ctx.fillRect(-10, -8, 20, 16);
          ctx.fillStyle = '#566573';
          ctx.fillRect(6, -5, 14, 3); ctx.fillRect(6, 2, 14, 3);

          ctx.strokeStyle = 'rgba(255, 0, 50, 0.4)';
          ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(80, 0); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

        } else if (this.type === 'silo') {
          // Silo de Armazenamento Tiberium com Tanques Duplos e Medidor de Nível em Tempo Real
          ctx.fillStyle = '#1b242e';
          ctx.fillRect(-20, -18, 40, 36);
          ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 2; ctx.strokeRect(-20, -18, 40, 36);

          // Cálculo do percentual de lotação global dos silos
          const game = window.game;
          let fillRatio = 0;
          if (game && game.creditCapacity > 0) {
            fillRatio = Math.min(1.0, Math.max(0, game.credits / game.creditCapacity));
          }

          // 2 Cilindros Metálicos (Tanques de Vidro com Tiberium Líquido Fluindo)
          const tankRadius = 9;
          [-10, 10].forEach(tx => {
            // Fundo escuro do cilindro
            ctx.fillStyle = '#121820';
            ctx.beginPath(); ctx.arc(tx, -2, tankRadius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 1.5; ctx.stroke();

            // Líquido de Tiberium subindo conforme a lotação
            if (fillRatio > 0.01) {
              const liquidHeight = Math.min(16, Math.max(2, fillRatio * 16));
              const liquidGlow = 0.6 + Math.sin(this.animPhase * 3 + tx) * 0.35;
              const fillGrad = ctx.createLinearGradient(tx, 6, tx, 6 - liquidHeight);
              fillGrad.addColorStop(0, `rgba(0, 200, 80, ${liquidGlow * 0.85})`);
              fillGrad.addColorStop(0.6, `rgba(0, 255, 120, ${liquidGlow})`);
              fillGrad.addColorStop(1, '#a8ffb2');
              ctx.fillStyle = fillGrad;

              ctx.save();
              ctx.beginPath(); ctx.arc(tx, -2, tankRadius - 1.5, 0, Math.PI * 2); ctx.clip();
              ctx.fillRect(tx - tankRadius, 6 - liquidHeight, tankRadius * 2, liquidHeight);
              ctx.restore();
            }

            // Reflexo de vidro no cilindro
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(tx - 1, -8, 2, 12);
          });

          // MARCADOR DE MEDIÇÃO E LOTAÇÃO DO SILO (Silo Fill Measurement Badge)
          const fillPct = Math.round(fillRatio * 100);
          const badgeY = (this.selected || this.hp < this.maxHp) ? (-this.height / 2 - 27) : (-this.height / 2 - 17);
          const badgeW = 72;
          const badgeH = 14;

          ctx.save();
          ctx.fillStyle = 'rgba(6, 16, 12, 0.88)';
          ctx.fillRect(-badgeW / 2, badgeY, badgeW, badgeH);
          ctx.strokeStyle = fillPct >= 95 ? '#ff3344' : (fillPct >= 80 ? '#ffaa00' : '#00ff77');
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-badgeW / 2, badgeY, badgeW, badgeH);

          // Mini barra interna de nível de armazenamento
          const barPad = 2;
          const barFillW = (badgeW - barPad * 2) * Math.min(1, fillRatio);
          ctx.fillStyle = fillPct >= 95 ? 'rgba(255, 51, 68, 0.4)' : 'rgba(0, 255, 119, 0.3)';
          ctx.fillRect(-badgeW / 2 + barPad, badgeY + barPad, barFillW, badgeH - barPad * 2);

          // Texto com a medição de lotação
          ctx.font = 'bold 8px "Orbitron", monospace, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = fillPct >= 95 ? '#ff4d5a' : (fillPct >= 80 ? '#ffbb33' : '#00ff77');
          ctx.fillText(`SILO: ${fillPct}% LOTADO`, 0, badgeY + badgeH / 2);
          ctx.restore();

        } else if (this.type === 'obelisk') {
          // Obelisco de Luz NOD: Agulha Negra com Cristal Escarlate no Topo
          ctx.fillStyle = '#0f141a';
          ctx.beginPath();
          ctx.moveTo(0, -28);
          ctx.lineTo(16, 24);
          ctx.lineTo(-16, 24);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2; ctx.stroke();

          // Detalhes em painéis angulares
          ctx.fillStyle = '#2c1214';
          ctx.beginPath();
          ctx.moveTo(0, -16); ctx.lineTo(8, 20); ctx.lineTo(-8, 20); ctx.closePath();
          ctx.fill();

          // Cristal de Foco no Ápice
          const crystalGlow = this.isCharging ? (0.6 + Math.sin(this.animPhase * 16) * 0.4) : (0.4 + Math.sin(this.animPhase * 2) * 0.2);
          const cGrad = ctx.createRadialGradient(0, -26, 1, 0, -26, 14);
          cGrad.addColorStop(0, '#ffffff');
          cGrad.addColorStop(0.3, `rgba(255, 51, 68, ${crystalGlow})`);
          cGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
          ctx.fillStyle = cGrad;
          ctx.beginPath(); ctx.arc(0, -26, 14, 0, Math.PI * 2); ctx.fill();

          ctx.fillStyle = '#ff2233';
          ctx.beginPath(); ctx.arc(0, -26, 4, 0, Math.PI * 2); ctx.fill();

        } else if (this.type === 'temple') {
          // Templo de NOD: Pirâmide Escalonada com Silo Nuclear Central
          ctx.fillStyle = '#1c1f24';
          ctx.fillRect(-44, -44, 88, 88);
          ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.strokeRect(-44, -44, 88, 88);

          // Segundo Andar da Pirâmide
          ctx.fillStyle = '#282b30';
          ctx.fillRect(-28, -28, 56, 56);
          ctx.strokeStyle = '#8b0000'; ctx.lineWidth = 2; ctx.strokeRect(-28, -28, 56, 56);

          // Escotilha do Silo Nuclear Central
          ctx.fillStyle = '#0a0a0c';
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2; ctx.stroke();

          // Símbolo de Radiação / NOD
          ctx.fillStyle = '#ff3344';
          ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        }

        // Ícone animado de reparo
        if (this.isRepairing) {
          ctx.save();
          ctx.translate(0, -this.height/2 - 22);
          ctx.rotate(Math.sin(this.animPhase * 3) * 0.4);
          ctx.fillStyle = '#00ff66';
          ctx.font = '16px monospace';
          ctx.fillText('🔧', -8, 0);
          ctx.restore();
        }

        if (this.selected) {
          ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 2;
          ctx.strokeRect(-this.width/2 - 4, -this.height/2 - 4, this.width + 8, this.height + 8);
        }

        if (this.selected || this.hp < this.maxHp) {
          const barW = this.width;
          const barH = 5;
          const barY = -this.height/2 - 12;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(-barW/2, barY, barW, barH);
          const hpPercent = Math.max(0, this.hp / this.maxHp);
          ctx.fillStyle = hpPercent > 0.5 ? '#00ff66' : (hpPercent > 0.25 ? '#ffaa00' : '#ff3344');
          ctx.fillRect(-barW/2, barY, barW * hpPercent, barH);
        }

        ctx.restore();

        // Renderização do Rally Point (Ponto de Encontro) quando selecionado
        if (this.selected && this.rallyPoint && (this.type === 'barracks' || this.type === 'factory')) {
          ctx.save();
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = -performance.now() * 0.02;
          ctx.beginPath();
          ctx.moveTo(this.spawnX, this.spawnY);
          ctx.lineTo(this.rallyPoint.x, this.rallyPoint.y);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.arc(this.rallyPoint.x, this.rallyPoint.y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(this.rallyPoint.x, this.rallyPoint.y, 8, 0, Math.PI * 2);
          ctx.stroke();

          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#00e5ff';
          ctx.fillText('🚩 RALLY', this.rallyPoint.x + 10, this.rallyPoint.y + 4);
          ctx.restore();
        }
      }
    }