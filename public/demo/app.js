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

const AVAILABLE_SIZES = ["S", "M", "L", "XL", "2XL"];

const state = {
  cart: JSON.parse(localStorage.getItem("bx-cart") || "[]"),
};

const PRODUCT_KEY_BY_SKU = {
  "BX-MUT-01": "black",
  "BX-MUT-02": "navy",
};

const formatMoney = (value) => `HK$${value.toLocaleString("en-HK")}`;
const drawer = document.querySelector("[data-cart-drawer]");
const drawerOverlay = document.querySelector("[data-drawer-overlay]");
const modal = document.querySelector("[data-demo-modal]");
const orderModal = document.querySelector("[data-order-modal]");
const sizeChartModal = document.querySelector("[data-size-chart-modal]");
const modalOverlay = document.querySelector("[data-modal-overlay]");
const toast = document.querySelector("[data-toast]");
const cartItemsNode = document.querySelector("[data-cart-items]");
const cartTotalNode = document.querySelector("[data-cart-total]");
const checkoutButton = document.querySelector("[data-checkout]");
const orderForm = document.querySelector("[data-order-form]");
const orderSummary = document.querySelector("[data-order-summary]");
const feedbackIcon = document.querySelector("[data-feedback-icon]");
const feedbackKicker = document.querySelector("[data-feedback-kicker]");
const feedbackTitle = document.querySelector("[data-feedback-title]");
const feedbackCopy = document.querySelector("[data-feedback-copy]");
const feedbackAction = document.querySelector("[data-feedback-action]");

let toastTimer;

function getEffectivePrice(product) {
  if (product.pricingMode === "sale" && product.salePrice) return product.salePrice;
  if (product.pricingMode === "member" && product.memberPrice) return product.memberPrice;
  return product.originalPrice;
}

function getEffectivePriceLabel(product) {
  if (product.pricingMode === "sale" && product.salePrice) return "特價";
  if (product.pricingMode === "member" && product.memberPrice) return "會員價";
  return "";
}

function getPriceMeta(product) {
  const bits = [];
  if (!product.memberPrice && !product.salePrice) return "";
  if (product.originalPrice) bits.push(`原價 HK$${product.originalPrice}`);
  if (product.memberPrice) bits.push(`會員 HK$${product.memberPrice}`);
  if (product.salePrice) bits.push(`特價 HK$${product.salePrice}`);
  return bits.join(" · ");
}

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
  if (orderModal.classList.contains("is-open")) return orderModal;
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

