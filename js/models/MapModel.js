export class MapEngine {
      constructor(width = 2400, height = 1800) {
        this.width = width;
        this.height = height;
        this.tileSize = 32;
        this.cols = Math.floor(width / this.tileSize);
        this.rows = Math.floor(height / this.tileSize);

        this.grid = new Uint8Array(this.cols * this.rows);

        // Grid do Shroud: 0 = Oculto/Shroud, 1 = Explorado (Névoa), 2 = Visão Ativa
        this.shroud = new Uint8Array(this.cols * this.rows);
        this.shroudEnabled = true;

        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = width;
        this.terrainCanvas.height = height;
        this.terrainCtx = this.terrainCanvas.getContext('2d');

        this.decalCanvas = document.createElement('canvas');
        this.decalCanvas.width = width;
        this.decalCanvas.height = height;
        this.decalCtx = this.decalCanvas.getContext('2d');

        this.tiberiumFields = [];
        this.generateWorld();
      }

      setGrid(col, row, val) {
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
          this.grid[row * this.cols + col] = val;
        }
      }

      getGrid(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 1;
        return this.grid[row * this.cols + col];
      }

      isAreaFree(worldX, worldY, sizeRadius) {
        const minCol = Math.floor((worldX - sizeRadius) / this.tileSize);
        const maxCol = Math.floor((worldX + sizeRadius) / this.tileSize);
        const minRow = Math.floor((worldY - sizeRadius) / this.tileSize);
        const maxRow = Math.floor((worldY + sizeRadius) / this.tileSize);

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            if (this.getGrid(c, r) === 1) return false;
          }
        }
        return true;
      }

      updateVision(friendlyEntities) {
        if (!this.shroudEnabled) return;

        // Transforma a visão ativa (2) em explorada (1)
        for (let i = 0; i < this.shroud.length; i++) {
          if (this.shroud[i] === 2) this.shroud[i] = 1;
        }

        // Para cada entidade aliada, revela no raio de visão
        friendlyEntities.forEach(ent => {
          const sightRadius = ent.isAir ? 280 : (ent.range ? ent.range + 80 : 200);
          const rTiles = Math.ceil(sightRadius / this.tileSize);
          const centerC = Math.floor(ent.x / this.tileSize);
          const centerR = Math.floor(ent.y / this.tileSize);

          for (let dr = -rTiles; dr <= rTiles; dr++) {
            for (let dc = -rTiles; dc <= rTiles; dc++) {
              if (dc*dc + dr*dr <= rTiles * rTiles) {
                const c = centerC + dc;
                const r = centerR + dr;
                if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
                  this.shroud[r * this.cols + c] = 2; // Visão ativa
                }
              }
            }
          }
        });
      }

      isVisible(worldX, worldY) {
        if (!this.shroudEnabled) return true;
        const c = Math.floor(worldX / this.tileSize);
        const r = Math.floor(worldY / this.tileSize);
        if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
        return this.shroud[r * this.cols + c] === 2;
      }

      generateWorld() {
        const ctx = this.terrainCtx;

        const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
        grad.addColorStop(0, '#ab8b56');
        grad.addColorStop(0.5, '#997945');
        grad.addColorStop(1, '#826538');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        for (let i = 0; i < 3500; i++) {
          const x = Math.random() * this.width;
          const y = Math.random() * this.height;
          const radius = 12 + Math.random() * 70;
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(75, 55, 30, 0.09)' : 'rgba(230, 200, 140, 0.12)';
          ctx.fill();
        }

        ctx.fillStyle = 'rgba(40, 25, 10, 0.22)';
        for (let i = 0; i < 3000; i++) {
          ctx.fillRect(Math.random() * this.width, Math.random() * this.height, 2, 2);
        }

        this.renderRoad(ctx);
        this.generateRockClusters(ctx);

        // Campos de Tiberium distribuídos nos 4 quadrantes e na Cratera Central (King of the Hill)
        this.createTiberiumField(550, 480, 24);   // Slot 1 (Noroeste / GDI)
        this.createTiberiumField(1750, 450, 24);  // Slot 2 (Nordeste / NOD)
        this.createTiberiumField(550, 1320, 24);  // Slot 3 (Sudoeste / GDI Ouro)
        this.createTiberiumField(1750, 1320, 24); // Slot 4 (Sudeste / NOD Roxo)
        this.createTiberiumField(1200, 900, 36);  // Cratera Central (Ponto Estratégico KotH)
      }

      renderRoad(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 700);
        ctx.bezierCurveTo(600, 720, 1200, 850, 1800, 840);
        ctx.lineTo(this.width, 920); ctx.lineTo(this.width, 980);
        ctx.bezierCurveTo(1800, 900, 1200, 910, 600, 780);
        ctx.lineTo(0, 760); ctx.closePath();

        ctx.fillStyle = '#26292b'; ctx.fill();
        ctx.strokeStyle = '#1a1c1d'; ctx.lineWidth = 4; ctx.stroke();

        ctx.setLineDash([22, 18]);
        ctx.strokeStyle = '#c49a2b'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 730);
        ctx.bezierCurveTo(600, 750, 1200, 880, 1800, 870);
        ctx.lineTo(this.width, 950);
        ctx.stroke(); ctx.setLineDash([]);

        for (let i = 0; i < 50; i++) {
          ctx.beginPath();
          ctx.arc(Math.random() * this.width, 720 + Math.random() * 180, 8 + Math.random() * 14, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(12, 12, 14, 0.45)';
          ctx.fill();
        }
        ctx.restore();
      }

      generateRockClusters(ctx) {
        const clusterCenters = [
          { x: 300, y: 250, r: 80 },
          { x: 1400, y: 350, r: 100 },
          { x: 900, y: 1300, r: 110 },
          { x: 2100, y: 500, r: 90 },
          { x: 1550, y: 1450, r: 95 },
          { x: 350, y: 1150, r: 75 }
        ];

        clusterCenters.forEach(cl => {
          const numRocks = 12 + Math.floor(Math.random() * 8);
          for (let i = 0; i < numRocks; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * cl.r;
            const rx = cl.x + Math.cos(angle) * dist;
            const ry = cl.y + Math.sin(angle) * dist;
            const rw = 26 + Math.random() * 36;
            const rh = 20 + Math.random() * 26;

            const gridC = Math.floor(rx / this.tileSize);
            const gridR = Math.floor(ry / this.tileSize);
            this.setGrid(gridC, gridR, 1);
            this.setGrid(gridC + 1, gridR, 1);

            ctx.fillStyle = 'rgba(15, 12, 8, 0.5)';
            ctx.beginPath();
            ctx.ellipse(rx + 8, ry + 10, rw * 0.6, rh * 0.5, 0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#5c4e3b';
            ctx.beginPath();
            ctx.moveTo(rx - rw/2, ry);
            ctx.lineTo(rx - rw/4, ry - rh/2);
            ctx.lineTo(rx + rw/3, ry - rh/2 + 3);
            ctx.lineTo(rx + rw/2, ry + 2);
            ctx.lineTo(rx + rw/4, ry + rh/2);
            ctx.lineTo(rx - rw/3, ry + rh/2 - 2);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(215, 195, 160, 0.28)';
            ctx.beginPath();
            ctx.moveTo(rx - rw/4, ry - rh/2);
            ctx.lineTo(rx + rw/3, ry - rh/2 + 3);
            ctx.lineTo(rx + rw/6, ry);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#2d2419';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      }

      createTiberiumField(centerX, centerY, count) {
        const field = { x: centerX, y: centerY, crystals: [] };
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 115;
          field.crystals.push({
            x: centerX + Math.cos(angle) * dist,
            y: centerY + Math.sin(angle) * dist,
            size: 15 + Math.random() * 11,
            maxHealth: 100,
            health: 100,
            pulsePhase: Math.random() * Math.PI * 2,
            type: Math.random() > 0.85 ? 'blue' : 'green'
          });
        }
        this.tiberiumFields.push(field);
      }

      addTreadMark(x, y, angle) {
        const ctx = this.decalCtx;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = 'rgba(25, 20, 12, 0.15)';
        ctx.fillRect(-6, -10, 12, 3);
        ctx.fillRect(-6, 7, 12, 3);
        ctx.restore();
      }

      addScorchMark(x, y, radius = 24) {
        const ctx = this.decalCtx;
        ctx.save();
        ctx.translate(x, y);
        const scorch = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
        scorch.addColorStop(0, 'rgba(15, 12, 10, 0.88)');
        scorch.addColorStop(0.6, 'rgba(30, 22, 15, 0.55)');
        scorch.addColorStop(1, 'rgba(40, 30, 20, 0)');
        ctx.fillStyle = scorch;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      draw(ctx, viewport) {
        ctx.drawImage(this.terrainCanvas, viewport.x, viewport.y, viewport.w, viewport.h, viewport.x, viewport.y, viewport.w, viewport.h);
        ctx.drawImage(this.decalCanvas, viewport.x, viewport.y, viewport.w, viewport.h, viewport.x, viewport.y, viewport.w, viewport.h);

        const time = performance.now() * 0.003;
        this.tiberiumFields.forEach(field => {
          const auraGrad = ctx.createRadialGradient(field.x, field.y, 20, field.x, field.y, 140);
          auraGrad.addColorStop(0, 'rgba(0, 255, 119, 0.22)');
          auraGrad.addColorStop(1, 'rgba(0, 255, 119, 0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath(); ctx.arc(field.x, field.y, 140, 0, Math.PI * 2); ctx.fill();

          field.crystals.forEach(c => {
            if (c.health <= 0) return;
            const pulse = 0.85 + Math.sin(time + c.pulsePhase) * 0.15;
            const currentSize = c.size * (c.health / c.maxHealth) * pulse;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(c.x + 3, c.y + 4, currentSize * 0.6, currentSize * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            const isBlue = c.type === 'blue';
            const baseCol = isBlue ? '#00e5ff' : '#00ff77';
            const coreCol = isBlue ? '#d0f8ff' : '#d2ffe2';

            const glowGrad = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, currentSize * 1.8);
            glowGrad.addColorStop(0, isBlue ? 'rgba(0, 229, 255, 0.45)' : 'rgba(0, 255, 119, 0.45)');
            glowGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = glowGrad;
            ctx.beginPath(); ctx.arc(c.x, c.y, currentSize * 1.8, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = baseCol;
            ctx.beginPath();
            ctx.moveTo(c.x, c.y - currentSize);
            ctx.lineTo(c.x + currentSize * 0.45, c.y - currentSize * 0.2);
            ctx.lineTo(c.x + currentSize * 0.35, c.y + currentSize * 0.4);
            ctx.lineTo(c.x - currentSize * 0.35, c.y + currentSize * 0.4);
            ctx.lineTo(c.x - currentSize * 0.45, c.y - currentSize * 0.2);
            ctx.closePath(); ctx.fill();

            ctx.fillStyle = coreCol;
            ctx.beginPath();
            ctx.moveTo(c.x, c.y - currentSize);
            ctx.lineTo(c.x + currentSize * 0.1, c.y);
            ctx.lineTo(c.x - currentSize * 0.35, c.y - currentSize * 0.2);
            ctx.closePath(); ctx.fill();
          });
        });
      }

      drawShroud(ctx, viewport) {
        if (!this.shroudEnabled) return;

        const startC = Math.max(0, Math.floor(viewport.x / this.tileSize));
        const endC = Math.min(this.cols - 1, Math.ceil((viewport.x + viewport.w) / this.tileSize));
        const startR = Math.max(0, Math.floor(viewport.y / this.tileSize));
        const endR = Math.min(this.rows - 1, Math.ceil((viewport.y + viewport.h) / this.tileSize));

        for (let r = startR; r <= endR; r++) {
          for (let c = startC; c <= endC; c++) {
            const val = this.shroud[r * this.cols + c];
            if (val === 0) {
              // Shroud Total: Escuridão negra impenetrável
              ctx.fillStyle = '#06080b';
              ctx.fillRect(c * this.tileSize, r * this.tileSize, this.tileSize, this.tileSize);
            } else if (val === 1) {
              // Fog of War: Terreno explorado, mas sem visão ativa
              ctx.fillStyle = 'rgba(6, 10, 16, 0.65)';
              ctx.fillRect(c * this.tileSize, r * this.tileSize, this.tileSize, this.tileSize);
            }
          }
        }
      }
    }

    /* =========================================================================
       3. SISTEMA DE PARTÍCULAS EM MÚLTIPLOS ESTÁGIOS (VFX)
       ========================================================================= */