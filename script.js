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
      (p, i) => `
      <div class="product-card">
        <div class="product-cat">${escapeHTML(p.category)}${p.brand ? " · " + escapeHTML(p.brand) : ""}</div>
        <div class="product-name">${escapeHTML(p.name)}</div>
        <div class="product-meta">
          <span class="product-price">₹${p.price.toLocaleString("en-IN")}</span>
          ${stockBadge(p.stock)}
        </div>
        ${p.stock > 0
          ? `<button class="add-to-cart-btn" data-name="${escapeHTML(p.name)}" data-price="${p.price}">+ Add to Order</button>`
          : `<button class="add-to-cart-btn" disabled style="opacity:.5; cursor:not-allowed;">Out of stock</button>`
        }
      </div>`
    )
    .join("");

  grid.querySelectorAll(".add-to-cart-btn[data-name]").forEach(btn => {
    btn.addEventListener("click", () => {
      addToCart(btn.dataset.name, Number(btn.dataset.price));
    });
  });
}

/* ---------------- CART (order system) ---------------- */
let CART = []; // { name, price, qty }

function addToCart(name, price) {
  const existing = CART.find(item => item.name === name);
  if (existing) existing.qty += 1;
  else CART.push({ name, price, qty: 1 });
  renderCart();
  document.getElementById("cartPanel").classList.add("open");
}

function changeQty(name, delta) {
  const item = CART.find(i => i.name === name);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) CART = CART.filter(i => i.name !== name);
  renderCart();
}

function removeFromCart(name) {
  CART = CART.filter(i => i.name !== name);
  renderCart();
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const badge = document.getElementById("cartBadge");
  const totalQty = CART.reduce((sum, i) => sum + i.qty, 0);
  badge.textContent = totalQty;

  if (!CART.length) {
    container.innerHTML = `<p class="cart-empty">Abhi cart khaali hai. Product ke saath "+ Add" dabayein.</p>`;
    return;
  }

  container.innerHTML = CART.map(
    item => `
    <div class="cart-row">
      <div class="cart-row-name">
        ${escapeHTML(item.name)}<br/>
        <span class="cart-row-price">₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</span>
      </div>
      <div class="cart-qty">
        <button data-action="minus" data-name="${escapeHTML(item.name)}">−</button>
        <span>${item.qty}</span>
        <button data-action="plus" data-name="${escapeHTML(item.name)}">+</button>
      </div>
      <button class="cart-remove" data-action="remove" data-name="${escapeHTML(item.name)}">✕</button>
    </div>`
  ).join("");

  container.querySelectorAll("[data-action='plus']").forEach(b =>
    b.addEventListener("click", () => changeQty(b.dataset.name, 1))
  );
  container.querySelectorAll("[data-action='minus']").forEach(b =>
    b.addEventListener("click", () => changeQty(b.dataset.name, -1))
  );
  container.querySelectorAll("[data-action='remove']").forEach(b =>
    b.addEventListener("click", () => removeFromCart(b.dataset.name))
  );
}

const cartToggle = document.getElementById("cartToggle");
const cartPanel = document.getElementById("cartPanel");
const cartClose = document.getElementById("cartClose");
cartToggle.addEventListener("click", () => cartPanel.classList.toggle("open"));
cartClose.addEventListener("click", () => cartPanel.classList.remove("open"));

/* WhatsApp number — order isi number par jaayega */
const ORDER_WHATSAPP_NUMBER = "916350665647";