function setFeedbackModal({ icon = "OK", kicker, title, copy, action = "BACK TO STORE" }) {
  feedbackIcon.textContent = icon;
  feedbackKicker.textContent = kicker;
  feedbackTitle.innerHTML = title;
  feedbackCopy.textContent = copy;
  feedbackAction.textContent = action;
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

function changeCartSize(index, size) {
  const item = state.cart[index];
  if (!item || !AVAILABLE_SIZES.includes(size) || item.size === size) return;

  const duplicate = state.cart.find((entry, entryIndex) => (
    entryIndex !== index && entry.productKey === item.productKey && entry.size === size
  ));

  if (duplicate) {
    duplicate.quantity += item.quantity;
    state.cart.splice(index, 1);
  } else {
    item.size = size;
  }

  persistCart();
}

function getCartPayload() {
  return state.cart.map((item) => ({
    sku: PRODUCTS[item.productKey].sku,
    size: item.size,
    quantity: item.quantity,
  }));
}

function renderOrderSummary() {
  const total = state.cart.reduce((sum, item) => sum + getEffectivePrice(PRODUCTS[item.productKey]) * item.quantity, 0);

  if (!state.cart.length) {
    orderSummary.innerHTML = `<div class="order-review__line"><span>購物袋而家未有商品。</span></div>`;
    return;
  }

  orderSummary.innerHTML = [
    ...state.cart.map((item) => {
      const product = PRODUCTS[item.productKey];
      return `
        <div class="order-review__line">
          <span>${product.name}<br />${product.colour} / SIZE ${item.size} × ${item.quantity}</span>
          <strong>${formatMoney(getEffectivePrice(product) * item.quantity)}</strong>
        </div>
      `;
    }),
    `<div class="order-review__total"><span>ORDER TOTAL</span><strong>${formatMoney(total)}</strong></div>`,
  ].join("");
}

function renderCart() {
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = state.cart.reduce((sum, item) => sum + getEffectivePrice(PRODUCTS[item.productKey]) * item.quantity, 0);

  document.querySelectorAll("[data-cart-count]").forEach((node) => { node.textContent = count; });
  cartTotalNode.textContent = formatMoney(total);
  checkoutButton.disabled = count === 0;

  if (!state.cart.length) {
    cartItemsNode.innerHTML = `<div class="empty-bag"><span>00</span><h3>YOUR BAG IS EMPTY</h3><p>揀顏色同尺碼，建立你嘅比賽 loadout。</p></div>`;
    renderOrderSummary();
    return;
  }

  cartItemsNode.innerHTML = state.cart.map((item, index) => {
    const product = PRODUCTS[item.productKey];
    const sizeOptions = AVAILABLE_SIZES.map((size) => (
      `<option value="${size}" ${size === item.size ? "selected" : ""}>${size}</option>`
    )).join("");

    return `
      <article class="cart-line">
        <img src="${product.images.front}" alt="${product.name}" />
        <div>
          <h3>${product.name}</h3>
          <p>${product.colour}</p>
          <div class="cart-line__controls">
            <label class="cart-size-field">
              <span>SIZE</span>
              <select data-size-change data-index="${index}" aria-label="修改 ${product.name} 尺碼">
                ${sizeOptions}
              </select>
            </label>
            <div class="qty-control" aria-label="商品數量">
              <button type="button" data-qty="-1" data-index="${index}" aria-label="減少數量">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-qty="1" data-index="${index}" aria-label="增加數量">＋</button>
            </div>
          </div>
          <strong>${formatMoney(getEffectivePrice(product) * item.quantity)}</strong>
        </div>
        <button type="button" class="cart-line__remove" data-remove data-index="${index}" aria-label="移除 ${product.name}">×</button>
      </article>
    `;
  }).join("");

  renderOrderSummary();
}

function openOrderModal() {
  if (!state.cart.length) return;
  renderOrderSummary();
  openModal(orderModal);
}

async function submitOrder(event) {
  event.preventDefault();
  if (!state.cart.length) {
    closeModal(orderModal);
    showToast("購物袋暫時未有商品");
    return;
  }

  if (!orderForm.reportValidity()) return;

  const button = orderForm.querySelector("[data-confirm-order]");
  const previous = button.innerHTML;
  const formData = new FormData(orderForm);
  const payload = {
    customer: {
      firstName: String(formData.get("firstName") || "").trim(),
      lastName: String(formData.get("lastName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
    },
    items: getCartPayload(),
  };

  button.disabled = true;
  button.innerHTML = "<span>SENDING ORDER…</span><span>···</span>";

  try {
    const response = await fetch("/api/confirm-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "未能確認訂單，請稍後再試。");

    state.cart = [];
    persistCart();
    orderForm.reset();
    closeModal(orderModal);

    setFeedbackModal({
      icon: "OK",
      kicker: "ORDER CONFIRMED",
      title: "ORDER<br />RECEIVED.",
      copy: `我哋已收到你嘅訂單 ${data?.orderReference ? `（${data.orderReference}）` : ""}。團隊會根據你填寫嘅資料再聯絡你安排付款同確認。`,
      action: "BACK TO STORE",
    });
    openModal(modal);
  } catch (error) {
    setFeedbackModal({
      icon: "!",
      kicker: "ORDER ISSUE",
      title: "ORDER<br />NOT SENT.",
      copy: error instanceof Error ? error.message : "未能確認訂單，請稍後再試。",
      action: "TRY AGAIN",
    });
    openModal(modal);
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
checkoutButton.addEventListener("click", openOrderModal);
orderForm.addEventListener("submit", submitOrder);

cartItemsNode.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const qtyButton = target.closest("[data-qty]");
  const removeButton = target.closest("[data-remove]");
  if (qtyButton) updateQuantity(Number(qtyButton.dataset.index), Number(qtyButton.dataset.qty));
  if (removeButton) {
    state.cart.splice(Number(removeButton.dataset.index), 1);
    persistCart();
  }
});

cartItemsNode.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (!target.matches("[data-size-change]")) return;
  changeCartSize(Number(target.dataset.index), target.value);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (getOpenModal()) closeModal();
  else if (drawer.classList.contains("is-open")) closeCart();
});

updatePricingUI();
loadCatalog();
renderCart();
