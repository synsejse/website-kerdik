/**
 * Initialize admin header logout button
 */
export async function initAdminHeader(): Promise<void> {
    const container = document.getElementById("admin-logout-container");
    const btn = document.getElementById("admin-logout-btn");
    if (!btn || !container) return;

    try {
        const res = await fetch("/admin/check", { credentials: "same-origin" });
        if (res.ok) {
            const isAuth = await res.json();
            if (isAuth) {
                btn.classList.remove("hidden");
                container.classList.remove("hidden");
            } else {
                btn.classList.add("hidden");
                container.classList.add("hidden");
            }
        }
    } catch (e) {
        container.classList.add("hidden");
    }

    btn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
            await fetch("/admin/logout", { method: "POST", credentials: "same-origin" });
        } catch (err) {
            // ignore network errors
        } finally {
            window.location.href = "/admin/login";
        }
    });
}
