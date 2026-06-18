const SPRITE_BASE =
  "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/";

const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const filtersEl = document.getElementById("type-filters");
const regionFiltersEl = document.getElementById("region-filters");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");

let activeType = null;
let activeRegion = null;
let query = "";

// Botões de filtro por região.
const regions = [...new Set(POKEMON.map((p) => p.region))];
for (const region of regions) {
  const btn = document.createElement("button");
  btn.className = "region-pill";
  btn.textContent = REGION_LABELS[region];
  btn.dataset.region = region;
  btn.addEventListener("click", () => {
    activeRegion = activeRegion === region ? null : region;
    [...regionFiltersEl.children].forEach((c) =>
      c.classList.toggle("active", c.dataset.region === activeRegion)
    );
    render();
  });
  regionFiltersEl.appendChild(btn);
}

// Monta os botões de filtro a partir dos tipos presentes na lista.
const typesPresent = [...new Set(POKEMON.flatMap((p) => p.types))].sort((a, b) =>
  TYPE_LABELS[a].localeCompare(TYPE_LABELS[b])
);

for (const type of typesPresent) {
  const btn = document.createElement("button");
  btn.className = `type-pill t-${type}`;
  btn.textContent = TYPE_LABELS[type];
  btn.dataset.type = type;
  btn.addEventListener("click", () => {
    activeType = activeType === type ? null : type;
    [...filtersEl.children].forEach((c) =>
      c.classList.toggle("active", c.dataset.type === activeType)
    );
    render();
  });
  filtersEl.appendChild(btn);
}

function cardHTML(p) {
  const num = String(p.id).padStart(3, "0");
  const badges = p.types
    .map((t) => `<span class="type-badge t-${t}">${TYPE_LABELS[t]}</span>`)
    .join("");
  return `
    <li class="card" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.name}, ver detalhes">
      <span class="num">Nº ${num}</span>
      <img src="${SPRITE_BASE}${p.id}.png" alt="${p.name}" loading="lazy"
           onerror="this.style.opacity=0.25" />
      <div class="name">${p.name}</div>
      <div class="types">${badges}</div>
    </li>`;
}

function render() {
  const q = query.trim().toLowerCase();
  const list = POKEMON.filter((p) => {
    const matchesType = !activeType || p.types.includes(activeType);
    const matchesRegion = !activeRegion || p.region === activeRegion;
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      String(p.id).includes(q);
    return matchesType && matchesRegion && matchesQuery;
  });

  grid.innerHTML = list.map(cardHTML).join("");
  emptyEl.hidden = list.length > 0;
  countEl.textContent = `${list.length} de ${POKEMON.length} Pokémon`;
}

searchInput.addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

// ---------- Modal de detalhes ----------
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const detailCache = new Map();

const STAT_LABELS = {
  hp: "HP",
  attack: "Ataque",
  defense: "Defesa",
  "special-attack": "Atq. Esp.",
  "special-defense": "Def. Esp.",
  speed: "Velocidade",
};

// Cores por tipo (espelham o styles.css) para desenhar a cartinha no canvas.
const TYPE_COLORS = {
  normal: "#a8a77a", fire: "#ee8130", water: "#6390f0", grass: "#7ac74c",
  electric: "#f7d02c", ice: "#96d9d6", fighting: "#c22e28", poison: "#a33ea1",
  ground: "#e2bf65", flying: "#a98ff3", psychic: "#f95587", bug: "#a6b91a",
  rock: "#b6a136", ghost: "#735797", dragon: "#6f35fc", dark: "#705746",
  steel: "#b7b7ce", fairy: "#d685ad",
};

// Pokémon atualmente aberto no modal (com seus detalhes carregados).
let currentDetail = null;

function openModal(id) {
  const p = POKEMON.find((x) => x.id === id);
  if (!p) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  renderModalLoading(p);
  loadDetails(p);
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  modalBody.innerHTML = "";
  currentDetail = null;
}

