const MM_TO_PX = 96 / 25.4;
const CART_STORAGE_KEY = "stampSimulatorCart";
const CALIBRATION_STORAGE_KEY = "stampCalibrationFactor";

const state = {
  products: [],
  accessories: [],
  filters: {
    search: "",
    group: "pre-inked",
    shape: "rect",
  },
  selectedProductId: null,
  textBoxes: [],
  selectedTextBoxId: null,
  drag: null,
  calibrationFactor: 1,
  suppressNextClick: false,
  cart: [],
  activeScreen: "shop",
  toastTimer: null,
};

const elements = {
  heroStats: document.querySelector("#heroStats"),
  heroProductImage: document.querySelector("#heroProductImage"),
  viewCartButton: document.querySelector("#viewCartButton"),
  headerBackToShopButton: document.querySelector("#headerBackToShopButton"),
  viewCartCount: document.querySelector("#viewCartCount"),
  workspace: document.querySelector("#workspace"),
  resultsSummary: document.querySelector("#resultsSummary"),
  productList: document.querySelector("#productList"),
  searchInput: document.querySelector("#searchInput"),
  groupFilters: document.querySelector("#groupFilters"),
  shapeField: document.querySelector("#shapeField"),
  shapeFilters: document.querySelector("#shapeFilters"),
  stampFrame: document.querySelector("#stampFrame"),
  stampSurface: document.querySelector("#stampSurface"),
  previewStage: document.querySelector("#previewStage"),
  previewScaleLabel: document.querySelector("#previewScaleLabel"),
  calibrationExpected: document.querySelector("#calibrationExpected"),
  calibrationMeasuredInput: document.querySelector("#calibrationMeasuredInput"),
  applyCalibrationButton: document.querySelector("#applyCalibrationButton"),
  resetCalibrationButton: document.querySelector("#resetCalibrationButton"),
  calibrationStatus: document.querySelector("#calibrationStatus"),
  editorToolbar: document.querySelector("#editorToolbar"),
  specCard: document.querySelector("#specCard"),
  addTextButton: document.querySelector("#addTextButton"),
  addStampToCartButton: document.querySelector("#addStampToCartButton"),
  sendOrderButton: document.querySelector("#sendOrderButton"),
  textLayerList: document.querySelector("#textLayerList"),
  textContentInput: document.querySelector("#textContentInput"),
  fontSizeInput: document.querySelector("#fontSizeInput"),
  fontSizeValue: document.querySelector("#fontSizeValue"),
  boldInput: document.querySelector("#boldInput"),
  alignControls: document.querySelector("#alignControls"),
  removeTextButton: document.querySelector("#removeTextButton"),
  calibrationCard: document.querySelector("#calibrationCard"),
  orderCard: document.querySelector("#orderCard"),
  accessoryBrowser: document.querySelector("#accessoryBrowser"),
  accessoryBrowserList: document.querySelector("#accessoryBrowserList"),
  previewFooterToolbar: document.querySelector("#previewFooterToolbar"),
  cartSummary: document.querySelector("#cartSummary"),
  cartList: document.querySelector("#cartList"),
  clearCartButton: document.querySelector("#clearCartButton"),
  customerNameInput: document.querySelector("#customerNameInput"),
  customerAddressInput: document.querySelector("#customerAddressInput"),
  customerPhoneInput: document.querySelector("#customerPhoneInput"),
  orderStatus: document.querySelector("#orderStatus"),
  orderSection: document.querySelector("#orderSection"),
  backToShopButton: document.querySelector("#backToShopButton"),
  toast: document.querySelector("#toast"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

async function init() {
  const appData = window.APP_DATA ?? {};
  state.products = appData.stamps ?? [];
  state.accessories = appData.accessories ?? [];
  if (!state.products.length) {
    throw new Error("Bundled stamp data is missing.");
  }

  state.calibrationFactor = readCalibrationFactor();
  state.cart = readCart();
  state.selectedProductId = state.products[0]?.articleNo ?? null;
  state.textBoxes = [createTextBox("Company Name"), createTextBox("Approved")];
  state.selectedTextBoxId = state.textBoxes[0]?.id ?? null;

  bindEvents();
  syncSelectionToVisibleProducts();
  renderHeroStats();
  renderAll();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    syncSelectionToVisibleProducts();
    renderCatalog();
  });

  elements.groupFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-group]");
    if (!button) return;
    state.filters.group = button.dataset.group;
    syncSegmentedControl(elements.groupFilters, button);
    syncSelectionToVisibleProducts();
    renderCatalog();
  });

  elements.shapeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-shape]");
    if (!button) return;
    state.filters.shape = button.dataset.shape;
    syncSegmentedControl(elements.shapeFilters, button);
    syncSelectionToVisibleProducts();
    renderCatalog();
  });

  elements.addTextButton.addEventListener("click", () => {
    const textBox = createTextBox(`Text ${state.textBoxes.length + 1}`);
    state.textBoxes.push(textBox);
    state.selectedTextBoxId = textBox.id;
    renderEditor();
    renderPreview();
  });

  elements.removeTextButton.addEventListener("click", () => {
    if (!state.selectedTextBoxId) return;
    state.textBoxes = state.textBoxes.filter((item) => item.id !== state.selectedTextBoxId);
    state.selectedTextBoxId = state.textBoxes[0]?.id ?? null;
    renderEditor();
    renderPreview();
  });

  elements.textContentInput.addEventListener("input", (event) => {
    const sanitized = String(event.target.value).replace(/[\r\n]+/g, " ");
    if (event.target.value !== sanitized) {
      event.target.value = sanitized;
    }
    updateSelectedTextBox({ text: sanitized });
  });

  elements.fontSizeInput.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    elements.fontSizeValue.textContent = `${value} px`;
    updateSelectedTextBox({ fontSize: value });
  });

  elements.boldInput.addEventListener("change", (event) => {
    updateSelectedTextBox({ bold: event.target.checked });
  });

  elements.alignControls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-align]");
    if (!button) return;
    updateSelectedTextBox({ align: button.dataset.align });
  });

  elements.addStampToCartButton.addEventListener("click", addCurrentStampToCart);
  elements.sendOrderButton.addEventListener("click", sendOrder);

  elements.applyCalibrationButton.addEventListener("click", applyCalibration);
  elements.resetCalibrationButton.addEventListener("click", resetCalibration);

  elements.accessoryBrowserList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-accessory-article]");
    if (!button) return;
    const card = button.closest(".accessory-item");
    const colorSelect = card?.querySelector("[data-ink-color]");
    addAccessoryToCart(button.dataset.accessoryArticle, colorSelect?.value ?? "");
  });

  elements.cartList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-cart-action]");
    if (!button) return;
    const id = button.dataset.cartId;
    const action = button.dataset.cartAction;
    if (action === "increase") {
      updateCartQuantity(id, 1);
    } else if (action === "decrease") {
      updateCartQuantity(id, -1);
    } else if (action === "remove") {
      removeCartItem(id);
    }
  });

  elements.clearCartButton.addEventListener("click", clearCart);
  elements.viewCartButton.addEventListener("click", openOrderSection);
  elements.headerBackToShopButton?.addEventListener("click", openShopSection);
  elements.backToShopButton.addEventListener("click", openShopSection);

  window.addEventListener("resize", renderPreview);
}

