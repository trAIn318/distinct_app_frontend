/**
 * La pagina de detalle de un curso ("Ver mas") tiene que PINTARSE.
 *
 * Existe porque el bug real no se veia en ningun otro sitio: al cambiar los CTA
 * de Outlook por el boton de eleccion quedaron dos `href={payUrl}` /
 * `href={interestUrl}` apuntando a variables que ya no existian. El build no lo
 * caza (la ruta es dinamica, nunca se prerenderiza) y el lint tampoco
 * (no-undef no esta activo), asi que el ReferenceError solo aparecia al abrir
 * la pagina en produccion: HTTP 500.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const CURSO = {
  id: 2,
  title: "Bartender",
  code: "BTR",
  description: "Real world bartending experience.",
  image_url: "bartender.jpg",
  video_url: "https://youtu.be/IWs2NZpQPQE",
  modules: 4,
  original_language: "en",
  level: "beginner",
  title_en: "Bartender",
  description_en: "Real world bartending experience.",
};

vi.mock("../../../../lib/api", () => ({
  getCourse: vi.fn(async () => CURSO),
  getReviews: vi.fn(async () => []),
}));

afterEach(cleanup);

async function pintar(id = "2") {
  const { default: CourseDetailPage } = await import("../page");
  // Un server component async: se ejecuta y se pinta lo que devuelve.
  render(await CourseDetailPage({ params: Promise.resolve({ id }) }));
}

describe("detalle de curso", () => {
  it("se pinta completa, con el CTA del pie incluido", async () => {
    await pintar();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Bartender");
    // El CTA del pie es justo donde estaban las variables inexistentes.
    expect(screen.getAllByText("Enroll & Pay").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("I'm Interested").length).toBeGreaterThanOrEqual(2);
  });

  it("ningun CTA de la pagina manda a Outlook ni a un href vacio", async () => {
    const { container } = render(
      await (await import("../page")).default({ params: Promise.resolve({ id: "2" }) })
    );

    expect(container.querySelectorAll('a[href*="outlook.office.com"]')).toHaveLength(0);
    for (const a of container.querySelectorAll("a")) {
      expect(a.getAttribute("href")).toBeTruthy();
    }
  });
});
