import type { Translation } from "./zh";

const en: Translation = {
  common: {
    back: "Back",
    retry: "Retry",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    saveDraft: "Save draft",
    customerService: "Talk to support",
    copy: "Copy",
    copied: "Error details copied",
    copyFailed: "Copy failed, please select the text manually",
    language: "Language",
  },
  language: {
    zh: "中文",
    en: "English",
  },
  booking: {
    title: "Booking details",
    pickupTab: "Pet pickup",
    homeTab: "At-home service",
    storeTab: "In-store boarding",
    pickupAddress: "Pickup & dropoff",
    pickupSection: "Choose a pickup option",
    submit: "Confirm booking",
    addressSummary: "Address summary",
  },
  errors: {
    title: "Something went wrong",
    subtitle:
      "Please follow the hints below to retry. If the issue persists, contact support and attach the error details.",
    addressSearch: {
      label: "Address search failed",
      hint: "We couldn't resolve that address. Check the spelling or try a different keyword.",
    },
    routePlanning: {
      label: "Route planning failed",
      hint: "Amap route planning returned an error. We estimated the base fare; please retry shortly.",
    },
    orderSubmit: {
      label: "Order submission failed",
      hint: "Booking service is temporarily unavailable. Please retry or contact support.",
    },
    aiAdvice: {
      rateLimit: "Too many requests — showing offline fallback advice.",
      credit: "AI credits exhausted — showing offline fallback advice.",
      offline: "AI is temporarily unavailable — showing offline fallback advice.",
    },
    retryAction: "Retry",
    copyDetails: "Copy error details",
    detailsLabel: "Error details",
  },
};

export default en;
