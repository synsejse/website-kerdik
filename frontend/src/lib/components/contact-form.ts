/**
 * Contact form handler with validation and submission
 */

export interface ContactFormElements {
  form: HTMLFormElement;
  feedback: HTMLElement | null;
  submitBtn: HTMLButtonElement;
  btnIcon: HTMLElement | null;
  btnSpinner: HTMLElement | null;
  btnText: HTMLElement | null;
}

/**
 * Initialize contact form with validation and submission handling
 */
export function initContactForm(): void {
  const form = document.getElementById('contact-form') as HTMLFormElement;
  const feedback = document.getElementById('form-feedback');
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  const btnIcon = document.getElementById('btn-icon');
  const btnSpinner = document.getElementById('btn-spinner');
  const btnText = document.getElementById('btn-text');

  if (!form) return;

  // Clear custom validity on input
  form.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (target) target.setCustomValidity('');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!feedback || !submitBtn) return;

    // Basic client-side validation check (optional, but good for UX)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Custom email validation
    const emailInput = form.elements.namedItem('email') as HTMLInputElement;
    if (emailInput && !emailInput.value.includes('@')) {
      emailInput.setCustomValidity('Zadajte platnú emailovú adresu.');
      emailInput.reportValidity();
      return;
    }

    // Custom message length check
    const messageInput = form.elements.namedItem('message') as HTMLTextAreaElement;
    if (messageInput && messageInput.value.trim().length < 10) {
      messageInput.setCustomValidity('Správa musí mať aspoň 10 znakov.');
      messageInput.reportValidity();
      return;
    }

    // Disable button
    submitBtn.disabled = true;
    if (btnIcon) btnIcon.classList.add('hidden');
    if (btnSpinner) btnSpinner.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Odosielam...';

    feedback.classList.add('hidden');
    feedback.className = 'hidden mb-6 p-4 rounded-xl border text-sm font-bold';

    try {
      const formData = new FormData(form);

      const response = await fetch(form.action, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Success
        feedback.textContent = 'Ďakujeme, Vaša správa bola úspešne odoslaná. Čoskoro Vás budeme kontaktovať.';
        feedback.classList.remove('hidden');
        feedback.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
        form.reset();
      } else {
        throw new Error('Server returned error');
      }
    } catch (error) {
      // Error
      console.error(error);
      feedback.textContent = 'Nepodarilo sa odoslať správu. Skúste to prosím neskôr alebo nás kontaktujte telefonicky.';
      feedback.classList.remove('hidden');
      feedback.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    } finally {
      // Re-enable button
      submitBtn.disabled = false;
      if (btnIcon) btnIcon.classList.remove('hidden');
      if (btnSpinner) btnSpinner.classList.add('hidden');
      if (btnText) btnText.textContent = 'Odoslať správu';
    }
  });
}
