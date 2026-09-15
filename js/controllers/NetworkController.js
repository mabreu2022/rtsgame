import { escapeHtml } from '../utils/MathUtils.js';
import { Building } from '../models/Building.js';
import { Unit } from '../models/Unit.js';

export class MultiplayerManager {
      constructor(engine) {
        this.engine = engine;
        this.peer = null;
        this.conn = null; // Usado por clientes conectados ao Host
        this.connections = []; // Usado pelo Host para gerenciar múltiplos clientes (Star P2P)
        this.roomId = null;
        this.isHost = false;
        this.connected = false;
        this.opponentName = '';

        this.commanderName = 'Cmd_' + Math.floor(100 + Math.random() * 900);
        this.myPeerId = 'cmd_' + Math.random().toString(36).substr(2, 6);
        this.onlinePeers = new Map();
        this.channel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('cnc_tiberian_network') : null;

        this.initDOM();
        this.initPresence();
        this.checkURLParams();
      }

      initDOM() {
        const btnOpen = document.getElementById('btnOpenMultiplayer');
        const modal = document.getElementById('multiplayer-modal');
        const btnClose = document.getElementById('btnCloseMultiplayer');

        if (btnOpen) btnOpen.onclick = () => { modal.style.display = 'flex'; };
        if (btnClose) btnClose.onclick = () => { modal.style.display = 'none'; };

        const btnCreate = document.getElementById('btnCreateRoom');
        if (btnCreate) btnCreate.onclick = () => this.createRoom();

        const btnJoin = document.getElementById('btnJoinRoom');
        if (btnJoin) btnJoin.onclick = () => {
          const code = document.getElementById('joinRoomCodeInput').value.trim().toUpperCase();
          if (code) this.joinRoom(code);
        };

        const btnCopy = document.getElementById('btnCopyRoomCode');
        if (btnCopy) btnCopy.onclick = () => {
          if (this.roomId) {
            navigator.clipboard.writeText(this.roomId).then(() => {
              btnCopy.innerText = 'COPIADO!';
              setTimeout(() => btnCopy.innerText = '📋 COPIAR CÓDIGO', 2000);
            });
          }
        };

        // Copiar Link Compartilhável Direto (?room=CODE)
        const btnCopyLink = document.getElementById('btnCopyInviteLink');
        if (btnCopyLink) {
          btnCopyLink.onclick = () => {
            if (this.roomId) {
              const url = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
              navigator.clipboard.writeText(url).then(() => {
                btnCopyLink.innerText = '✅ LINK COPIADO!';
                setTimeout(() => btnCopyLink.innerText = '🔗 COPIAR LINK DE CONVITE', 2200);
              });
            }
          };
        }

        // Botão Iniciar Batalha / Aplicar Configurações no Lobby
        const btnStartLobby = document.getElementById('btnStartOrApplyLobby');
        if (btnStartLobby) {
          btnStartLobby.onclick = () => {
            this.applyLobbySettings();
            modal.style.display = 'none';
          };
        }

        // Toasts de Convite Entrante
        const btnAcceptInvite = document.getElementById('btnAcceptInvite');
        const btnDeclineInvite = document.getElementById('btnDeclineInvite');
        const btnDismiss = document.getElementById('btnDismissInvite');
        const toast = document.getElementById('invite-toast');

        if (btnAcceptInvite) {
          btnAcceptInvite.onclick = () => {
            if (this.pendingInviteRoom) {
              toast.style.display = 'none';
              this.joinRoom(this.pendingInviteRoom);
            }
          };
        }
        if (btnDeclineInvite) btnDeclineInvite.onclick = () => { toast.style.display = 'none'; };
        if (btnDismiss) btnDismiss.onclick = () => { toast.style.display = 'none'; };

        // Chat Tático
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('chat-send-btn');
        const sendChat = () => {
          const text = chatInput.value.trim();
          if (!text) return;
          chatInput.value = '';
          this.sendChatMessage(text);
          chatInput.blur();
        };

        if (chatSendBtn) chatSendBtn.onclick = sendChat;
        if (chatInput) {
          chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendChat();
            else if (e.key === 'Escape') chatInput.blur();
          });
        }

        window.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && document.activeElement !== chatInput && (!modal || modal.style.display !== 'flex')) {
            chatInput.focus();
            e.preventDefault();
          }
        });
      }

      applyLobbySettings() {
        // Atualiza modo de vitória
        const selObj = document.getElementById('selectVictoryObjective');
        if (selObj) {
          this.engine.victoryMode = selObj.value;
          const badgeVal = document.getElementById('hud-victory-val');
          if (badgeVal) {
            const texts = {
              annihilation: 'ANIQUILAÇÃO TOTAL',
              assassination: 'DESTRUIÇÃO DE HQ',
              tiberium_race: 'CORRIDA TIBERIANA',
              king_of_hill: 'REI DA COLINA'
            };
            badgeVal.innerText = texts[selObj.value] || selObj.value.toUpperCase();
          }
        }

        // Atualiza slots de jogadores
        const s2 = document.getElementById('selectSlot2');
        const s3 = document.getElementById('selectSlot3');
        const s4 = document.getElementById('selectSlot4');

        this.engine.slotConfigs = {
          slot1: 'human',
          slot2: s2 ? s2.value : 'ai_medium',
          slot3: s3 ? s3.value : 'closed',
          slot4: s4 ? s4.value : 'closed'
        };

        this.engine.initEntities();
        this.engine.eva.speak('Battle control online.');
        this.engine.showEvaMessage('CONFIGURAÇÃO DE SALA APLICADA COM SUCESSO');
      }

      initPresence() {
        if (!this.channel) return;

        this.channel.onmessage = (e) => {
          const data = e.data;
          if (!data || !data.type) return;

          if (data.type === 'PRESENCE_PING') {
            if (data.id !== this.myPeerId) {
              this.onlinePeers.set(data.id, data);
            }
          } else if (data.type === 'INVITE_OFFER') {
            if (data.targetPeerId === this.myPeerId || !data.targetPeerId) {
              this.pendingInviteRoom = data.roomId;
              const msg = document.getElementById('inviteToastMsg');
              if (msg) msg.innerHTML = `Comandante <strong>${escapeHtml(data.senderName)}</strong> convidou você para a sala <strong>${escapeHtml(data.roomId)}</strong>!`;
              const toast = document.getElementById('invite-toast');
              if (toast) toast.style.display = 'block';
              this.engine.sounds.playEvaChime('ready');
            }
          }
        };

        // Heartbeat a cada 2.5s
        setInterval(() => {
          if (this.channel) {
            this.channel.postMessage({
              type: 'PRESENCE_PING',
              id: this.myPeerId,
              name: this.commanderName,
              roomId: this.roomId,
              isHost: this.isHost,
              time: Date.now()
            });
          }
          this.cleanAndRenderOnlineList();
        }, 2500);
      }

      cleanAndRenderOnlineList() {
        const now = Date.now();
        for (const [id, peer] of this.onlinePeers.entries()) {
          if (now - peer.time > 7000) {
            this.onlinePeers.delete(id);
          }
        }

        const list = document.getElementById('onlinePlayersList');
        const countTxt = document.getElementById('onlineCountTxt');
        if (!list) return;

        const totalOnline = 1 + this.onlinePeers.size;
        if (countTxt) countTxt.innerText = `${totalOnline} ONLINE`;

        list.innerHTML = `
          <div class="online-player-item">
            <div class="player-info-badge">
              <span class="status-live-dot"></span>
              <span>Você (${this.commanderName})</span>
            </div>
            <span style="color: #728599; font-size: 10px;">SEU DISPOSITIVO ${this.roomId ? `| SALA: ${this.roomId}` : ''}</span>
          </div>
        `;

        this.onlinePeers.forEach(peer => {
          const item = document.createElement('div');
          item.className = 'online-player-item';

          let actionBtn = '';
          if (peer.roomId && peer.isHost) {
            actionBtn = `<button class="btn-action-small" onclick="window.game.multiplayer.joinRoom('${peer.roomId}')">⚔️ ENTRAR (${peer.roomId})</button>`;
          } else if (this.isHost && this.roomId) {
            actionBtn = `<button class="btn-action-small" onclick="window.game.multiplayer.inviteCommander('${peer.id}')">✉️ CONVIDAR</button>`;
          }

          item.innerHTML = `
            <div class="player-info-badge">
              <span class="status-live-dot"></span>
              <span>${escapeHtml(peer.name)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${actionBtn}
            </div>
          `;
          list.appendChild(item);
        });
      }

      inviteCommander(targetPeerId) {
        if (!this.channel || !this.roomId) return;
        this.channel.postMessage({
          type: 'INVITE_OFFER',
          targetPeerId: targetPeerId,
          senderName: this.commanderName,
          roomId: this.roomId
        });
        this.engine.showEvaMessage('CONVITE MILITAR TRANSMITIDO');
        this.engine.sounds.playSelect();
      }

      checkURLParams() {
        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get('room');
        if (roomCode) {
          const modal = document.getElementById('multiplayer-modal');
          if (modal) modal.style.display = 'flex';
          const input = document.getElementById('joinRoomCodeInput');
          if (input) input.value = roomCode.trim().toUpperCase();
          setTimeout(() => {
            this.joinRoom(roomCode.trim().toUpperCase());
          }, 600);
        }
      }

      createRoom() {
        if (typeof Peer === 'undefined') {
          alert('Biblioteca PeerJS indisponível. O jogo continuará operando normalmente em Modo Solo.');
          return;
        }

        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        this.roomId = `GDI-${randomSuffix}`;
        this.isHost = true;
        this.connections = [];

        try {
          this.peer = new Peer(this.roomId, {
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
              ]
            }
          });
        } catch (err) {
          console.error(err);
          alert('Erro ao inicializar PeerJS: ' + err.message);
          return;
        }

        document.getElementById('btnCreateRoom').style.display = 'none';
        document.getElementById('host-room-info').style.display = 'flex';
        document.getElementById('displayRoomCode').innerText = this.roomId;
        document.getElementById('hostStatusTxt').innerText = 'Aguardando comandantes se conectarem...';

        this.peer.on('open', (id) => {
          this.engine.showEvaMessage(`SALA CRIADA: ${id}`);
          this.engine.eva.speak('Transmission channel open.');
        });

        this.peer.on('call', (call) => this.handleIncomingMediaCall(call));
        this.peer.on('connection', (conn) => {
          this.setupConnectionHandlers(conn);
        });

        this.peer.on('error', (err) => {
          console.error('Peer error:', err);
          document.getElementById('hostStatusTxt').innerText = 'Status: ' + err.type;
        });
      }

      joinRoom(roomId) {
        if (typeof Peer === 'undefined') {
          alert('Biblioteca PeerJS indisponível. O jogo continuará operando normalmente em Modo Solo.');
          return;
        }

        this.isHost = false;
        this.roomId = roomId;

        try {
          this.peer = new Peer(null, {
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
              ]
            }
          });
        } catch (err) {
          console.error(err);
          alert('Erro ao inicializar PeerJS: ' + err.message);
          return;
        }

        document.getElementById('btnJoinRoom').style.display = 'none';
        document.getElementById('join-status-info').style.display = 'block';
        document.getElementById('clientStatusTxt').innerText = `Conectando a ${roomId}...`;

        this.peer.on('open', () => {
          this.peer.on('call', (call) => this.handleIncomingMediaCall(call));
          this.conn = this.peer.connect(roomId, { reliable: true });
          this.setupConnectionHandlers(this.conn);
        });

        this.peer.on('error', (err) => {
          console.error('Peer error:', err);
          document.getElementById('clientStatusTxt').innerText = 'Falha: ' + err.type;
          document.getElementById('btnJoinRoom').style.display = 'block';
        });
      }

      setupConnectionHandlers(conn) {
        conn.on('open', () => {
          if (this.isHost) {
            // Host atribui slot livre (slot2, slot3 ou slot4)
            const takenSlots = this.connections.map(c => c.slotId);
            const nextSlot = ['slot2', 'slot3', 'slot4'].find(s => !takenSlots.includes(s));
            if (!nextSlot) {
              conn.send({ type: 'ROOM_FULL' });
              conn.close();
              return;
            }

            conn.slotId = nextSlot;
            this.connections.push(conn);
            this.connected = true;

            const slotTxt = document.getElementById(`${nextSlot}StatusTxt`);
            if (slotTxt) {
              slotTxt.style.display = 'block';
              slotTxt.innerText = `👤 CONECTADO (${conn.peer.substr(0, 6)})`;
              slotTxt.style.color = '#00ff66';
            }

            // Envia Handshake ao novo cliente com o slot dele e o modo de jogo
            conn.send({
              type: 'HANDSHAKE',
              assignedSlot: nextSlot,
              slotConfigs: this.engine.slotConfigs,
              victoryMode: this.engine.victoryMode,
              hostName: this.commanderName
            });

            this.engine.showEvaMessage(`COMANDANTE CONECTADO NO ${nextSlot.toUpperCase()}`);
            this.engine.eva.speak('Reinforcements arrived.');
            this.engine.sounds.playEvaChime('ready');
            this.updateHUDMultiplayerStatus();
          } else {
            this.connected = true;
            this.conn = conn;
          }
        });

        conn.on('data', (data) => {
          this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
          if (this.isHost) {
            const idx = this.connections.indexOf(conn);
            if (idx !== -1) {
              const disconnectedSlot = this.connections[idx].slotId;
              this.connections.splice(idx, 1);
              const slotTxt = document.getElementById(`${disconnectedSlot}StatusTxt`);
              if (slotTxt) {
                slotTxt.style.display = 'none';
              }
              this.engine.showEvaMessage(`COMANDANTE ${disconnectedSlot.toUpperCase()} DESCONECTADO`);
              this.engine.eva.speak('Transmission link lost.');
              this.updateHUDMultiplayerStatus();
            }
          } else {
            this.connected = false;
            this.engine.showEvaMessage('CONEXÃO COM O HOST PERDIDA');
            this.engine.eva.speak('Transmission link lost.');
            this.updateHUDMultiplayerStatus();
          }
        });
      }

      updateHUDMultiplayerStatus() {
        const hudMp = document.getElementById('hud-mp-status');
        const statVal = document.getElementById('mpCurrentStatusVal');
        if (this.isHost) {
          const count = 1 + this.connections.length;
          if (hudMp) {
            hudMp.innerText = `🌐 SALA HOST (${count}/4)`;
            hudMp.style.color = '#00ff66';
          }
          if (statVal) {
            statVal.innerText = `HOST DA SALA [${this.roomId}] (${count}/4 COMANDANTES)`;
            statVal.style.color = '#00e5ff';
          }
        } else if (this.connected) {
          if (hudMp) {
            hudMp.innerText = `🌐 CLIENTE (${this.engine.myFaction.toUpperCase()})`;
            hudMp.style.color = '#00ff66';
          }
          if (statVal) {
            statVal.innerText = `CONECTADO COMO ${this.engine.myFaction.toUpperCase()}`;
            statVal.style.color = '#00e5ff';
          }
        } else {
          if (hudMp) {
            hudMp.innerText = '🌐 MODO SOLO';
            hudMp.style.color = '#ffaa00';
          }
          if (statVal) {
            statVal.innerText = 'DESCONECTADO (MODO SOLO)';
            statVal.style.color = 'var(--hud-amber)';
          }
        }
      }

      send(packet) {
        if (this.isHost) {
          this.connections.forEach(conn => {
            if (conn.open) {
              try { conn.send(packet); } catch (err) {}
            }
          });
        } else if (this.conn && this.conn.open) {
          try { this.conn.send(packet); } catch (err) {}
        }
      }

      broadcast(packet, exceptConn = null) {
        if (this.isHost) {
          this.connections.forEach(conn => {
            if (conn !== exceptConn && conn.open) {
              try { conn.send(packet); } catch (err) {}
            }
          });
        }
      }

      sendStateSync() {
        if (!this.isHost || this.connections.length === 0) return;
        const unitSnapshots = this.engine.units.map(u => ({
          uid: u.uid,
          x: Math.round(u.x),
          y: Math.round(u.y),
          hp: Math.round(u.hp),
          state: u.state
        }));
        const bldgSnapshots = this.engine.buildings.map(b => ({
          uid: b.uid,
          hp: Math.round(b.hp),
          isConstructing: b.isConstructing,
          constructProgress: Math.round(b.constructProgress * 100) / 100
        }));
        this.send({
          type: 'SYNC_STATE',
          units: unitSnapshots,
          buildings: bldgSnapshots
        });
      }

      handleStateSync(data) {
        if (data.units) {
          data.units.forEach(snap => {
            const u = this.engine.units.find(unit => unit.uid === snap.uid);
            if (u) {
              if (Math.hypot(u.x - snap.x, u.y - snap.y) > 35) {
                u.x = snap.x;
                u.y = snap.y;
              }
              u.hp = snap.hp;
            }
          });
        }
        if (data.buildings) {
          data.buildings.forEach(snap => {
            const b = this.engine.buildings.find(bldg => bldg.uid === snap.uid);
            if (b) {
              b.hp = snap.hp;
              b.isConstructing = snap.isConstructing;
              b.constructProgress = snap.constructProgress;
            }
          });
        }
      }

      handleIncomingData(data, fromConn) {
        if (!data || !data.type) return;

        // Se o Host recebe comando de um cliente, retransmite aos outros clientes (Star Topology)
        if (this.isHost) {
          this.broadcast(data, fromConn);
        }

        switch (data.type) {
          case 'HANDSHAKE': {
            if (!this.isHost && data.assignedSlot) {
              this.engine.myFaction = data.assignedSlot;
              this.engine.slotConfigs = data.slotConfigs || this.engine.slotConfigs;
              this.engine.victoryMode = data.victoryMode || this.engine.victoryMode;
              this.engine.initEntities();
              this.updateHUDMultiplayerStatus();

              const facNames = {
                slot1: 'FORÇAS GDI AZUL',
                slot2: 'IRMANDADE NOD VERMELHO',
                slot3: 'FORÇAS GDI OURO',
                slot4: 'IRMANDADE NOD ROXO'
              };
              const facVal = document.getElementById('hud-faction-val');
              if (facVal) {
                facVal.innerText = facNames[data.assignedSlot] || data.assignedSlot.toUpperCase();
                facVal.style.color = (data.assignedSlot === 'slot2' || data.assignedSlot === 'slot4') ? '#ff3344' : '#00e5ff';
              }

              this.engine.showEvaMessage(`CONECTADO COMO ${facNames[data.assignedSlot]}!`);
              this.engine.eva.speak('Battle control online.');
              this.engine.sounds.playEvaChime('ready');
              const modal = document.getElementById('multiplayer-modal');
              if (modal) modal.style.display = 'none';
            }
            break;
          }

          case 'CMD_MOVE': {
            const targets = this.engine.units.filter(u => data.uids.includes(u.uid));
            targets.forEach((u, idx) => {
              if (data.isHarvesting && data.fieldIndex !== undefined && this.engine.map.tiberiumFields[data.fieldIndex]) {
                u.targetField = this.engine.map.tiberiumFields[data.fieldIndex];
                u.state = 'HARVESTING';
              } else {
                const spread = (idx - (targets.length - 1) / 2) * 25;
                u.moveTo(data.targetX + spread, data.targetY);
              }
            });
            break;
          }

          case 'CMD_ATTACK': {
            const attackers = this.engine.units.filter(u => data.uids.includes(u.uid));
            let target = null;
            if (data.targetType === 'unit') {
              target = this.engine.units.find(u => u.uid === data.targetUid);
            } else {
              target = this.engine.buildings.find(b => b.uid === data.targetUid);
            }
            if (target) {
              attackers.forEach(u => u.attack(target));
            }
            break;
          }

          case 'CMD_BUILD': {
            const newB = new Building(data.x, data.y, data.buildingType, data.faction, true, data.uid);
            this.engine.buildings.push(newB);
            this.engine.recalculatePower();
            break;
          }

          case 'CMD_TRAIN': {
            const newU = new Unit(data.spawnX, data.spawnY, data.unitType, data.faction, data.uid);
            newU.moveTo(data.targetX, data.targetY);
            this.engine.units.push(newU);
            break;
          }

          case 'CMD_ION': {
            this.engine.triggerIonCannon(data.x, data.y, false);
            break;
          }

          case 'CMD_NUKE': {
            this.engine.triggerNukeStrike(data.x, data.y, false);
            break;
          }

          case 'CMD_REPAIR': {
            const b = this.engine.buildings.find(b => b.uid === data.uid);
            if (b) b.isRepairing = data.isRepairing;
            break;
          }

          case 'CMD_SELL': {
            const b = this.engine.buildings.find(b => b.uid === data.uid);
            if (b) this.engine.sellBuilding(b, false);
            break;
          }

          case 'CMD_CHAT': {
            this.addChatMessage(data.sender, data.text, data.faction);
            break;
          }

          
          
          case 'DIPLO_SYNC': {
            this.engine.setAlliance(data.s1, data.s2, data.isAllied, false);
            break;
          }

          case 'DIPLO_PROPOSAL': {
            if (data.toSlot === this.engine.myFaction) {
              const accept = confirm(`O Comandante do ${data.fromSlot.toUpperCase()} propõe um Pacto de Aliança Militar! Deseja aceitar?`);
              if (accept) {
                this.engine.setAlliance(data.fromSlot, data.toSlot, true, true);
                this.engine.eva.speak('Alliance formed.');
                this.engine.showEvaMessage(`ALIANÇA MILITAR FIRMADA COM ${data.fromSlot.toUpperCase()}!`);
              }
            }
            break;
          }

          case 'DIPLO_BREAK': {
            this.engine.setAlliance(data.fromSlot, data.toSlot, false, false);
            this.engine.eva.speak('Alliance terminated! Enemy detected.');
            this.engine.showEvaMessage(`ALERTA DIPLOMÁTICO: ${data.fromSlot.toUpperCase()} ROMPEU A ALIANÇA!`);
            this.engine.sounds.playEvaChime('alert');
            break;
          }

          case 'SYNC_MAP_THEME': {
            this.engine.changeMapTheme(data.theme, false);
            break;
          }

          case 'COMMS_STATUS': {
            this.updateSlotMediaUI(data.slot, data.hasVideo, data.hasAudio);
            break;
          }

          case 'SYNC_STATE': {
            if (!this.isHost) {
              this.handleStateSync(data);
            }
            break;
          }
        }
      }

      
      // =========================================================================
      // TRANSMISSÃO DE VÍDEOCONFERÊNCIA WEBRTC (CÂMERA & MICROFONE)
      // =========================================================================
      async toggleCamera() {
        const btnCam = document.getElementById('btnToggleCam');
        if (this.isCameraOn) {
          if (this.localStream) {
            this.localStream.getVideoTracks().forEach(t => t.stop());
          }
          this.isCameraOn = false;
          if (btnCam) btnCam.innerText = '📹 CÂMERA: OFF';
          this.updateSlotMediaUI(this.engine.myFaction, false, !this.isMicMuted);
          this.broadcastMediaStatus(false, !this.isMicMuted);
        } else {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: 320, height: 240, frameRate: 15 },
              audio: true
            });
            this.localStream = stream;
            this.isCameraOn = true;
            this.isMicMuted = false;
            if (btnCam) btnCam.innerText = '📹 CÂMERA: ON';

            const mySlot = this.engine.myFaction;
            const localVid = document.getElementById(`video-slot-${mySlot}`);
            const localHolo = document.getElementById(`holo-slot-${mySlot}`);
            if (localVid) {
              localVid.srcObject = stream;
              localVid.muted = true;
              localVid.play().catch(() => {});
              localVid.style.display = 'block';
            }
            if (localHolo) localHolo.style.display = 'none';

            this.updateSlotMediaUI(mySlot, true, true);
            this.broadcastMediaStatus(true, true);

            // Chama os peers conectados
            this.callAllConnectedPeers();
          } catch (err) {
            console.warn('Erro ao acessar webcam:', err);
            alert('Não foi possível acessar a câmera: ' + (err.message || 'Permissão negada.'));
          }
        }
      }

      toggleMic() {
        const btnMic = document.getElementById('btnToggleMic');
        if (!this.localStream) return;
        this.isMicMuted = !this.isMicMuted;
        this.localStream.getAudioTracks().forEach(t => t.enabled = !this.isMicMuted);
        if (btnMic) btnMic.innerText = this.isMicMuted ? '🎙️ MIC: MUTADO' : '🎙️ MIC: ON';
        this.broadcastMediaStatus(this.isCameraOn, !this.isMicMuted);
      }

      callAllConnectedPeers() {
        if (!this.peer || !this.localStream) return;
        if (this.isHost) {
          this.connections.forEach(c => {
            this.callPeerMedia(c.peer, c.slotId);
          });
        } else if (this.conn && this.conn.peer) {
          this.callPeerMedia(this.conn.peer, 'slot1');
        }
      }

      callPeerMedia(remotePeerId, slotId) {
        if (!this.peer || !this.localStream) return;
        const call = this.peer.call(remotePeerId, this.localStream);
        this.handleMediaCall(call, slotId);
      }

      handleIncomingMediaCall(call) {
        call.answer(this.localStream || undefined);
        let senderSlot = 'slot1';
        if (this.isHost) {
          const matched = this.connections.find(c => c.peer === call.peer);
          if (matched) senderSlot = matched.slotId;
        }
        this.handleMediaCall(call, senderSlot);
      }

      handleMediaCall(call, slotId) {
        call.on('stream', (remoteStream) => {
          const vid = document.getElementById(`video-slot-${slotId}`);
          const holo = document.getElementById(`holo-slot-${slotId}`);
          if (vid) {
            vid.srcObject = remoteStream;
            vid.play().catch(() => {});
            vid.style.display = 'block';
          }
          if (holo) holo.style.display = 'none';
          this.updateSlotMediaUI(slotId, true, true);
        });

        call.on('close', () => {
          const vid = document.getElementById(`video-slot-${slotId}`);
          const holo = document.getElementById(`holo-slot-${slotId}`);
          if (vid) {
            vid.srcObject = null;
            vid.style.display = 'none';
          }
          if (holo) holo.style.display = 'flex';
          this.updateSlotMediaUI(slotId, false, false);
        });
      }

      broadcastMediaStatus(hasVideo, hasAudio) {
        this.send({
          type: 'COMMS_STATUS',
          slot: this.engine.myFaction,
          hasVideo: hasVideo,
          hasAudio: hasAudio
        });
      }

      updateSlotMediaUI(slot, hasVideo, hasAudio) {
        const badge = document.getElementById(`badge-media-${slot}`);
        if (badge) {
          if (hasVideo) {
            badge.innerHTML = `<span style="color: #00ff66;">● AO VIVO</span> ${hasAudio ? '🎙️' : '🔇'}`;
          } else {
            badge.innerHTML = `<span>HOLOGRÁFICO</span> ${hasAudio ? '🎙️' : ''}`;
          }
        }
      }

      sendChatMessage(text) {
        const sender = this.engine.myFaction.toUpperCase();
        this.addChatMessage(sender, text, this.engine.myFaction);
        this.send({
          type: 'CMD_CHAT',
          sender: sender,
          text: text,
          faction: this.engine.myFaction
        });
      }

      addChatMessage(sender, text, faction = 'slot1') {
        const log = document.getElementById('chat-log');
        if (!log) return;

        const isEnemy = !this.engine.isFriendly(faction);
        const msgEl = document.createElement('div');
        msgEl.className = `chat-msg ${isEnemy ? 'nod' : ''}`;
        msgEl.innerHTML = `<span class="chat-sender" style="color: ${isEnemy ? 'var(--hud-red)' : 'var(--hud-cyan)'};">[${sender}]:</span> ${escapeHtml(text)}`;
        log.appendChild(msgEl);

        if (log.children.length > 6) {
          log.removeChild(log.children[0]);
        }

        setTimeout(() => {
          if (msgEl.parentNode) {
            msgEl.style.transition = 'opacity 1s ease';
            msgEl.style.opacity = '0';
            setTimeout(() => { if (msgEl.parentNode) msgEl.parentNode.removeChild(msgEl); }, 1000);
          }
        }, 8000);
      }
    }