import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import RoleGuard from "./RoleGuard";

const authState: { user: any; loading: boolean } = { user: { id: "u1" }, loading: false };
const rolesState: { roles: string[]; loading: boolean } = { roles: ["user"], loading: false };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));
vi.mock("@/hooks/useUserRoles", () => ({
  useUserRoles: () => rolesState,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const LocationProbe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

const renderAt = (path: string, allow: any[]) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RoleGuard allow={allow}>
              <div>secret</div>
            </RoleGuard>
          }
        />
        <Route path="/roles" element={<LocationProbe />} />
        <Route path="/auth" element={<div>login</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  authState.user = { id: "u1" };
  authState.loading = false;
  rolesState.roles = ["user"];
  rolesState.loading = false;
});

describe("RoleGuard", () => {
  it("renders children when role is allowed", () => {
    rolesState.roles = ["sitter"];
    renderAt("/protected", ["sitter"]);
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("redirects unauthorized user to /roles with highlight + from", async () => {
    rolesState.roles = ["user"];
    renderAt("/protected?x=1", ["sitter"]);
    await waitFor(() => {
      const loc = screen.getByTestId("loc").textContent ?? "";
      expect(loc).toContain("/roles");
      expect(loc).toContain("highlight=sitter");
      expect(loc).toContain("from=" + encodeURIComponent("/protected?x=1"));
    });
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("redirects to /auth when unauthenticated", () => {
    authState.user = null;
    renderAt("/protected", ["sitter"]);
    expect(screen.getByText("login")).toBeInTheDocument();
  });
});
