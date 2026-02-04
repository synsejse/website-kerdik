import { api, type OfferSummary } from "../../lib/api";
import * as L from "leaflet";

let map: L.Map | null = null;
let markers: L.Marker[] = [];

/**
 * Initialize Leaflet map with offer locations
 */
function initMap(offers: OfferSummary[]) {
  const mapContainer = document.getElementById("map-container");
  const mapLoading = document.getElementById("map-loading");
  const mapError = document.getElementById("map-error");

  // Filter offers with valid coordinates
  const offersWithCoords = offers.filter(
    (offer) => offer.latitude != null && offer.longitude != null
  );

  if (offersWithCoords.length === 0) {
    if (mapLoading) mapLoading.classList.add("hidden");
    if (mapError) {
      mapError.textContent = "Žiadne objekty s GPS súradnicami.";
      mapError.classList.remove("hidden");
    }
    return;
  }

  if (!mapContainer) return;

  try {
    // Calculate center (average of all coordinates)
    const avgLat = offersWithCoords.reduce((sum, o) => sum + (o.latitude || 0), 0) / offersWithCoords.length;
    const avgLng = offersWithCoords.reduce((sum, o) => sum + (o.longitude || 0), 0) / offersWithCoords.length;

    // Show container first
    if (mapLoading) mapLoading.classList.add("hidden");
    mapContainer.classList.remove("hidden");

    // Small delay to ensure container is rendered
    setTimeout(() => {
      // Create map centered on average coordinates
      map = L.map(mapContainer).setView([avgLat, avgLng], 13);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add markers for each offer
      offersWithCoords.forEach((offer) => {
        if (offer.latitude == null || offer.longitude == null || !map) return;

        const marker = L.marker([offer.latitude, offer.longitude]).addTo(map);

        // Create popup content
        const popupContent = `
          <div style="max-width: 200px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${offer.title || "Objekt"}</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">${offer.description || ""}</p>
            ${offer.link ? `<a href="${offer.link}" style="display: inline-block; margin-top: 8px; color: #0f62fe; font-size: 12px; font-weight: 600;">Zistiť viac →</a>` : ""}
          </div>
        `;

        marker.bindPopup(popupContent);
        markers.push(marker);
      });

      // Force map to recalculate size
      map.invalidateSize();
    }, 100);
  } catch (error) {
    console.error("Error initializing map:", error);
    if (mapLoading) mapLoading.classList.add("hidden");
    if (mapError) {
      mapError.textContent = "Chyba pri načítaní mapy.";
      mapError.classList.remove("hidden");
    }
  }
}

/**
 * Initialize offer section and load offers from API
 */
export function initOfferSection(): void {
  const container = document.getElementById("offers-list");

  function createOfferElement(offer: OfferSummary) {
    const article = document.createElement("article");
    article.setAttribute("role", "article");
    article.className = "border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col group transition-all duration-300 hover:shadow-md hover:border-primary/30";

    // Figure with image
    const figure = document.createElement("figure");
    figure.className = "m-0 h-40 lg:h-44 overflow-hidden bg-gray-100 italic border-b border-gray-100";

    const img = document.createElement("img");
    img.className = "w-full h-full object-cover transition-transform duration-500 group-hover:scale-110";
    // Use public image endpoint provided by backend
    img.src = `/api/offers/${encodeURIComponent(offer.id)}/image`;
    img.alt = offer.title || "Ponuka";
    img.loading = "lazy";

    img.onerror = function () {
      img.remove();
    };

    figure.appendChild(img);
    article.appendChild(figure);

    // Content
    const content = document.createElement("div");
    content.className = "p-4 lg:p-5 flex-1 flex flex-col gap-2.5";

    const h3 = document.createElement("h3");
    h3.className = "m-0 text-[1.05rem] font-bold leading-tight group-hover:text-primary transition-colors";
    h3.textContent = offer.title || "";

    // Slug displayed under the title
    const slugEl = document.createElement("p");
    slugEl.className = "m-0 text-xs text-gray-400 font-mono";
    slugEl.textContent = "/" + (offer.slug || "");

    const p = document.createElement("p");
    p.className = "m-0 text-[#374151] text-sm leading-relaxed";
    p.textContent = offer.description || "";

    const a = document.createElement("a");
    a.className = "mt-auto self-start inline-flex items-center px-4 py-2 bg-primary text-white no-underline rounded-lg text-sm font-semibold transition-colors hover:bg-[#0353e9]";
    if (offer && typeof offer.link === "string" && offer.link.trim() !== "") {
      a.href = offer.link;
    } else {
      a.href = "#";
    }
    a.textContent = "Zistiť viac";

    content.appendChild(h3);
    content.appendChild(slugEl);
    content.appendChild(p);
    content.appendChild(a);

    article.appendChild(content);
    return article;
  }

  function showEmptyState() {
    if (container) {
      container.innerHTML = '<div class="col-span-full text-center text-gray-500">Žiadne ponuky na zobrazenie.</div>';
    }
  }

  async function loadOffers() {
    try {
      const offers = await api.offers.getOffers();

      if (container) container.innerHTML = "";

      if (!Array.isArray(offers) || offers.length === 0) {
        showEmptyState();
        return;
      }

      offers.forEach((offer) => {
        if (!offer || typeof offer.id === "undefined") return;
        const el = createOfferElement(offer);
        if (container) container.appendChild(el);
      });

      // Initialize map after loading offers
      initMap(offers);
    } catch (err) {
      console.error("Error loading offers:", err);
      showEmptyState();
    }
  }

  // Run immediately
  if (container) {
    loadOffers();
  }
}
