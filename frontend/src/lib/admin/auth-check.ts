/**
 * Check admin authentication and redirect if needed
 */
export async function checkAdminAuth(): Promise<void> {
    try {
        const resp = await fetch("/admin/check", { credentials: "same-origin" });
        const isAuth: boolean = resp.ok ? Boolean(await resp.json()) : false;
        const path = window.location.pathname.replace(/\/+$/, "");
        const onLogin = path === "/admin/login";

        if (!isAuth && !onLogin) {
            window.location.href = "/admin/login";
        } else if (isAuth && onLogin) {
            window.location.href = "/admin/messages";
        }
    } catch (e) {
        const path = window.location.pathname.replace(/\/+$/, "");
        if (path !== "/admin/login") {
            window.location.href = "/admin/login";
        }
    }
}
