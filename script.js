/* =========================================================
   IronPoint Hardware — script.js
   1) Google Sheet se product data fetch karta hai (CSV format)
   2) Catalog grid render karta hai
   3) Search box handle karta hai
   4) Ek chhota "AI assistant" chatbot chalata hai jo isi data
      ke andar se jawab dhoondta hai (koi paid API key nahi chahiye)
   ========================================================= */

/* -----------------------------------------------------------
   STEP 1: Apni Google Sheet ka "Publish to web" CSV link yahan daalein.
   Kaise banayein: README.md file dekhein.
   Example:
   const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-XXXXXXXX/pub?output=csv";
----------------------------------------------------------- */
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1-37Fnho3YrivfuJGJVjc-419Z-JC9BoLPdQnZO9-yH4/export?format=csv&gid=0";

/* Agar sheet load na ho paye to demo data dikhane ke liye (offline/testing ke liye) */
const FALLBACK_DATA = [
  { name: "Claw Hammer 16oz", category: "Hand Tools", price: 349, stock: 24 },
  { name: "M8 Hex Bolt (Pack of 50)", category: "Fasteners", price: 129, stock: 6 },
  { name: "Cordless Drill 12V", category: "Power Tools", price: 2499, stock: 0 },
  { name: "Measuring Tape 5m", category: "Hand Tools", price: 149, stock: 40 },
  { name: "Safety Gloves (Pair)", category: "Safety Gear", price: 99, stock: 18 },
  { name: "Angle Grinder 4inch", category: "Power Tools", price: 1899, stock: 3 },
];

let PRODUCTS = [];

/* ---------------- CSV PARSE ---------------- */
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(c => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return {
      name: row.name || row["item name"] || row.item || "Unnamed Item",
      brand: row.brand || "",
      category: row.category || row.type || row.brand || "General",
      price: Number(row.price) || 0,
      stock: Number(row.stock) || 0,
    };
  });
}

/* ---------------- LOAD DATA ---------------- */
async function loadProducts() {
  const statusEl = document.getElementById("catalogStatus");
  if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("PASTE_YOUR")) {
    statusEl.textContent = "⚠ Google Sheet link set nahi hai — demo data dikhaya ja raha hai (README.md dekhein).";
    PRODUCTS = FALLBACK_DATA;
    renderProducts(PRODUCTS);
    updateStockPill(PRODUCTS);
    buildTicker(PRODUCTS);
    return;
  }
  try {
    statusEl.textContent = "Google Sheet se data load ho raha hai…";
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
    const csvText = await res.text();
    PRODUCTS = parseCSV(csvText);
    statusEl.textContent = `${PRODUCTS.length} items live sheet se load hue.`;
    renderProducts(PRODUCTS);
    updateStockPill(PRODUCTS);
    buildTicker(PRODUCTS);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "⚠ Sheet load nahi ho payi, demo data dikhaya ja raha hai.";
    PRODUCTS = FALLBACK_DATA;
    renderProducts(PRODUCTS);
    updateStockPill(PRODUCTS);
    buildTicker(PRODUCTS);
  }
}

/* ---------------- RENDER CATALOG ---------------- */
function stockBadge(stock) {
  if (stock <= 0) return `<span class="product-stock stock-out">Out of stock</span>`;
  if (stock <= 8) return `<span class="product-stock stock-low">Low stock: ${stock}</span>`;
  return `<span class="product-stock stock-in">In stock: ${stock}</span>`;
}

function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  if (!list.length) {
    grid.innerHTML = `<p style="color:var(--muted)">Koi item nahi mila.</p>`;
    return;
  }
  grid.innerHTML = list
    .map(
      p => `
      <div class="product-card">
        <div class="product-cat">${escapeHTML(p.category)}${p.brand ? " · " + escapeHTML(p.brand) : ""}</div>
        <div class="product-name">${escapeHTML(p.name)}</div>
        <div class="product-meta">
          <span class="product-price">₹${p.price.toLocaleString("en-IN")}</span>
          ${stockBadge(p.stock)}
        </div>
      </div>`
    )
    .join("");
}

