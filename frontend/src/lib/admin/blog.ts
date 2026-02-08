import { api, type BlogPost } from "../../lib/api";
import { escapeHtml, showConfirmDialog } from "./utils";
import Cropper from "cropperjs";

// Extend window with admin actions
declare global {
  interface Window {
    editBlogPost?: (id: number) => void;
    deleteBlogPost?: (id: number) => Promise<void>;
  }
}

export interface BlogPageElements {
  container: HTMLElement | null;
  loading: HTMLElement | null;
  noPosts: HTMLElement | null;
  form: HTMLFormElement | null;
  modal: HTMLElement | null;
  refreshBtn: HTMLElement | null;
  addPostBtn: HTMLElement | null;
  modalClose: HTMLElement | null;
  modalCancel: HTMLElement | null;
  postId: HTMLInputElement | null;
  postTitle: HTMLInputElement | null;
  postSlug: HTMLInputElement | null;
  postExcerpt: HTMLTextAreaElement | null;
  postContent: HTMLTextAreaElement | null;
  postPublished: HTMLInputElement | null;
  postImage: HTMLInputElement | null;
  imagePreview: HTMLElement | null;
  imagePreviewImg: HTMLImageElement | null;
  blogImageCropContainer: HTMLElement | null;
  blogImageCropPreview: HTMLImageElement | null;
  blogCropApply: HTMLButtonElement | null;
  blogCropCancel: HTMLButtonElement | null;
}

export interface BlogFormData {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  published: boolean;
  imageFile?: File;
}

export class BlogPageController {
  private elements: BlogPageElements;
  private postsData: BlogPost[] = [];
  private cropper: any = null;
  private croppedImageBlob: Blob | null = null;

  constructor(elements: BlogPageElements) {
    this.elements = elements;
    this.initialize();
  }

  private initialize(): void {
    this.setupEventListeners();
    this.loadPosts();
  }

  private setupEventListeners(): void {
    const {
      form,
      refreshBtn,
      addPostBtn,
      modalClose,
      modalCancel,
      postImage,
      blogCropApply,
      blogCropCancel,
    } = this.elements;

    form?.addEventListener("submit", (e) => this.handleFormSubmit(e));
    refreshBtn?.addEventListener("click", () => this.loadPosts());
    addPostBtn?.addEventListener("click", () => this.openModal());
    modalClose?.addEventListener("click", () => this.closeModal());
    modalCancel?.addEventListener("click", () => this.closeModal());
    postImage?.addEventListener("change", () => this.handleImageChange());
    blogCropApply?.addEventListener("click", () => this.applyCrop());
    blogCropCancel?.addEventListener("click", () => this.cancelCrop());

    this.setupWindowFunctions();
  }

  private setupWindowFunctions(): void {
    window.editBlogPost = (id: number) => {
      this.editPost(id);
    };

    window.deleteBlogPost = async (id: number) => {
      showConfirmDialog("Zmazať príspevok?", async () => {
        try {
          await api.admin.deleteBlogPost(id);
          await this.loadPosts();
        } catch (error) {
          console.error("Failed to delete blog post:", error);
          alert("Chyba pri mazaní.");
        }
      });
    };
  }

  async loadPosts(): Promise<void> {
    const { container, loading, noPosts } = this.elements;

    if (loading) loading.classList.remove("hidden");
    if (container) container.innerHTML = "";
    if (noPosts) noPosts.classList.add("hidden");

    try {
      this.postsData = await api.admin.getAllBlogPosts();

      if (this.postsData.length === 0) {
        if (noPosts) noPosts.classList.remove("hidden");
      } else {
        this.renderPosts();
      }
    } catch (error) {
      console.error("Failed to load blog posts:", error);
      alert("Chyba pri načítavaní príspevkov.");
    } finally {
      if (loading) loading.classList.add("hidden");
    }
  }

  private renderPosts(): void {
    const { container } = this.elements;
    if (!container) return;

    container.innerHTML = this.postsData.map((post) => this.renderPostCard(post)).join("");
  }

