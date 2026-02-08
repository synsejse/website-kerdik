import * as L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png?url";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png?url";
import markerShadow from "leaflet/dist/images/marker-shadow.png?url";

// Fix default icon paths for Vite/Astro
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/**
 * Initialize contact map with company location
 */
export function initContactMap(): void {
    const mapContainer = document.getElementById("contact-map");
    
    if (!mapContainer) return;

    // Company location: Papiernická 1788/8, 034 01 Ružomberok
    const latitude = 49.0742;
    const longitude = 19.3056;

    // Create map
    const map = L.map(mapContainer).setView([latitude, longitude], 15);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    // Add marker for company location
    const marker = L.marker([latitude, longitude]).addTo(map);

    // Add popup with company information
    marker.bindPopup(`
        <div style="text-align: center;">
            <strong style="font-size: 14px;">MK-SBD s.r.o.</strong><br>
            <span style="font-size: 12px; color: #666;">Papiernická 1788/8<br>034 01 Ružomberok</span>
        </div>
    `).openPopup();

    // Force map to recalculate size after a short delay
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}
