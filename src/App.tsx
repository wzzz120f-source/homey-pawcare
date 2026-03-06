import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import BookingPage from "./pages/BookingPage";
import CommunityPage from "./pages/CommunityPage";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import ShopPage from "./pages/ShopPage";
import CustomerServicePage from "./pages/CustomerServicePage";
import PaymentPage from "./pages/PaymentPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
