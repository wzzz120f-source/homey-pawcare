import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import RoleSwitchPage from "./RoleSwitchPage";

const rolesState: { activeRole: string; availableRoles: string[]; setActiveRole: any; loading: boolean } = {
  activeRole: "user",
  availableRoles: ["user"],
  setActiveRole: vi.fn(),
  loading: false,
};

vi.mock("@/hooks/useUserRoles", () => ({
  useUserRoles: () => rolesState,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const scrollIntoViewMock = vi.fn();
beforeEach(() => {
  scrollIntoViewMock.mockClear();
  (Element.prototype as any).scrollIntoView = scrollIntoViewMock;
  rolesState.activeRole = "user";
  rolesState.availableRoles = ["user"];
  rolesState.setActiveRole = vi.fn();
});

const Probe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/roles${search}`]}>
      <Routes>
        <Route path="/roles" element={<RoleSwitchPage />} />
        <Route path="/sitter/apply" element={<Probe />} />
        <Route path="/worker" element={<Probe />} />
        <Route path="/protected" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("RoleSwitchPage", () => {
  it("highlights requested role and scrolls into view", async () => {
    renderAt("?highlight=sitter&from=/protected");
    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalledTimes(1));
    expect(scrollIntoViewMock.mock.calls[0][0]).toMatchObject({ block: "center" });
    // banner shows the requested role
    expect(screen.getByRole("status").textContent).toContain("宠托师");
    expect(screen.getByRole("status").textContent).toContain("/protected");
  });

  it("unauthorized role click navigates to applyPath with return param", async () => {
    renderAt("?highlight=sitter&from=/protected");
    fireEvent.click(screen.getByRole("button", { name: /宠托师/ }));
    await waitFor(() => {
      const loc = screen.getByTestId("loc").textContent ?? "";
      expect(loc).toContain("/sitter/apply");
      expect(loc).toContain("return=");
    });
  });

  it("authorized role switch navigates back to from", async () => {
    rolesState.availableRoles = ["user", "sitter"];
    renderAt("?highlight=sitter&from=/protected");
    fireEvent.click(screen.getByRole("button", { name: /宠托师/ }));
    await waitFor(() => {
      expect(rolesState.setActiveRole).toHaveBeenCalledWith("sitter");
      expect(screen.getByTestId("loc").textContent).toContain("/protected");
    });
  });
});
