/**
 * src/lib/courseText.js
 * Selección del contenido de curso según el idioma de la UI.
 *
 * El API devuelve title/description en todos los idiomas soportados
 * (title_en, title_es, …) con fallback al original ya resuelto en el
 * backend. Aquí solo elegimos la variante del locale activo.
 */

export function getCourseTitle(course, locale) {
  return course?.[`title_${locale}`] || course?.title || "";
}

export function getCourseDescription(course, locale) {
  return course?.[`description_${locale}`] || course?.description || "";
}