function renderAll() {
  renderScreen();
  updateFilterVisibility();
  renderHeroImage();
  renderCatalog();
  renderPreview();
  renderSpecCard();
  renderEditor();
  renderAccessoryBrowser();
  renderCart();
}

function renderHeroStats() {
  const circles = state.products.filter((item) => item.shape === "circle").length;
  const rectangles = state.products.filter((item) => item.shape === "rect").length;
  const rubberCount = state.accessories.filter((item) => item.productGroup === "rubber").length;
  const inkCount = state.accessories.filter((item) => item.productGroup === "ink").length;

  elements.heroStats.innerHTML = `
    <div class="hero-stat">
      <span>Stamp Sizes</span>
      <strong>${state.products.length}</strong>
    </div>
    <div class="hero-stat">
      <span>Rubber / Ink</span>
      <strong>${rubberCount} / ${inkCount}</strong>
    </div>
    <div class="hero-stat">
      <span>Rect / Circle</span>
      <strong>${rectangles} / ${circles}</strong>
    </div>
  `;
}

function renderHeroImage() {
  if (!elements.heroProductImage) return;
  const imageConfig = getHeroImageConfig();
  elements.heroProductImage.src = imageConfig.src;
  elements.heroProductImage.alt = imageConfig.alt;
}

function renderCatalog() {
  const filteredItems = getFilteredCatalogItems();
  const selectedProduct = getSelectedProduct();
  const listScrollTop = elements.productList.scrollTop;
  updateFilterVisibility();
  renderHeroImage();
  const showResultsSummary = state.filters.group === "pre-inked";
  elements.resultsSummary.classList.toggle("hidden", !showResultsSummary);
  elements.productList.classList.toggle("hidden", !showResultsSummary);
  elements.resultsSummary.textContent = showResultsSummary
    ? `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"} found`
    : "";

  if (!filteredItems.length) {
    elements.productList.replaceChildren(elements.emptyStateTemplate.content.cloneNode(true));
    elements.productList.scrollTop = listScrollTop;
    renderSpecCard();
    renderPreview();
    renderAccessoryBrowser();
    return;
  }

  const cards = filteredItems.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    const isStamp = item.kind === "stamp";
    button.className = `product-card${isStamp && selectedProduct?.articleNo === item.articleNo ? " active" : ""}`;
    if (isStamp) {
      button.innerHTML = `
        <div class="product-topline">
          <span class="product-title">${escapeHtml(item.model)}</span>
          <span class="price">${formatRm(item.rsp)}</span>
        </div>
        <div class="badge-row">
          <span class="badge">Pre-Inked</span>
          <span class="badge">${item.shape === "circle" ? "Circle" : "Rectangle"}</span>
        </div>
        <p>${escapeHtml(getDisplaySizeLabel(item))}</p>
        <div class="product-meta">
          <span class="meta-label">${escapeHtml(item.articleNo)}</span>
        </div>
      `;
      button.addEventListener("click", () => {
        state.selectedProductId = item.articleNo;
        renderCatalog();
        renderPreview();
        renderSpecCard();
        renderAccessoryBrowser();
      });
    } else {
      button.innerHTML = `
        <div class="product-topline">
          <span class="product-title">${escapeHtml(item.model)}</span>
          <span class="price">${formatRm(item.rsp)}</span>
        </div>
        <div class="badge-row">
          <span class="badge">${item.productGroup === "rubber" ? "Rubber" : "Ink"}</span>
          <span class="badge">${item.linkedModels === "all" ? "All stamps" : `For ${escapeHtml(item.linkedModels.join(", "))}`}</span>
        </div>
        <p>${escapeHtml(item.description)}</p>
        <div class="product-meta">
          <span class="meta-label">${escapeHtml(item.articleNo)}</span>
        </div>
      `;
    }
    return button;
  });

  elements.productList.replaceChildren(...cards);
  elements.productList.scrollTop = listScrollTop;
  renderSpecCard();
  renderPreview();
  renderAccessoryBrowser();
}

