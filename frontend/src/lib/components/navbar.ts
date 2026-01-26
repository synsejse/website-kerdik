/**
 * Mobile navbar toggle utilities
 */

/**
 * Initialize mobile menu toggle for a navbar
 */
export function initNavbar(
  menuToggleSelector: string,
  navMenuId: string,
): void {
  const menuToggle = document.querySelector(menuToggleSelector);
  const navMenu = document.getElementById(navMenuId);

  if (!menuToggle || !navMenu) {
    console.warn(
      `Navbar elements not found: toggle=${menuToggleSelector}, menu=${navMenuId}`,
    );
    return;
  }

  // Use local constants to avoid TypeScript null checks inside functions
  const toggle = menuToggle;
  const menu = navMenu;

  function setMenu(open: boolean): void {
    toggle.setAttribute("aria-expanded", String(open));
    if (open) {
      menu.classList.add("active");
      menu.setAttribute("aria-hidden", "false");
    } else {
      menu.classList.remove("active");
      menu.setAttribute("aria-hidden", "true");
    }
  }

  function isOpen(): boolean {
    return toggle.getAttribute("aria-expanded") === "true";
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(!isOpen());
  });

  // Close menu when clicking a link
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    const target = e.target as Node;
    if (!menu.contains(target) && !toggle.contains(target)) {
      setMenu(false);
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setMenu(false);
    }
  });

  // Close on resize to desktop/tablet breakpoint
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      setMenu(false);
    }
  });
}
