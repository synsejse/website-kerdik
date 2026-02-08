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
    article.className = "bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1 flex flex-col";

    // Figure with image
    const figure = document.createElement("figure");
    figure.className = "m-0";

    const img = document.createElement("img");
    img.className = "w-full h-48 object-cover";
    img.src = `/api/offers/${encodeURIComponent(offer.id)}/image`;
    img.alt = offer.title || "Ponuka";
    img.loading = "lazy";

    img.onerror = function () {
      // If image fails, remove the figure entirely
      figure.remove();
    };

    figure.appendChild(img);
    article.appendChild(figure);

    // Content
    const content = document.createElement("div");
    content.className = "p-6 flex flex-col flex-1";

    const h3 = document.createElement("h3");
    h3.className = "m-0 mb-3 text-xl font-bold text-gray-900 leading-tight hover:text-primary transition-colors cursor-pointer";
    h3.textContent = offer.title || "";

    // Description with expandable functionality
    const descContainer = document.createElement("div");
    descContainer.className = "mb-4";
    
    const descId = `desc-${offer.id}`;
    const p = document.createElement("p");
    p.id = descId;
    p.className = "m-0 text-sm text-gray-600 leading-relaxed line-clamp-3 transition-all duration-300";
    p.textContent = offer.description || "";

    // Check if description is long enough to need expansion
    const needsExpansion = (offer.description || "").length > 150;

    if (needsExpansion) {
      const expandBtn = document.createElement("button");
      expandBtn.className = "text-sm font-medium text-primary hover:text-blue-600 transition-colors mt-2";
      expandBtn.textContent = "Zobraziť viac";
      expandBtn.type = "button";
      
      expandBtn.addEventListener("click", () => {
        const isExpanded = !p.classList.contains("line-clamp-3");
        if (isExpanded) {
          p.classList.add("line-clamp-3");
          expandBtn.textContent = "Zobraziť viac";
        } else {
          p.classList.remove("line-clamp-3");
          expandBtn.textContent = "Zobraziť menej";
        }
      });

      descContainer.appendChild(p);
      descContainer.appendChild(expandBtn);
    } else {
      descContainer.appendChild(p);
    }

    // Footer with link
    const footer = document.createElement("div");
    footer.className = "mt-auto pt-4";

    const a = document.createElement("a");
    a.className = "inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-blue-600 transition-colors no-underline";
    if (offer && typeof offer.link === "string" && offer.link.trim() !== "") {
      a.href = offer.link;
    } else {
      a.href = "#";
      a.addEventListener("click", (e) => e.preventDefault());
    }
    
    a.innerHTML = `
      Viac informácií
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
    `;

    footer.appendChild(a);

    content.appendChild(h3);
    content.appendChild(descContainer);
    content.appendChild(footer);

    article.appendChild(content);
    return article;
  }

  function showEmptyState() {
    if (container) {
      container.innerHTML = '<div class="col-span-full text-center py-12"><p class="text-gray-600">Žiadne ponuky na zobrazenie.</p></div>';
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
