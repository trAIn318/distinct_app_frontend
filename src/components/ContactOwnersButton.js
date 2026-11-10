"use client";

/**
 * ContactOwnersButton
 * CTA de contacto con los 3 owners que NO obliga a ningun proveedor de correo.
 *
 * Antes estos botones eran un enlace directo al composer web de Outlook. A
 * quien no tiene cuenta Microsoft —la mayoria de los visitantes— le aparecia
 * la pantalla de login de Microsoft en lugar de un correo listo para enviar,
 * y lo mas probable es que cerrara la pestaña sin que nosotros lo supieramos.
 *
 * Ahora el boton abre un menu con los tres caminos y la persona elige:
 *   - su propia aplicacion de correo (mailto:, sirva lo que tenga configurado)
 *   - Gmail en el navegador
 *   - Outlook en el navegador
 *
 * Patron ARIA: disclosure (boton + aria-expanded), NO role="menu". Un menu
 * ARIA es para comandos de aplicacion y obliga a navegacion con flechas;
 * esto son tres enlaces, y asi el Tab del navegador ya funciona solo.
 *
 * El mailto va SIN target="_blank" a proposito: abrir un mailto en pestaña
 * nueva deja una pestaña en blanco colgando en varios navegadores.
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  buildOwnersMailto,
  buildOwnersGmailCompose,
  buildOwnersOutlookCompose,
} from "../lib/config";
import { useT } from "../i18n/client";
import styles from "./ContactOwnersButton.module.css";

// Alto aproximado del menu (titulo + 3 opciones + padding). Solo se usa para
// decidir si abre hacia abajo o hacia arriba; no hace falta que sea exacto.
const ALTO_APROXIMADO = 200;

export default function ContactOwnersButton({
  subject,
  body,
  label,
  className = "btn-ghost",
}) {
  const t = useT("contactOwners");
  const [abierto, setAbierto] = useState(false);
  const [colocacion, setColocacion] = useState("down");
  const caja = useRef(null);
  const tituloId = useId();

  // Cerrar con Escape o al hacer clic afuera. Solo se escucha mientras esta
  // abierto: nada queda enganchado al documento el resto del tiempo.
  useEffect(() => {
    if (!abierto) return;

    function alTeclear(evento) {
      if (evento.key === "Escape") setAbierto(false);
    }
    function alClicAfuera(evento) {
      if (caja.current && !caja.current.contains(evento.target)) {
        setAbierto(false);
      }
    }

    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alClicAfuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alClicAfuera);
    };
  }, [abierto]);

  // El CTA de las tarjetas de curso esta al fondo de la tarjeta: si el menu
  // se abriera siempre hacia abajo, en la ultima fila se saldria de la
  // pantalla. Se mide al abrir, que es cuando se sabe donde quedo el boton.
  function abrir() {
    const marco = caja.current?.getBoundingClientRect();
    if (marco) {
      const espacioDebajo = window.innerHeight - marco.bottom;
      setColocacion(espacioDebajo < ALTO_APROXIMADO ? "up" : "down");
    }
    setAbierto(true);
  }

  const opciones = [
    {
      id: "propio",
      etiqueta: t("ownApp"),
      href: buildOwnersMailto(subject, body),
      enPestañaNueva: false,
    },
    {
      id: "gmail",
      etiqueta: t("gmail"),
      href: buildOwnersGmailCompose(subject, body),
      enPestañaNueva: true,
    },
    {
      id: "outlook",
      etiqueta: t("outlook"),
      href: buildOwnersOutlookCompose(subject, body),
      enPestañaNueva: true,
    },
  ];

  return (
    <div className={styles.wrapper} ref={caja}>
      <button
        type="button"
        className={className}
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
      >
        {label}
      </button>

      {abierto && (
        <div className={styles.popover} data-placement={colocacion}>
          <p id={tituloId} className={styles.heading}>
            {t("chooseTitle")}
          </p>
          <ul className={styles.options} aria-labelledby={tituloId}>
            {opciones.map((opcion) => (
              <li key={opcion.id}>
                <a
                  href={opcion.href}
                  className={styles.option}
                  onClick={() => setAbierto(false)}
                  {...(opcion.enPestañaNueva
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {opcion.etiqueta}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
