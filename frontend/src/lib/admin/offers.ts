import { api, type OfferSummary } from "../../lib/api";
import { escapeHtml, showConfirmDialog } from "./utils";

// Leaflet type declarations
declare global {
  interface Window {
    editOffer?: (id: number) => void;
    deleteOffer?: (id: number) => Promise<void>;
    L?: any; // Leaflet library
  }
}

export interface OffersPageElements {
  container: HTMLElement | null;
  loading: HTMLElement | null;
  noOffers: HTMLElement | null;
  form: HTMLFormElement | null;
  modal: HTMLElement | null;
  refreshBtn: HTMLElement | null;
  addOfferBtn: HTMLElement | null;
  modalClose: HTMLElement | null;
  modalCancel: HTMLElement | null;
  offerId: HTMLInputElement | null;
  offerTitle: HTMLInputElement | null;
  offerSlug: HTMLInputElement | null;
  offerDesc: HTMLTextAreaElement | null;
  offerLink: HTMLInputElement | null;
  offerLatitude: HTMLInputElement | null;
  offerLongitude: HTMLInputElement | null;
  offerImage: HTMLInputElement | null;
  imagePreview: HTMLElement | null;
  imagePreviewImg: HTMLImageElement | null;
  mapPicker: HTMLElement | null;
}

export interface OfferFormData {
  id?: string;
  title: string;
  slug: string;
  description: string;
  link: string;
  latitude?: string;
  longitude?: string;
  imageFile?: File;
}

export class OffersPageController {
  private elements: OffersPageElements;
  private offersData: OfferSummary[] = [];
  private map: any = null;
  private marker: any = null;

  constructor(elements: OffersPageElements) {
    this.elements = elements;
    this.initialize();
  }

  private initialize(): void {
    this.setupEventListeners();
    this.loadOffers();
  }

  private setupEventListeners(): void {
    const {
      form,
      refreshBtn,
      addOfferBtn,
      modalClose,
      modalCancel,
      offerImage,
      offerLatitude,
      offerLongitude,
    } = this.elements;

    form?.addEventListener("submit", (e) => this.handleFormSubmit(e));
    refreshBtn?.addEventListener("click", () => this.loadOffers());
    addOfferBtn?.addEventListener("click", () => this.openModal());
    modalClose?.addEventListener("click", () => this.closeModal());
    modalCancel?.addEventListener("click", () => this.closeModal());
    offerImage?.addEventListener("change", () => this.handleImageChange());

    // Sync input fields with map
    offerLatitude?.addEventListener("input", () => this.updateMapFromInputs());
    offerLongitude?.addEventListener("input", () => this.updateMapFromInputs());

    this.setupWindowFunctions();
  }

  private setupWindowFunctions(): void {
    window.editOffer = (id: number) => {
      this.editOffer(id);
    };

    window.deleteOffer = async (id: number) => {
      showConfirmDialog("Zmazať?", async () => {
        try {
          await api.admin.deleteOffer(id);
          await this.loadOffers();
        } catch (error) {
          console.error("Failed to delete offer:", error);
          alert("Chyba pri mazaní.");
        }
      });
    };
  }

  async loadOffers(): Promise<void> {
    const { container, loading, noOffers } = this.elements;

    if (loading) loading.classList.remove("hidden");
    if (container) container.innerHTML = "";

    try {
      this.offersData = await api.offers.getOffers();

      if (this.offersData.length === 0) {
        noOffers?.classList.remove("hidden");
      } else {
        noOffers?.classList.add("hidden");
        this.renderOffers();
      }
    } catch (error) {
      console.error("Failed to load offers:", error);
      alert("Chyba pri načítaní.");
    } finally {
      if (loading) loading.classList.add("hidden");
    }
  }

  private renderOffers(): void {
    if (!this.elements.container) return;

    const html = this.offersData
      .map((offer) => this.createOfferCard(offer))
      .join("");

    this.elements.container.innerHTML = html;
  }

