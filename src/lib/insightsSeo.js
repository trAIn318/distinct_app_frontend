/**
 * src/lib/insightsSeo.js — datos estructurados JSON-LD del centro de white
 * papers (sección 6 de la ficha).
 *
 * Esto es lo que permite que Google muestre el paper como resultado
 * enriquecido. Si sale mal no hay error visible: la página se ve igual y el
 * resultado simplemente nunca aparece. De ahí que esté probado.
 *
 * Regla que atraviesa todo el archivo: JSON-LD solo acepta URLs ABSOLUTAS.
 */
import { CONTACT_EMAIL, SITE_URL } from "./config";

export { SITE_URL };

export const ORGANIZATION_NAME = "Distinct Hospitality Solutions";
export const ORGANIZATION_LOGO = `${SITE_URL}/img/logo_cropped.png`;

export function paperUrl(slug) {
  return `${SITE_URL}/insights/${slug}`;
}

/**
 * Identidad de la empresa. Ya NO es solo del centro de white papers: la emite
 * tambien la portada, via el componente `OrganizationSchema`. La definicion
 * vive aqui porque dos definiciones serian dos identidades.
 *
 * `email` y `contactPoint` son la respuesta a "cual es su correo de contacto"
 * en terminos que una maquina entiende. Sin ellos, cambiar el destino del
 * formulario en el backend no publica nada: la direccion no aparece en ninguna
 * parte que alguien de afuera pueda leer.
 *
 * `sameAs` (LinkedIn, Instagram) y la dirección de Miami que pide la sección 8
 * de la ficha NO se incluyen todavía: no los tenemos. Un `sameAs` con un perfil
 * equivocado le afirma a Google que ese perfil es este negocio, así que vale
 * más omitirlo que adivinarlo. Se agregan cuando lleguen los enlaces reales.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZATION_NAME,
    url: SITE_URL,
    logo: ORGANIZATION_LOGO,
    email: CONTACT_EMAIL,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_EMAIL,
      // El sitio atiende en los dos idiomas en los que esta escrito.
      availableLanguage: ["en", "es"],
    },
  };
}

export function articleSchema(paper) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: paper.title,
    description: paper.metaDescription,
    url: paperUrl(paper.slug),
    mainEntityOfPage: paperUrl(paper.slug),
    datePublished: paper.publishDate,
    // Sin fecha de actualización, Google toma la de publicación. Repetirla es
    // correcto y evita un dateModified vacío, que sí es un error.
    dateModified: paper.updatedDate || paper.publishDate,
    // El nombre tiene que ser EL MISMO que el byline visible de la página: si
    // difieren, Google no empareja el dato con lo que lee en el artículo.
    author: {
      "@type": "Person",
      name: paper.author,
      ...(paper.authorRole ? { jobTitle: paper.authorRole } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: ORGANIZATION_NAME,
      logo: { "@type": "ImageObject", url: ORGANIZATION_LOGO },
    },
    ...(paper.coverImage ? { image: `${SITE_URL}${paper.coverImage}` } : {}),
  };
}

/** Devuelve null si no hay preguntas: un FAQPage vacío es inválido. */
export function faqSchema(paper) {
  const preguntas = paper.faq || [];
  if (preguntas.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: preguntas.map((p) => ({
      "@type": "Question",
      name: p.question,
      acceptedAnswer: { "@type": "Answer", text: p.answer },
    })),
  };
}

export function breadcrumbSchema(paper) {
  const migas = [
    { name: "Home", item: SITE_URL },
    { name: "Insights", item: `${SITE_URL}/insights` },
    { name: paper.title, item: paperUrl(paper.slug) },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((miga, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: miga.name,
      item: miga.item,
    })),
  };
}
