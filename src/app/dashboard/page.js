"use client";

/**
 * /dashboard ya no es una página de contenido: el tablero vive en el
 * desplegable de la barra. Esta ruta redirige a la home y dispara el evento
 * que abre el Tablero, para no romper marcadores ni enlaces antiguos.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    try {
      window.sessionStorage.setItem("distinct:open-dashboard", "1");
    } catch {}
    window.dispatchEvent(new Event("distinct:open-dashboard"));
    router.replace("/");
  }, [router]);
  return null;
}
