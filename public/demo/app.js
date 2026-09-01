const PRODUCTS = {
  black: {
    sku: "BX-MUT-01",
    name: "UTILITY TEE — CHARCOAL GREY",
    colour: "CHARCOAL GREY",
    originalPrice: 498,
    memberPrice: 498,
    salePrice: null,
    pricingMode: "member",
    images: {
      front: "/assets/member-charcoal-front-v1.png",
      back: "/assets/member-charcoal-back-v1.png",
      detail: "/assets/member-charcoal-detail-v1.png",
    },
    alts: {
      front: "深黑灰會員機能 T-shirt 正面",
      back: "深黑灰會員機能 T-shirt 背面",
      detail: "深黑灰會員機能 T-shirt 收納系統近鏡",
    },
  },
  navy: {
    sku: "BX-MUT-02",
    name: "UTILITY TEE — NAVY",
    colour: "FIELD NAVY",
    originalPrice: 498,
    memberPrice: 498,
    salePrice: null,
    pricingMode: "member",
    images: {
      front: "/assets/member-navy-front-v2.png",
      back: "/assets/member-navy-back-v2.png",
      detail: "/assets/member-navy-detail-v2.png",
    },
    alts: {
      front: "深藍色會員機能 T-shirt 正面",
      back: "深藍色會員機能 T-shirt 背面",
      detail: "深藍色會員機能 T-shirt 收納系統近鏡",
    },
  },
};

const state = {
  cart: JSON.parse(localStorage.getItem("bx-cart") || "[]"),
};

const PRODUCT_KEY_BY_SKU = {
  "BX-MUT-01": "black",
  "BX-MUT-02": "navy",
};

const formatMoney = (value) => `HK$${value.toLocaleString("en-HK")}`;
const getEffectivePrice = (product) => {
  if (product.pricingMode === "sale" && product.salePrice) return product.salePrice;
  if (product.pricingMode === "member" && product.memberPrice) return product.memberPrice;
  return product.originalPrice;
};
const getEffectivePriceLabel = (product) => {
  if (product.pricingMode === "sale" && product.salePrice) return "特價";
  if (product.pricingMode === "member" && product.memberPrice) return "會員價";
  return "";
};
const getPriceMeta = (product) => {
  const bits = [];
  if (!product.memberPrice && !product.salePrice) return "";
  if (product.originalPrice) bits.push(`原價 HK$${product.originalPrice}`);
  if (product.memberPrice) bits.push(`會員 HK$${product.memberPrice}`);
  if (product.salePrice) bits.push(`特價 HK$${product.salePrice}`);
  return bits.join(" · ");
};
const drawer = document.querySelector("[data-cart-drawer]");
const drawerOverlay = document.querySelector("[data-drawer-overlay]");
const modal = document.querySelector("[data-demo-modal]");
const sizeChartModal = document.querySelector("[data-size-chart-modal]");
const modalOverlay = document.querySelector("[data-modal-overlay]");
const toast = document.querySelector("[data-toast]");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function lockPage(locked) {
  document.body.classList.toggle("is-locked", locked);
}

function openCart() {
  drawer.classList.add("is-open");
  drawerOverlay.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  lockPage(true);
  drawer.querySelector("[data-close-cart]").focus();
}

function closeCart() {
  drawer.classList.remove("is-open");
  drawerOverlay.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  lockPage(false);
}

function getOpenModal() {
  if (sizeChartModal.classList.contains("is-open")) return sizeChartModal;
  if (modal.classList.contains("is-open")) return modal;
  return null;
}

function openModal(targetModal = modal) {
  closeCart();
  targetModal.classList.add("is-open");
  modalOverlay.classList.add("is-open");
  lockPage(true);
  targetModal.querySelector("[data-close-modal]").focus();
}

function closeModal(targetModal = getOpenModal()) {
  if (!targetModal) return;

  targetModal.classList.remove("is-open");
  if (!getOpenModal()) {
    modalOverlay.classList.remove("is-open");
    lockPage(false);
  }
}

function persistCart() {
  localStorage.setItem("bx-cart", JSON.stringify(state.cart));
  renderCart();
}

function updatePricingUI() {
  document.querySelectorAll("[data-price-block]").forEach((node) => {
    const product = PRODUCTS[node.dataset.priceBlock];
    if (!product) return;

    const currentNode = node.querySelector("[data-price-current]");
    const labelNode = node.querySelector("[data-price-label]");
    const metaNode = node.querySelector("[data-price-meta]");
    const label = getEffectivePriceLabel(product);
    const effectivePrice = getEffectivePrice(product);
    const meta = getPriceMeta(product);
    const compare = product.originalPrice > effectivePrice ? `<s>${formatMoney(product.originalPrice)}</s>` : "";

    if (currentNode) currentNode.textContent = formatMoney(effectivePrice);
    if (labelNode) {
      labelNode.textContent = label;
      labelNode.hidden = !label;
    }
    if (metaNode) {
      const markup = `${compare}${meta}`;
      metaNode.innerHTML = markup;
      metaNode.hidden = !markup;
    }
  });
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data?.products)) return;

    data.products.forEach((row) => {
      const key = row.key || PRODUCT_KEY_BY_SKU[row.sku];
      if (!key || !PRODUCTS[key]) return;

      if (row.name) PRODUCTS[key].name = String(row.name).toUpperCase().replace(" - ", " — ");
      if (row.colour) PRODUCTS[key].colour = String(row.colour).toUpperCase();
      PRODUCTS[key].originalPrice = Number(row.originalPriceHkd) || PRODUCTS[key].originalPrice;
      PRODUCTS[key].memberPrice = row.memberPriceHkd == null ? null : Number(row.memberPriceHkd) || null;
      PRODUCTS[key].salePrice = Number(row.salePriceHkd) || null;
      PRODUCTS[key].pricingMode = ["original", "member", "sale"].includes(row.pricingMode) ? row.pricingMode : "original";
    });

    updatePricingUI();
    renderCart();
  } catch {}
}

