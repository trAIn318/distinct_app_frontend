import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ReactiveImage from "../ReactiveImage";

// next/image → <img> simple en test
vi.mock("next/image", () => ({
  default: (props) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

afterEach(cleanup);

describe("ReactiveImage", () => {
  it("renders an image with the given alt and src", () => {
    render(<ReactiveImage src="/img/courses/frontdesk.jpeg" alt="Front Desk" ratio="4:3" />);
    const img = screen.getByAltText("Front Desk");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toContain("frontdesk");
  });

  it("exposes effect=none to disable the duotone (data attribute)", () => {
    const { container } = render(
      <ReactiveImage src="/x.jpg" alt="x" effect="none" />
    );
    const figure = container.querySelector("figure");
    expect(figure.getAttribute("data-effect")).toBe("none");
  });

  it("sets a CSS variable for the tint opacity override", () => {
    const { container } = render(
      <ReactiveImage src="/x.jpg" alt="x" tintOpacity={0.2} />
    );
    const figure = container.querySelector("figure");
    expect(figure.getAttribute("style")).toContain("0.2");
  });
});