function renderModalLoading(p) {
  const badges = p.types
    .map((t) => `<span class="type-badge t-${t}">${TYPE_LABELS[t]}</span>`)
    .join("");
  modalBody.innerHTML = `
    <div class="modal-head t-${p.types[0]}-bg">
      <img src="${SPRITE_BASE}${p.id}.png" alt="${p.name}" />
      <span class="modal-num">Nº ${String(p.id).padStart(3, "0")}</span>
    </div>
    <h2 id="modal-name">${p.name}</h2>
    <p class="modal-region">${REGION_LABELS[p.region]}</p>
    <div class="modal-types">${badges}</div>
    <p class="modal-loading">Carregando detalhes...</p>`;
}

async function loadDetails(p) {
  try {
    const data = detailCache.get(p.id) || (await fetchDetails(p.id));
    detailCache.set(p.id, data);
    // Garante que o usuário ainda está vendo este Pokémon.
    if (modal.hidden) return;
    renderModalDetails(p, data);
  } catch (err) {
    const loading = modalBody.querySelector(".modal-loading");
    if (loading)
      loading.textContent = "Não foi possível carregar os detalhes (verifique a conexão).";
  }
}

async function fetchDetails(id) {
  const [pokeRes, speciesRes] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon/${id}`),
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
  ]);
  const poke = await pokeRes.json();
  const species = await speciesRes.json();

  const flavor =
    pickFlavor(species.flavor_text_entries, "pt") ||
    pickFlavor(species.flavor_text_entries, "en") ||
    "";
  const genus =
    (species.genera.find((g) => g.language.name === "pt") ||
      species.genera.find((g) => g.language.name === "en") ||
      {}).genus || "";

  return {
    height: poke.height / 10, // metros
    weight: poke.weight / 10, // kg
    abilities: poke.abilities.map((a) => formatName(a.ability.name)),
    stats: poke.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
    flavor: flavor.replace(/\s+/g, " ").trim(),
    genus,
  };
}

function pickFlavor(entries, lang) {
  const e = entries.find((x) => x.language.name === lang);
  return e ? e.flavor_text : "";
}

function formatName(s) {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function renderModalDetails(p, d) {
  const statsHTML = d.stats
    .map((s) => {
      const pct = Math.min(100, (s.value / 255) * 100);
      return `
        <div class="stat-row">
          <span class="stat-name">${STAT_LABELS[s.name] || s.name}</span>
          <span class="stat-val">${s.value}</span>
          <span class="stat-bar"><span class="stat-fill t-${p.types[0]}" style="width:${pct}%"></span></span>
        </div>`;
    })
    .join("");

  modalBody.querySelector(".modal-loading").outerHTML = `
    ${d.genus ? `<p class="modal-genus">${d.genus}</p>` : ""}
    ${d.flavor ? `<p class="modal-flavor">${d.flavor}</p>` : ""}
    <div class="modal-facts">
      <div><span class="fact-label">Altura</span><span class="fact-val">${d.height.toFixed(1)} m</span></div>
      <div><span class="fact-label">Peso</span><span class="fact-val">${d.weight.toFixed(1)} kg</span></div>
      <div><span class="fact-label">Habilidades</span><span class="fact-val">${d.abilities.join(", ")}</span></div>
    </div>
    <h3 class="stats-title">Estatísticas base</h3>
    <div class="stats">${statsHTML}</div>
    <div class="modal-actions">
      <button id="download-btn" class="download-btn">⬇ Baixar cartinha</button>
      <button id="compare-from-modal" class="compare-btn-sm" data-cmp-id="${p.id}">⚔️ Comparar este</button>
    </div>`;

  currentDetail = { p, d };
}

// Abrir ao clicar / Enter em um card (delegação de evento).
// ---------- Comparador de tipos ----------
// Tabela de efetividade (geração VI+). Para cada tipo atacante, lista os
// tipos defensores em que ele é super eficaz (2×), pouco eficaz (0.5×) ou
// não causa dano (0×). O que não está listado é neutro (1×).
const TYPE_CHART = {
  normal:   { super: [], notVery: ["rock", "steel"], noEffect: ["ghost"] },
  fire:     { super: ["grass", "ice", "bug", "steel"], notVery: ["fire", "water", "rock", "dragon"], noEffect: [] },
  water:    { super: ["fire", "ground", "rock"], notVery: ["water", "grass", "dragon"], noEffect: [] },
  electric: { super: ["water", "flying"], notVery: ["electric", "grass", "dragon"], noEffect: ["ground"] },
  grass:    { super: ["water", "ground", "rock"], notVery: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"], noEffect: [] },
  ice:      { super: ["grass", "ground", "flying", "dragon"], notVery: ["fire", "water", "ice", "steel"], noEffect: [] },
  fighting: { super: ["normal", "ice", "rock", "dark", "steel"], notVery: ["poison", "flying", "psychic", "bug", "fairy"], noEffect: ["ghost"] },
  poison:   { super: ["grass", "fairy"], notVery: ["poison", "ground", "rock", "ghost"], noEffect: ["steel"] },
  ground:   { super: ["fire", "electric", "poison", "rock", "steel"], notVery: ["grass", "bug"], noEffect: ["flying"] },
  flying:   { super: ["grass", "fighting", "bug"], notVery: ["electric", "rock", "steel"], noEffect: [] },
  psychic:  { super: ["fighting", "poison"], notVery: ["psychic", "steel"], noEffect: ["dark"] },
  bug:      { super: ["grass", "psychic", "dark"], notVery: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"], noEffect: [] },
  rock:     { super: ["fire", "ice", "flying", "bug"], notVery: ["fighting", "ground", "steel"], noEffect: [] },
  ghost:    { super: ["psychic", "ghost"], notVery: ["dark"], noEffect: ["normal"] },
  dragon:   { super: ["dragon"], notVery: ["steel"], noEffect: ["fairy"] },
  dark:     { super: ["psychic", "ghost"], notVery: ["fighting", "dark", "fairy"], noEffect: [] },
  steel:    { super: ["ice", "rock", "fairy"], notVery: ["fire", "water", "electric", "steel"], noEffect: [] },
  fairy:    { super: ["fighting", "dragon", "dark"], notVery: ["fire", "poison", "steel"], noEffect: [] },
};

const ALL_TYPES = Object.keys(TYPE_CHART);

// Multiplicador de um tipo atacante contra UM tipo defensor.
function effectiveness(attacker, defender) {
  const c = TYPE_CHART[attacker];
  if (c.noEffect.includes(defender)) return 0;
  if (c.super.includes(defender)) return 2;
  if (c.notVery.includes(defender)) return 0.5;
  return 1;
}

// Multiplicador de um tipo atacante contra o(s) tipo(s) de um Pokémon.
function multiplierVs(attacker, defenderTypes) {
  return defenderTypes.reduce((m, t) => m * effectiveness(attacker, t), 1);
}

function fmtMult(m) {
  if (m === 0) return "0×";
  if (Number.isInteger(m)) return m + "×";
  return m + "×"; // 0.25, 0.5
}

function multClass(m) {
  if (m === 0) return "m-zero";
  if (m > 1) return "m-good";
  if (m < 1) return "m-bad";
  return "m-neutral";
}

// Para o lado defensor: agrupa os 18 tipos por multiplicador recebido.
function defensiveProfile(defenderTypes) {
  const groups = {};
  for (const atk of ALL_TYPES) {
    const m = multiplierVs(atk, defenderTypes);
    if (m === 1) continue;
    (groups[m] = groups[m] || []).push(atk);
  }
  return groups;
}

const selA = document.getElementById("sel-a");
const selB = document.getElementById("sel-b");
const compareEl = document.getElementById("compare");
const compareBody = document.getElementById("compare-body");

// Popula os dois seletores com todos os Pokémon (ordenados por número).
const sortedForSelect = [...POKEMON].sort((a, b) => a.id - b.id);
function fillSelect(sel, selectedId) {
  sel.innerHTML = sortedForSelect
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>Nº ${String(
          p.id
        ).padStart(3, "0")} — ${p.name}</option>`
    )
    .join("");
}