function renderPreview() {
  toggleCenterMode();
  if (isAccessoryMode()) {
    elements.stampSurface.replaceChildren();
    elements.stampSurface.style.width = "0";
    elements.stampSurface.style.height = "0";
    return;
  }

  const product = getSelectedProduct();
  if (!product) {
    elements.stampSurface.className = "stamp-surface";
    elements.stampSurface.style.width = "0";
    elements.stampSurface.style.height = "0";
    elements.stampSurface.replaceChildren();
    return;
  }

  const { widthMm, heightMm } = getDisplayDimensions(product);
  const widthPx = Math.max(40, widthMm * getMmToPx());
  const heightPx = Math.max(40, heightMm * getMmToPx());

  elements.stampSurface.className = `stamp-surface ${product.shape}`;
  elements.stampSurface.style.width = `${widthPx}px`;
  elements.stampSurface.style.height = `${heightPx}px`;
  applyPreviewScale(widthPx, heightPx);
  renderTextBoxes(widthPx, heightPx);
  renderSpecCard();
}

function renderTextBoxes(widthPx, heightPx) {
  const surfaceRect = { width: widthPx, height: heightPx };
  const nodes = state.textBoxes.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `stamp-text${item.id === state.selectedTextBoxId ? " selected" : ""}`;
    button.textContent = item.text;
    button.style.left = `${item.x * widthPx}px`;
    button.style.top = `${item.y * heightPx}px`;
    button.style.fontSize = `${item.fontSize}px`;
    button.style.fontWeight = item.bold ? "700" : "400";
    button.style.textAlign = item.align;
    button.style.maxWidth = `${Math.max(180, widthPx + 220)}px`;
    button.dataset.id = item.id;
    button.addEventListener("click", () => {
      if (state.suppressNextClick) return;
      state.selectedTextBoxId = item.id;
      renderEditor();
      renderPreview();
    });
    button.addEventListener("pointerdown", (event) => beginDrag(event, item.id, surfaceRect));
    return button;
  });

  elements.stampSurface.replaceChildren(...nodes);
}

function beginDrag(event, textBoxId, surfaceRect) {
  const target = event.currentTarget;
  const box = state.textBoxes.find((item) => item.id === textBoxId);
  if (!box) return;

  event.preventDefault();
  state.selectedTextBoxId = textBoxId;
  renderEditor();

  const surfaceBounds = elements.stampSurface.getBoundingClientRect();
  const targetBounds = target.getBoundingClientRect();
  const scale = getCurrentPreviewScale();

  target.setPointerCapture?.(event.pointerId);
  document.body.style.userSelect = "none";

  state.drag = {
    textBoxId,
    element: target,
    offsetX: (event.clientX - targetBounds.left) / scale,
    offsetY: (event.clientY - targetBounds.top) / scale,
    surfaceRect,
    surfaceBounds,
    targetWidth: targetBounds.width / scale,
    targetHeight: targetBounds.height / scale,
    moved: false,
  };

  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", endDrag, { once: true });
}

function onDragMove(event) {
  if (!state.drag) return;
  const { surfaceBounds, targetWidth, targetHeight, textBoxId, surfaceRect, offsetX, offsetY, element } = state.drag;
  const scale = getCurrentPreviewScale();
  const rawX = (event.clientX - surfaceBounds.left) / scale - offsetX;
  const rawY = (event.clientY - surfaceBounds.top) / scale - offsetY;
  const dragPaddingX = Math.max(160, surfaceRect.width);
  const dragPaddingY = Math.max(120, surfaceRect.height);
  const nextX = clamp(rawX, -dragPaddingX, surfaceRect.width + dragPaddingX - targetWidth);
  const nextY = clamp(rawY, -dragPaddingY, surfaceRect.height + dragPaddingY - targetHeight);

  updateTextBox(textBoxId, {
    x: nextX / surfaceRect.width,
    y: nextY / surfaceRect.height,
  });

  if (element) {
    element.style.left = `${nextX}px`;
    element.style.top = `${nextY}px`;
  }
  state.drag.moved = true;
}

function endDrag(event) {
  if (state.drag?.element && event?.pointerId !== undefined) {
    state.drag.element.releasePointerCapture?.(event.pointerId);
  }
  if (state.drag?.moved) {
    state.suppressNextClick = true;
    window.setTimeout(() => {
      state.suppressNextClick = false;
    }, 0);
  }
  state.drag = null;
  document.body.style.userSelect = "";
  window.removeEventListener("pointermove", onDragMove);
  renderPreview();
}

