// ---------------- IndexedDB ----------------
const DB_NAME = "intervalles_pwa";
const DB_VER = 1;
const STORE = "kv";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const st = tx.objectStore(STORE);
    const req = st.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const st = tx.objectStore(STORE);
    const req = st.put(val, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- Data ----------------
async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de charger data.json");
  const arr = await res.json();

  const cleaned = (Array.isArray(arr) ? arr : [])
    .filter(x => x && typeof x.q === "string" && typeof x.a === "string")
    .map(x => ({ q: x.q.trim(), a: x.a.trim() }))
    .filter(x => x.q && x.a);

  if (!cleaned.length) throw new Error("data.json ne contient aucune paire valide {q,a}.");
  return cleaned;
}

function shuffledIndices(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatQuestionTwoLines(q) {
  const s = (q ?? '').trim();
  if (!s) return '';

  let line1 = s;
  let line2 = '';

  if (s.includes('\n')) {
    [line1, line2] = s.split('\n', 2);
  } else {
    const m = s.match(/^(\S+)\s+(.+)$/);
    if (m) {
      line1 = m[1];
      line2 = m[2];
    } else {
      const m2 = s.match(/^([A-G](?:♭|♯)?)\s*(.+)$/);
      if (m2) {
        line1 = m2[1];
        line2 = m2[2];
      }
    }
  }

  if (!line2) return applyPuristItalicMarkup(renderNoteMarkup(line1));
  return `<span class="q-line1">${applyPuristItalicMarkup(renderNoteMarkup(line1))}</span>
<span class="q-line2">${applyPuristItalicMarkup(wrapAccidentals(line2))}</span>`;
}

function wrapAccidentals(str){
  return String(str ?? "")
    .replace(/([#♯])/g, '<span class="accidental">$1</span>')
    .replace(/([b♭])/g, '<span class="accidental">$1</span>');
}

function renderNoteMarkup(str){
  const s = String(str ?? "");
  const m = s.match(/^\s*([A-Ga-g])\s*([#♯b♭])?\s*$/);
  if (!m) return wrapAccidentals(s);
  const letter = m[1].toUpperCase();
  const acc = m[2] ? m[2] : "";
  const accNorm = acc === "#" ? "♯" : (acc === "b" ? "♭" : acc);
  if (!accNorm) return `<span class="note-letter">${letter}</span>`;
  return `<span class="note-letter">${letter}</span><span class="accidental">${accNorm}</span>`;
}

// ---------------- UI ----------------
const card = document.getElementById("card");
const elContent = document.getElementById("content");
const homeImg = document.getElementById("homeImg");
const elCard = card;

const themeToggleBtn = document.getElementById("themeToggle");

function applyScheme(scheme){
  if (scheme === "invert") {
    document.documentElement.setAttribute("data-scheme", "invert");
    if (themeToggleBtn) themeToggleBtn.textContent = "☀︎";
  } else {
    document.documentElement.removeAttribute("data-scheme");
    if (themeToggleBtn) themeToggleBtn.textContent = "☾";
  }
}

function getSavedScheme(){
  try { return localStorage.getItem("scheme") || "normal"; } catch { return "normal"; }
}

function saveScheme(s){
  try { localStorage.setItem("scheme", s); } catch {}
}

const tapArea = document.getElementById("tapArea");

// État
let data = [];
let skipNextAppear = false;
let tapLocked = false;

let state = {
  mode: "home",
  deck: [],
  pos: 0,
  currentIndex: null
};

function resetDeck() {
  state.deck = shuffledIndices(data.length);
  state.pos = 0;
  state.currentIndex = null;
}

function pickNextQuestion() {
  if (state.pos >= state.deck.length) {
    state.mode = "home";
    resetDeck();
    return;
  }
  state.currentIndex = state.deck[state.pos++];
  state.mode = "question";
}

// ============ TRANSITION (DIM PULSE) ============

async function playPoof() {
  // DIM GLOBAL minimaliste (QUESTION → RÉPONSE)
  document.body.classList.add("flash-answer");

  await new Promise(r => setTimeout(r, 140));

  document.body.classList.remove("flash-answer");
}

function playAppear() {
  card.classList.add('appearing');
  setTimeout(() => card.classList.remove('appearing'), 400);
}

function applyPuristItalicMarkup(html){
  // 1) Convertit <i> / <em> en <span class="italic"> pour que l’italique utilise STIX
  // 2) Auto‑italique pour les variables isolées entre parenthèses, ex: (I), (V), (x)
  //    => évite l’ambiguïté I vs l même si data.json ne contient pas <i>...</i>.
  return String(html ?? "")
    .replace(/<\s*(i|em)\s*>/gi, '<span class="italic">')
    .replace(/<\s*\/\s*(i|em)\s*>/gi, '</span>')
    // (I) → (<span class="italic">I</span>)  |  ( x ) → (<span class="italic">x</span>)
    .replace(/\(\s*([A-Za-z])\s*\)/g, '(<span class="italic">$1</span>)');
}

function renderPlain(s){
  return String(s);
}

function render() {
  card.className = "card " + state.mode;
  card.classList.toggle("is-question", state.mode === "question");
  card.classList.toggle("is-answer", state.mode === "answer");

  if (state.mode === "home") {
    card.className = "card home";
    if (homeImg) homeImg.src = "assets/accueil.png";
    return;
  }

  if (state.mode === "question") {
    const q = data[state.currentIndex]?.q ?? "—";
    const prettyQ = q.replace(/×/g, '<span class="op">×</span>');
    elContent.innerHTML = `<span class="q-single">${applyPuristItalicMarkup(prettyQ)}</span>`;
    if (!skipNextAppear) playAppear();
    skipNextAppear = false;
  }

  if (state.mode === "answer") {
    const answer = data[state.currentIndex]?.a ?? "—";
    elContent.innerHTML = `<span class="a-line">${applyPuristItalicMarkup(renderNoteMarkup(answer))}</span>`;
    playAppear();
    return;
  }
}

async function handleTap() {
  if (tapLocked) return;
  tapLocked = true;

  try {
    if (state.mode === "home") {
      pickNextQuestion();
      render();
      await idbSet("state", state);
      return;
    }

    if (state.mode === "question") {
      // POOF spectaculaire !
      await playPoof();
      state.mode = "answer";
      render();
      await idbSet("state", state);
      return;
    }

    if (state.mode === "answer") {
      // AUCUNE transition entre la réponse et la question suivante
      skipNextAppear = true;
      pickNextQuestion();
      render();
      await idbSet("state", state);
      return;
    }
  } finally {
    // Anti double-tap iOS/PWA : ignore les événements répétés sur une courte fenêtre
    setTimeout(() => {
      tapLocked = false;
    }, 350);
  }
}

async function boot() {
  applyScheme(getSavedScheme());
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const next = (document.documentElement.getAttribute("data-scheme") === "invert") ? "normal" : "invert";
      applyScheme(next);
      saveScheme(next);
    });
  }

  if (document.fonts && document.fonts.ready) { await document.fonts.ready; }

  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); } catch {}
  }

  data = await loadData();

  const saved = await idbGet("state");
  if (saved && typeof saved === "object") state = saved;

  state.mode = "home";
  state.currentIndex = null;

  if (!Array.isArray(state.deck) || state.deck.length !== data.length) {
    resetDeck();
    state.mode = "home";
  }

  render();
  await idbSet("state", state);

  tapArea.addEventListener("click", handleTap);
}

boot().catch(err => {
  card.className = "card home";
  elContent.textContent = String(err?.message ?? err);
});