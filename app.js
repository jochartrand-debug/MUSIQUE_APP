// --- Anti double-tap lock (v43) ---
let __tapLocked = false;
function __withTapLock(fn, delay=300){
  return function(...args){
    if (__tapLocked) return;
    __tapLocked = true;
    try { fn.apply(this, args); }
    finally { setTimeout(()=>{ __tapLocked = false; }, delay); }
  }
}
// --- end anti double-tap ---

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

  if (!line2) return renderNoteMarkup(line1);
  return `<span class="q-line1">${renderNoteMarkup(line1)}</span>
<span class="q-line2">${wrapAccidentals(line2)}</span>`;
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
let state = {
  mode: "home",      // "home" | "question" | "answer"
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

// Petite transition douce du texte
function flashAnswer(){
  const el = document.body;
  el.classList.remove("flash-answer");
  requestAnimationFrame(() => {
    el.classList.add("flash-answer");
    setTimeout(() => el.classList.remove("flash-answer"), 200);
  });
}

function render() {
  card.className = "card " + state.mode;

  if (state.mode === "home") {
  card.className = "card home";
  if (homeImg) homeImg.src = "assets/accueil.png";
  return;
}

  if (state.mode === "question") {
    elContent.innerHTML = formatQuestionTwoLines(data[state.currentIndex]?.q ?? "—");
    return;
  }

  if (state.mode === "answer") {
    const answer = data[state.currentIndex]?.a ?? "—";
    flashAnswer();
    flashAnswer();
    elContent.innerHTML = `<span class="a-line">${renderNoteMarkup(answer)}</span>`;
    return;
  }
}

// Flow:
// Accueil -> Question aléatoire (sans répétition)
// Question -> Réponse
// Réponse -> Nouvelle question (sans répétition)
// Après toutes les paires -> retour Accueil + reset
async function handleTap() {
  if (state.mode === "home") {
    pickNextQuestion();
    render();
    await idbSet("state", state);
    return;
  }

  if (state.mode === "question") {
    state.mode = "answer";
    render();
    await idbSet("state", state);
    return;
  }

  if (state.mode === "answer") {
    pickNextQuestion(); // si fini: home + reset
    render();
    await idbSet("state", state);
    return;
  }
}

async function boot() {
  // Thème pédagogique (question/réponse inversables)
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

  // Toujours démarrer à l’accueil (évite de reprendre sur une question après une session)
  state.mode = "home";
  state.currentIndex = null;

  // Si data.json a changé, on reconstruit
  if (!Array.isArray(state.deck) || state.deck.length !== data.length) {
    resetDeck();
    state.mode = "home";
  }

  render();
  await idbSet("state", state);

  tapArea.addEventListener('click', __withTapLock(handleTap));
  tapArea.addEventListener("touchend", (e) => {
    e.preventDefault();
    handleTap();
  }, { passive: false });
}

boot().catch(err => {
  card.className = "card home";
  elContent.textContent = String(err?.message ?? err);
});