document.getElementById("sendOrderBtn").addEventListener("click", () => {
  if (!CART.length) {
    alert("Pehle cart mein items add karein.");
    return;
  }
  const name = document.getElementById("custName").value.trim();
  const mobile = document.getElementById("custMobile").value.trim();
  const address = document.getElementById("custAddress").value.trim();

  if (!name || !mobile || !address) {
    alert("Kripya apna naam, mobile number aur address bharein.");
    return;
  }
  if (!/^[0-9]{10}$/.test(mobile)) {
    alert("Kripya 10-digit sahi mobile number daalein.");
    return;
  }

  const lines = CART.map(i => `• ${i.name} × ${i.qty} = ₹${i.price * i.qty}`);
  const total = CART.reduce((sum, i) => sum + i.price * i.qty, 0);
  const message =
    "Namaste, mujhe ye order karna hai:\n\n" +
    lines.join("\n") +
    `\n\nTotal: ₹${total}\n\n` +
    `Naam: ${name}\nMobile: ${mobile}\nAddress: ${address}\n\nKripya confirm karein.`;
  const url = `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
});

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

/* Smart local assistant — natural language jaisa samajhta hai (bina kisi backend/API ke):
   - Budget-based search ("500 ke andar kya hai")
   - Kaam/need-based bundle suggestions ("paint karna hai", "ghar banana hai")
   - Cheapest/costliest
   - Stock check with fuzzy matching
   - Seedha chat se "add to cart" bhi kar sakta hai
   Agar aap real LLM (Claude/GPT) chatbot chahte hain, README.md ka
   "Real AI Assistant" section padhein — uske liye ek chhota backend chahiye
   hota hai taaki API key public na ho. */

const CATEGORY_BUNDLES = {
  paint: ["paint", "chuna", "cement", "putty", "primer"],
  construction: ["cement", "chuna", "putty", "sika", "graout", "marble", "blade"],
  electrical: ["wire", "switch", "socket", "mcb", "bulb", "holder"],
  tools: ["hammer", "drill", "grinder", "tape", "gloves", "blade", "pilar"],
};

function fuzzyIncludes(haystack, needle) {
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  // word-by-word partial match (handles typos/spacing differences loosely)
  const words = needle.split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return false;
  return words.every(w => haystack.includes(w.slice(0, Math.max(3, w.length - 1))));
}

function formatItem(p) {
  return `${p.name} — ₹${p.price} (${p.stock > 0 ? `${p.stock} in stock` : "out of stock"})`;
}

function answerQuery(rawQuery) {
  const q = rawQuery.toLowerCase().trim();

  /* greetings */
  if (/^(hi|hello|hey|namaste|namaskar)\b/.test(q)) {
    return "Namaste! Aap kya dhoondh rahe hain — item ka naam, ya budget batayein (jaise \"500 ke andar cement\"), main sujhaav dunga.";
  }

  /* "add to cart" from chat: e.g. "putty add karo", "add white cement" */
  if (/\badd\b/.test(q) || /jodo|daalo/.test(q)) {
    const match = PRODUCTS.find(p => fuzzyIncludes(q, p.name.toLowerCase()));
    if (match) {
      if (match.stock <= 0) return `Maaf kijiye, "${match.name}" abhi out of stock hai — isse order mein add nahi kar sakte.`;
      addToCart(match.name, match.price);
      return `"${match.name}" aapke order mein add kar diya hai ✅. Order button se dekh sakte hain.`;
    }
  }

  /* budget-based: "500 ke andar", "under 500", "500 se kam" */
  const budgetMatch = q.match(/(\d+)\s*(ke andar|se kam|under|budget)|(under|budget)\s*(\d+)/);
  if (budgetMatch) {
    const budget = Number(budgetMatch[1] || budgetMatch[4]);
    const options = PRODUCTS.filter(p => p.price <= budget && p.stock > 0).sort((a, b) => b.price - a.price);
    if (!options.length) return `₹${budget} ke andar abhi koi item stock mein nahi hai.`;
    return `₹${budget} ke andar ye milega:\n` + options.slice(0, 6).map(p => `• ${formatItem(p)}`).join("\n");
  }

  /* cheapest / costliest */
  if (/cheapest|sasta/.test(q)) {
    const cheapest = [...PRODUCTS].filter(p => p.stock > 0).sort((a, b) => a.price - b.price)[0];
    return cheapest ? `Sabse sasta item: ${formatItem(cheapest)} — ${cheapest.category}` : "Abhi data available nahi hai.";
  }
  if (/expensive|mehenga|costly/.test(q)) {
    const costly = [...PRODUCTS].sort((a, b) => b.price - a.price)[0];
    return costly ? `Sabse mehenga item: ${formatItem(costly)} — ${costly.category}` : "Abhi data available nahi hai.";
  }

  /* need/work based bundle suggestion: "paint karna hai", "ghar banana hai", "wiring ka kaam" */
  for (const [key, keywords] of Object.entries(CATEGORY_BUNDLES)) {
    if (q.includes(key) || keywords.some(k => q.includes(k + " karna") || q.includes(k + " ka kaam"))) {
      const options = PRODUCTS.filter(p =>
        keywords.some(k => p.name.toLowerCase().includes(k) || p.category.toLowerCase().includes(k))
      );
      if (options.length) {
        return `Iske liye ye items kaam aayenge:\n` + options.slice(0, 6).map(p => `• ${formatItem(p)}`).join("\n") +
          `\n\nChahen to bolen "add karo [item ka naam]" — main order mein daal dunga.`;
      }
    }
  }

  /* stock / availability check with fuzzy matching */
  if (/stock|available|hai kya|milega/.test(q)) {
    const match = PRODUCTS.find(p => fuzzyIncludes(q, p.name.toLowerCase()));
    if (match) {
      return match.stock > 0
        ? `Haan, "${match.name}" stock mein hai — ${match.stock} units, ₹${match.price} each.`
        : `Maaf kijiye, "${match.name}" abhi out of stock hai.`;
    }
  }

  /* general fuzzy keyword search across product names/categories/brand */
  const matches = PRODUCTS.filter(
    p =>
      fuzzyIncludes(q, p.name.toLowerCase()) ||
      q.includes(p.category.toLowerCase()) ||
      (p.brand && q.includes(p.brand.toLowerCase()))
  );
  if (matches.length) {
    const list = matches.slice(0, 4).map(p => `• ${formatItem(p)}`).join("\n");
    return `Mujhe ye items mile:\n${list}\n\nOrder karne ke liye bolen "add karo [item ka naam]".`;
  }

  return `Mujhe is baare mein exact item nahi mila. Aap category batayein (jaise electrical, paint, tools), ya apna budget batayein (jaise "500 ke andar kya hai").`;
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