function addToCart(productKey, size) {
  const existing = state.cart.find((item) => item.productKey === productKey && item.size === size);
  if (existing) existing.quantity += 1;
  else state.cart.push({ productKey, size, quantity: 1 });
  persistCart();
  showToast(`${PRODUCTS[productKey].name} / ${size} 已加入 FIELD BAG`);
  openCart();
}

function updateQuantity(index, delta) {
  const item = state.cart[index];
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) state.cart.splice(index, 1);
  persistCart();
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce((sum, item) => sum + getEffectivePrice(PRODUCTS[item.productKey]) * item.quantity, 0);

  document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = count; });
  document.querySelector("[data-cart-total]").textContent = formatMoney(total);
  document.querySelector("[data-checkout]").disabled = count === 0;

  const itemsNode = document.querySelector("[data-cart-items]");
  if (!state.cart.length) {
    itemsNode.innerHTML = `<div class="empty-bag"><span>00</span><h3>YOUR BAG IS EMPTY</h3><p>揀顏色同尺碼，建立你嘅比賽 loadout。</p></div>`;
    return;
  }

  itemsNode.innerHTML = state.cart.map((item, index) => {
    const product = PRODUCTS[item.productKey];
    return `
      <article class="cart-line">
        <img src="${product.images.front}" alt="${product.name}" />
        <div>
          <h3>${product.name}</h3>
          <p>${product.colour} / SIZE ${item.size}</p>
          <div class="qty-control" aria-label="商品數量">
            <button type="button" data-qty="-1" data-index="${index}" aria-label="減少數量">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-qty="1" data-index="${index}" aria-label="增加數量">＋</button>
          </div>
          <strong>${formatMoney(getEffectivePrice(product) * item.quantity)}</strong>
        </div>
        <button type="button" class="cart-line__remove" data-remove data-index="${index}" aria-label="移除 ${product.name}">×</button>
      </article>`;
  }).join("");
}

async function beginCheckout() {
  const button = document.querySelector("[data-checkout]");
  if (!state.cart.length) return;
  const previous = button.innerHTML;
  button.disabled = true;
  button.innerHTML = "<span>CONNECTING TO STRIPE…</span><b>···</b>";

  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: state.cart.map((item) => ({ sku: PRODUCTS[item.productKey].sku, size: item.size, quantity: item.quantity })) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Stripe is not configured");
    if (!data.url) throw new Error("Missing checkout URL");
    window.location.assign(data.url);
  } catch (error) {
    if (error instanceof Error && !/stripe is not configured/i.test(error.message)) {
      showToast(error.message);
    } else {
      openModal();
    }
  } finally {
    button.disabled = false;
    button.innerHTML = previous;
  }
}

document.querySelectorAll(".product-card").forEach((card) => {
  const productKey = card.dataset.product;
  const product = PRODUCTS[productKey];
  const mainImage = card.querySelector("[data-main-image]");
  const indexNode = card.querySelector(".image-index");

  card.querySelectorAll("[data-view]").forEach((button, index) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      mainImage.style.opacity = "0";
      setTimeout(() => {
        mainImage.src = product.images[view];
        mainImage.alt = product.alts[view];
        mainImage.style.opacity = "1";
      }, 130);
      card.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("is-active", item === button));
      indexNode.textContent = `0${index + 1} / 03`;
    });
  });

  card.querySelector("[data-add-to-cart]").addEventListener("click", () => {
    const sizeSelect = card.querySelector("[data-size]");
    if (!sizeSelect.value) {
      sizeSelect.focus();
      showToast("請先選擇尺碼 / SELECT A SIZE");
      return;
    }
    addToCart(productKey, sizeSelect.value);
  });

  card.querySelector("[data-open-size-chart]").addEventListener("click", () => {
    openModal(sizeChartModal);
  });
});

document.querySelectorAll("[data-open-cart]").forEach((button) => button.addEventListener("click", openCart));
document.querySelectorAll("[data-close-cart]").forEach((button) => button.addEventListener("click", closeCart));
document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => closeModal()));
drawerOverlay.addEventListener("click", closeCart);
modalOverlay.addEventListener("click", () => closeModal());
document.querySelector("[data-checkout]").addEventListener("click", beginCheckout);

document.querySelector("[data-cart-items]").addEventListener("click", (event) => {
  const qtyButton = event.target.closest("[data-qty]");
  const removeButton = event.target.closest("[data-remove]");
  if (qtyButton) updateQuantity(Number(qtyButton.dataset.index), Number(qtyButton.dataset.qty));
  if (removeButton) {
    state.cart.splice(Number(removeButton.dataset.index), 1);
    persistCart();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (getOpenModal()) closeModal();
  else if (drawer.classList.contains("is-open")) closeCart();
});

const params = new URLSearchParams(window.location.search);
if (params.get("checkout") === "success") {
  state.cart = [];
  persistCart();
  setTimeout(() => showToast("付款完成 / ORDER CONFIRMED"), 350);
}

updatePricingUI();
loadCatalog();
renderCart();
