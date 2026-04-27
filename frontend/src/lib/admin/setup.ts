import { api } from "../api";

export function initAdminSetup(): void {
    const form = document.getElementById(
        "setup-form",
    ) as HTMLFormElement | null;
    const usernameInput = document.getElementById(
        "username",
    ) as HTMLInputElement | null;
    const passwordInput = document.getElementById(
        "password",
    ) as HTMLInputElement | null;
    const confirmInput = document.getElementById(
        "confirm-password",
    ) as HTMLInputElement | null;
    const submitBtn = document.getElementById(
        "setup-btn",
    ) as HTMLButtonElement | null;
    const errorMessage = document.getElementById(
        "error-message",
    ) as HTMLDivElement | null;

    if (
        !form ||
        !usernameInput ||
        !passwordInput ||
        !confirmInput ||
        !submitBtn ||
        !errorMessage
    ) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (password !== confirmPassword) {
            errorMessage.textContent = "Heslá sa nezhodujú.";
            errorMessage.classList.remove("hidden");
            return;
        }

        try {
            usernameInput.disabled = true;
            passwordInput.disabled = true;
            confirmInput.disabled = true;
            submitBtn.disabled = true;
            errorMessage.classList.add("hidden");

            await api.admin.setupFirstUser(username, password);
            window.location.href = "/admin/messages";
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Nepodarilo sa dokončiť prvotné nastavenie.";
            errorMessage.textContent = message;
            errorMessage.classList.remove("hidden");
            usernameInput.disabled = false;
            passwordInput.disabled = false;
            confirmInput.disabled = false;
            submitBtn.disabled = false;
        }
    });
}