function renderSpecCard() {
  if (isAccessoryMode()) {
    const modeLabel = getAccessoryModeLabel();
    elements.specCard.innerHTML = `
      <div class="empty-state">
        <h3>${escapeHtml(modeLabel)} Mode</h3>
        <p>Stamp editing is hidden while browsing ${escapeHtml(modeLabel.toLowerCase())} items. Use the center panel to add products to cart.</p>
      </div>
    `;
    return;
  }

  const product = getSelectedProduct();
  if (!product) {
    elements.specCard.innerHTML = `
      <div class="empty-state">
        <h3>Select a stamp</h3>
        <p>Pick a product to see the size, article number, and retail price.</p>
      </div>
    `;
    return;
  }

  elements.specCard.innerHTML = `
    <div>
      <div class="spec-badges">
        <span class="badge">Pre-Inked</span>
        <span class="badge">${product.shape === "circle" ? "Circle" : "Rectangle"}</span>
      </div>
      <h3>${escapeHtml(product.model)}</h3>
      <p>${escapeHtml(product.description)}</p>
    </div>
    <dl class="spec-list">
      <div>
        <dt>Article No.</dt>
        <dd>${escapeHtml(product.articleNo)}</dd>
      </div>
      <div>
        <dt>Stamp Size</dt>
        <dd>${escapeHtml(getDisplaySizeLabel(product))}</dd>
      </div>
      <div>
        <dt>Retail Price</dt>
        <dd>${formatRm(product.rsp)}</dd>
      </div>
      <div>
        <dt>Preview Scale</dt>
        <dd>${elements.previewScaleLabel.textContent}</dd>
      </div>
      <div>
        <dt>Calibration</dt>
        <dd>${Math.round(state.calibrationFactor * 100)}%</dd>
      </div>
    </dl>
  `;
}

function renderEditor() {
  const items = state.textBoxes.map((textBox, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `text-layer-item${textBox.id === state.selectedTextBoxId ? " active" : ""}`;
    button.innerHTML = `
      <div>
        <strong>Layer ${index + 1}</strong>
        <div>${escapeHtml(textBox.text || "Empty text box")}</div>
      </div>
      <small>${textBox.fontSize}px · ${textBox.align}${textBox.bold ? " · bold" : ""}</small>
    `;
    button.addEventListener("click", () => {
      state.selectedTextBoxId = textBox.id;
      populateEditorInputs();
      renderEditor();
      renderPreview();
    });
    return button;
  });

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No text layers</h3><p>Add a text box to start designing the stamp.</p>";
    elements.textLayerList.replaceChildren(empty);
  } else {
    elements.textLayerList.replaceChildren(...items);
  }

  populateEditorInputs();
}

function populateEditorInputs() {
  const textBox = getSelectedTextBox();
  const hasSelection = Boolean(textBox);
  elements.textContentInput.disabled = !hasSelection;
  elements.fontSizeInput.disabled = !hasSelection;
  elements.boldInput.disabled = !hasSelection;
  elements.removeTextButton.disabled = !hasSelection;
  [...elements.alignControls.querySelectorAll("button")].forEach((button) => {
    button.disabled = !hasSelection;
  });

  if (!textBox) {
    elements.textContentInput.value = "";
    elements.fontSizeInput.value = "18";
    elements.fontSizeValue.textContent = "18 px";
    elements.boldInput.checked = false;
    syncAlignButtons("left");
    return;
  }

  elements.textContentInput.value = textBox.text;
  elements.fontSizeInput.value = String(textBox.fontSize);
  elements.fontSizeValue.textContent = `${textBox.fontSize} px`;
  elements.boldInput.checked = textBox.bold;
  syncAlignButtons(textBox.align);
}

function renderAccessoryBrowser() {
  const relevantAccessories = getAccessoryItemsForMode();
  const modeLabel = getAccessoryModeLabel();

  if (!relevantAccessories.length) {
    elements.accessoryBrowserList.innerHTML = `
      <div class="empty-state">
        <h3>No ${escapeHtml(modeLabel.toLowerCase())}</h3>
        <p>${isAccessoryMode() ? `No ${escapeHtml(modeLabel.toLowerCase())} items match the current search.` : "Choose a stamp to see matching rubber and ink items."}</p>
      </div>
    `;
    return;
  }

  const product = getSelectedProduct();
  const productModel = product?.model ?? null;
  elements.accessoryBrowserList.innerHTML = relevantAccessories
    .map(
      (item) => `
        <article class="accessory-item">
          <div>
            <div class="badge-row">
              <span class="badge">${item.productGroup === "rubber" ? "Rubber" : "Ink"}</span>
              <span class="badge">${item.linkedModels === "all" ? "All stamps" : `For ${escapeHtml(productModel)}`}</span>
            </div>
            <h4>${escapeHtml(item.model)}</h4>
            <p>${escapeHtml(item.description)}</p>
            <small>${escapeHtml(item.articleNo)}</small>
          </div>
          <div class="accessory-actions">
            <strong>${formatRm(item.rsp)}</strong>
            ${
              item.productGroup === "ink"
                ? `<label class="accessory-color-field">
                    <span>Color</span>
                    <select data-ink-color>
                      <option value="Black">Black</option>
                      <option value="Blue">Blue</option>
                      <option value="Red">Red</option>
                    </select>
                  </label>`
                : ""
            }
            <button type="button" data-accessory-article="${escapeHtml(item.articleNo)}">Add</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderCart() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = state.cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  elements.viewCartCount.textContent = String(totalItems);
  elements.cartSummary.innerHTML = `
    <div class="cart-totals">
      <strong>${totalItems} item${totalItems === 1 ? "" : "s"}</strong>
      <span>${formatRm(totalPrice)}</span>
    </div>
  `;

  if (!state.cart.length) {
    elements.cartList.innerHTML = `
      <div class="empty-state">
        <h3>Cart is empty</h3>
        <p>Add a customized stamp, rubber die, or ink bottle to start building an order.</p>
      </div>
    `;
    return;
  }

  elements.cartList.innerHTML = state.cart
    .map(
      (item) => `
        <article class="cart-item">
          <div class="cart-item-copy">
            <div class="badge-row">
              <span class="badge">${escapeHtml(item.kindLabel)}</span>
            </div>
            <h4>${escapeHtml(item.name)}</h4>
            <p>${escapeHtml(item.description)}</p>
            ${item.designSummary ? `<small>${escapeHtml(item.designSummary)}</small>` : ""}
          </div>
          <div class="cart-item-actions">
            <strong>${formatRm(item.unitPrice)}</strong>
            <div class="cart-qty-controls">
              <button type="button" data-cart-action="decrease" data-cart-id="${escapeHtml(item.id)}">-</button>
              <span>${item.qty}</span>
              <button type="button" data-cart-action="increase" data-cart-id="${escapeHtml(item.id)}">+</button>
            </div>
            <button type="button" class="cart-remove" data-cart-action="remove" data-cart-id="${escapeHtml(item.id)}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");
}

