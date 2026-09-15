export class MapEngine {
  constructor(width = 2400, height = 1800, theme = 'wasteland') {
    this.width = width;
    this.height = height;
    this.theme = theme; // 'wasteland' | 'snow' | 'volcanic' | 'desert' | 'urban'
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
    this.roads = [];
    this.lavaFissures = [];
    this.radarPings = [];
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

  registerBuilding(b) {
    if (!b) return;
    const halfW = b.width / 2;
    const halfH = b.height / 2;
    const minCol = Math.max(0, Math.floor((b.x - halfW + 6) / this.tileSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((b.x + halfW - 6) / this.tileSize));
    const minRow = Math.max(0, Math.floor((b.y - halfH + 6) / this.tileSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((b.y + halfH - 6) / this.tileSize));

    const exemptTiles = new Set();
    if (b.spawnX && b.spawnY) {
      const sc = Math.floor(b.spawnX / this.tileSize);
      const sr = Math.floor(b.spawnY / this.tileSize);
      exemptTiles.add(`${sc},${sr}`);
    }
    if (b.dockX && b.dockY) {
      const dc = Math.floor(b.dockX / this.tileSize);
      const dr = Math.floor(b.dockY / this.tileSize);
      exemptTiles.add(`${dc},${dr}`);
    }

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (!exemptTiles.has(`${c},${r}`)) {
          this.setGrid(c, r, 1);
        }
      }
    }
  }

  unregisterBuilding(b) {
    if (!b) return;
    const halfW = b.width / 2;
    const halfH = b.height / 2;
    const minCol = Math.max(0, Math.floor((b.x - halfW) / this.tileSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((b.x + halfW) / this.tileSize));
    const minRow = Math.max(0, Math.floor((b.y - halfH) / this.tileSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((b.y + halfH) / this.tileSize));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        this.setGrid(c, r, 0);
      }
    }
  }

  addBuildingRubble(x, y, width, height) {
    const ctx = this.decalCtx;
    ctx.save();
    const grad = ctx.createRadialGradient(x, y, 8, x, y, Math.max(width, height) * 0.7);
    grad.addColorStop(0, 'rgba(12, 10, 8, 0.95)');
    grad.addColorStop(0.5, 'rgba(28, 22, 16, 0.7)');
    grad.addColorStop(1, 'rgba(10, 10, 10, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(width, height) * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#222830';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const rx = x + (Math.random() - 0.5) * (width * 0.6);
      const ry = y + (Math.random() - 0.5) * (height * 0.6);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + (Math.random() - 0.5) * 22, ry + (Math.random() - 0.5) * 22);
      ctx.stroke();
    }
    ctx.restore();
  }

  addRadarPing(x, y, color = '#ff3344', duration = 3.5) {
    this.radarPings.push({
      x, y, color, duration, timer: 0, radius: 0, maxRadius: 30
    });
  }

  updateRadarPings(dt) {
    for (let i = this.radarPings.length - 1; i >= 0; i--) {
      const ping = this.radarPings[i];
      ping.timer += dt;
      ping.radius = ((ping.timer % 0.8) / 0.8) * ping.maxRadius;
      if (ping.timer >= ping.duration) {
        this.radarPings.splice(i, 1);
      }
    }
  }

  hasLineOfSight(x0, y0, x1, y1) {
    let c0 = Math.floor(x0 / this.tileSize);
    let r0 = Math.floor(y0 / this.tileSize);
    const c1 = Math.floor(x1 / this.tileSize);
    const r1 = Math.floor(y1 / this.tileSize);

    const dc = Math.abs(c1 - c0);
    const dr = Math.abs(r1 - r0);
    const sc = (c0 < c1) ? 1 : -1;
    const sr = (r0 < r1) ? 1 : -1;
    let err = dc - dr;

    while (true) {
      if (this.getGrid(c0, r0) === 1) return false;
      if (c0 === c1 && r0 === r1) break;
      const e2 = 2 * err;
      if (e2 > -dr) {
        err -= dr;
        c0 += sc;
      }
      if (e2 < dc) {
        err += dc;
        r0 += sr;
      }
    }
    return true;
  }

  findPath(startX, startY, targetX, targetY) {
    const startCol = Math.floor(startX / this.tileSize);
    const startRow = Math.floor(startY / this.tileSize);
    let targetCol = Math.floor(targetX / this.tileSize);
    let targetRow = Math.floor(targetY / this.tileSize);

    targetCol = Math.max(0, Math.min(this.cols - 1, targetCol));
    targetRow = Math.max(0, Math.min(this.rows - 1, targetRow));

    if (this.getGrid(targetCol, targetRow) === 1) {
      const neighbors = [
        { c: targetCol, r: targetRow - 1 },
        { c: targetCol, r: targetRow + 1 },
        { c: targetCol - 1, r: targetRow },
        { c: targetCol + 1, r: targetRow },
        { c: targetCol - 1, r: targetRow - 1 },
        { c: targetCol + 1, r: targetRow - 1 },
        { c: targetCol - 1, r: targetRow + 1 },
        { c: targetCol + 1, r: targetRow + 1 },
      ];
      let bestAdj = null;
      let minD = Infinity;
      for (const n of neighbors) {
        if (this.getGrid(n.c, n.r) === 0) {
          const d = Math.hypot(n.c - startCol, n.r - startRow);
          if (d < minD) { minD = d; bestAdj = n; }
        }
      }
      if (bestAdj) {
        targetCol = bestAdj.c;
        targetRow = bestAdj.r;
      } else {
        return [{ x: targetX, y: targetY }];
      }
    }

    if (startCol === targetCol && startRow === targetRow) {
      return [{ x: targetX, y: targetY }];
    }

    if (this.hasLineOfSight(startX, startY, targetX, targetY)) {
      return [{ x: targetX, y: targetY }];
    }

    const startIndex = startRow * this.cols + startCol;
    const targetIndex = targetRow * this.cols + targetCol;

    const openSet = [startIndex];
    const cameFrom = new Int32Array(this.cols * this.rows).fill(-1);
    const gScore = new Float32Array(this.cols * this.rows).fill(Infinity);
    const fScore = new Float32Array(this.cols * this.rows).fill(Infinity);
    const inOpenSet = new Uint8Array(this.cols * this.rows);

    gScore[startIndex] = 0;
    const h = (c, r) => Math.hypot(c - targetCol, r - targetRow);
    fScore[startIndex] = h(startCol, startRow);
    inOpenSet[startIndex] = 1;

    let iterations = 0;
    const maxIterations = 800;
    let closestIndex = startIndex;
    let closestDist = fScore[startIndex];

    const dirs = [
      { dc: 0, dr: -1, cost: 1 },
      { dc: 0, dr: 1, cost: 1 },
      { dc: -1, dr: 0, cost: 1 },
      { dc: 1, dr: 0, cost: 1 },
      { dc: -1, dr: -1, cost: 1.414 },
      { dc: 1, dr: -1, cost: 1.414 },
      { dc: -1, dr: 1, cost: 1.414 },
      { dc: 1, dr: 1, cost: 1.414 }
    ];

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;
      let lowestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (fScore[openSet[i]] < fScore[openSet[lowestIdx]]) lowestIdx = i;
      }
      const current = openSet.splice(lowestIdx, 1)[0];
      inOpenSet[current] = 0;

      if (current === targetIndex) {
        return this.reconstructAndSmoothPath(cameFrom, current, targetX, targetY);
      }

      const currCol = current % this.cols;
      const currRow = Math.floor(current / this.cols);
      const currDist = h(currCol, currRow);
      if (currDist < closestDist) {
        closestDist = currDist;
        closestIndex = current;
      }

      for (const d of dirs) {
        const nc = currCol + d.dc;
        const nr = currRow + d.dr;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;

        if (d.dc !== 0 && d.dr !== 0) {
          if (this.getGrid(currCol + d.dc, currRow) === 1 || this.getGrid(currCol, currRow + d.dr) === 1) {
            continue;
          }
        }

        if (this.getGrid(nc, nr) === 1) continue;

        const neighbor = nr * this.cols + nc;
        const tentativeG = gScore[current] + d.cost;

        if (tentativeG < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeG;
          fScore[neighbor] = tentativeG + h(nc, nr);

          if (!inOpenSet[neighbor]) {
            openSet.push(neighbor);
            inOpenSet[neighbor] = 1;
          }
        }
      }
    }

    if (closestIndex !== startIndex) {
      return this.reconstructAndSmoothPath(cameFrom, closestIndex, targetX, targetY);
    }

    return [{ x: targetX, y: targetY }];
  }

  reconstructAndSmoothPath(cameFrom, currentIndex, targetX, targetY) {
    const rawPath = [];
    let curr = currentIndex;
    while (curr !== -1) {
      const c = curr % this.cols;
      const r = Math.floor(curr / this.cols);
      rawPath.push({
        x: (c + 0.5) * this.tileSize,
        y: (r + 0.5) * this.tileSize
      });
      curr = cameFrom[curr];
    }
    rawPath.reverse();

    if (rawPath.length > 0) {
      rawPath[rawPath.length - 1] = { x: targetX, y: targetY };
    }

    if (rawPath.length <= 2) return rawPath;

    const smoothed = [rawPath[0]];
    let currentIdx = 0;

    while (currentIdx < rawPath.length - 1) {
      let farthestVisible = currentIdx + 1;
      for (let next = rawPath.length - 1; next > currentIdx + 1; next--) {
        if (this.hasLineOfSight(rawPath[currentIdx].x, rawPath[currentIdx].y, rawPath[next].x, rawPath[next].y)) {
          farthestVisible = next;
          break;
        }
      }
      smoothed.push(rawPath[farthestVisible]);
      currentIdx = farthestVisible;
    }

    return smoothed;
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

  isRoad(worldX, worldY) {
    if (this.theme !== 'urban' && this.theme !== 'wasteland') return false;
    for (const r of this.roads) {
      if (r.type === 'horizontal' && Math.abs(worldY - r.y) < r.width / 2) return true;
      if (r.type === 'vertical' && Math.abs(worldX - r.x) < r.width / 2) return true;
      if (r.type === 'curve') {
        const dist = Math.abs(worldY - (740 + Math.sin(worldX / 300) * 80));
        if (dist < 40) return true;
      }
    }
    return false;
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
          if (dc * dc + dr * dr <= rTiles * rTiles) {
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
    ctx.clearRect(0, 0, this.width, this.height);
    this.grid.fill(0);
    this.tiberiumFields = [];
    this.roads = [];
    this.lavaFissures = [];

    switch (this.theme) {
      case 'snow':
        this.generateSnow(ctx);
        break;
      case 'volcanic':
        this.generateVolcanic(ctx);
        break;
      case 'desert':
        this.generateDesert(ctx);
        break;
      case 'urban':
        this.generateUrban(ctx);
        break;
      case 'wasteland':
      default:
        this.generateWasteland(ctx);
        break;
    }
  }

  // =========================================================================
  // 1. BIOMA: TIBERIAN WASTELAND (Árido Clássico)
  // =========================================================================
  generateWasteland(ctx) {
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
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(75, 55, 30, 0.09)' : 'rgba(230, 200, 140, 0.12)';
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(40, 25, 10, 0.22)';
    for (let i = 0; i < 3000; i++) {
      ctx.fillRect(Math.random() * this.width, Math.random() * this.height, 2, 2);
    }

    this.renderWastelandRoad(ctx);
    this.generateRockClusters(ctx, '#5c4e3b', '#2d2419');

    // Campos de Tiberium Verde e Azul
    this.createTiberiumField(550, 480, 24, 'green');
    this.createTiberiumField(1750, 450, 24, 'green');
    this.createTiberiumField(550, 1320, 24, 'green');
    this.createTiberiumField(1750, 1320, 24, 'green');
    this.createTiberiumField(1200, 900, 36, 'mixed');
  }

  renderWastelandRoad(ctx) {
    this.roads.push({ type: 'curve', width: 60 });
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 700);
    ctx.bezierCurveTo(600, 720, 1200, 850, 1800, 840);
    ctx.lineTo(this.width, 920);
    ctx.lineTo(this.width, 980);
    ctx.bezierCurveTo(1800, 900, 1200, 910, 600, 780);
    ctx.lineTo(0, 760);
    ctx.closePath();

    ctx.fillStyle = '#26292b';
    ctx.fill();
    ctx.strokeStyle = '#1a1c1d';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.setLineDash([22, 18]);
    ctx.strokeStyle = '#c49a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 730);
    ctx.bezierCurveTo(600, 750, 1200, 880, 1800, 870);
    ctx.lineTo(this.width, 950);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // =========================================================================
  // 2. BIOMA: SIBERIAN PERMAFROST (Neve, Geleiras & Tiberium Azul Raro)
  // =========================================================================
  generateSnow(ctx) {
    const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
    grad.addColorStop(0, '#eaf1f7');
    grad.addColorStop(0.5, '#d3e2ee');
    grad.addColorStop(1, '#b5cfe5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Lagos de Gelo Translúcido
    const iceLakes = [
      { x: 1200, y: 900, rx: 180, ry: 120 },
      { x: 750, y: 350, rx: 110, ry: 75 },
      { x: 1650, y: 1400, rx: 130, ry: 90 }
    ];

    iceLakes.forEach(lake => {
      const lakeGrad = ctx.createRadialGradient(lake.x, lake.y, 10, lake.x, lake.y, lake.rx);
      lakeGrad.addColorStop(0, '#8ec4e8');
      lakeGrad.addColorStop(0.7, '#6baed6');
      lakeGrad.addColorStop(1, '#4292c6');
      ctx.fillStyle = lakeGrad;
      ctx.beginPath();
      ctx.ellipse(lake.x, lake.y, lake.rx, lake.ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Rachaduras no gelo
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(lake.x, lake.y);
        ctx.lineTo(lake.x + (Math.random() - 0.5) * lake.rx * 1.4, lake.y + (Math.random() - 0.5) * lake.ry * 1.4);
        ctx.stroke();
      }
    });

    // Ventos de Neve e Bancos de Neve
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(180, 210, 235, 0.15)';
      ctx.beginPath();
      ctx.arc(x, y, 10 + Math.random() * 50, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pinheiros Congelados
    this.generatePineTrees(ctx);

    // Rochas de Granito com Neve no Topo
    this.generateRockClusters(ctx, '#4d5866', '#26303b', true);

    // No mapa de neve, o Tiberium Azul Glacial de Alto Valor domina!
    this.createTiberiumField(550, 480, 26, 'blue');
    this.createTiberiumField(1750, 450, 26, 'blue');
    this.createTiberiumField(550, 1320, 26, 'blue');
    this.createTiberiumField(1750, 1320, 26, 'blue');
    this.createTiberiumField(1200, 900, 40, 'blue');
  }

  generatePineTrees(ctx) {
    const groves = [
      { x: 950, y: 300, count: 18 },
      { x: 1450, y: 1450, count: 22 },
      { x: 320, y: 850, count: 16 },
      { x: 2050, y: 850, count: 18 }
    ];

    groves.forEach(g => {
      for (let i = 0; i < g.count; i++) {
        const tx = g.x + (Math.random() - 0.5) * 160;
        const ty = g.y + (Math.random() - 0.5) * 140;

        // Tronco
        ctx.fillStyle = '#3a271d';
        ctx.fillRect(tx - 3, ty, 6, 12);

        // Folhagem de pinheiro com topo nevado
        ctx.fillStyle = '#1e3828';
        ctx.beginPath();
        ctx.moveTo(tx, ty - 26);
        ctx.lineTo(tx + 14, ty);
        ctx.lineTo(tx - 14, ty);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f0f6fc';
        ctx.beginPath();
        ctx.moveTo(tx, ty - 26);
        ctx.lineTo(tx + 7, ty - 14);
        ctx.lineTo(tx - 7, ty - 14);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  // =========================================================================
  // 3. BIOMA: VOLCANIC BADLANDS (Basalto Negro & Fissuras de Magma)
  // =========================================================================
  generateVolcanic(ctx) {
    const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
    grad.addColorStop(0, '#1c1614');
    grad.addColorStop(0.5, '#281d18');
    grad.addColorStop(1, '#151110');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Depósitos de fuligem e cinzas
    for (let i = 0; i < 2500; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      ctx.fillStyle = Math.random() > 0.6 ? 'rgba(255, 68, 0, 0.05)' : 'rgba(10, 8, 7, 0.4)';
      ctx.beginPath();
      ctx.arc(x, y, 15 + Math.random() * 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fissuras de Magma Incandescente
    this.renderLavaFissures(ctx);

    // Pilares de Basalto Escuro e Gargalos
    this.generateRockClusters(ctx, '#221b18', '#0d0a09', false, '#ff4400');

    // Tiberium concentrado em crateras térmicas
    this.createTiberiumField(550, 480, 24, 'mixed');
    this.createTiberiumField(1750, 450, 24, 'mixed');
    this.createTiberiumField(550, 1320, 24, 'mixed');
    this.createTiberiumField(1750, 1320, 24, 'mixed');
    this.createTiberiumField(1200, 900, 38, 'mixed');
  }

  renderLavaFissures(ctx) {
    const fissures = [
      { startX: 800, startY: 0, cp1x: 950, cp1y: 450, cp2x: 1100, cp2y: 750, endX: 1180, endY: 880 },
      { startX: 1600, startY: 1800, cp1x: 1450, cp1y: 1350, cp2x: 1300, cp2y: 1050, endX: 1220, endY: 920 }
    ];

    this.lavaFissures = fissures;

    fissures.forEach(f => {
      // Borda quente queimada
      ctx.beginPath();
      ctx.moveTo(f.startX, f.startY);
      ctx.bezierCurveTo(f.cp1x, f.cp1y, f.cp2x, f.cp2y, f.endX, f.endY);
      ctx.strokeStyle = '#5a1d08';
      ctx.lineWidth = 36;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Magma laranja
      ctx.strokeStyle = '#e64a19';
      ctx.lineWidth = 20;
      ctx.stroke();

      // Núcleo incandescente amarelo
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 8;
      ctx.stroke();
    });
  }

  // =========================================================================
  // 4. BIOMA: DESERT OASIS (Dunas de Areia, Cânions & Oásis Central)
  // =========================================================================
  generateDesert(ctx) {
    const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
    grad.addColorStop(0, '#e5b869');
    grad.addColorStop(0.5, '#d4a150');
    grad.addColorStop(1, '#ba8538');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Ondulações de Dunas
    for (let y = 0; y < this.height; y += 45) {
      ctx.strokeStyle = 'rgba(140, 95, 30, 0.18)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < this.width; x += 150) {
        ctx.quadraticCurveTo(x + 75, y + Math.sin(x / 60) * 16, x + 150, y);
      }
      ctx.stroke();
    }

    // Oásis Central com Lago de Água Azul Turquesa
    const oasisX = 1200, oasisY = 900;
    const waterGrad = ctx.createRadialGradient(oasisX, oasisY, 15, oasisX, oasisY, 140);
    waterGrad.addColorStop(0, '#00e5ff');
    waterGrad.addColorStop(0.5, '#0099cc');
    waterGrad.addColorStop(1, '#006699');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(oasisX, oasisY, 150, 95, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5cc68e';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Palmeiras ao redor do Oásis
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const px = oasisX + Math.cos(angle) * (140 + Math.random() * 35);
      const py = oasisY + Math.sin(angle) * (90 + Math.random() * 25);
      this.drawPalmTree(ctx, px, py);
    }

    // Penhascos de Arenito Vermelho
    this.generateRockClusters(ctx, '#9e6236', '#5c3116');

    // Tiberium no Deserto
    this.createTiberiumField(550, 480, 24, 'green');
    this.createTiberiumField(1750, 450, 24, 'green');
    this.createTiberiumField(550, 1320, 24, 'green');
    this.createTiberiumField(1750, 1320, 24, 'green');
    this.createTiberiumField(1200, 900, 36, 'mixed');
  }

  drawPalmTree(ctx, x, y) {
    ctx.fillStyle = '#6e4726';
    ctx.fillRect(x - 2, y, 5, 16);
    ctx.fillStyle = '#27ae60';
    for (let a = 0; a < 6; a++) {
      const rad = (a / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(rad) * 18, y + Math.sin(rad) * 12);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#27ae60';
      ctx.stroke();
    }
  }

  // =========================================================================
  // 5. BIOMA: MEGACITY RUINS (Asfalto Urbano, Ruínas & Aumento de Velocidade)
  // =========================================================================
  generateUrban(ctx) {
    const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
    grad.addColorStop(0, '#2b2f36');
    grad.addColorStop(0.5, '#202328');
    grad.addColorStop(1, '#181a1e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Malha de Ruas e Avenidas Urbanas (+20% velocidade de veículos!)
    this.roads = [
      { type: 'horizontal', y: 450, width: 80 },
      { type: 'horizontal', y: 1350, width: 80 },
      { type: 'vertical', x: 600, width: 80 },
      { type: 'vertical', x: 1800, width: 80 },
      { type: 'horizontal', y: 900, width: 100 }
    ];

    this.roads.forEach(r => {
      ctx.fillStyle = '#17191d';
      if (r.type === 'horizontal') {
        ctx.fillRect(0, r.y - r.width / 2, this.width, r.width);
        ctx.setLineDash([20, 15]);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, r.y);
        ctx.lineTo(this.width, r.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillRect(r.x - r.width / 2, 0, r.width, this.height);
        ctx.setLineDash([20, 15]);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(r.x, 0);
        ctx.lineTo(r.x, this.height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Blocos de Edifícios em Ruínas e Escombros Urbanos
    this.generateUrbanRuins(ctx);

    // Tiberium emergindo de crateras no asfalto
    this.createTiberiumField(550, 480, 24, 'green');
    this.createTiberiumField(1750, 450, 24, 'green');
    this.createTiberiumField(550, 1320, 24, 'green');
    this.createTiberiumField(1750, 1320, 24, 'green');
    this.createTiberiumField(1200, 900, 36, 'blue');
  }

  generateUrbanRuins(ctx) {
    const ruinBlocks = [
      { x: 300, y: 250, w: 120, h: 90 },
      { x: 1200, y: 300, w: 140, h: 100 },
      { x: 2100, y: 250, w: 130, h: 80 },
      { x: 900, y: 1350, w: 120, h: 90 },
      { x: 1500, y: 1350, w: 120, h: 90 },
      { x: 300, y: 1550, w: 110, h: 80 },
      { x: 2100, y: 1550, w: 120, h: 80 }
    ];

    ruinBlocks.forEach(b => {
      const minC = Math.floor((b.x - b.w / 2) / this.tileSize);
      const maxC = Math.floor((b.x + b.w / 2) / this.tileSize);
      const minR = Math.floor((b.y - b.h / 2) / this.tileSize);
      const maxR = Math.floor((b.y + b.h / 2) / this.tileSize);

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          this.setGrid(c, r, 1);
        }
      }

      ctx.fillStyle = '#121418';
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);

      ctx.fillStyle = '#3a404a';
      ctx.fillRect(b.x - b.w / 2 + 4, b.y - b.h / 2 + 4, b.w - 8, b.h - 8);

      ctx.strokeStyle = '#525b68';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);

      // Vergalhões de aço expostos
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 2;
      for (let s = 0; s < 5; s++) {
        ctx.beginPath();
        ctx.moveTo(b.x - b.w / 2 + s * 24, b.y - b.h / 2);
        ctx.lineTo(b.x - b.w / 2 + s * 24 + 10, b.y - b.h / 2 - 12);
        ctx.stroke();
      }
    });
  }

  // =========================================================================
  // FORMAÇÃO DE ROCHAS PROCEDURAIS
  // =========================================================================
  generateRockClusters(ctx, fillCol, strokeCol, hasSnowCap = false, lavaGlow = null) {
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

        ctx.fillStyle = fillCol;
        ctx.beginPath();
        ctx.moveTo(rx - rw / 2, ry);
        ctx.lineTo(rx - rw / 4, ry - rh / 2);
        ctx.lineTo(rx + rw / 3, ry - rh / 2 + 3);
        ctx.lineTo(rx + rw / 2, ry + 2);
        ctx.lineTo(rx + rw / 4, ry + rh / 2);
        ctx.lineTo(rx - rw / 3, ry + rh / 2 - 2);
        ctx.closePath();
        ctx.fill();

        if (hasSnowCap) {
          ctx.fillStyle = '#f4f8fb';
          ctx.beginPath();
          ctx.moveTo(rx - rw / 4, ry - rh / 2);
          ctx.lineTo(rx + rw / 3, ry - rh / 2 + 3);
          ctx.lineTo(rx + rw / 5, ry - rh / 4);
          ctx.closePath();
          ctx.fill();
        }

        if (lavaGlow) {
          ctx.strokeStyle = lavaGlow;
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
      }
    });
  }

  createTiberiumField(centerX, centerY, count, primaryType = 'green') {
    const field = { x: centerX, y: centerY, crystals: [] };
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 115;
      let crystalType = 'green';
      if (primaryType === 'blue') crystalType = 'blue';
      else if (primaryType === 'mixed') crystalType = Math.random() > 0.6 ? 'blue' : 'green';
      else crystalType = Math.random() > 0.88 ? 'blue' : 'green';

      field.crystals.push({
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        size: 15 + Math.random() * 11,
        maxHealth: 100,
        health: 100,
        pulsePhase: Math.random() * Math.PI * 2,
        type: crystalType
      });
    }
    this.tiberiumFields.push(field);
  }

  addTreadMark(x, y, angle) {
    const ctx = this.decalCtx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = this.theme === 'snow' ? 'rgba(70, 110, 150, 0.2)' : 'rgba(25, 20, 12, 0.15)';
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
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx, viewport) {
    if (this.terrainCanvas) {
      ctx.drawImage(this.terrainCanvas, 0, 0);
    }
    if (this.decalCanvas) {
      ctx.drawImage(this.decalCanvas, 0, 0);
    }

    const time = performance.now() * 0.003;

    // Brilho pulsante nas fissuras de magma (bioma vulcânico)
    if (this.theme === 'volcanic' && this.lavaFissures.length > 0) {
      const pulse = 0.5 + Math.sin(time * 2) * 0.3;
      ctx.save();
      ctx.globalAlpha = pulse;
      this.lavaFissures.forEach(f => {
        ctx.beginPath();
        ctx.moveTo(f.startX, f.startY);
        ctx.bezierCurveTo(f.cp1x, f.cp1y, f.cp2x, f.cp2y, f.endX, f.endY);
        ctx.strokeStyle = '#ff7700';
        ctx.lineWidth = 10;
        ctx.stroke();
      });
      ctx.restore();
    }

    // Renderização dos cristais de Tiberium com iluminação radial
    this.tiberiumFields.forEach(field => {
      const auraGrad = ctx.createRadialGradient(field.x, field.y, 20, field.x, field.y, 140);
      auraGrad.addColorStop(0, 'rgba(0, 255, 119, 0.22)');
      auraGrad.addColorStop(1, 'rgba(0, 255, 119, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(field.x, field.y, 140, 0, Math.PI * 2);
      ctx.fill();

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
        ctx.beginPath();
        ctx.arc(c.x, c.y, currentSize * 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = baseCol;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - currentSize);
        ctx.lineTo(c.x + currentSize * 0.45, c.y - currentSize * 0.2);
        ctx.lineTo(c.x + currentSize * 0.35, c.y + currentSize * 0.4);
        ctx.lineTo(c.x - currentSize * 0.35, c.y + currentSize * 0.4);
        ctx.lineTo(c.x - currentSize * 0.45, c.y - currentSize * 0.2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = coreCol;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - currentSize);
        ctx.lineTo(c.x + currentSize * 0.1, c.y);
        ctx.lineTo(c.x - currentSize * 0.35, c.y - currentSize * 0.2);
        ctx.closePath();
        ctx.fill();
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