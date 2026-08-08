import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SalesTrendChart from "../SalesTrendChart";
import SalesByPropertyChart from "../SalesByPropertyChart";

afterEach(cleanup);

describe("charts", () => {
  it("SalesTrendChart monta sin romper con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesTrendChart data={[{ date: "2026-05-06", net_sales: "100.00" }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("SalesByPropertyChart monta sin romper con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesByPropertyChart data={[{ property_name: "P1", net_sales: "100.00" }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("no rompe con datos vacíos", () => {
    render(<SalesTrendChart data={[]} />);
    render(<SalesByPropertyChart data={[]} />);
  });
});
