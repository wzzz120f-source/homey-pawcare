# BottomCta + Booking E2E (Playwright)

## Setup

```bash
npm i -D @playwright/test
npx playwright install
```

## Run

```bash
# All projects (iPhone SE/12/13/14ProMax + Pixel 5/7 + Galaxy S9+)
npx playwright test

# Single device
npx playwright test --project=iphone-13

# Only one spec
npx playwright test e2e/hotel-room-selection.spec.ts

# Against a deployed URL
E2E_BASE_URL=https://homey-pawcare.lovable.app npx playwright test
```

## Specs

| File | Purpose |
| --- | --- |
| `bottom-cta.spec.ts` | safe-area + scroll hide/show |
| `bottom-cta.gestures.spec.ts` | touch swipe coherence + anti-jitter |
| `bottom-cta.offsets.spec.ts` | numeric / `5rem` / auto-nav offset checks |
| `viewport-layout.spec.ts` | CTA + booking-modal layout across iPhone/Android sizes |
| `pickup-booking.spec.ts` | 接送预约 form fields, validation, submit-button states |
| `booking-modal-scroll.spec.ts` | sticky footer remains clickable after scrolling modal body |
| `hotel-room-selection.spec.ts` | room cards click + keyboard, modal 房型/合计 updates |

Test selectors rely on `data-testid` attributes added in source:
`bottom-cta`, `bottom-cta-shell`, `pickup-address-input`, `dropoff-address-input`,
`room-card-{0..2}`, `modal-room-{0..2}`, `booking-modal-footer`,
`btn-next-confirm`, `btn-submit-booking`.
