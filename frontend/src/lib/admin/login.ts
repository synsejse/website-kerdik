import { api } from "../api";

/**
 * Initialize admin login form
 */
export function initAdminLogin(): void {
    const form = document.getElementById(
        "login-form",
    ) as HTMLFormElement | null;
    const usernameInput = document.getElementById(
        "username",
    ) as HTMLInputElement | null;
    const passwordInput = document.getElementById(
        "password",
    ) as HTMLInputElement | null;
    const loginBtn = document.getElementById(
        "login-btn",
    ) as HTMLButtonElement | null;
    const errorMessage = document.getElementById(
        "error-message",
    ) as HTMLDivElement | null;

    if (
        !form ||
        !usernameInput ||
        !passwordInput ||
        !loginBtn ||
        !errorMessage
    ) {
        return;
    }

    form.addEventListener("submit", async (e: Event) => {
        e.preventDefault();

        const username = usernameInput.value ?? "";
        const password = passwordInput.value ?? "";

        try {
            usernameInput.disabled = true;
            passwordInput.disabled = true;
            loginBtn.disabled = true;
            errorMessage.classList.add("hidden");

            await api.admin.login(username, password);
            window.location.href = "/admin/messages";
        } catch (err) {
            errorMessage.textContent =
                "Nesprávne prihlasovacie údaje. Skúste to znova.";
            errorMessage.classList.remove("hidden");
            usernameInput.disabled = false;
            passwordInput.disabled = false;
            loginBtn.disabled = false;
            usernameInput.focus();
        }
    });
}
