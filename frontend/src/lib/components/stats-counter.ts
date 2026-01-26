/**
 * Initialize animated counters for stats section
 * Uses IntersectionObserver to start animation when section becomes visible
 */
export function initStatsCounter() {
  const run = () => {
    const section = document.querySelector(".stats-section");
    if (!section) return;

    const values = Array.from(
      section.querySelectorAll(".value"),
    ) as HTMLElement[];
    let started = false;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (el: HTMLElement, target: number) => {
      const duration = 3000; // exactly 3 seconds
      const start = performance.now();
      // Ensure we always start from 0 in UI
      el.textContent = (0).toLocaleString("sk-SK");

      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(p);
        const val = Math.round(eased * target);
        el.textContent = val.toLocaleString("sk-SK");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const startAll = () => {
      if (started) return;
      started = true;
      values.forEach((el) => {
        const target = parseInt(
          el.getAttribute("data-target") || "0",
          10,
        );
        animate(el, target);
      });
    };

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              startAll();
              io.disconnect();
            }
          });
        },
        { threshold: 0.25 },
      );
      io.observe(section);
    } else {
      // Fallback: start immediately with animation (no IO support)
      startAll();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, {
      once: true,
    });
  } else {
    run();
  }
}
