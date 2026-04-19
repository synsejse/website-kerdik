import { api } from "../api";

function classesForTone(tone: string): string {
  switch (tone) {
    case "warning":
      return "bg-amber-500 text-white";
    case "info":
      return "bg-blue-600 text-white";
    case "critical":
    default:
      return "bg-red-600 text-white";
  }
}

export async function initEmergencyBanner(): Promise<void> {
  const container = document.getElementById("emergency-banner");
  if (!container) return;

  try {
    const banner = await api.offers.getEmergencyBanner();
    if (!banner || !banner.is_active) {
      return;
    }

    const dismissedKey = `emergency-banner-dismissed:${banner.id}`;
    if (window.sessionStorage.getItem(dismissedKey) === "1") {
      return;
    }

    container.className = classesForTone(banner.tone);
    container.innerHTML = `
      <div class="max-w-275 mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div class="min-w-0 flex-1">
          <p class="m-0 text-xs font-black uppercase tracking-[0.18em] text-white/80">Núdzový oznam</p>
          <p class="m-0 mt-1 text-sm md:text-base font-black break-words">${banner.title}</p>
          <p class="m-0 mt-1 text-sm text-white/90 break-words">${banner.message}</p>
          ${banner.link_label && banner.link_url ? `<a href="${banner.link_url}" class="inline-flex items-center mt-3 text-sm font-black text-white no-underline underline-offset-4 hover:underline">${banner.link_label}</a>` : ""}
        </div>
        <button type="button" id="emergency-banner-close" class="self-start md:self-center px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black uppercase tracking-widest text-white border border-white/20 transition-colors">
          Zavrieť
        </button>
      </div>
    `;
    container.classList.remove("hidden");

    const closeBtn = document.getElementById("emergency-banner-close") as HTMLButtonElement | null;
    closeBtn?.addEventListener("click", () => {
      window.sessionStorage.setItem(dismissedKey, "1");
      container.remove();
    });
  } catch (error) {
    console.error("Failed to load emergency banner:", error);
  }
}
