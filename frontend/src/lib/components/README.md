# Component Utilities

This directory contains reusable TypeScript utilities for frontend components. Following the cleanup pattern from previous commits, complex TypeScript code has been extracted from `.astro` files into dedicated `.ts` files for better maintainability and reusability.

## Files

### `hero-carousel.ts`
- **Extracted from**: `frontend/src/components/home/HeroCarousel.astro`
- **Purpose**: Hero carousel initialization and animation logic
- **Exports**:
  - `Slide` interface - carousel slide data structure
  - `CarouselOptions` interface - carousel configuration options
  - `initHeroCarousel()` function - initializes the hero carousel with auto-play, progress bar, navigation, and accessibility features

### `stats-counter.ts`
- **Extracted from**: `frontend/src/components/home/StatsSection.astro`
- **Purpose**: Animated counter initialization for statistics section
- **Exports**:
  - `initStatsCounter()` function - initializes animated counters that trigger when the section becomes visible using IntersectionObserver

### `contact-form.ts`
- **Extracted from**: `frontend/src/components/contact/ContactForm.astro`
- **Purpose**: Contact form handling with validation and submission
- **Exports**:
  - `ContactFormElements` interface - form element references
  - `initContactForm()` function - initializes form validation, submission, and UI state management

### `navbar.ts`
- **Extracted from**: `frontend/src/components/layout/Navbar.astro`
- **Purpose**: Mobile menu toggle functionality for main site navigation
- **Exports**:
  - `initNavbar(menuToggleSelector, navMenuId)` function - initializes mobile menu toggle with accessibility features

### `admin-navbar.ts`
- **Extracted from**: `frontend/src/components/layout/admin/Navbar.astro`
- **Purpose**: Mobile menu toggle with admin-specific features (auth check, logout)
- **Exports**:
  - `initAdminNavbar()` function - initializes admin navbar with mobile menu, auth check, and logout handling

### `offer-section.ts`
- **Extracted from**: `frontend/src/components/shared/OfferSection.astro`
- **Purpose**: Offer list loading and rendering from API
- **Exports**:
  - `initOfferSection()` function - loads and renders offers from the API

## Pattern

Following the same cleanup approach used in recent commits (`4986b58`, `0d33773`), this extraction:
1. Moves complex TypeScript logic out of `.astro` files
2. Creates reusable, testable utility functions
3. Maintains component-specific types and interfaces
4. Keeps `.astro` files focused on markup and styling
5. Makes the codebase more maintainable and easier to test

## Usage

In your `.astro` component:

```astro
<script>
    import { initHeroCarousel } from "../../lib/components/hero-carousel";
    initHeroCarousel();
</script>
```

Or for other components:

```astro
<script>
    import { initStatsCounter } from "../../lib/components/stats-counter";
    initStatsCounter();
</script>
```

## Summary

This cleanup extracted TypeScript from **6 astro components**, creating **6 reusable utility files** and reducing astro file complexity by **450+ lines** while maintaining full functionality and type safety.
