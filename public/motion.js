// «Animasiyaları azalt» açıq olsa da işləyir: CSS orada yalnız yumşaq solma göstərir, yerdəyişmə yoxdur
if ("IntersectionObserver" in window) {
  const SEL = ".section .sec-head, .section .card, .section .stat-card, .section .threat, .section .lesson, .section .source, .section .priv, .section .faq details, .section .flow li, .section .feat-list li, .section .about-facts > div, .section .dom-points li, .section .priv-links, .section .page-head, .section .bars > div, .page .page-head, .page .prose > *, .page .game, .page .board";
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("rv-in"); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  const hiddenIn = (el) => !!el.closest("[hidden]");
  const excluded = (el) => !!el.closest("#netice, .hero") || hiddenIn(el);
  const below = (el) => el.getBoundingClientRect().top >= window.innerHeight;
  const apply = (el, i) => {
    el.classList.add("rv");
    el.style.setProperty("--rv-delay", (i % 6) * 70 + "ms");
    io.observe(el);
  };

  const root = document.querySelector("main") || document;
  const chosen = [];
  root.querySelectorAll(SEL).forEach((el) => {
    if (excluded(el)) return;
    if (chosen.some((c) => c.contains(el))) return;
    chosen.push(el);
  });
  const finalSet = chosen.filter((el) => !chosen.some((c) => c !== el && c.contains(el)));
  const counters = new Map();
  for (const el of finalSet) {
    if (!below(el)) continue;
    const p = el.parentElement;
    const i = counters.get(p) || 0;
    counters.set(p, i + 1);
    apply(el, i);
  }

  for (const id of ["thList", "acadGrid"]) {
    const box = document.getElementById(id);
    if (!box) continue;
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1 || n.classList.contains("rv")) continue;
          if (!below(n)) continue;
          apply(n, Array.prototype.indexOf.call(box.children, n));
        }
      }
    }).observe(box, { childList: true });
  }

  const revealVisible = () => {
    const limit = window.innerHeight * 0.95;
    document.querySelectorAll(".rv:not(.rv-in)").forEach((el) => {
      if (el.getBoundingClientRect().top < limit) { el.classList.add("rv-in"); io.unobserve(el); }
    });
  };
  let timer = 0;
  window.addEventListener("scroll", () => { clearTimeout(timer); timer = setTimeout(revealVisible, 120); }, { passive: true });
  window.addEventListener("beforeprint", () => document.querySelectorAll(".rv:not(.rv-in)").forEach((el) => el.classList.add("rv-in")));
}
