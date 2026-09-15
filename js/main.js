import { Engine } from './controllers/GameEngine.js';

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Engine();
});