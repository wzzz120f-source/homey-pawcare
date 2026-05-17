import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import EscrowStatusCard from "./EscrowStatusCard";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [] }),
        }),
      }),
    }),
    rpc: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("EscrowStatusCard", () => {
  it("returns null when escrowStatus is none", () => {
    const { container } = render(
      <EscrowStatusCard orderId="o1" escrowStatus="none" orderStatus="paid" amount={100} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows partial badge and amount breakdown", () => {
    render(
      <EscrowStatusCard
        orderId="o1"
        escrowStatus="released_partial"
        orderStatus="serving"
        amount={100}
        refundAmount={30}
      />,
    );
    expect(screen.getByText(/部分结算/)).toBeInTheDocument();
    expect(screen.getByText(/已退款：¥30/)).toBeInTheDocument();
    expect(screen.getByText(/剩余担保：¥70/)).toBeInTheDocument();
  });

  it("shows refunded label", () => {
    render(
      <EscrowStatusCard orderId="o1" escrowStatus="refunded" orderStatus="cancelled" amount={50} refundAmount={50} />,
    );
    expect(screen.getByText(/已退款/)).toBeInTheDocument();
  });
});