function addCurrentStampToCart() {
  const product = getSelectedProduct();
  if (!product) return;

  const textSnapshot = state.textBoxes.map((item) => ({
    text: item.text,
    fontSize: item.fontSize,
    bold: item.bold,
    align: item.align,
    x: Number(item.x.toFixed(4)),
    y: Number(item.y.toFixed(4)),
  }));
  const key = JSON.stringify({ articleNo: product.articleNo, textSnapshot });
  const id = `stamp:${simpleHash(key)}`;
  const designSummary = textSnapshot.length ? textSnapshot.map((item) => item.text || "Empty").join(" | ") : "No text";

  upsertCartItem({
    id,
    kind: "stamp",
    kindLabel: "Custom Stamp",
    articleNo: product.articleNo,
    model: product.model,
    shape: product.shape,
    widthMm: product.widthMm,
    heightMm: product.heightMm,
    diameterMm: product.diameterMm,
    sizeLabel: product.sizeLabel,
    name: `${product.model} Custom Stamp`,
    description: `${getDisplaySizeLabel(product)} · ${product.description}`,
    designSummary,
    textSnapshot,
    unitPrice: Number(product.rsp),
  });
}

function addAccessoryToCart(articleNo, selectedColor) {
  const item = state.accessories.find((entry) => entry.articleNo === articleNo);
  if (!item) return;
  const colorLabel = item.productGroup === "ink" ? (selectedColor || "Black") : "";

  upsertCartItem({
    id: `accessory:${item.articleNo}:${colorLabel || "default"}`,
    kind: "accessory",
    kindLabel: item.productGroup === "rubber" ? "Rubber" : "Ink",
    articleNo: item.articleNo,
    name: item.productGroup === "ink" ? `${item.description} - ${colorLabel}` : item.description,
    description: item.productGroup === "ink" ? `${item.articleNo} · Color: ${colorLabel}` : item.articleNo,
    selectedColor: colorLabel,
    designSummary: "",
    unitPrice: Number(item.rsp),
  });
}

function upsertCartItem(nextItem) {
  const existing = state.cart.find((item) => item.id === nextItem.id);
  if (existing) {
    existing.qty += 1;
    showToast(`${nextItem.kindLabel} quantity updated in cart.`);
  } else {
    state.cart.unshift({ ...nextItem, qty: 1 });
    showToast(`${nextItem.kindLabel} added to cart.`);
  }
  persistCart();
  renderCart();
}

function toggleCenterMode() {
  const accessoryMode = isAccessoryMode();
  elements.editorToolbar.classList.toggle("hidden", accessoryMode);
  elements.textLayerList.classList.toggle("hidden", accessoryMode);
  elements.previewStage.classList.toggle("hidden", accessoryMode);
  elements.calibrationCard.classList.toggle("hidden", accessoryMode);
  elements.addStampToCartButton.classList.toggle("hidden", accessoryMode);
  elements.accessoryBrowser.classList.toggle("hidden", !accessoryMode);
}

function sendOrder() {
  const customerName = elements.customerNameInput.value.trim();
  const customerAddress = elements.customerAddressInput.value.trim();
  const customerPhone = elements.customerPhoneInput.value.trim();

  if (!customerName || !customerAddress || !customerPhone) {
    const message = "Please fill in customer name, address, and phone number before sending the order.";
    elements.orderStatus.textContent = message;
    window.alert(message);
    return;
  }

  if (!state.cart.length) {
    const message = "Cart is empty. Add at least one stamp or accessory before sending the order.";
    elements.orderStatus.textContent = message;
    window.alert(message);
    return;
  }

  const orderHtml = buildOrderHtml({
    customerName,
    customerAddress,
    customerPhone,
    items: state.cart,
  });
  const blob = new Blob([orderHtml], { type: "text/html;charset=utf-8" });
  const safeName = customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "customer";
  downloadBlob(blob, `order-${safeName}.html`);
  elements.orderStatus.textContent = "Order HTML file generated with customer details, cart items, and design previews.";
}

function updateCartQuantity(id, delta) {
  state.cart = state.cart
    .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
    .filter((item) => item.qty > 0);
  persistCart();
  renderCart();
}

function removeCartItem(id) {
  state.cart = state.cart.filter((item) => item.id !== id);
  persistCart();
  renderCart();
}

function clearCart() {
  state.cart = [];
  persistCart();
  renderCart();
  showToast("Cart cleared.");
}

function openOrderSection() {
  state.activeScreen = "order";
  renderScreen();
}

function openShopSection() {
  state.activeScreen = "shop";
  renderScreen();
}

