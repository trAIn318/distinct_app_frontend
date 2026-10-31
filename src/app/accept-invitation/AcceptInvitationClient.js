"use client";

/**
 * AcceptInvitationClient — activar una invitación. PÚBLICA, sin sesión.
 *
 * Es el destino del enlace del correo, y la única pantalla del panel que se
 * abre sin estar autenticado. Hasta que existió, el correo llevaba a un 404.
 *
 * Dos variantes, según lo que responda el backend:
 *   - `kind: "new"`  → contraseña (dos veces) y consentimiento OBLIGATORIO.
 *   - `kind: "join"` → un solo clic: la cuenta ya existe y ya tiene contraseña
 *     y consentimiento. Si aquí se pidiera contraseña, el backend la ignoraría
 *     y la persona habría escrito algo que se descarta en silencio.
 *
 * NO muestra el correo de la invitación: el backend no lo devuelve, a propósito,
 * para no confirmarle a nadie que una dirección fue invitada.
 *
 * Cuando el enlace no sirve hay UNA sola pantalla: el backend responde el mismo
 * 404 para las cuatro causas (inexistente, vencido, cancelado y ya usado) y lo
 * hace por privacidad, así que distinguirlas sería inventar información.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getInvitationInfo, acceptInvitation } from "../../lib/api";
import { saveSession } from "../../lib/session";
import { loadServerPreferences } from "../../lib/preferences";
import { errorMessageFor } from "../../lib/companyAdmin";
import { useT } from "../../i18n/client";
import styles from "./page.module.css";

/** Lo que exige el serializador del backend (min_length=8). Validarlo aqui
 *  evita que la persona reciba un 400 cuyo motivo no se le puede mostrar. */
const MIN_PASSWORD = 8;

const FASE = {
  CARGANDO: "cargando",
  LISTA: "lista",
  ENLACE_MALO: "enlaceMalo",   // el backend dijo 404: el enlace de verdad no sirve
  FALLO_CARGA: "falloCarga",   // no pudimos preguntar: el enlace puede estar bien
};

/** Solo un 404 significa "este enlace no sirve". Un fallo de red, un 429 del
 *  throttle (20/min por IP, COMPARTIDO entre consultar y aceptar: 20 empleados
 *  tras el mismo NAT lo agotan) o un 5xx del servicio despertando NO dicen nada
 *  sobre el enlace, y presentarlos como enlace muerto manda a la persona a
 *  pedir uno nuevo, que es justo lo que no va a arreglarle nada. */
function esEnlaceMuerto(err) {
  return err && err.status === 404;
}

