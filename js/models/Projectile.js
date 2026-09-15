export class Projectile {
      constructor(x, y, target, damage, type = 'shell', faction = 'player', shooter = null) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.type = type;
        this.faction = faction;
        this.shooter = shooter;
        this.dead = false;

        this.speed = type === 'laser' ? 450 : (type === 'bullet' ? 480 : (type === 'rocket' ? 320 : 380));
        this.trail = [];
      }

      update(dt, engine) {
        if (!this.target || this.target.hp <= 0) {
          this.dead = true;
          return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= this.speed * dt + 6) {
          this.target.hp -= this.damage;
          this.dead = true;

          engine.particles.createExplosion(this.target.x, this.target.y, this.type === 'bullet' ? 0.25 : 0.55);
          engine.sounds.playExplosion();

          // Se destruiu o alvo, pontua veterania para o atirador
          if (this.target.hp <= 0) {
            if (this.shooter && this.shooter.addKill) this.shooter.addKill();
            engine.particles.createExplosion(this.target.x, this.target.y, 1.2);
            engine.map.addScorchMark(this.target.x, this.target.y, 35);
          }
        } else {
          this.trail.push({ x: this.x, y: this.y });
          if (this.trail.length > 5) this.trail.shift();
          this.x += (dx / dist) * this.speed * dt;
          this.y += (dy / dist) * this.speed * dt;
        }
      }

      draw(ctx) {
        if (this.type === 'laser') {
          ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.target.x, this.target.y); ctx.stroke();
        } else if (this.type === 'rocket') {
          ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)'; ctx.lineWidth = 2;
          ctx.beginPath();
          this.trail.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
          ctx.stroke();
          ctx.fillStyle = '#e74c3c';
          ctx.beginPath(); ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = (this.shooter && this.shooter.rank === 2) ? '#ff3344' : '#ffee88';
          ctx.beginPath(); ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    /* =========================================================================
       7. SIDEBAR DE COMANDO, FILAS, REPARAR/VENDER E CANHÃO DE ÍONS
       ========================================================================= */