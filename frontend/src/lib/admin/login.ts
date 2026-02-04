import { api } from "../api";

/**
 * Initialize admin login form
 */
export function initAdminLogin(): void {
    const form = document.getElementById("login-form") as HTMLFormElement | null;
    const passwordInput = document.getElementById("password") as HTMLInputElement | null;
    const loginBtn = document.getElementById("login-btn") as HTMLButtonElement | null;
    const errorMessage = document.getElementById("error-message") as HTMLDivElement | null;

    if (!form || !passwordInput || !loginBtn || !errorMessage) {
        return;
    }

    form.addEventListener("submit", async (e: Event) => {
        e.preventDefault();

        const password = passwordInput.value ?? "";

        try {
            passwordInput.disabled = true;
            loginBtn.disabled = true;
            errorMessage.classList.add("hidden");

            await api.admin.login(password);
            window.location.href = "/admin/messages";
        } catch (err) {
            errorMessage.textContent = "Nesprávne heslo. Skúste to znova.";
            errorMessage.classList.remove("hidden");
            passwordInput.disabled = false;
            loginBtn.disabled = false;
            passwordInput.value = "";
            passwordInput.focus();
        }
    });
}
