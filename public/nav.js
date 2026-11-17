// Menyu: telefonda açılan panel və ana səhifədə aktiv bölmənin işarələnməsi.
const toggle = document.getElementById("navToggle");
const nav = document.getElementById("mainNav");

if (toggle && nav) {
  const use = toggle.querySelector("use");
  const set = (open) => {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Menyunu bağla" : "Menyunu aç");
    if (use) use.setAttribute("href", "/icons.svg#" + (open ? "x" : "menu"));
  };
  toggle.addEventListener("click", () => set(!nav.classList.contains("open")));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) { set(false); toggle.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("open") && !nav.contains(e.target) && !toggle.contains(e.target)) set(false);
  });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (m) => { if (m.matches) set(false); });
}

// Ana səhifədə menyu bəndi səhifədəki sıra ilə işarələnir: başlığın altından keçən sonuncu hədəf aktivdir.
// Menyu bəndləri səhifədəki sıra ilə düzülüb (Ana səhifə → Təhlil → Aktiv təhdidlər → Akademiya → Haqqımızda),
// ona görə aşağı endikcə işarə yalnız irəli gedir, geri qayıtmır.
const home = location.pathname === "/" || location.pathname.endsWith("/index.html");
if (home && nav) {
  const items = [...nav.querySelectorAll(':scope > a[href^="/#"]')] // telefondakı «Mesajı yoxla» düyməsi sayılmır
    .map((a) => ({ a, el: document.getElementById(a.getAttribute("href").slice(2)) }))
    .filter((x) => x.el);
  const header = document.querySelector(".site-header");
  let current = null;
  const update = () => {
    const line = (header ? header.offsetHeight : 64) + 24;
    let active = items[0];
    for (const x of items) if (x.el.getBoundingClientRect().top <= line) active = x;
    // səhifənin sonunda son bölmə qısa olsa da işarələnsin
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = items[items.length - 1];
    if (!active || active === current) return;
    current = active;
    items.forEach((x) => { if (x === active) x.a.setAttribute("aria-current", "true"); else x.a.removeAttribute("aria-current"); });
  };
  let raf = 0;
  window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  window.addEventListener("resize", update);
  window.addEventListener("load", update);
  update();
}
