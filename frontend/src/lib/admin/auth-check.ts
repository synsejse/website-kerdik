import { api } from "../api";

/**
 * Check admin authentication and redirect if needed
 */
export async function checkAdminAuth(): Promise<void> {
    try {
        const status = await api.admin.getStatus();

        const path = window.location.pathname.replace(/\/+$/, "");
        const onLogin = path === "/admin/login";
        const onSetup = path === "/admin/setup";
        const onInvite = path === "/admin/invite";

        if (status.setup_required) {
            if (!onSetup) {
                window.location.href = "/admin/setup";
            }
            return;
        }

        if (onSetup) {
            window.location.href = status.authenticated ? "/admin/messages" : "/admin/login";
            return;
        }

        if (onInvite) {
            return;
        }

        if (!status.authenticated && !onLogin) {
            window.location.href = "/admin/login";
        } else if (status.authenticated && onLogin) {
            window.location.href = "/admin/messages";
        }
    } catch (e) {
        const path = window.location.pathname.replace(/\/+$/, "");
        if (path !== "/admin/login" && path !== "/admin/setup" && path !== "/admin/invite") {
            window.location.href = "/admin/login";
        }
    }
}
