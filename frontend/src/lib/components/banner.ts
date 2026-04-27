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

function toneLabel(tone: string): string {
    switch (tone) {
        case "warning":
            return "Varovanie";
        case "info":
            return "Informácia";
        case "critical":
        default:
            return "Kritické upozornenie";
    }
}

export async function initBanner(): Promise<void> {
    const container = document.getElementById("site-banner");
    if (!container) return;

    try {
        const banner = await api.banner.getBanner();
        if (!banner || !banner.is_active) {
            return;
        }

        container.className = classesForTone(banner.tone);
        container.innerHTML = `
      <div class="max-w-275 mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div class="min-w-0 flex-1">
          <p class="m-0 text-xs font-black uppercase tracking-[0.18em] text-white/80">${toneLabel(banner.tone)}</p>
          <p class="m-0 mt-1 text-sm md:text-base font-black break-words">${banner.title}</p>
          <p class="m-0 mt-1 text-sm text-white/90 break-words">${banner.message}</p>
        </div>
        ${
            banner.link_label && banner.link_url
                ? `
          <a href="${banner.link_url}" class="self-start md:self-center inline-flex items-center justify-center px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black uppercase tracking-widest text-white border border-white/20 transition-colors no-underline whitespace-nowrap">
            ${banner.link_label}
          </a>
        `
                : ""
        }
      </div>
    `;
        container.classList.remove("hidden");
    } catch (error) {
        console.error("Failed to load banner:", error);
    }
}
