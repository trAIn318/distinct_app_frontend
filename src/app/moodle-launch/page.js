import { Suspense } from "react";
import MoodleLaunchClient from "./MoodleLaunchClient";

export const metadata = {
  title: "Redirecting… | Distinct Hospitality Solutions",
  robots: { index: false, follow: false },
};

// Ruta puente para el SSO de Moodle. Al ser una URL navegable, TODOS los tipos
// de click sobre un curso (izquierdo, central/rueda, Ctrl, derecho→nueva pestaña)
// funcionan de forma nativa: cada pestaña resuelve su propio SSO y aterriza en el
// curso. useSearchParams exige un límite de Suspense.
export default function MoodleLaunchPage() {
  return (
    <Suspense fallback={null}>
      <MoodleLaunchClient />
    </Suspense>
  );
}
