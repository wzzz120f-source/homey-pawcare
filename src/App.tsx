import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const BookingPage = lazy(() => import("./pages/BookingPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const CustomerServicePage = lazy(() => import("./pages/CustomerServicePage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const MerchantAppealPage = lazy(() => import("./pages/MerchantAppealPage"));
const PetHotelPage = lazy(() => import("./pages/PetHotelPage"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/stores" element={<BookingPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/customer-service" element={<CustomerServicePage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/order/:id" element={<OrderDetailPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/merchant-appeal" element={<MerchantAppealPage />} />
            <Route path="/pet-hotel" element={<PetHotelPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