  private createOfferCard(offer: OfferSummary): string {
    const imageUrl = api.offers.getOfferImageUrl(offer.id);
    const title = escapeHtml(offer.title);
    const slug = escapeHtml(offer.slug);
    const desc = escapeHtml(offer.description ?? "");

    return `
      <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1">
        ${offer.image_mime ? `<img src="${imageUrl}" alt="${title}" class="w-full h-48 object-cover rounded-lg mb-4">` : ''}
        <h3 class="m-0 text-lg font-bold text-gray-900 leading-tight mb-3 break-words">${title}</h3>
        <p class="text-sm text-gray-500 mb-4"><strong>Slug:</strong> <code class="bg-gray-100 px-2 py-1 rounded text-xs break-all">${slug}</code></p>
        ${desc ? `<p class="text-sm text-gray-600 mb-4 line-clamp-3 break-words">${desc}</p>` : ''}
        <div class="flex gap-2">
          <button onclick="window.editOffer && window.editOffer(${offer.id})" class="flex-1 px-3 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Upraviť
          </button>
          <button onclick="window.deleteOffer && window.deleteOffer(${offer.id})" class="px-3 py-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  private handleFormSubmit(e: Event): void {
    e.preventDefault();

    const formData = this.getFormData();
    this.saveOffer(formData);
  }

  private getFormData(): OfferFormData {
    const { offerId, offerTitle, offerSlug, offerDesc, offerLink, offerLatitude, offerLongitude, offerImage } =
      this.elements;

    return {
      id: offerId?.value,
      title: offerTitle?.value || "",
      slug: offerSlug?.value || "",
      description: offerDesc?.value || "",
      link: offerLink?.value || "",
      latitude: offerLatitude?.value || "",
      longitude: offerLongitude?.value || "",
      imageFile: offerImage?.files?.[0],
    };
  }

  private async saveOffer(formData: OfferFormData): Promise<void> {
    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("slug", formData.slug);
      if (formData.description)
        data.append("description", formData.description);
      if (formData.link) data.append("link", formData.link);
      if (formData.latitude) data.append("latitude", formData.latitude);
      if (formData.longitude) data.append("longitude", formData.longitude);

      if (formData.id) {
        // If image is provided, update it. Otherwise, don't send the field and backend keeps existing image
        if (formData.imageFile) {
          data.append("image", formData.imageFile);
        }
        await api.admin.updateOffer(parseInt(formData.id, 10), data);
      } else {
        if (formData.imageFile) data.append("image", formData.imageFile);
        await api.admin.createOffer(data);
      }

      this.closeModal();
      await this.loadOffers();
    } catch (error) {
      console.error("Failed to save offer:", error);
      alert("Chyba pri ukladaní.");
    }
  }

  private editOffer(id: number): void {
    const offer = this.offersData.find((x) => x.id === id);
    if (!offer) return;

    const {
      offerId,
      offerTitle,
      offerSlug,
      offerDesc,
      offerLink,
      offerLatitude,
      offerLongitude,
      imagePreview,
      imagePreviewImg,
      modal,
    } = this.elements;

    if (offerId) offerId.value = String(offer.id);
    if (offerTitle) offerTitle.value = offer.title;
    if (offerSlug) offerSlug.value = offer.slug;
    if (offerDesc) offerDesc.value = offer.description || "";
    if (offerLink) offerLink.value = offer.link || "";
    if (offerLatitude) offerLatitude.value = offer.latitude ? String(offer.latitude) : "";
    if (offerLongitude) offerLongitude.value = offer.longitude ? String(offer.longitude) : "";
    if (imagePreview && imagePreviewImg) {
      imagePreview.classList.remove("hidden");
      imagePreviewImg.src = api.offers.getOfferImageUrl(offer.id);
    }
    if (modal) modal.classList.remove("hidden");
    
    // Initialize map after modal is visible
    setTimeout(() => this.initializeMap(), 100);
  }

  private handleImageChange(): void {
    const { offerImage, imagePreview, imagePreviewImg } = this.elements;
    const file = offerImage?.files?.[0];

    if (file && imagePreview && imagePreviewImg) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && imagePreviewImg) {
          imagePreviewImg.src = e.target.result as string;
          imagePreview.classList.remove("hidden");
        }
      };
      reader.readAsDataURL(file);
    }
  }

  private openModal(): void {
    const { modal, offerId } = this.elements;
    if (offerId) offerId.value = "";
    if (modal) modal.classList.remove("hidden");
    
    // Initialize map after modal is visible
    setTimeout(() => this.initializeMap(), 100);
  }

  private closeModal(): void {
    const { modal, form, imagePreview } = this.elements;
    if (modal) modal.classList.add("hidden");
    if (form) form.reset();
    if (imagePreview) imagePreview.classList.add("hidden");
  }

  private initializeMap(): void {
    const { mapPicker, offerLatitude, offerLongitude } = this.elements;
    
    if (!mapPicker || !window.L) return;

    // If map already exists, just update it
    if (this.map) {
      this.updateMapFromInputs();
      this.map.invalidateSize();
      return;
    }

    // Default center: Slovakia (Košice area)
    const defaultLat = 48.7164;
    const defaultLng = 21.2611;
    
    // Initialize map
    this.map = window.L.map(mapPicker).setView([defaultLat, defaultLng], 7);

    // Add OpenStreetMap tiles
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // Add click handler to place marker
    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      
      // Update input fields
      if (offerLatitude) offerLatitude.value = lat.toFixed(6);
      if (offerLongitude) offerLongitude.value = lng.toFixed(6);
      
      // Update marker
      this.updateMarker(lat, lng);
    });

    // Set initial marker if coordinates exist
    this.updateMapFromInputs();
  }

  private updateMapFromInputs(): void {
    const { offerLatitude, offerLongitude } = this.elements;
    
    if (!this.map || !offerLatitude || !offerLongitude) return;

    const lat = parseFloat(offerLatitude.value);
    const lng = parseFloat(offerLongitude.value);

    if (!isNaN(lat) && !isNaN(lng)) {
      this.updateMarker(lat, lng);
      this.map.setView([lat, lng], 13);
    }
  }

  private updateMarker(lat: number, lng: number): void {
    if (!this.map || !window.L) return;

    // Remove existing marker
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Add new marker
    this.marker = window.L.marker([lat, lng]).addTo(this.map);
  }
}

export function initializeOffersPage(
  elements: OffersPageElements,
): OffersPageController {
  return new OffersPageController(elements);
}
