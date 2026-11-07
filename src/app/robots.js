/**
 * src/app/robots.js — /robots.txt
 *
 * El sitio tampoco tenía robots.txt. Sección 7 de la ficha.
 *
 * Los PDF se bloquean a propósito aunque sean de descarga libre: si Google
 * indexa el PDF, ese PDF compite en resultados con la página del paper, que es
 * la que tiene que posicionar y la que lleva al resto del sitio. Bloquear el
 * PDF no impide descargarlo, solo que aparezca como resultado.
 */
import { SITE_URL } from "../lib/config";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/login",
        "/register",
        "/forgot-password",
        "/accept-invitation",
        "/account/",
        "/dashboard/",
        "/settings/",
        "/moodle-launch",
        "/insights/pdf/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
