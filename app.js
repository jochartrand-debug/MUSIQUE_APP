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

// ---------------- UI ----------------
const card = document.getElementById("card");
const elContent = document.getElementById("content");
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
function setTextWithFade(nextText) {
  elContent.style.opacity = "0";
  window.setTimeout(() => {
    elContent.textContent = nextText;
    // rAF pour garantir le repaint
    requestAnimationFrame(() => { elContent.style.opacity = "1"; });
  }, 120);
}

function render() {
  card.className = "card " + state.mode;

  if (state.mode === "home") {
    setTextWithFade("Touchez l’écran pour commencer.");
    return;
  }

  if (state.mode === "question") {
    setTextWithFade(data[state.currentIndex]?.q ?? "—");
    return;
  }

  if (state.mode === "answer") {
    setTextWithFade(data[state.currentIndex]?.a ?? "—");
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
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js"); } catch {}
  }

  data = await loadData();

  const saved = await idbGet("state");
  if (saved && typeof saved === "object") state = saved;

  // Si data.json a changé, on reconstruit
  if (!Array.isArray(state.deck) || state.deck.length !== data.length) {
    resetDeck();
    state.mode = "home";
  }

  render();
  await idbSet("state", state);

  tapArea.addEventListener("click", handleTap);
  tapArea.addEventListener("touchend", (e) => {
    e.preventDefault();
    handleTap();
  }, { passive: false });
}

boot().catch(err => {
  card.className = "card home";
  elContent.textContent = String(err?.message ?? err);
});
