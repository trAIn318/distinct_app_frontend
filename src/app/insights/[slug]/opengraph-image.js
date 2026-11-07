/**
 * Imagen social 1200x630 por paper (FR-9 de la ficha).
 *
 * Se genera al vuelo en vez de pedir un archivo por paper: así cada publicación
 * nueva tiene su tarjeta de marca sin que nadie abra un editor de imágenes.
 *
 * Nota: aquí NO se usan las fuentes de la marca (Cormorant, DM Sans). El
 * generador de imágenes necesita el archivo de la fuente cargado a mano, y
 * `next/font` las resuelve en el navegador, no acá. La tarjeta mantiene el
 * color y la composición de la marca con la tipografía del sistema. Cargar los
 * .woff de Google es el paso pendiente si se quiere fidelidad total.
 */
import { ImageResponse } from "next/og";
import { getPaperBySlug } from "../../../lib/insights";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Distinct Insights";

// Tokens de claude.md §2.1. Se repiten como literales porque este archivo se
// renderiza fuera del DOM y no puede leer las variables CSS.
const OBSIDIAN = "#0A0A0A";
const IVORY = "#F7F4EF";
const GOLD = "#C9A96E";
const SMOKE = "#6E6E73";

export default async function OgImage({ params }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);

  const titulo = paper?.title || "Distinct Insights";
  const autor = paper?.author ? `By ${paper.author}` : "";
  const etiqueta = paper?.label || "Distinct Insights";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OBSIDIAN,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            {etiqueta}
          </div>
          <div style={{ width: 96, height: 1, background: GOLD, marginTop: 28 }} />
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titulo.length > 60 ? 64 : 78,
            lineHeight: 1.1,
            color: IVORY,
            maxWidth: 1000,
          }}
        >
          {titulo}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 24,
            color: SMOKE,
          }}
        >
          <span>{autor}</span>
          <span style={{ letterSpacing: 3, textTransform: "uppercase" }}>
            Distinct Hospitality Solutions
          </span>
        </div>
      </div>
    ),
    size
  );
}
