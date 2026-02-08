import { api, type OfferSummary } from "../../lib/api";
import { escapeHtml, showConfirmDialog } from "./utils";
import L from "leaflet";
import Cropper from "cropperjs";
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

// Global function declarations
declare global {
  interface Window {
    editOffer?: (id: number) => void;
    deleteOffer?: (id: number) => Promise<void>;
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
  imageCropContainer: HTMLElement | null;
  imageCropPreview: HTMLImageElement | null;
  cropApply: HTMLButtonElement | null;
  cropCancel: HTMLButtonElement | null;
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
  private cropper: any = null;
  private croppedImageBlob: Blob | null = null;

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
      cropApply,
      cropCancel,
    } = this.elements;

    form?.addEventListener("submit", (e) => this.handleFormSubmit(e));
    refreshBtn?.addEventListener("click", () => this.loadOffers());
    addOfferBtn?.addEventListener("click", () => this.openModal());
    modalClose?.addEventListener("click", () => this.closeModal());
    modalCancel?.addEventListener("click", () => this.closeModal());
    offerImage?.addEventListener("change", () => this.handleImageChange());
    cropApply?.addEventListener("click", () => this.applyCrop());
    cropCancel?.addEventListener("click", () => this.cancelCrop());

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
    
    // Clone icon templates
    const editTemplate = document.getElementById('icon-edit') as HTMLTemplateElement;
    const trashTemplate = document.getElementById('icon-trash') as HTMLTemplateElement;
    
    if (editTemplate) {
      this.elements.container.querySelectorAll('.icon-edit').forEach((placeholder) => {
        placeholder.replaceWith(editTemplate.content.cloneNode(true));
      });
    }
    
    if (trashTemplate) {
      this.elements.container.querySelectorAll('.icon-trash').forEach((placeholder) => {
        placeholder.replaceWith(trashTemplate.content.cloneNode(true));
      });
    }
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
            <span class="icon-edit"></span>
            Upraviť
          </button>
          <button onclick="window.deleteOffer && window.deleteOffer(${offer.id})" class="px-3 py-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
            <span class="icon-trash"></span>
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
        if (this.croppedImageBlob) {
          data.append("image", this.croppedImageBlob, "image.jpg");
        } else if (formData.imageFile) {
          data.append("image", formData.imageFile);
        }
        await api.admin.updateOffer(parseInt(formData.id, 10), data);
      } else {
        if (this.croppedImageBlob) {
          data.append("image", this.croppedImageBlob, "image.jpg");
        } else if (formData.imageFile) {
          data.append("image", formData.imageFile);
        }
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
    const { offerImage, imageCropContainer, imageCropPreview, imagePreview } = this.elements;
    const file = offerImage?.files?.[0];

    if (file && imageCropContainer && imageCropPreview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && imageCropPreview) {
          // Destroy existing cropper if any
          if (this.cropper) {
            this.cropper.destroy();
          }

          // Hide final preview and show crop container
          if (imagePreview) imagePreview.classList.add("hidden");
          imageCropContainer.classList.remove("hidden");

          // Set image source and initialize cropper
          imageCropPreview.src = e.target.result as string;

          // Wait for image to load before initializing cropper
          imageCropPreview.onload = () => {            
            if (imageCropPreview) {
              this.cropper = new Cropper(imageCropPreview);
              
              // Set canvas to fill 100% of grid container
              const canvas = this.cropper.getCropperCanvas();
              if (canvas) {
                canvas.style.width = '100%';
                canvas.style.height = '100%';
              }
              
              // Set aspect ratio on the selection element (v2.x API)
              const selection = this.cropper.getCropperSelection();
              if (selection) {
                selection.aspectRatio = 16 / 9;
                selection.initialCoverage = 0.8;
              }
            }
          };
        }
      };
      reader.readAsDataURL(file);
    }
  }

  private async applyCrop(): Promise<void> {
    if (!this.cropper) return;

    const { imageCropContainer, imagePreview, imagePreviewImg } = this.elements;

    // Get cropped canvas using Cropper 2.x API
    const selection = this.cropper.getCropperSelection();
    if (!selection) return;

    try {
      const croppedCanvas = await selection.$toCanvas({
        width: 1920,
        height: 1080,
      });

      if (croppedCanvas && imagePreview && imagePreviewImg) {
        // Convert canvas to blob
        croppedCanvas.toBlob((blob: Blob | null) => {
          if (blob) {
            this.croppedImageBlob = blob;

            // Show preview
            imagePreviewImg.src = croppedCanvas.toDataURL();
            imagePreview.classList.remove("hidden");

            // Hide crop container
            if (imageCropContainer) imageCropContainer.classList.add("hidden");

            // Destroy cropper
            if (this.cropper) {
              this.cropper.destroy();
              this.cropper = null;
            }
          }
        }, 'image/jpeg', 0.95);
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  }

  private cancelCrop(): void {
    const { offerImage, imageCropContainer } = this.elements;

    // Destroy cropper
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }

    // Hide crop container
    if (imageCropContainer) imageCropContainer.classList.add("hidden");

    // Clear file input
    if (offerImage) offerImage.value = "";

    // Clear cropped blob
    this.croppedImageBlob = null;
  }

  private openModal(): void {
    const { modal, offerId } = this.elements;
    if (offerId) offerId.value = "";
    if (modal) modal.classList.remove("hidden");
    
    // Initialize map after modal is visible
    setTimeout(() => this.initializeMap(), 100);
  }

  private closeModal(): void {
    const { modal, form, imagePreview, imageCropContainer } = this.elements;
    
    // Destroy cropper if exists
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
    
    // Reset cropped blob
    this.croppedImageBlob = null;
    
    if (modal) modal.classList.add("hidden");
    if (form) form.reset();
    if (imagePreview) imagePreview.classList.add("hidden");
    if (imageCropContainer) imageCropContainer.classList.add("hidden");
  }

  private initializeMap(): void {
    const { mapPicker, offerLatitude, offerLongitude } = this.elements;
    
    if (!mapPicker) return;

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
    this.map = L.map(mapPicker).setView([defaultLat, defaultLng], 7);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
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
    if (!this.map) return;

    // Remove existing marker
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Add new marker
    this.marker = L.marker([lat, lng]).addTo(this.map);
  }
}

export function initializeOffersPage(
  elements: OffersPageElements,
): OffersPageController {
  return new OffersPageController(elements);
}