  private renderPostCard(post: BlogPost): string {
    const createdAt = new Date(post.created_at).toLocaleDateString("sk-SK");
    const statusBadge = post.published
      ? '<span class="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700 rounded">Publikované</span>'
      : '<span class="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 rounded">Koncept</span>';

    return `
      <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1">
        ${post.image_mime ? `<img src="${api.blog.getBlogPostImageUrl(post.id)}" alt="${escapeHtml(post.title)}" class="w-full h-48 object-cover rounded-lg mb-4">` : ''}
        <div class="flex items-start justify-between gap-4 mb-3">
          <h3 class="m-0 text-lg font-bold text-gray-900 leading-tight break-words">${escapeHtml(post.title)}</h3>
          ${statusBadge}
        </div>
        <p class="text-sm text-gray-500 mb-2"><strong>Slug:</strong> <code class="bg-gray-100 px-2 py-1 rounded text-xs break-all">${escapeHtml(post.slug)}</code></p>
        ${post.excerpt ? `<p class="text-sm text-gray-600 mb-4 line-clamp-2 break-words">${escapeHtml(post.excerpt)}</p>` : ''}
        <div class="text-xs text-gray-400 mb-4">Vytvorené: ${createdAt}</div>
        <div class="flex gap-2">
          <button onclick="window.editBlogPost && window.editBlogPost(${post.id})" class="flex-1 px-3 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Upraviť
          </button>
          <button onclick="window.deleteBlogPost && window.deleteBlogPost(${post.id})" class="px-3 py-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors">
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
    this.savePost(formData);
  }

  private getFormData(): BlogFormData {
    const { postId, postTitle, postSlug, postExcerpt, postContent, postPublished, postImage } =
      this.elements;

    return {
      id: postId?.value,
      title: postTitle?.value || "",
      slug: postSlug?.value || "",
      excerpt: postExcerpt?.value || "",
      content: postContent?.value || "",
      published: postPublished?.checked || false,
      imageFile: postImage?.files?.[0],
    };
  }

  private async savePost(formData: BlogFormData): Promise<void> {
    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("slug", formData.slug);
      if (formData.excerpt) data.append("excerpt", formData.excerpt);
      data.append("content", formData.content);
      data.append("published", formData.published ? "true" : "false");

      if (formData.id) {
        // Update existing post
        if (this.croppedImageBlob) {
          data.append("image", this.croppedImageBlob, "image.jpg");
        } else if (formData.imageFile) {
          data.append("image", formData.imageFile);
        }
        await api.admin.updateBlogPost(parseInt(formData.id, 10), data);
      } else {
        // Create new post
        if (this.croppedImageBlob) {
          data.append("image", this.croppedImageBlob, "image.jpg");
        } else if (formData.imageFile) {
          data.append("image", formData.imageFile);
        }
        await api.admin.createBlogPost(data);
      }

      this.closeModal();
      await this.loadPosts();
    } catch (error) {
      console.error("Failed to save blog post:", error);
      alert("Chyba pri ukladaní.");
    }
  }

  private editPost(id: number): void {
    const post = this.postsData.find((x) => x.id === id);
    if (!post) return;

    const {
      postId,
      postTitle,
      postSlug,
      postExcerpt,
      postContent,
      postPublished,
      imagePreview,
      imagePreviewImg,
      modal,
    } = this.elements;

    if (postId) postId.value = String(post.id);
    if (postTitle) postTitle.value = post.title;
    if (postSlug) postSlug.value = post.slug;
    if (postExcerpt) postExcerpt.value = post.excerpt || "";
    if (postContent) postContent.value = post.content;
    if (postPublished) postPublished.checked = post.published;
    if (imagePreview && imagePreviewImg && post.image_mime) {
      imagePreview.classList.remove("hidden");
      imagePreviewImg.src = api.blog.getBlogPostImageUrl(post.id);
    }
    if (modal) modal.classList.remove("hidden");
  }

  private handleImageChange(): void {
    const { postImage, blogImageCropContainer, blogImageCropPreview, imagePreview } = this.elements;
    const file = postImage?.files?.[0];

    if (file && blogImageCropContainer && blogImageCropPreview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && blogImageCropPreview) {
          // Destroy existing cropper if any
          if (this.cropper) {
            this.cropper.destroy();
          }

          // Hide final preview and show crop container
          if (imagePreview) imagePreview.classList.add("hidden");
          blogImageCropContainer.classList.remove("hidden");

          // Set image source and initialize cropper
          blogImageCropPreview.src = e.target.result as string;

          // Wait for image to load before initializing cropper
          blogImageCropPreview.onload = () => {
            if (blogImageCropPreview) {
              this.cropper = new Cropper(blogImageCropPreview);
              
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

    const { blogImageCropContainer, imagePreview, imagePreviewImg } = this.elements;

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
            if (blogImageCropContainer) blogImageCropContainer.classList.add("hidden");

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
    const { postImage, blogImageCropContainer } = this.elements;

    // Destroy cropper
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }

    // Hide crop container
    if (blogImageCropContainer) blogImageCropContainer.classList.add("hidden");

    // Clear file input
    if (postImage) postImage.value = "";

    // Clear cropped blob
    this.croppedImageBlob = null;
  }

  private openModal(): void {
    const { modal, postId, form, postPublished } = this.elements;
    if (postId) postId.value = "";
    if (postPublished) postPublished.checked = false;
    if (form) form.reset();
    if (modal) modal.classList.remove("hidden");
  }

  private closeModal(): void {
    const { modal, form, imagePreview, blogImageCropContainer } = this.elements;
    
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
    if (blogImageCropContainer) blogImageCropContainer.classList.add("hidden");
  }
}

export function initializeBlogPage(
  elements: BlogPageElements,
): BlogPageController {
  return new BlogPageController(elements);
}
