import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import AnimatedCounter from "../AnimatedCounter";

afterEach(cleanup);

describe("AnimatedCounter", () => {
  it("eventually shows the final formatted value", async () => {
    // duración corta → el conteo completa rápido y de forma determinista en test
    render(<AnimatedCounter value={1248} durationMs={20} />);
    await waitFor(() => expect(screen.getByText("1,248")).toBeInTheDocument());
  });

  it("applies prefix and suffix to the final value", async () => {
    render(<AnimatedCounter value={95} durationMs={20} suffix="%" />);
    await waitFor(() => expect(screen.getByText("95%")).toBeInTheDocument());
  });

  it("renders the final value immediately when reduced motion is preferred", async () => {
    vi.stubGlobal("matchMedia", (q) => ({
      matches: true, media: q, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    }));
    render(<AnimatedCounter value={500} />);
    expect(screen.getByText("500")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
