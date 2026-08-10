import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SalesByMonthChart from "../SalesByMonthChart";

afterEach(cleanup);

describe("SalesByMonthChart", () => {
  it("monta con datos", () => {
    const { container } = render(
      <div style={{ width: 600, height: 300 }}>
        <SalesByMonthChart data={[{ month: "2026-04", net: 100 }, { month: "2026-05", net: 250 }]} />
      </div>
    );
    expect(container).toBeTruthy();
  });
  it("no rompe con datos vacíos", () => {
    render(<SalesByMonthChart data={[]} />);
  });
});
