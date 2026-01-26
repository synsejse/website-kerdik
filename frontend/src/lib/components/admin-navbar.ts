/**
 * Admin Navbar utilities with mobile menu and auth features
 */

/**
 * Initialize admin navbar with mobile menu and logout functionality
 */
export function initAdminNavbar(): void {
  const menuToggle = document.querySelector(".mobile-menu-toggle");
  const navMenu = document.getElementById("admin-primary-navigation");

  if (!menuToggle || !navMenu) {
    console.warn("Admin navbar elements not found");
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

  // Close menu when clicking a link or button
  menu.querySelectorAll("a, button").forEach((link) => {
    link.addEventListener("click", () => setMenu(false));
  });

  // Admin auth check
  (async function () {
    const logoutBtnMobile = document.getElementById("admin-logout-btn-mobile");
    if (!logoutBtnMobile) return;

    try {
      const resp = await fetch("/admin/check", { credentials: "same-origin" });
      if (resp.ok) {
        const isAuth = await resp.json();
        if (!isAuth) {
          logoutBtnMobile.classList.add("hidden");
        }
      }
    } catch (e) {
      logoutBtnMobile.classList.add("hidden");
    }

    logoutBtnMobile.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await fetch("/admin/logout", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch (err) {
        // ignore
      } finally {
        window.location.href = "/admin/login";
      }
    });
  })();

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
