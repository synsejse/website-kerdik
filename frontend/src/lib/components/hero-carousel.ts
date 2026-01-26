// Hero Carousel component TypeScript utilities

export interface Slide {
  image: string;
  title: string;
  description: string;
}

export interface CarouselOptions {
  interval?: number;
  prefersReduced?: boolean;
  isPaused?: boolean;
}

/**
 * Initialize the hero carousel with progressive enhancement
 */
export function initHeroCarousel() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const ready = (fn: () => void) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, {
        once: true,
      });
    } else {
      fn();
    }
  };

  ready(() => {
    const root = document.querySelector(".hero-carousel");
    if (!root) return;

    const wrapper = root.querySelector(".slides-wrapper");
    const slides = wrapper
      ? Array.from(wrapper.querySelectorAll(".slide"))
      : [];
    const btnPrev = root.querySelector(".carousel-btn.prev");
    const btnNext = root.querySelector(".carousel-btn.next");
    const dots = Array.from(root.querySelectorAll(".dot"));
    const bar = root.querySelector(
      ".carousel-progress-bar",
    ) as HTMLElement | null;
    const container = root.querySelector(".carousel-container") || root;

    if (!slides.length) return;

    let index = 0;
    let timer: number | null = null;
    const interval = 5000; // 5s per slide
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let isPaused = false;

    const setActive = (i: number) => {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, si) => {
        if (si === index) {
          s.classList.add("active", "opacity-100");
          s.classList.remove("opacity-0");
          s.removeAttribute("aria-hidden");
        } else {
          s.classList.remove("active", "opacity-100");
          s.classList.add("opacity-0");
          s.setAttribute("aria-hidden", "true");
        }
      });
      dots.forEach((d, di) => {
        const isActive = di === index;
        d.setAttribute("aria-current", isActive ? "true" : "false");
        if (isActive) {
          d.classList.add("bg-white");
          d.classList.remove("bg-white/65");
        } else {
          d.classList.remove("bg-white");
          d.classList.add("bg-white/65");
        }
      });
      if (bar) {
        // Reset progress bar instantly then allow it to grow again
        bar.style.transition = "none";
        bar.style.width = "0%";
        bar.setAttribute("aria-valuenow", "0");
        // Force reflow to apply the reset width before animating
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        void bar.offsetWidth;
        bar.style.transition = prefersReduced
          ? "none"
          : `width ${interval}ms linear`;
        if (!isPaused && !prefersReduced) {
          requestAnimationFrame(() => {
            bar.style.width = "100%";
            bar.setAttribute("aria-valuenow", "100");
          });
        }
      }
    };

    const next = () => setActive(index + 1);
    const prev = () => setActive(index - 1);

    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      if (prefersReduced || isPaused) return;
      clear();
      timer = window.setTimeout(() => {
        next();
        schedule();
      }, interval);
    };

    // Event bindings
    btnNext?.addEventListener("click", () => {
      next();
      schedule();
    });
    btnPrev?.addEventListener("click", () => {
      prev();
      schedule();
    });
    dots.forEach((d, di) =>
      d.addEventListener("click", () => {
        setActive(di);
        schedule();
      }),
    );

    const pause = () => {
      isPaused = true;
      clear();
      if (bar) {
        // Keep current width, stop transition
        const computed = getComputedStyle(bar);
        const widthPx = parseFloat(computed.width);
        const parentWidth = bar.parentElement
          ? bar.parentElement.clientWidth
          : 1;
        const pct = Math.max(
          0,
          Math.min(100, (widthPx / parentWidth) * 100),
        );
        bar.style.transition = "none";
        bar.style.width = pct + "%";
      }
    };
    const resume = () => {
      isPaused = false;
      if (!prefersReduced) {
        // resume bar animation to end within remaining time – simplify by restarting cycle
        setActive(index);
        schedule();
      }
    };

    container.addEventListener("mouseenter", pause);
    container.addEventListener("mouseleave", resume);
    container.addEventListener("focusin", pause);
    container.addEventListener("focusout", resume);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pause();
      else resume();
    });

    // Initialize
    // Mark roles for accessibility
    wrapper?.setAttribute("role", "list");
    slides.forEach((s) => s.setAttribute("role", "listitem"));
    setActive(0);
    schedule();
  });
}
