import { api } from "../api";
import { markdownToHtml } from "../../utils/markdown";

function getBlogSlug(): string | null {
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("slug");
  if (querySlug) {
    return querySlug;
  }

  const pathnameMatch = window.location.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (pathnameMatch) {
    return decodeURIComponent(pathnameMatch[1]);
  }

  return null;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export async function initBlogPostPage(): Promise<void> {
  const loading = document.getElementById("loading-post");
  const error = document.getElementById("error-post");
  const content = document.getElementById("post-content");
  const slug = getBlogSlug();

  if (!slug || !content) {
    error?.classList.remove("hidden");
    loading?.classList.add("hidden");
    return;
  }

  try {
    const [post, allPosts] = await Promise.all([
      api.blog.getBlogPostBySlug(slug),
      api.blog.getBlogPosts(),
    ]);

    const createdDate = new Date(post.created_at);
    const updatedDate = new Date(post.updated_at);
    const formattedCreated = createdDate.toLocaleDateString("sk-SK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedUpdated = updatedDate.toLocaleDateString("sk-SK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    document.title = `${post.title} | Blog | MK-SBD`;

    const relatedPosts = allPosts.filter((entry) => entry.slug !== post.slug).slice(0, 3);

    content.innerHTML = `
      <article class="max-w-4xl mx-auto">
        <nav class="mb-6 text-sm text-gray-500">
          <a href="/blog" class="hover:text-primary transition-colors no-underline">Blog</a>
          <span class="mx-2">/</span>
          <span>${escapeHtml(post.title)}</span>
        </nav>

        <header class="mb-8">
          <h1 class="m-0 mb-4 text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight tracking-tight">
            ${escapeHtml(post.title)}
          </h1>
          <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <time datetime="${post.created_at}">${formattedCreated}</time>
            ${post.updated_at !== post.created_at ? `<span>Aktualizované: ${formattedUpdated}</span>` : ""}
          </div>
        </header>

        ${post.image_mime ? `
          <div class="mb-8">
            <img src="${api.blog.getBlogPostImageUrl(post.id)}" alt="${escapeHtml(post.title)}" class="w-full h-auto rounded-2xl shadow-lg">
          </div>
        ` : ""}

        ${post.excerpt ? `
          <div class="mb-8 p-6 bg-blue-50 border-l-4 border-primary rounded-r-lg">
            <div class="text-lg text-gray-700 italic m-0 prose max-w-none">
              ${markdownToHtml(post.excerpt)}
            </div>
          </div>
        ` : ""}

        <div class="prose prose-lg max-w-none">
          ${markdownToHtml(post.content)}
        </div>

        <div class="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 items-center justify-between">
          <a href="/blog" class="inline-flex items-center gap-2 text-primary hover:text-blue-600 font-bold transition-colors no-underline">
            <span class="icon-chevron-left"></span>
            Späť na blog
          </a>
        </div>
      </article>

      ${relatedPosts.length > 0 ? `
        <section class="max-w-5xl mx-auto mt-16 border-t border-gray-200 pt-12">
          <div class="mb-8">
            <p class="m-0 mb-2 text-xs font-black uppercase tracking-[0.15em] text-primary">Objavte viac</p>
            <h2 class="m-0 text-2xl md:text-3xl font-bold text-gray-900">Ďalšie príspevky</h2>
          </div>
          <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            ${relatedPosts.map((entry) => `
              <article class="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1">
                ${entry.image_mime ? `<img src="${api.blog.getBlogPostImageUrl(entry.id)}" alt="${escapeHtml(entry.title)}" class="w-full h-44 object-cover">` : ""}
                <div class="p-6">
                  <h3 class="m-0 mb-3 text-lg font-bold text-gray-900 leading-tight">
                    <a href="/blog/${encodeURIComponent(entry.slug)}" class="no-underline text-inherit hover:text-primary transition-colors">${escapeHtml(entry.title)}</a>
                  </h3>
                  ${entry.excerpt ? `<div class="text-sm text-gray-600 mb-4 line-clamp-3 prose prose-sm max-w-none">${markdownToHtml(entry.excerpt)}</div>` : ""}
                  <a href="/blog/${encodeURIComponent(entry.slug)}" class="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-blue-600 transition-colors no-underline">Čítať viac</a>
                </div>
              </article>
            `).join("")}
          </div>
        </section>
      ` : ""}
    `;

    const chevronTemplate = document.getElementById("icon-chevron-left") as HTMLTemplateElement | null;
    if (chevronTemplate) {
      content.querySelectorAll(".icon-chevron-left").forEach((placeholder) => {
        placeholder.replaceWith(chevronTemplate.content.cloneNode(true));
      });
    }

    content.classList.remove("hidden");
  } catch (err) {
    console.error("Error loading blog post:", err);
    error?.classList.remove("hidden");
  } finally {
    loading?.classList.add("hidden");
  }
}