function updateStockPill(list) {
  const inStock = list.filter(p => p.stock > 0).length;
  document.getElementById("stockCount").textContent = `${inStock}/${list.length} items in stock`;
}

function buildTicker(list) {
  const track = document.getElementById("tickerTrack");
  const items = list.slice(0, 12);
  const html = items.map(p => `<span>⬡ ${escapeHTML(p.name)} — ₹${p.price}</span>`).join("");
  track.innerHTML = html + html; // duplicate for seamless scroll
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- SEARCH ---------------- */
document.getElementById("searchInput").addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = PRODUCTS.filter(
    p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );
  renderProducts(filtered);
});

document.getElementById("refreshBtn").addEventListener("click", loadProducts);

/* ---------------- AI ASSISTANT (TOOLBOX CHAT) ---------------- */
const toolboxToggle = document.getElementById("toolboxToggle");
const toolboxPanel = document.getElementById("toolboxPanel");
const toolboxClose = document.getElementById("toolboxClose");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

toolboxToggle.addEventListener("click", () => toolboxPanel.classList.toggle("open"));
toolboxClose.addEventListener("click", () => toolboxPanel.classList.remove("open"));

function addMessage(text, who = "bot") {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* Simple keyword-based assistant that answers from the live product data.
   Ye koi paid AI API call nahi karta — isliye GitHub Pages (static hosting)
   par bina kisi backend/API-key ke free chalta hai.
   Agar aap real LLM (Claude/GPT) chatbot chahte hain, README.md ka
   "Real AI Assistant" section padhein — uske liye ek chhota backend chahiye
   hota hai taaki API key public na ho. */
function answerQuery(rawQuery) {
  const q = rawQuery.toLowerCase();

  if (/cheapest|sasta/.test(q)) {
    const cheapest = [...PRODUCTS].sort((a, b) => a.price - b.price)[0];
    return cheapest
      ? `Sabse sasta item: "${cheapest.name}" — ₹${cheapest.price} (${cheapest.category})`
      : "Abhi data available nahi hai.";
  }

  if (/expensive|mehenga|costly/.test(q)) {
    const costly = [...PRODUCTS].sort((a, b) => b.price - a.price)[0];
    return costly
      ? `Sabse mehenga item: "${costly.name}" — ₹${costly.price} (${costly.category})`
      : "Abhi data available nahi hai.";
  }

  if (/stock|available|hai kya|milega/.test(q)) {
    const match = PRODUCTS.find(p => q.includes(p.name.toLowerCase().split(" ")[0]));
    if (match) {
      return match.stock > 0
        ? `Haan, "${match.name}" stock mein hai — ${match.stock} units, ₹${match.price} each.`
        : `Maaf kijiye, "${match.name}" abhi out of stock hai.`;
    }
  }

  // general keyword search across product names/categories
  const matches = PRODUCTS.filter(
    p => q.includes(p.name.toLowerCase()) || q.includes(p.category.toLowerCase()) ||
         p.name.toLowerCase().split(" ").some(word => word.length > 3 && q.includes(word))
  );
  if (matches.length) {
    const list = matches
      .slice(0, 4)
      .map(p => `• ${p.name} — ₹${p.price} (${p.stock > 0 ? "in stock" : "out of stock"})`)
      .join("\n");
    return `Mujhe ye items mile:\n${list}`;
  }

  return `Mujhe is baare mein exact item nahi mila. Aap "catalog" section mein search kar sakte hain, ya category ka naam batayein (jaise: Power Tools, Fasteners, Safety Gear).`;
}

chatForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, "user");
  chatInput.value = "";
  setTimeout(() => addMessage(answerQuery(text), "bot"), 350);
});

/* ---------------- INIT ---------------- */
loadProducts();
