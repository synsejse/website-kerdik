import { api } from "../api";

function getInviteToken(): string | null {
  return new URLSearchParams(window.location.search).get("token");
}

export async function initAdminInvite(): Promise<void> {
  const form = document.getElementById("invite-form") as HTMLFormElement | null;
  const usernameInput = document.getElementById("invite-username") as HTMLInputElement | null;
  const passwordInput = document.getElementById("password") as HTMLInputElement | null;
  const confirmInput = document.getElementById("confirm-password") as HTMLInputElement | null;
  const submitBtn = document.getElementById("invite-btn") as HTMLButtonElement | null;
  const subtitle = document.getElementById("invite-subtitle") as HTMLParagraphElement | null;
  const errorMessage = document.getElementById("error-message") as HTMLDivElement | null;
  const token = getInviteToken();

  if (!form || !usernameInput || !passwordInput || !confirmInput || !submitBtn || !subtitle || !errorMessage || !token) {
    return;
  }

  try {
    const invite = await api.admin.getInviteStatus(token);
    usernameInput.value = invite.username;
    subtitle.textContent = `Pozvánka platí do ${new Date(invite.expires_at).toLocaleString("sk-SK")}`;
    form.classList.remove("hidden");
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : "Pozvánka je neplatná alebo expirovaná.";
    errorMessage.classList.remove("hidden");
    subtitle.textContent = "Pozvánku sa nepodarilo načítať";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (passwordInput.value !== confirmInput.value) {
      errorMessage.textContent = "Heslá sa nezhodujú.";
      errorMessage.classList.remove("hidden");
      return;
    }

    try {
      submitBtn.disabled = true;
      passwordInput.disabled = true;
      confirmInput.disabled = true;
      errorMessage.classList.add("hidden");

      await api.admin.acceptInvite(token, passwordInput.value);
      window.location.href = "/admin/messages";
    } catch (error) {
      errorMessage.textContent = error instanceof Error ? error.message : "Nepodarilo sa dokončiť pozvánku.";
      errorMessage.classList.remove("hidden");
      submitBtn.disabled = false;
      passwordInput.disabled = false;
      confirmInput.disabled = false;
    }
  });
}