function renderScreen() {
  const showOrder = state.activeScreen === "order";
  elements.workspace.classList.toggle("hidden", showOrder);
  elements.orderSection.classList.toggle("hidden", !showOrder);
  elements.viewCartButton.classList.toggle("hidden", showOrder);
  elements.headerBackToShopButton?.classList.toggle("hidden", !showOrder);
  if (showOrder) {
    elements.orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function updateFilterVisibility() {
  const showShape = state.filters.group === "pre-inked";
  elements.shapeField?.classList.toggle("hidden", !showShape);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer);
  }
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2200);
}

function persistCart() {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

function readCart() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function syncAlignButtons(activeAlign) {
  [...elements.alignControls.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("active", button.dataset.align === activeAlign);
  });
}

function syncSegmentedControl(container, activeButton) {
  [...container.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

function isAccessoryMode() {
  return state.filters.group === "rubber" || state.filters.group === "ink";
}

function getAccessoryModeLabel() {
  if (state.filters.group === "rubber") {
    return "Rubber";
  }
  if (state.filters.group === "ink") {
    return "Ink Bottle";
  }
  return "Accessories";
}

function getHeroImageConfig() {
  if (state.filters.group === "rubber") {
    return {
      src: "stampcustomdata/stamprubber.webp",
      alt: "Rubber product photo",
    };
  }
  if (state.filters.group === "ink") {
    return {
      src: "stampcustomdata/stampinkbtl.webp",
      alt: "Ink bottle product photo",
    };
  }

  const product = getSelectedProduct();
  if (product?.shape === "circle") {
    return {
      src: "stampcustomdata/stamppreinkround.webp",
      alt: "Round pre-inked stamp photo",
    };
  }

  return {
    src: "stampcustomdata/stamppreinkrec.webp",
    alt: "Rectangular pre-inked stamp photo",
  };
}

function getFilteredCatalogItems() {
  const stampItems = state.products
    .filter((product) => {
      if (isAccessoryMode()) {
        return false;
      }
      if (product.shape !== state.filters.shape) {
        return false;
      }
      const searchHaystack = [
        product.articleNo,
        product.model,
        product.description,
        product.sizeLabel,
        getDisplaySizeLabel(product),
        product.productGroup,
        product.shape,
      ]
        .join(" ")
        .toLowerCase();
      return !state.filters.search || searchHaystack.includes(state.filters.search);
    })
    .map((item) => ({ ...item, kind: "stamp" }));

  const accessoryItems = state.accessories
    .filter((item) => {
      if (state.filters.group === "pre-inked") {
        return false;
      }
      if (state.filters.group === "rubber" && item.productGroup !== "rubber") {
        return false;
      }
      if (state.filters.group === "ink" && item.productGroup !== "ink") {
        return false;
      }
      const searchHaystack = [
        item.articleNo,
        item.model,
        item.description,
        item.productGroup,
        Array.isArray(item.linkedModels) ? item.linkedModels.join(" ") : item.linkedModels,
      ]
        .join(" ")
        .toLowerCase();
      return !state.filters.search || searchHaystack.includes(state.filters.search);
    })
    .map((item) => ({ ...item, kind: "accessory" }));

  if (isAccessoryMode()) {
    return accessoryItems;
  }
  return stampItems;
}

function getFilteredProducts() {
  if (state.filters.group !== "pre-inked") {
    return [];
  }

  return state.products.filter((product) => {
    const matchesGroup = product.productGroup === state.filters.group;
    const matchesShape = product.shape === state.filters.shape;
    const searchHaystack = [
      product.articleNo,
      product.model,
      product.description,
      product.sizeLabel,
      getDisplaySizeLabel(product),
      product.productGroup,
      product.shape,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !state.filters.search || searchHaystack.includes(state.filters.search);
    return matchesGroup && matchesShape && matchesSearch;
  });
}

function getAccessoryItemsForMode() {
  if (isAccessoryMode()) {
    return getFilteredCatalogItems().filter((item) => item.kind === "accessory");
  }

  const product = getSelectedProduct();
  const productModel = product?.model ?? null;
  return state.accessories.filter((item) => {
    if (item.linkedModels === "all") {
      return true;
    }
    return Array.isArray(item.linkedModels) && item.linkedModels.includes(productModel);
  });
}

function syncSelectionToVisibleProducts() {
  if (isAccessoryMode()) {
    return;
  }
  const filtered = getFilteredProducts();
  if (!filtered.some((item) => item.articleNo === state.selectedProductId)) {
    state.selectedProductId = filtered[0]?.articleNo ?? null;
  }
}

function getSelectedProduct() {
  return state.products.find((item) => item.articleNo === state.selectedProductId) ?? null;
}

function getSelectedTextBox() {
  return state.textBoxes.find((item) => item.id === state.selectedTextBoxId) ?? null;
}

function createTextBox(defaultText) {
  const count = state.textBoxes.length;
  return {
    id: crypto.randomUUID(),
    text: defaultText,
    fontSize: 18,
    bold: false,
    align: "center",
    x: 0.15,
    y: Math.min(0.75, 0.15 + count * 0.18),
  };
}

function updateSelectedTextBox(patch) {
  if (!state.selectedTextBoxId) return;
  updateTextBox(state.selectedTextBoxId, patch);
  renderEditor();
  renderPreview();
}

function updateTextBox(id, patch) {
  state.textBoxes = state.textBoxes.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function applyPreviewScale(widthPx, heightPx) {
  const frameWrap = elements.previewStage.querySelector(".stamp-frame-wrap");
  const availableWidth = Math.max(180, frameWrap.clientWidth - 24);
  const availableHeight = Math.max(180, frameWrap.clientHeight - 24);
  const scale = Math.min(1, availableWidth / widthPx, availableHeight / heightPx);
  elements.stampFrame.style.setProperty("--preview-scale", `${scale}`);
  elements.previewScaleLabel.textContent =
    scale < 1 ? `Scaled to ${Math.round(scale * 100)}% to fit screen` : `1 mm ≈ ${getMmToPx().toFixed(2)} px`;
  renderCalibrationInfo();
}

function getCurrentPreviewScale() {
  const raw = getComputedStyle(elements.stampFrame).getPropertyValue("--preview-scale").trim();
  return raw ? Number(raw) : 1;
}

async function buildPreviewBlob(product) {
  const { widthMm, heightMm } = getDisplayDimensions(product);
  const widthPx = Math.round(widthMm * getMmToPx());
  const heightPx = Math.round(heightMm * getMmToPx());
  const svg = buildPreviewSvg(product, widthPx, heightPx);
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = widthPx + 40;
  canvas.height = heightPx + 40;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 20, 20);
  URL.revokeObjectURL(url);
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

function buildPreviewSvg(product, widthPx, heightPx) {
  return buildPreviewSvgFromLayers(product, state.textBoxes, widthPx, heightPx);
}

function buildPreviewSvgFromLayers(product, layers, widthPx, heightPx) {
  const radius = product.shape === "circle" ? widthPx / 2 - 2 : 14;
  const shapeNode =
    product.shape === "circle"
      ? `<circle cx="${widthPx / 2}" cy="${heightPx / 2}" r="${radius}" fill="transparent" stroke="#2b2118" stroke-width="2" />`
      : `<rect x="1" y="1" width="${widthPx - 2}" height="${heightPx - 2}" rx="${radius}" ry="${radius}" fill="transparent" stroke="#2b2118" stroke-width="2" />`;

  const textNodes = layers
    .map((item) => {
      const x = item.x * widthPx;
      const y = item.y * heightPx;
      const anchor = item.align === "left" ? "start" : item.align === "right" ? "end" : "middle";
      const lineX =
        item.align === "left"
          ? x
          : item.align === "right"
            ? Math.min(widthPx - 4, x + widthPx * 0.3)
            : Math.min(widthPx - 4, x + widthPx * 0.15);
      const singleLine = escapeXml((item.text || "").replace(/[\r\n]+/g, " "));
      const lineY = y + item.fontSize;
      return `<text font-family="Segoe UI, Arial, sans-serif" font-size="${item.fontSize}" font-weight="${item.bold ? 700 : 400}" text-anchor="${anchor}" fill="#111"><tspan x="${lineX}" y="${lineY}">${singleLine || " "}</tspan></text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">${shapeNode}${textNodes}</svg>`;
}

function buildSpecCardHtml(product) {
  const layers = state.textBoxes
    .map(
      (item, index) =>
        `<li><strong>Layer ${index + 1}:</strong> ${escapeHtml(item.text)} <span>(${item.fontSize}px, ${item.align}${item.bold ? ", bold" : ""})</span></li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(product.model)} Spec Card</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; background: #f7f1e8; color: #2b2118; padding: 32px; }
      .card { max-width: 720px; margin: 0 auto; background: #fffdf9; border: 1px solid rgba(101,69,42,.18); border-radius: 24px; padding: 28px; }
      .badge { display: inline-block; margin-right: 8px; padding: 6px 10px; border-radius: 999px; background: rgba(181,79,45,.12); color: #88351a; font-size: 12px; }
      h1 { margin: 12px 0 8px; font-family: Georgia, serif; }
      dl { display: grid; gap: 14px; }
      dt { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #746553; }
      dd { margin: 4px 0 0; font-weight: 600; }
      ul { padding-left: 20px; }
      li + li { margin-top: 8px; }
      span { color: #746553; }
    </style>
  </head>
  <body>
    <article class="card">
      <div>
        <span class="badge">Pre-Inked</span>
        <span class="badge">${product.shape === "circle" ? "Circle" : "Rectangle"}</span>
      </div>
      <h1>${escapeHtml(product.model)}</h1>
      <p>${escapeHtml(product.description)}</p>
      <dl>
        <div><dt>Article No.</dt><dd>${escapeHtml(product.articleNo)}</dd></div>
        <div><dt>Size</dt><dd>${escapeHtml(getDisplaySizeLabel(product))}</dd></div>
        <div><dt>Retail Price</dt><dd>${formatRm(product.rsp)}</dd></div>
      </dl>
      <h2>Current Text Layers</h2>
      <ul>${layers || "<li>No text layers</li>"}</ul>
    </article>
  </body>
</html>`;
}

function buildOrderHtml(order) {
  const totalPrice = order.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const itemMarkup = order.items
    .map((item) => {
      const previewMarkup = item.kind === "stamp" ? buildOrderStampPreview(item) : "";
      return `
        <article class="order-item">
          <div class="order-item-copy">
            <div class="badge-row"><span class="badge">${escapeHtml(item.kindLabel)}</span></div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.description)}</p>
            ${item.designSummary ? `<p><strong>Design:</strong> ${escapeHtml(item.designSummary)}</p>` : ""}
            <p><strong>Qty:</strong> ${item.qty}</p>
            <p><strong>Unit Price:</strong> ${formatRm(item.unitPrice)}</p>
            <p><strong>Line Total:</strong> ${formatRm(item.unitPrice * item.qty)}</p>
          </div>
          ${previewMarkup}
        </article>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Stamp Order</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; background: #f7f1e8; color: #2b2118; margin: 0; padding: 32px; }
      .sheet { max-width: 980px; margin: 0 auto; display: grid; gap: 18px; }
      .card { background: #fffdf9; border: 1px solid rgba(101,69,42,.16); border-radius: 22px; padding: 24px; }
      h1, h2, h3 { font-family: Georgia, serif; margin: 0 0 10px; }
      p { margin: 6px 0; line-height: 1.5; }
      .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: rgba(181,79,45,.12); color: #88351a; font-size: 12px; }
      .order-item { display: grid; grid-template-columns: 1.3fr .9fr; gap: 18px; align-items: start; padding-top: 18px; border-top: 1px solid rgba(101,69,42,.12); }
      .order-item:first-child { border-top: 0; padding-top: 0; }
      .preview-box { display: grid; place-items: center; min-height: 180px; padding: 18px; border-radius: 18px; background: linear-gradient(180deg, #fff, #f6eee4); border: 1px dashed rgba(101,69,42,.18); }
      .totals { display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; }
      @media (max-width: 760px) { .meta, .order-item { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="card">
        <h1>Stamp Order</h1>
        <div class="meta">
          <div><strong>Customer Name</strong><p>${escapeHtml(order.customerName)}</p></div>
          <div><strong>Phone No.</strong><p>${escapeHtml(order.customerPhone)}</p></div>
          <div><strong>Total</strong><p>${formatRm(totalPrice)}</p></div>
        </div>
        <div style="margin-top:14px;">
          <strong>Address</strong>
          <p>${escapeHtml(order.customerAddress).replaceAll("\n", "<br />")}</p>
        </div>
      </section>
      <section class="card">
        <h2>Items</h2>
        ${itemMarkup}
      </section>
      <section class="card">
        <div class="totals">
          <span>Total Items</span>
          <span>${order.items.reduce((sum, item) => sum + item.qty, 0)}</span>
        </div>
        <div class="totals" style="margin-top:8px;">
          <span>Grand Total</span>
          <span>${formatRm(totalPrice)}</span>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function buildOrderStampPreview(item) {
  const product = {
    shape: item.shape,
    widthMm: item.widthMm,
    heightMm: item.heightMm,
    diameterMm: item.diameterMm,
    sizeLabel: item.sizeLabel,
  };
  const { widthMm, heightMm } = getDisplayDimensions(product);
  const pxPerMm = 4;
  const widthPx = Math.max(44, Math.round(widthMm * pxPerMm));
  const heightPx = Math.max(44, Math.round(heightMm * pxPerMm));
  const svg = buildPreviewSvgFromLayers(product, item.textSnapshot || [], widthPx, heightPx);
  return `<div class="preview-box">${svg}</div>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function formatRm(value) {
  return `RM ${Number(value).toFixed(2)}`;
}

function getMmToPx() {
  return MM_TO_PX * state.calibrationFactor;
}

function getCalibrationTargetMm(product) {
  const { widthMm, heightMm } = getDisplayDimensions(product);
  return Math.max(widthMm, heightMm);
}

function getDisplaySizeLabel(product) {
  if (product.shape === "circle") {
    return `${formatMeasure(product.diameterMm * 2)} mm`;
  }
  return product.sizeLabel;
}

function renderCalibrationInfo() {
  const product = getSelectedProduct();
  if (!product) {
    elements.calibrationExpected.textContent = "-";
    elements.calibrationStatus.textContent = "Select a stamp to calibrate the screen size.";
    return;
  }

  const expectedMm = getCalibrationTargetMm(product);
  elements.calibrationExpected.textContent = `${expectedMm.toFixed(1)} mm`;
  const percent = Math.round(state.calibrationFactor * 100);
  elements.calibrationStatus.textContent = `Current calibration: ${percent}% of default browser size. Measure the long side of ${product.model} and apply your ruler value if needed.`;
}

function applyCalibration() {
  const product = getSelectedProduct();
  const measuredMm = Number(elements.calibrationMeasuredInput.value);
  if (!product || !Number.isFinite(measuredMm) || measuredMm <= 0) {
    elements.calibrationStatus.textContent = "Enter a valid ruler measurement in mm before applying calibration.";
    return;
  }

  const expectedMm = getCalibrationTargetMm(product);
  state.calibrationFactor = expectedMm / measuredMm;
  persistCalibrationFactor();
  renderPreview();
  renderSpecCard();
  elements.calibrationStatus.textContent = `Calibration applied. ${expectedMm.toFixed(1)} mm expected / ${measuredMm.toFixed(1)} mm measured = ${Math.round(state.calibrationFactor * 100)}% correction.`;
}

function resetCalibration() {
  state.calibrationFactor = 1;
  persistCalibrationFactor();
  elements.calibrationMeasuredInput.value = "";
  renderPreview();
  renderSpecCard();
  elements.calibrationStatus.textContent = "Calibration reset to the browser default size estimate.";
}

function persistCalibrationFactor() {
  window.localStorage.setItem(CALIBRATION_STORAGE_KEY, String(state.calibrationFactor));
}

function readCalibrationFactor() {
  const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getDisplayDimensions(product) {
  if (product.shape === "circle") {
    return {
      widthMm: product.diameterMm * 2,
      heightMm: product.diameterMm * 2,
    };
  }

  return {
    widthMm: Math.max(product.widthMm, product.heightMm),
    heightMm: Math.min(product.widthMm, product.heightMm),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMeasure(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

init().catch((error) => {
  console.error(error);
  elements.productList.innerHTML = `
    <div class="empty-state">
      <h3>Data load failed</h3>
      <p>${escapeHtml(error.message)}</p>
    </div>
  `;
});