// Bloco de "X atacando Y": melhor multiplicador entre os tipos de X.
function attackBlock(attacker, defender) {
  const rows = attacker.types
    .map((t) => {
      const m = multiplierVs(t, defender.types);
      return `<div class="atk-row ${multClass(m)}">
        <span class="type-badge t-${t}">${TYPE_LABELS[t]}</span>
        <span class="atk-mult">${fmtMult(m)}</span>
      </div>`;
    })
    .join("");
  const best = Math.max(...attacker.types.map((t) => multiplierVs(t, defender.types)));
  return { html: rows, best };
}

// Lista de fraquezas/resistências defensivas.
function defenseBlock(p) {
  const groups = defensiveProfile(p.types);
  const order = [4, 2, 0.5, 0.25, 0];
  const labels = {
    4: "Fraqueza ×4", 2: "Fraqueza ×2",
    0.5: "Resiste ×½", 0.25: "Resiste ×¼", 0: "Imune",
  };
  const parts = order
    .filter((k) => groups[k] && groups[k].length)
    .map((k) => {
      const badges = groups[k]
        .map((t) => `<span class="mini-badge t-${t}">${TYPE_LABELS[t]}</span>`)
        .join("");
      return `<div class="def-line"><span class="def-label ${
        k >= 2 ? "weak" : "resist"
      }">${labels[k]}</span><span class="def-badges">${badges}</span></div>`;
    })
    .join("");
  return parts || `<p class="def-none">Sem fraquezas ou resistências notáveis.</p>`;
}

