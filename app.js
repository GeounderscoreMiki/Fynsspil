import { municipalities } from './municipalities.js';
import { mapView, mapRegions } from './mapdata.js';
import { groups, vault, salt, iterations } from './gamedata.js';
import { firebaseConfig, questionSeconds, maxLives } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, increment, addDoc, collection,
  query, orderBy, limit, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const screens = ['start', 'game', 'lost', 'won', 'scores'];

let db = null;
try { db = getFirestore(initializeApp(firebaseConfig)); } catch (e) { console.warn('Firebase ikke sat op', e); }

let playerName = localStorage.getItem('fynName') || '';
let game = null; // { lives, solved:Set, question, startedAt, deadline, over }
let map, circles = {};
let tick = null;

function show(name) {
  screens.forEach((s) => ($('screen-' + s).hidden = s !== name));
  $('topbar').hidden = name !== 'game';
  if (name === 'game') {
    if (!map) initMap();
  }
}

function setFeedback(text, cls) {
  $('feedback').textContent = text;
  $('feedback').className = cls || '';
}

function formatTime(sec) {
  return `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} sek`;
}

// ---- Firebase ----
async function bump(field) {
  if (!db) return;
  try { await setDoc(doc(db, 'stats', 'counters'), { [field]: increment(1) }, { merge: true }); } catch (e) { console.warn(e); }
}

async function loadStats() {
  if (!db) return;
  try {
    const d = await getDoc(doc(db, 'stats', 'counters'));
    const { attempts = 0, completed = 0 } = d.exists() ? d.data() : {};
    $('stats').textContent = `${completed} har gennemført spillet ud af ${attempts} forsøg`;
  } catch (e) { console.warn(e); }
}

async function showScores() {
  stopTimer();
  const body = $('score-body');
  body.replaceChildren();
  show('scores');
  if (!db) return;
  try {
    const snap = await getDocs(query(collection(db, 'scores'), orderBy('seconds', 'asc'), limit(50)));
    snap.docs.forEach((d, i) => {
      const r = d.data();
      const tr = document.createElement('tr');
      [i + 1, r.name, (r.seconds / 60).toFixed(2).replace('.', ','), r.lives == null ? '–' : `❤️ ${r.lives}`].forEach((v) => {
        tr.appendChild(Object.assign(document.createElement('td'), { textContent: v }));
      });
      body.appendChild(tr);
    });
  } catch (e) { console.warn(e); }
}

// ---- Kryptering (svar er kun gemt som hash, koordinaten er krypteret) ----
const enc = new TextEncoder();
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function pbkdf2(password, bits = 256) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromB64(salt), iterations, hash: 'SHA-256' }, base, bits);
}

async function isCorrect(groupIndex, circleId) {
  return toB64(await pbkdf2(`${groupIndex}:${circleId}`)) === groups[groupIndex].check;
}

async function openVault(answers) {
  const key = await crypto.subtle.importKey('raw', await pbkdf2(answers.join('|')), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(vault.iv) }, key, fromB64(vault.data));
  return new TextDecoder().decode(plain);
}

