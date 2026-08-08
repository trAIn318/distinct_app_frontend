import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const isAuthenticated = vi.fn();
vi.mock("../../../../../lib/session", () => ({ isAuthenticated: (...a) => isAuthenticated(...a) }));

const getProperties = vi.fn();
const createProperty = vi.fn();
const updateProperty = vi.fn();
vi.mock("../../../../../lib/api", () => ({
  getProperties: (...a) => getProperties(...a),
  createProperty: (...a) => createProperty(...a),
  updateProperty: (...a) => updateProperty(...a),
}));

import PropertiesClient from "../PropertiesClient";

afterEach(cleanup);
beforeEach(() => {
  replace.mockClear();
  isAuthenticated.mockReset(); getProperties.mockReset();
  createProperty.mockReset(); updateProperty.mockReset();
});

describe("PropertiesClient", () => {
  it("redirige a login sin sesión", () => {
    isAuthenticated.mockReturnValue(false);
    render(<PropertiesClient />);
    expect(replace).toHaveBeenCalledWith("/login?next=/dashboard/analytics/properties");
  });

  it("lista propiedades y permite desactivar", async () => {
    isAuthenticated.mockReturnValue(true);
    getProperties
      .mockResolvedValueOnce([{ id: 1, name: "Rooftop", currency: "USD", active: true, comp_id: 1, company_name: "Distinct" }])
      .mockResolvedValueOnce([{ id: 1, name: "Rooftop", currency: "USD", active: false, comp_id: 1, company_name: "Distinct" }]);
    updateProperty.mockResolvedValue({ property: { id: 1, name: "Rooftop", currency: "USD", active: false } });
    render(<PropertiesClient />);
    await waitFor(() => expect(screen.getByText("Rooftop")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /deactivate|desactivar/i }));
    await waitFor(() => expect(updateProperty).toHaveBeenCalledWith(1, { active: false }));
  });
});
