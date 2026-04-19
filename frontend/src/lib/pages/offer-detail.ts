import { api } from "../api";
import { markdownToHtml } from "../../utils/markdown";
import * as L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png?url";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png?url";
import markerShadow from "leaflet/dist/images/marker-shadow.png?url";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function getOfferSlug(): string | null {
  const match = window.location.pathname.match(/^\/offer\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function renderMap(latitude: number, longitude: number): void {
  const mapContainer = document.getElementById("offer-detail-map");
  if (!mapContainer) return;

  const map = L.map(mapContainer).setView([latitude, longitude], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);
  L.marker([latitude, longitude]).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

export async function initOfferDetailPage(): Promise<void> {
  const loading = document.getElementById("offer-loading");
  const error = document.getElementById("offer-error");
  const content = document.getElementById("offer-content");
  const slug = getOfferSlug();

  if (!slug || !content) {
    error?.classList.remove("hidden");
    loading?.classList.add("hidden");
    return;
  }

  try {
    const offer = await api.offers.getOfferBySlug(slug);
    document.title = `${offer.title} | MK-SBD`;
    const detailBody = offer.content || offer.excerpt || "";

    content.innerHTML = `
      <div class="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] items-start">
        <article class="min-w-0">
          <nav class="mb-6 text-sm text-gray-500">
            <a href="/offer" class="hover:text-primary transition-colors no-underline">Ponuka</a>
            <span class="mx-2">/</span>
            <span>${offer.title}</span>
          </nav>

          <header class="mb-8">
            <p class="m-0 mb-3 text-xs font-black uppercase tracking-[0.15em] text-primary">Detail ponuky</p>
            <h1 class="m-0 text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-gray-900 leading-tight">${offer.title}</h1>
          </header>

          ${offer.image_mime ? `
            <div class="mb-8 overflow-hidden rounded-2xl border border-gray-200 shadow-sm bg-white">
              <img src="${api.offers.getOfferImageUrl(offer.id)}" alt="${offer.title}" class="w-full h-auto max-h-[32rem] object-cover" />
            </div>
          ` : ""}

          ${offer.excerpt ? `
            <div class="mb-8 p-6 bg-blue-50 border-l-4 border-primary rounded-r-lg">
              <div class="text-lg text-gray-700 italic m-0 prose max-w-none">
                ${markdownToHtml(offer.excerpt)}
              </div>
            </div>
          ` : ""}

          <div class="prose prose-lg max-w-none text-gray-700">
            ${detailBody ? markdownToHtml(detailBody) : "<p>Detail ponuky bude doplnený čoskoro.</p>"}
          </div>
        </article>

        <aside class="grid gap-6 lg:sticky lg:top-28">
          <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 class="m-0 mb-4 text-xl font-bold text-gray-900">Rýchle akcie</h2>
            <div class="flex flex-col gap-3">
              <a href="/contact" class="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary text-white no-underline font-bold hover:bg-[#0353e9] transition-colors">Kontaktovať nás</a>
              ${offer.link ? `<a href="${offer.link}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-primary/20 text-primary no-underline font-bold hover:bg-primary/5 transition-colors">Externý odkaz</a>` : ""}
              <a href="/offer" class="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-gray-200 text-gray-700 no-underline font-bold hover:border-primary/20 hover:text-primary transition-colors">Späť na ponuku</a>
            </div>
          </section>

          ${offer.latitude != null && offer.longitude != null ? `
            <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 class="m-0 mb-4 text-xl font-bold text-gray-900">Poloha objektu</h2>
              <div id="offer-detail-map" class="h-72 rounded-xl overflow-hidden border border-gray-200"></div>
            </section>
          ` : ""}
        </aside>
      </div>
    `;

    content.classList.remove("hidden");

    if (offer.latitude != null && offer.longitude != null) {
      renderMap(offer.latitude, offer.longitude);
    }
  } catch (err) {
    console.error("Error loading offer detail:", err);
    error?.classList.remove("hidden");
  } finally {
    loading?.classList.add("hidden");
  }
}
