import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { lazyTracked } from "@/lib/chunkRecovery";
import AIChatWidget from "@/components/AIChatWidget";
import RoleGuard from "@/components/RoleGuard";

// Community-adjacent routes are marked critical: a chunk-load failure on these
// triggers the global capped reload flow so future community additions inherit
// the same recovery behavior automatically.
const CommunityPage = lazyTracked("路由 CommunityPage", () => import("./pages/CommunityPage"), { critical: true });
const PostDetailPage = lazyTracked("路由 PostDetailPage", () => import("./pages/PostDetailPage"), { critical: true });
const CharityFootprintPage = lazyTracked("路由 CharityFootprintPage", () => import("./pages/CharityFootprintPage"), { critical: true });

// Other routes get tracking only (visible in the status widget) without
// auto-reload, to avoid surprise reloads on rarely-used screens.
const BookingPage = lazyTracked("路由 BookingPage", () => import("./pages/BookingPage"));
const AuthPage = lazyTracked("路由 AuthPage", () => import("./pages/AuthPage"));
const ProfilePage = lazyTracked("路由 ProfilePage", () => import("./pages/ProfilePage"));
const ShopPage = lazyTracked("路由 ShopPage", () => import("./pages/ShopPage"));
const CustomerServicePage = lazyTracked("路由 CustomerServicePage", () => import("./pages/CustomerServicePage"));
const PaymentPage = lazyTracked("路由 PaymentPage", () => import("./pages/PaymentPage"));
const OrderDetailPage = lazyTracked("路由 OrderDetailPage", () => import("./pages/OrderDetailPage"));
const ProductDetailPage = lazyTracked("路由 ProductDetailPage", () => import("./pages/ProductDetailPage"));
const MerchantAppealPage = lazyTracked("路由 MerchantAppealPage", () => import("./pages/MerchantAppealPage"));
const PetHotelPage = lazyTracked("路由 PetHotelPage", () => import("./pages/PetHotelPage"));
const HotelDetailPage = lazyTracked("路由 HotelDetailPage", () => import("./pages/HotelDetailPage"));
const PointsCenterPage = lazyTracked("路由 PointsCenterPage", () => import("./pages/PointsCenterPage"));
const MerchantCenterPage = lazyTracked("路由 MerchantCenterPage", () => import("./pages/MerchantCenterPage"));
const MerchantApplyPage = lazyTracked("路由 MerchantApplyPage", () => import("./pages/MerchantApplyPage"));
const MerchantAdminPage = lazyTracked("路由 MerchantAdminPage", () => import("./pages/MerchantAdminPage"));
const DriverApplyPage = lazyTracked("路由 DriverApplyPage", () => import("./pages/DriverApplyPage"));
const SitterApplyPage = lazyTracked("路由 SitterApplyPage", () => import("./pages/SitterApplyPage"));
const GroomerApplyPage = lazyTracked("路由 GroomerApplyPage", () => import("./pages/GroomerApplyPage"));
const PetProfilesPage = lazyTracked("路由 PetProfilesPage", () => import("./pages/PetProfilesPage"));
const TripRatingPage = lazyTracked("路由 TripRatingPage", () => import("./pages/TripRatingPage"));
const TripTrackingPage = lazyTracked("路由 TripTrackingPage", () => import("./pages/TripTrackingPage"));
const OrderHistoryPage = lazyTracked("路由 OrderHistoryPage", () => import("./pages/OrderHistoryPage"));
const GroupBookingPage = lazyTracked("路由 GroupBookingPage", () => import("./pages/GroupBookingPage"));
const WorkerDashboardPage = lazyTracked("路由 WorkerDashboardPage", () => import("./pages/WorkerDashboardPage"));
const AdminReviewPage = lazyTracked("路由 AdminReviewPage", () => import("./pages/AdminReviewPage"));
const RoleSwitchPage = lazyTracked("路由 RoleSwitchPage", () => import("./pages/RoleSwitchPage"));
const AdminDashboardPage = lazyTracked("路由 AdminDashboardPage", () => import("./pages/admin/AdminDashboardPage"));
const AdminApplicationsPage = lazyTracked("路由 AdminApplicationsPage", () => import("./pages/admin/AdminApplicationsPage"));
const AdminCommissionPage = lazyTracked("路由 AdminCommissionPage", () => import("./pages/admin/AdminCommissionPage"));
const AdminRevenuePage = lazyTracked("路由 AdminRevenuePage", () => import("./pages/admin/AdminRevenuePage"));
const AdminWithdrawalsPage = lazyTracked("路由 AdminWithdrawalsPage", () => import("./pages/admin/AdminWithdrawalsPage"));
const AdminAuditLogPage = lazyTracked("路由 AdminAuditLogPage", () => import("./pages/admin/AdminAuditLogPage"));
const WithdrawPage = lazyTracked("路由 WithdrawPage", () => import("./pages/WithdrawPage"));
const AddressBookPage = lazyTracked("路由 AddressBookPage", () => import("./pages/AddressBookPage"));
const WalletPage = lazyTracked("路由 WalletPage", () => import("./pages/WalletPage"));
const ProviderEarningsPage = lazyTracked("路由 ProviderEarningsPage", () => import("./pages/ProviderEarningsPage"));

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
            <Route path="/pet-hotel/:id" element={<HotelDetailPage />} />
            <Route path="/points" element={<PointsCenterPage />} />
            <Route path="/post/:id" element={<PostDetailPage />} />
            <Route path="/charity-footprint" element={<CharityFootprintPage />} />
            <Route path="/merchant" element={<MerchantCenterPage />} />
            <Route path="/merchant/apply" element={<MerchantApplyPage />} />
            <Route path="/merchant/admin" element={<RoleGuard allow={["admin"]}><MerchantAdminPage /></RoleGuard>} />
            <Route path="/driver/apply" element={<DriverApplyPage />} />
            <Route path="/sitter/apply" element={<SitterApplyPage />} />
            <Route path="/groomer/apply" element={<GroomerApplyPage />} />
            <Route path="/pets" element={<PetProfilesPage />} />
            <Route path="/rate/:id" element={<TripRatingPage />} />
            <Route path="/track/:id" element={<TripTrackingPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/group-booking" element={<GroupBookingPage />} />
            <Route path="/worker" element={<RoleGuard allow={["sitter","groomer","driver"]}><WorkerDashboardPage /></RoleGuard>} />
            <Route path="/admin/review" element={<RoleGuard allow={["admin"]}><AdminReviewPage /></RoleGuard>} />
            <Route path="/admin" element={<RoleGuard allow={["admin"]}><AdminDashboardPage /></RoleGuard>} />
            <Route path="/admin/applications" element={<RoleGuard allow={["admin"]}><AdminApplicationsPage /></RoleGuard>} />
            <Route path="/admin/commission" element={<RoleGuard allow={["admin"]}><AdminCommissionPage /></RoleGuard>} />
            <Route path="/admin/revenue" element={<RoleGuard allow={["admin"]}><AdminRevenuePage /></RoleGuard>} />
            <Route path="/admin/withdrawals" element={<RoleGuard allow={["admin"]}><AdminWithdrawalsPage /></RoleGuard>} />
            <Route path="/admin/audit" element={<RoleGuard allow={["admin"]}><AdminAuditLogPage /></RoleGuard>} />
            <Route path="/worker/withdraw" element={<RoleGuard allow={["sitter","groomer","driver"]}><WithdrawPage /></RoleGuard>} />
            <Route path="/roles" element={<RoleSwitchPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <AIChatWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
