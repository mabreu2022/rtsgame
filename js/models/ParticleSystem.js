export class ParticleSystem {
      constructor() {
        this.particles = [];
      }

      createExplosion(x, y, scale = 1.0) {
        this.particles.push({
          x, y, type: 'flash', radius: 35 * scale, life: 0.1, maxLife: 0.1, color: '#ffffff'
        });

        const fireballCount = Math.floor(10 * scale);
        for (let i = 0; i < fireballCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (20 + Math.random() * 50) * scale;
          this.particles.push({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            type: 'fire', radius: (14 + Math.random() * 16) * scale,
            life: 0.35 + Math.random() * 0.15, maxLife: 0.5
          });
        }

        const smokeCount = Math.floor(14 * scale);
        for (let i = 0; i < smokeCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (10 + Math.random() * 25) * scale;
          this.particles.push({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 15,
            type: 'smoke', radius: (16 + Math.random() * 22) * scale,
            growth: 15 * scale, life: 0.8 + Math.random() * 0.5, maxLife: 1.3,
            color: 'rgba(50, 50, 50,'
          });
        }

        const sparkCount = Math.floor(12 * scale);
        for (let i = 0; i < sparkCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (60 + Math.random() * 120) * scale;
          this.particles.push({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            type: 'spark', radius: 2, life: 0.5 + Math.random() * 0.4, maxLife: 0.9, color: '#ffdd33'
          });
        }
      }

      createMuzzleFlash(x, y, angle) {
        this.particles.push({
          x: x + Math.cos(angle) * 8, y: y + Math.sin(angle) * 8, angle,
          type: 'muzzle', radius: 18, life: 0.08, maxLife: 0.08
        });
      }

      createHarvestSparks(x, y) {
        for (let i = 0; i < 3; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 20 + Math.random() * 30;
          this.particles.push({
            x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 10,
            type: 'spark', radius: 1.5, life: 0.3, maxLife: 0.3, color: '#00ff77'
          });
        }
      }

      // Fumaça verde tóxica de envenenamento de Tiberium
      createToxicCloud(x, y) {
        this.particles.push({
          x, y, vx: (Math.random() - 0.5) * 8, vy: -12 - Math.random() * 10,
          type: 'smoke', radius: 8, growth: 8, life: 0.5, maxLife: 0.5, color: 'rgba(0, 255, 119,'
        });
      }

      createTreadDust(x, y) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
          type: 'dust', radius: 5 + Math.random() * 5, life: 0.4, maxLife: 0.4, color: 'rgba(150, 130, 95,'
        });
      }

      createJetTrail(x, y) {
        this.particles.push({
          x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
          type: 'fire', radius: 6, life: 0.2, maxLife: 0.2
        });
      }

      createDamageSmoke(x, y) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 12,
          vy: -22 - Math.random() * 18,
          type: 'smoke',
          radius: 7 + Math.random() * 5,
          growth: 12,
          life: 0.65 + Math.random() * 0.35,
          maxLife: 1.0,
          color: 'rgba(25, 25, 28,'
        });
      }

      createBuildingFire(x, y, w = 60, h = 60) {
        const px = x + (Math.random() - 0.5) * (w * 0.5);
        const py = y + (Math.random() - 0.5) * (h * 0.5);
        this.particles.push({
          x: px, y: py,
          vx: (Math.random() - 0.5) * 10,
          vy: -15 - Math.random() * 20,
          type: 'fire',
          radius: 8 + Math.random() * 8,
          life: 0.25 + Math.random() * 0.2,
          maxLife: 0.45
        });
        if (Math.random() > 0.4) {
          this.createDamageSmoke(px, py);
        }
      }


      update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.life -= dt;
          if (p.life <= 0) { this.particles.splice(i, 1); continue; }
          if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
          if (p.type === 'smoke' || p.type === 'dust') {
            p.radius += (p.growth || 6) * dt;
            p.vx *= 0.94; p.vy *= 0.94;
          } else if (p.type === 'spark') {
            p.vy += 180 * dt; p.vx *= 0.96;
          }
        }
      }

      draw(ctx) {
        this.particles.forEach(p => {
          const progress = p.life / p.maxLife;
          if (p.type === 'flash') {
            ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.9})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
          } else if (p.type === 'fire') {
            const alpha = progress;
            const r = p.radius * (1 + (1 - progress) * 0.6);
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            grad.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
            grad.addColorStop(0.4, `rgba(255, 120, 0, ${alpha * 0.8})`);
            grad.addColorStop(1, `rgba(40, 10, 0, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          } else if (p.type === 'smoke') {
            const alpha = progress * 0.55;
            ctx.fillStyle = `${p.color} ${alpha})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
          } else if (p.type === 'dust') {
            ctx.fillStyle = `${p.color} ${progress * 0.3})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
          } else if (p.type === 'spark') {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 1, p.y - 1, p.radius * 2, p.radius * 2);
          } else if (p.type === 'muzzle') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = 'rgba(255, 230, 120, 0.95)';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(p.radius * 1.4, -p.radius * 0.5);
            ctx.lineTo(p.radius * 1.8, 0); ctx.lineTo(p.radius * 1.4, p.radius * 0.5);
            ctx.closePath(); ctx.fill();
            ctx.restore();
          }
        });
      }
    }

    /* =========================================================================
       4. ESTRUTURAS MILITARES COM ANDAIMES E MODO REPARO
       ========================================================================= */