import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PetProfilesPage from "./PetProfilesPage";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "driver-1" }, loading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/BottomNav", () => ({ default: () => null }));

const orderResp = { data: null as any };
const petsResp = { data: [] as any[], error: null };
const profileResp = { data: { username: "小明" } };

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const chain: any = {
      select: () => chain, eq: () => chain, order: () => chain,
      maybeSingle: () => Promise.resolve(table === "orders" ? orderResp : profileResp),
      then: (cb: any) => Promise.resolve(table === "pets" ? petsResp : { data: [] }).then(cb),
    };
    return chain;
  };
  return { supabase: { from: (t: string) => builder(t) } };
});

const renderAt = (search: string) =>
  render(<MemoryRouter initialEntries={[`/pets${search}`]}><PetProfilesPage /></MemoryRouter>);

beforeEach(() => { orderResp.data = null; petsResp.data = []; });

describe("PetProfilesPage readonly mode", () => {
  it("shows missing_order fallback when orderId absent", async () => {
    renderAt("?readonly=1");
    await waitFor(() => expect(screen.getByTestId("fallback-missing_order")).toBeInTheDocument());
  });

  it("shows no_permission fallback when driver_id mismatches", async () => {
    orderResp.data = { user_id: "u1", driver_id: "other-driver", order_status: "in_progress", order_no: "X" };
    renderAt("?readonly=1&orderId=o1");
    await waitFor(() => expect(screen.getByTestId("fallback-no_permission")).toBeInTheDocument());
  });

  it("shows ended fallback when order status not active", async () => {
    orderResp.data = { user_id: "u1", driver_id: "driver-1", order_status: "completed", order_no: "X" };
    renderAt("?readonly=1&orderId=o1");
    await waitFor(() => expect(screen.getByTestId("fallback-ended")).toBeInTheDocument());
  });

  it("renders readonly banner and hides edit buttons for valid driver", async () => {
    orderResp.data = { user_id: "u1", driver_id: "driver-1", order_status: "in_progress", order_no: "ORD123" };
    petsResp.data = [{ id: "p1", user_id: "u1", name: "奶茶", pet_type: "dog", breed: null, weight_kg: 5,
      birthday: null, avatar_url: null, vaccinations: [], allergies: [], behavior_notes: [], notes: null,
      auto_share: true, is_default: true }];
    renderAt("?readonly=1&orderId=o1");
    await waitFor(() => expect(screen.getByTestId("readonly-banner")).toBeInTheDocument());
    expect(screen.queryByTestId("pet-edit-btn")).toBeNull();
    expect(screen.queryByTestId("pet-delete-btn")).toBeNull();
    expect(screen.queryByTestId("add-pet-btn")).toBeNull();
  });
});