function pokeHeader(p) {
  const badges = p.types
    .map((t) => `<span class="type-badge t-${t}">${TYPE_LABELS[t]}</span>`)
    .join("");
  return `
    <div class="cmp-poke">
      <img src="${SPRITE_BASE}${p.id}.png" alt="${p.name}" loading="lazy" onerror="this.style.opacity=.25" />
      <div class="cmp-name">${p.name}</div>
      <div class="cmp-types">${badges}</div>
    </div>`;
}

function renderCompare() {
  const a = POKEMON.find((p) => p.id === Number(selA.value));
  const b = POKEMON.find((p) => p.id === Number(selB.value));
  if (!a || !b) return;

  const aAtk = attackBlock(a, b);
  const bAtk = attackBlock(b, a);

  let verdict, verdictClass;
  if (aAtk.best > bAtk.best) {
    verdict = `🏆 <strong>${a.name}</strong> leva vantagem ofensiva (${fmtMult(
      aAtk.best
    )} contra ${fmtMult(bAtk.best)})`;
    verdictClass = "v-a";
  } else if (bAtk.best > aAtk.best) {
    verdict = `🏆 <strong>${b.name}</strong> leva vantagem ofensiva (${fmtMult(
      bAtk.best
    )} contra ${fmtMult(aAtk.best)})`;
    verdictClass = "v-b";
  } else {
    verdict = `🤝 Confronto equilibrado — ambos causam no máximo ${fmtMult(aAtk.best)}`;
    verdictClass = "v-tie";
  }

  compareBody.innerHTML = `
    <div class="cmp-grid">
      ${pokeHeader(a)}
      ${pokeHeader(b)}
    </div>

    <div class="verdict ${verdictClass}">${verdict}</div>

    <div class="matchup">
      <div class="matchup-col">
        <h3>${a.name} atacando</h3>
        ${aAtk.html}
      </div>
      <div class="matchup-col">
        <h3>${b.name} atacando</h3>
        ${bAtk.html}
      </div>
    </div>

    <h3 class="def-title">Fraquezas &amp; resistências</h3>
    <div class="matchup">
      <div class="matchup-col">
        <h4>${a.name}</h4>
        ${defenseBlock(a)}
      </div>
      <div class="matchup-col">
        <h4>${b.name}</h4>
        ${defenseBlock(b)}
      </div>
    </div>`;
}

function openCompare(idA, idB) {
  fillSelect(selA, idA ?? sortedForSelect[0].id);
  fillSelect(selB, idB ?? sortedForSelect[3].id);
  compareEl.hidden = false;
  document.body.style.overflow = "hidden";
  renderCompare();
}

function closeCompare() {
  compareEl.hidden = true;
  document.body.style.overflow = "";
}

document.getElementById("open-compare").addEventListener("click", () => openCompare());
selA.addEventListener("change", renderCompare);
selB.addEventListener("change", renderCompare);
compareEl.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close-compare")) closeCompare();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !compareEl.hidden) closeCompare();
});

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openModal(Number(card.dataset.id));
});
grid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".card");
  if (card) {
    e.preventDefault();
    openModal(Number(card.dataset.id));
  }
});

modal.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeModal();
});