// ---- Kort (indbygget SVG, ingen eksterne korttjenester) ----
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs) => {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

function initMap() {
  map = $('map');
  map.setAttribute('viewBox', `0 0 ${mapView.width} ${mapView.height}`);
  mapRegions.forEach(({ d, c }) => map.appendChild(svgEl('path', {
    d, class: 'land', 'fill-rule': 'evenodd', fill: c, stroke: c,
  })));
  const radius = (6.5 / 111) * mapView.scale;
  municipalities.forEach((m) => {
    const x = (m.lng - mapView.lng0) * mapView.cos * mapView.scale;
    const y = (mapView.lat1 - m.lat) * mapView.scale;
    const c = svgEl('circle', { cx: x, cy: y, r: radius, class: 'town' });
    c.addEventListener('click', () => guess(m.id));
    map.appendChild(c);
    circles[m.id] = c;
  });
}

function styleCircles() {
  Object.entries(circles).forEach(([id, c]) => {
    c.classList.toggle('done', game.solved.has(id));
  });
}

// ---- Spil ----
// Vælger en ledetråd, helst en der ikke er vist før for den kommune.
function pickClue(qi) {
  const used = (game.seen[qi] ||= new Set());
  const total = groups[qi].clues.length;
  if (used.size >= total) used.clear();
  const free = [...Array(total).keys()].filter((c) => !used.has(c));
  game.clue = free[Math.floor(Math.random() * free.length)];
  used.add(game.clue);
}

function nextQuestion(sameGroup) {
  if (sameGroup === undefined) {
    const open = groups.map((g, i) => i).filter((i) => game.answers[i] === undefined);
    game.question = open[Math.floor(Math.random() * open.length)];
  }
  pickClue(game.question);
  game.deadline = Date.now() + questionSeconds * 1000;
}

function renderGame(keepFeedback) {
  $('player').textContent = playerName;
  $('lives').textContent = `❤️ ${game.lives}/${maxLives}`;
  $('progress').textContent = `${game.solved.size}/${groups.length}`;
  $('clue').textContent = groups[game.question].clues[game.clue];
  if (!keepFeedback) setFeedback('Klik på den rigtige kommune på kortet.');
  show('game');
  styleCircles();
  startTimer();
}

function loseLife() {
  game.lives--;
  if (game.lives <= 0) {
    game.over = true;
    stopTimer();
    show('lost');
    return true;
  }
  return false;
}

async function guess(id) {
  if (!game || game.over || game.busy || game.solved.has(id)) return;
  game.busy = true;
  const current = game;
  const qi = game.question;
  const correct = await isCorrect(qi, id);
  current.busy = false;
  if (game !== current || game.over || game.question !== qi) return;
  if (correct) {
    game.solved.add(id);
    game.answers[qi] = id;
    if (game.solved.size === groups.length) return win();
    nextQuestion();
    renderGame();
    setFeedback('Rigtigt! Her er næste spørgsmål.', 'good');
  } else {
    if (loseLife()) return;
    nextQuestion(true); // ny ledetråd til samme kommune
    renderGame(true);
    setFeedback('Forkert – du mistede et liv. Her er en ny ledetråd til samme kommune.', 'bad');
  }
}

function startTimer() {
  stopTimer();
  const update = () => {
    const left = Math.max(0, game.deadline - Date.now());
    const sec = Math.ceil(left / 1000);
    $('timer').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('timer').className = sec <= 20 ? 'low' : '';
    if (left <= 0) {
      stopTimer();
      if (loseLife()) return;
      nextQuestion(); // spørgsmålet kommer tilbage i puljen
      renderGame(true);
      setFeedback('Tiden løb ud – du mistede et liv.', 'bad');
    }
  };
  update();
  tick = setInterval(update, 250);
}

function stopTimer() { clearInterval(tick); tick = null; }

async function win() {
  game.over = true;
  stopTimer();
  const seconds = Math.round((Date.now() - game.startedAt) / 1000);
  $('won-time').textContent = formatTime(seconds);
  try { $('final-coord').textContent = await openVault(game.answers); } catch { $('final-coord').textContent = 'Fejl – kontakt cache-ejeren'; }
  show('won');
  bump('completed');
  if (db) {
    try { await addDoc(collection(db, 'scores'), { name: playerName, seconds, lives: game.lives, createdAt: serverTimestamp() }); } catch (e) { console.warn(e); }
  }
  loadStats();
}

function start(name) {
  playerName = name.replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!playerName) return;
  localStorage.setItem('fynName', playerName);
  game = { lives: maxLives, solved: new Set(), answers: [], seen: [], startedAt: Date.now(), over: false };
  nextQuestion();
  renderGame();
  bump('attempts').then(loadStats);
}

$('start-form').addEventListener('submit', (e) => { e.preventDefault(); start($('name').value); });
$('retry').addEventListener('click', () => { $('name').value = playerName; show('start'); });
$('to-scores-start').addEventListener('click', (e) => { e.preventDefault(); showScores(); });
$('to-scores-won').addEventListener('click', showScores);
$('back').addEventListener('click', () => {
  if (game && !game.over) renderGame(true);
  else show('start');
});

$('name').value = playerName;
loadStats();
show('start');
