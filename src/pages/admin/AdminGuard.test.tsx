import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";

const authState: { user: any; loading: boolean } = { user: { id: "u1" }, loading: false };
const rolesState: { roles: string[]; loading: boolean } = { roles: ["user"], loading: false };

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/useUserRoles", () => ({ useUserRoles: () => rolesState }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const Probe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

const ADMIN_PATHS = [
  "/admin",
  "/admin/applications",
  "/admin/commission",
  "/admin/revenue",
  "/admin/withdrawals",
  "/admin/audit",
];

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<RoleGuard allow={["admin"]}><div>admin-content</div></RoleGuard>} />
        <Route path="/roles" element={<Probe />} />
        <Route path="/auth" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("Admin route guard (non-admin denied)", () => {
  beforeEach(() => {
    authState.user = { id: "u1" };
    authState.loading = false;
    rolesState.roles = ["user"];
    rolesState.loading = false;
  });

  ADMIN_PATHS.forEach((p) => {
    it(`redirects non-admin away from ${p} and never renders admin content`, async () => {
      rolesState.roles = ["user", "driver", "merchant"]; // explicitly NOT admin
      renderAt(p);
      await waitFor(() => {
        const loc = screen.getByTestId("loc").textContent ?? "";
        expect(loc).toContain("/roles");
        expect(loc).toContain("highlight=admin");
        expect(loc).toContain("from=" + encodeURIComponent(p));
      });
      expect(screen.queryByText("admin-content")).toBeNull();
    });
  });

  it("redirects to /auth when unauthenticated", () => {
    authState.user = null;
    renderAt("/admin");
    expect(screen.getByText("login")).toBeInTheDocument();
    expect(screen.queryByText("admin-content")).toBeNull();
  });

  it("renders content for admin role", () => {
    rolesState.roles = ["admin"];
    renderAt("/admin/withdrawals");
    expect(screen.getByText("admin-content")).toBeInTheDocument();
  });
});