export default function AcceptInvitationClient() {
  const t = useT("companyAdmin");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  // El estado inicial se DERIVA del token, que ya esta disponible al
  // renderizar: fijarlo dentro del efecto provocaba un render en cascada.
  const [fase, setFase] = useState(token ? FASE.CARGANDO : FASE.ENLACE_MALO);
  const [invitacion, setInvitacion] = useState(null);
  const [despertando, setDespertando] = useState(false);
  const [intento, setIntento] = useState(0);

  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [errorCampo, setErrorCampo] = useState(null);
  const [errorEnvio, setErrorEnvio] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Sin token no se consulta nada: el estado inicial ya es el de enlace
    // inválido. Un token basura sí se consulta y el backend responde 404.
    if (!token) return;
    let vigente = true;
    // Mismo gesto que el login: avisar que el servicio puede estar despertando,
    // en vez de dejar a la persona mirando "revisando tu invitación" sin más.
    const avisa = setTimeout(() => {
      if (vigente) setDespertando(true);
    }, 4000);
    (async () => {
      try {
        const info = await getInvitationInfo(token);
        if (!vigente) return;
        setInvitacion(info);
        setFase(FASE.LISTA);
      } catch (err) {
        if (!vigente) return;
        setFase(esEnlaceMuerto(err) ? FASE.ENLACE_MALO : FASE.FALLO_CARGA);
      } finally {
        if (vigente) setDespertando(false);
      }
    })();
    return () => {
      vigente = false;
      clearTimeout(avisa);
    };
  }, [token, intento]);

  // Un `kind` desconocido se trata como CUENTA NUEVA, no como un clic. Elegir
  // mal hacia "nueva" es recuperable -el backend ignora el cuerpo para join-;
  // hacia "join" deja a la persona pulsando un boton que falla sin decir por que.
  const esNueva = Boolean(invitacion) && invitacion.kind !== "join";

  const enviar = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      if (enviando) return;            // doble clic o Enter repetido
      setErrorCampo(null);
      setErrorEnvio(null);

      if (esNueva) {
        if (!password) {
          setErrorCampo({ campo: "password", texto: t("accept.passwordRequired") });
          return;
        }
        if (password.length < MIN_PASSWORD) {
          setErrorCampo({ campo: "password", texto: t("accept.passwordTooShort") });
          return;
        }
        if (password !== confirmacion) {
          setErrorCampo({ campo: "confirmacion", texto: t("accept.passwordMismatch") });
          return;
        }
        if (!acepta) {
          setErrorCampo({ campo: "acepta", texto: t("accept.policyRequired") });
          return;
        }
      }

      setEnviando(true);
      try {
        const sesion = await acceptInvitation(
          token,
          esNueva
            ? { password, confirmPassword: confirmacion, acceptPolicy: acepta }
            : {},
        );
        saveSession({
          access: sesion.access,
          refresh: sesion.refresh,
          user: sesion.user,
        });
        // El idioma y el tema de la cuenta mandan sobre los de invitado.
        await loadServerPreferences();
        // `/dashboard` es un shim que hace replace("/"): empujarlo rebota.
        router.push("/");
        router.refresh();
      } catch (err) {
        setEnviando(false);
        // Pantalla publica: nunca el texto crudo del backend (ver `safe`).
        setErrorEnvio(errorMessageFor(err, t, { safe: true }));
      }
    },
    [enviando, esNueva, password, confirmacion, acepta, token, router, t],
  );

  if (fase === FASE.CARGANDO) {
    return (
      <p className={styles.estado} role="status">
        {despertando ? t("accept.waking") : t("accept.loading")}
      </p>
    );
  }

  if (fase === FASE.FALLO_CARGA) {
    return (
      <div className={styles.aviso} role="status">
        <h2 className={styles.avisoTitulo}>{t("accept.loadFailedTitle")}</h2>
        <p className={styles.avisoCuerpo}>{t("accept.loadFailedBody")}</p>
        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            setFase(FASE.CARGANDO);
            setIntento((n) => n + 1);
          }}
        >
          {t("accept.retry")}
        </button>
      </div>
    );
  }

  if (fase === FASE.ENLACE_MALO) {
    return (
      <div className={styles.aviso} role="status">
        <h2 className={styles.avisoTitulo}>{t("accept.badLinkTitle")}</h2>
        <p className={styles.avisoCuerpo}>{t("accept.badLinkBody")}</p>
        <a className="btn-ghost" href="/login">
          {t("accept.goSignIn")}
        </a>
      </div>
    );
  }

  const empresa = (invitacion && invitacion.company_name) || "";

  return (
    <form className={styles.form} onSubmit={enviar} noValidate>
      <p className={styles.bienvenida}>
        {/* `company_name` puede venir nulo (invitation_views.py:55). Sin respaldo
            la frase quedaba truncada, y es la unica informacion que identifica
            a que se esta uniendo la persona. */}
        {empresa ? t("accept.welcome", { company: empresa }) : t("accept.welcomeNoCompany")}
      </p>
      <p className={styles.intro}>
        {esNueva ? t("accept.newAccountIntro") : t("accept.joinIntro")}
      </p>

      {esNueva && (
        <>
          <div className={styles.grupo}>
            <label className={styles.label} htmlFor="password">
              {t("accept.password")}
              <span className={styles.requerido} aria-hidden="true"> *</span>
              <span className="sr-only"> ({t("accept.required")})</span>
            </label>
            <input
              className={styles.input}
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              aria-describedby={errorCampo?.campo === "password" ? "password-error" : undefined}
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              aria-invalid={errorCampo?.campo === "password" || undefined}
            />
            {errorCampo?.campo === "password" && (
              <p className={styles.errorCampo} id="password-error" role="alert">
                {errorCampo.texto}
              </p>
            )}
          </div>

          <div className={styles.grupo}>
            <label className={styles.label} htmlFor="confirmacion">
              {t("accept.confirmPassword")}
              <span className={styles.requerido} aria-hidden="true"> *</span>
              <span className="sr-only"> ({t("accept.required")})</span>
            </label>
            <input
              className={styles.input}
              id="confirmacion"
              name="confirmacion"
              type="password"
              required
              autoComplete="new-password"
              aria-describedby={errorCampo?.campo === "confirmacion" ? "confirmacion-error" : undefined}
              value={confirmacion}
              onChange={(ev) => setConfirmacion(ev.target.value)}
              aria-invalid={errorCampo?.campo === "confirmacion" || undefined}
            />
            {errorCampo?.campo === "confirmacion" && (
              <p className={styles.errorCampo} id="confirmacion-error" role="alert">
                {errorCampo.texto}
              </p>
            )}
          </div>

          <div className={styles.grupo}>
            <label className={styles.checkLabel} htmlFor="acepta">
              <input
                id="acepta"
                name="acepta"
                type="checkbox"
                required
                checked={acepta}
                onChange={(ev) => setAcepta(ev.target.checked)}
                aria-invalid={errorCampo?.campo === "acepta" || undefined}
                aria-describedby={errorCampo?.campo === "acepta" ? "acepta-error" : undefined}
              />
              <span>{t("accept.acceptPolicy")}</span>
            </label>
            <a className={styles.politica} href="/privacy-policy" target="_blank" rel="noopener noreferrer">
              {t("accept.policyLink")}
            </a>
            {errorCampo?.campo === "acepta" && (
              <p className={styles.errorCampo} id="acepta-error" role="alert">
                {errorCampo.texto}
              </p>
            )}
          </div>
        </>
      )}

      {errorEnvio && (
        <p className={styles.errorEnvio} role="alert">
          {errorEnvio}
        </p>
      )}

      <button className="btn-primary" type="submit" disabled={enviando}>
        {enviando
          ? t("accept.working")
          : esNueva
            ? t("accept.activate")
            : t("accept.confirmJoin")}
      </button>
    </form>
  );
}
