const fs = require('fs');
const path = require('path');

const css = fs.readFileSync('temp_extracted.css', 'utf8');

if (!fs.existsSync('css')) fs.mkdirSync('css');

const idxOverlays = css.indexOf('/* OVERLAYS MILITARES NO CANTO DO VIEWPORT */');
const idxSidebar = css.indexOf('/* SIDEBAR MILITAR TÁTICA RETRÔ/SCI-FI (C&C STYLE) */');
const idxChat = css.indexOf('/* CHAT TÁTICO MILITAR */');

const mainCss = css.substring(0, idxOverlays).trim();
const hudCss = css.substring(idxOverlays, idxSidebar).trim();
const sidebarCss = css.substring(idxSidebar, idxChat).trim();
const modalsCss = css.substring(idxChat).trim();

fs.writeFileSync(path.join('css', 'main.css'), mainCss, 'utf8');
fs.writeFileSync(path.join('css', 'hud.css'), hudCss, 'utf8');
fs.writeFileSync(path.join('css', 'sidebar.css'), sidebarCss, 'utf8');
fs.writeFileSync(path.join('css', 'modals.css'), modalsCss, 'utf8');

console.log('CSS split completed:');
console.log('main.css:', mainCss.length, 'bytes');
console.log('hud.css:', hudCss.length, 'bytes');
console.log('sidebar.css:', sidebarCss.length, 'bytes');
console.log('modals.css:', modalsCss.length, 'bytes');

fs.unlinkSync('temp_extracted.css');
fs.unlinkSync('split_css.js');