modalBody.addEventListener("click", (e) => {
  if (e.target.id === "download-btn") downloadCard();
  if (e.target.id === "compare-from-modal") {
    const id = Number(e.target.dataset.cmpId);
    closeModal();
    // Escolhe um segundo Pokémon diferente para já mostrar o confronto.
    const other = sortedForSelect.find((p) => p.id !== id).id;
    openCompare(id, other);
  }
});

// ---------- Geração da cartinha (canvas) ----------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y);
      line = words[i] + " ";
      y += lineHeight;
      if (++lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, y);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function downloadCard() {
  if (!currentDetail) return;
  const { p, d } = currentDetail;
  const btn = document.getElementById("download-btn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Gerando...";

  try {
    const art = await loadImage(`${SPRITE_BASE}${p.id}.png`);
    const canvas = document.createElement("canvas");
    const W = 600, H = 840;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const c1 = TYPE_COLORS[p.types[0]];
    const c2 = TYPE_COLORS[p.types[1]] || c1;

    // Borda externa (moldura colorida pelo tipo).
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c1);
    bg.addColorStop(1, c2);
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, W, H, 36);
    ctx.fill();

    // Painel interno claro.
    ctx.fillStyle = "#f5f1e6";
    roundRect(ctx, 24, 24, W - 48, H - 48, 24);
    ctx.fill();

    // Cabeçalho: nome + PV.
    const hp = d.stats.find((s) => s.name === "hp")?.value ?? "";
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 40px 'Segoe UI', sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(p.name, 50, 92);
    ctx.textAlign = "right";
    ctx.fillStyle = "#c0392b";
    ctx.font = "bold 22px 'Segoe UI', sans-serif";
    ctx.fillText("PV", W - 120, 88);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 44px 'Segoe UI', sans-serif";
    ctx.fillText(String(hp), W - 50, 92);

    // Janela da arte.
    const winX = 50, winY = 112, winW = W - 100, winH = 360;
    const frame = ctx.createLinearGradient(0, winY, 0, winY + winH);
    frame.addColorStop(0, "#ffffff");
    frame.addColorStop(1, c1 + "55");
    ctx.fillStyle = frame;
    roundRect(ctx, winX, winY, winW, winH, 14);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#d4c98f";
    ctx.stroke();

    // Arte centralizada na janela.
    const size = 320;
    ctx.drawImage(art, W / 2 - size / 2, winY + (winH - size) / 2 + 10, size, size);

    // Número da Pokédex no topo da janela.
    ctx.textAlign = "left";
    ctx.fillStyle = "#666";
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    ctx.fillText(`Nº ${String(p.id).padStart(3, "0")}`, winX + 16, winY + 30);

    // Badges de tipo.
    let bx = 50;
    const by = 500;
    ctx.font = "bold 20px 'Segoe UI', sans-serif";
    for (const t of p.types) {
      const label = TYPE_LABELS[t].toUpperCase();
      const tw = ctx.measureText(label).width + 36;
      ctx.fillStyle = TYPE_COLORS[t];
      roundRect(ctx, bx, by, tw, 36, 18);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(label, bx + 18, by + 25);
      bx += tw + 12;
    }

    // Categoria + altura/peso.
    ctx.fillStyle = "#333";
    ctx.font = "italic 20px 'Segoe UI', sans-serif";
    ctx.fillText(
      `${d.genus || "Pokémon"}  ·  ${d.height.toFixed(1)} m  ·  ${d.weight.toFixed(1)} kg`,
      50,
      575
    );

    // Caixa de descrição.
    ctx.fillStyle = "#ece6d4";
    roundRect(ctx, 50, 595, W - 100, 150, 14);
    ctx.fill();
    ctx.fillStyle = "#2a2a2a";
    ctx.font = "19px 'Segoe UI', sans-serif";
    if (d.flavor) wrapText(ctx, d.flavor, 70, 628, W - 140, 26, 4);

    // Rodapé.
    ctx.fillStyle = "#777";
    ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Região: ${REGION_LABELS[p.region]}`, 50, 790);
    ctx.textAlign = "right";
    ctx.fillText("Pokédex Nacional", W - 50, 790);

    // Download.
    const link = document.createElement("a");
    link.download = `${String(p.id).padStart(3, "0")}-${p.name.toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    alert("Não foi possível gerar a imagem (a arte pode ter sido bloqueada pelo navegador).");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

render();
