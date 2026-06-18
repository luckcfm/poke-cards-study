const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/";

const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const filtersEl = document.getElementById("type-filters");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");

let activeType = null;
let query = "";

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
    <li class="card">
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
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      String(p.id).includes(q);
    return matchesType && matchesQuery;
  });

  grid.innerHTML = list.map(cardHTML).join("");
  emptyEl.hidden = list.length > 0;
  countEl.textContent = `${list.length} de ${POKEMON.length} Pokémon`;
}

searchInput.addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

render();
