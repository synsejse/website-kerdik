import { api, type OfferSummary } from "../../lib/api";
import { escapeHtml, showConfirmDialog } from "./utils";

// Extend window with admin actions
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
    } = this.elements;

    form?.addEventListener("submit", (e) => this.handleFormSubmit(e));
    refreshBtn?.addEventListener("click", () => this.loadOffers());
    addOfferBtn?.addEventListener("click", () => this.openModal());
    modalClose?.addEventListener("click", () => this.closeModal());
    modalCancel?.addEventListener("click", () => this.closeModal());
    offerImage?.addEventListener("change", () => this.handleImageChange());

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
      <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20">
        <div class="h-32 bg-gray-100 rounded-xl mb-4 overflow-hidden border">
          <img src="${imageUrl}" class="w-full h-full object-cover" alt="${title}" />
        </div>
        <h3 class="font-black text-gray-900 mb-1">${title}</h3>
        <p class="text-xs text-gray-400 mb-4 font-mono">/${slug}</p>
        <p class="text-sm text-gray-600 mb-4">${desc}</p>
        <div class="flex gap-2">
          <button onclick="window.editOffer && window.editOffer(${offer.id})" class="flex-1 py-2 bg-gray-50 hover:bg-blue-50 text-xs font-black uppercase tracking-widest rounded-lg transition-colors flex items-center justify-center gap-2">
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
  }

  private closeModal(): void {
    const { modal, form, imagePreview } = this.elements;
    if (modal) modal.classList.add("hidden");
    if (form) form.reset();
    if (imagePreview) imagePreview.classList.add("hidden");
  }
}

export function initializeOffersPage(
  elements: OffersPageElements,
): OffersPageController {
  return new OffersPageController(elements);
}
