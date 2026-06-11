/**
 * HomeTestimonials
 * Carrusel de testimonios para la home, justo debajo de Featured Courses.
 * Server component: fetchea en SSR. El backend ya devuelve todos los
 * testimonios en inglés (traduce y cachea los que estén en otro idioma,
 * y omite los intraducibles).
 *
 * Si el backend no responde o no hay testimonios, la sección no se
 * renderiza (mismo patrón que FeaturedCourses).
 */

import { getReviews } from "../lib/api";
import TestimonialsCarousel from "./TestimonialsCarousel";

export default async function HomeTestimonials() {
  const testimonials = await getReviews({ limit: 8 }).catch(() => []);

  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  return (
    <TestimonialsCarousel
      testimonials={testimonials}
      eyebrow="What our learners say"
      title="Voices from the Floor"
    />
  );
}
