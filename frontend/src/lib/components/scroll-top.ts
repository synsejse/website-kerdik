/**
 * Initialize scroll to top button with circular progress indicator
 */
export function initScrollTop(): void {
    if (typeof window === "undefined") return;

    const btn = document.getElementById("scrollTop");
    const progressCircle = document.getElementById("scrollProgress") as SVGCircleElement | null;
    if (!btn) return;

    const scrollThreshold = parseInt(btn?.dataset.threshold || "300", 10);
    const radius = progressCircle ? parseFloat(progressCircle.getAttribute("r") || "0") : 0;
    const circumference = 2 * Math.PI * radius;

    function onScroll() {
        if (!btn) return;

        // Calculate scroll percentage
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = docHeight > 0 ? scrollTop / docHeight : 0;

        // Update progress circle
        if (progressCircle) {
            const offset = circumference - scrollPercent * circumference;
            progressCircle.style.strokeDashoffset = offset.toString();
        }

        // Show/hide button
        if (scrollTop > scrollThreshold) {
            btn.classList.add("show");
        } else {
            btn.classList.remove("show");
        }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    // Initialize state on load
    onScroll();

    btn.addEventListener("click", () => {
        try {
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
            // Fallback for older browsers
            window.scrollTo(0, 0);
        }
    });
}
