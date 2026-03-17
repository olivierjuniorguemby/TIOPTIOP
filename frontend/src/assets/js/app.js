(function () {
  const fmtXAF = (v) => new Intl.NumberFormat('fr-FR').format(v) + " XAF";
  const IMG_BASE = "assets/img/"; // adapte: "assets/img/menus/"


  window.TT = {
    fmtXAF,
    toast(message, icon="bi-check-circle") {
      const el = document.getElementById("ttToast");
      if (!el) return alert(message);
      el.querySelector(".toast-body").innerHTML = `<i class="bi ${icon} me-2"></i>${message}`;
      const t = new bootstrap.Toast(el, { delay: 2200 });
      t.show();
    },
    setActiveNav() {
      const path = location.pathname.split("/").pop() || "index.html";
      document.querySelectorAll("[data-tt-nav]").forEach(a => {
        a.classList.toggle("active", a.getAttribute("data-tt-nav") === path);
      });
    },
    renderCategories(targetId="ttCategories") {
      const el = document.getElementById(targetId);
      if (!el) return;
      el.innerHTML = TT_MOCK.categories.map(c => `
        <a class="tt-pill d-inline-flex align-items-center gap-2" href="menu.html#cat=${c.id}">
          <i class="bi ${c.icon}"></i> <span>${c.name}</span>
        </a>
      `).join("");
    },
    renderMenuList(targetId="ttMenuList", filter={}) {

      const el = document.getElementById(targetId);
      if (!el) return;
      let items = [...TT_MOCK.menus];

      if (filter.q) {
        const q = filter.q.toLowerCase();
        items = items.filter(m => m.name.toLowerCase().includes(q));
      }
      if (filter.cat) items = items.filter(m => m.category === filter.cat);
      if (filter.maxPrice) items = items.filter(m => m.price <= filter.maxPrice);

      el.innerHTML = items.map(m => {
        
          const firstImage = (m.images && m.images.length) ? m.images[0] : "default.png";
    const imgSrc = IMG_BASE + firstImage;

    return `
        <div class="tt-card p-3 mb-3">
          <div class="tt-menu-item">
            <div class="tt-thumb">
            <img src="${imgSrc}" alt="${m.images}" loading="lazy"
             onerror="this.src='${IMG_BASE}default.png'">            </div>
            <div>
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <div class="fw-black" style="font-weight:900">${m.name}</div>
                  <div class="small text-muted">
                    <span class="tt-badge me-2">${TT_MOCK.categories.find(c=>c.id===m.category)?.name || "Menu"}</span>
                    <i class="bi bi-star-fill me-1" style="color: var(--brand)"></i>${m.rating}
                  </div>
                </div>
                <div class="tt-price">${fmtXAF(m.price)}</div>
              </div>
              <div class="mt-2 d-flex gap-2 flex-wrap">
                <a class="btn btn-sm btn-tt tt-btn" href="menu-detail.html?id=${m.id}">
                  Voir détails
                </a>
                <button class="btn btn-sm btn-tt-outline tt-btn" data-add="${m.id}">
                  <i class="bi bi-bag-plus me-1"></i> Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      `}).join("");

      el.querySelectorAll("[data-add]").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-add");
          const cart = TT.cartGet();
          cart.items.push({ id, qty: 1, extras: [] });
          TT.cartSet(cart);
          TT.toast("Ajouté au panier", "bi-bag-check");
          TT.updateCartBadge();
        });
      });
    },
    cartGet() {
      try { return JSON.parse(localStorage.getItem("tt_cart") || '{"items":[]}'); }
      catch { return { items: [] }; }
    },
    cartSet(v) {
      localStorage.setItem("tt_cart", JSON.stringify(v));
    },
    updateCartBadge() {
      const cart = TT.cartGet();
      const count = cart.items.reduce((a,b)=>a+(b.qty||1),0);
      document.querySelectorAll("[data-tt-cart-count]").forEach(el => el.textContent = count);
    },
    renderAds(targetId="ttAds") {
      const el = document.getElementById(targetId);
      if (!el) return;
      el.innerHTML = TT_MOCK.ads.map(a => `
        <div class="tt-card p-3 mb-2">
          <div class="d-flex gap-3">
            <div class="tt-thumb" style="width:56px;height:56px;border-radius:16px">
              <i class="bi ${a.icon}"></i>
            </div>
            <div>
              <div class="fw-bold">${a.title}</div>
              <div class="small text-muted">${a.body}</div>
            </div>
          </div>
        </div>
      `).join("");
    },
    bindSearch() {
      const input = document.getElementById("ttSearch");
      if (!input) return;
      input.addEventListener("input", () => {
        TT.renderMenuList("ttMenuList", { q: input.value });
      });
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    TT.setActiveNav();
    TT.renderCategories();
    TT.renderAds();
    TT.bindSearch();
    TT.updateCartBadge();
  });
})();
