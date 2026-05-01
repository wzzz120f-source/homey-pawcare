# BottomCta E2E tests (Playwright)

These tests verify safe-area handling and scroll-driven hide/show on iOS
and Android viewports.

## Setup

```bash
npm i -D @playwright/test
npx playwright install
```

## Run

```bash
# Against local dev server (auto-started by Playwright)
npx playwright test

# Against an already-running preview / deployed URL
E2E_BASE_URL=https://homey-pawcare.lovable.app npx playwright test

# Override the page that renders the CTA
E2E_CTA_PATH=/booking npx playwright test
```

## Coverage

- iPhone 13 (iOS Safari emulation) and Pixel 7 (Android Chrome emulation)
- Safe-area: CTA stays inside the viewport, padding-bottom ≥ 12px
- Scroll down → `data-state=hidden`, scroll up → `data-state=visible`
- Near top of page → always visible
- Hidden state produces a non-identity CSS transform (animation present)
