import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

const rolesState: { activeRole: string } = { activeRole: "groomer" };

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useUserRoles", () => ({ useUserRoles: () => rolesState }));
vi.mock("@/hooks/useGroomerLevel", () => ({
  useGroomerLevel: () => ({ level: "junior", setLevel: vi.fn(), loading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/BottomNav", () => ({ default: () => <div data-testid="bottom-nav" /> }));
vi.mock("@/components/RoleSwitcher", () => ({ default: () => <div /> }));
vi.mock("@/components/CompanionReportGenerator", () => ({ default: () => <div /> }));
vi.mock("@/components/HealthAssessmentForm", () => ({ default: () => <div /> }));
vi.mock("@/integrations/supabase/client", () => {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: [], error: null }),
    gte: () => builder,
  };
  return { supabase: { from: () => builder } };
});

import WorkerDashboardPage from "./WorkerDashboardPage";

const Probe = () => {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
};

beforeEach(() => {
  rolesState.activeRole = "groomer";
});

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/worker${search}`]}>
      <Routes>
        <Route path="/worker" element={<><WorkerDashboardPage /><Probe /></>} />
      </Routes>
    </MemoryRouter>,
  );

describe("WorkerDashboardPage tab self-correction", () => {
  it("rewrites invalid tab for groomer to default 'services' while preserving other params", async () => {
    renderAt("?tab=route&date=2026-05-09");
    await waitFor(() => {
      const loc = screen.getByTestId("loc").textContent ?? "";
      expect(loc).toContain("tab=services");
      expect(loc).toContain("date=2026-05-09");
    });
  });

  it("keeps valid tab unchanged for sitter", async () => {
    rolesState.activeRole = "sitter";
    renderAt("?tab=schedule");
    // give effect a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByTestId("loc").textContent).toContain("tab=schedule");
  });

  it("rewrites invalid tab for driver to 'route'", async () => {
    rolesState.activeRole = "driver";
    renderAt("?tab=services");
    await waitFor(() => {
      expect(screen.getByTestId("loc").textContent).toContain("tab=route");
    });
  });
});
