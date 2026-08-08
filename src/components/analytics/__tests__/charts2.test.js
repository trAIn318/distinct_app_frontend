import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SalesByWeekdayChart from "../SalesByWeekdayChart";
import TrafficTrendChart from "../TrafficTrendChart";

afterEach(cleanup);

describe("charts2", () => {
  it("SalesByWeekdayChart monta con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesByWeekdayChart data={[{ label: "Sun", net: 100 }, { label: "Mon", net: 50 }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("TrafficTrendChart monta con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <TrafficTrendChart
          data={[{ date: "2026-05-06", order_count: 10, guest_count: 15 }]}
          ordersLabel="Orders" guestsLabel="Guests"
        />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("no rompen con datos vacíos", () => {
    render(<SalesByWeekdayChart data={[]} />);
    render(<TrafficTrendChart data={[]} ordersLabel="O" guestsLabel="G" />);
  });
});
