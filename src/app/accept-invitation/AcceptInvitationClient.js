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

const FASE = { CARGANDO: "cargando", LISTA: "lista", ENLACE_MALO: "enlaceMalo" };

export default function AcceptInvitationClient() {
  const t = useT("companyAdmin");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  // El estado inicial se DERIVA del token, que ya esta disponible al
  // renderizar: fijarlo dentro del efecto provocaba un render en cascada.
  const [fase, setFase] = useState(token ? FASE.CARGANDO : FASE.ENLACE_MALO);
  const [invitacion, setInvitacion] = useState(null);

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
    (async () => {
      try {
        const info = await getInvitationInfo(token);
        if (!vigente) return;
        setInvitacion(info);
        setFase(FASE.LISTA);
      } catch {
        if (vigente) setFase(FASE.ENLACE_MALO);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [token]);

  const esNueva = invitacion && invitacion.kind === "new";

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
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        setEnviando(false);
        setErrorEnvio(errorMessageFor(err, t));
      }
    },
    [enviando, esNueva, password, confirmacion, acepta, token, router, t],
  );

  if (fase === FASE.CARGANDO) {
    return <p className={styles.estado}>{t("accept.loading")}</p>;
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
        {t("accept.welcome", { company: empresa })}
      </p>
      <p className={styles.intro}>
        {esNueva ? t("accept.newAccountIntro") : t("accept.joinIntro")}
      </p>

      {esNueva && (
        <>
          <div className={styles.grupo}>
            <label className={styles.label} htmlFor="password">
              {t("accept.password")}
            </label>
            <input
              className={styles.input}
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              aria-invalid={errorCampo?.campo === "password" || undefined}
            />
            {errorCampo?.campo === "password" && (
              <p className={styles.errorCampo}>{errorCampo.texto}</p>
            )}
          </div>

          <div className={styles.grupo}>
            <label className={styles.label} htmlFor="confirmacion">
              {t("accept.confirmPassword")}
            </label>
            <input
              className={styles.input}
              id="confirmacion"
              name="confirmacion"
              type="password"
              autoComplete="new-password"
              value={confirmacion}
              onChange={(ev) => setConfirmacion(ev.target.value)}
              aria-invalid={errorCampo?.campo === "confirmacion" || undefined}
            />
            {errorCampo?.campo === "confirmacion" && (
              <p className={styles.errorCampo}>{errorCampo.texto}</p>
            )}
          </div>

          <div className={styles.grupo}>
            <label className={styles.checkLabel} htmlFor="acepta">
              <input
                id="acepta"
                name="acepta"
                type="checkbox"
                checked={acepta}
                onChange={(ev) => setAcepta(ev.target.checked)}
                aria-invalid={errorCampo?.campo === "acepta" || undefined}
              />
              <span>{t("accept.acceptPolicy")}</span>
            </label>
            <a className={styles.politica} href="/privacy-policy" target="_blank" rel="noopener noreferrer">
              {t("accept.policyLink")}
            </a>
            {errorCampo?.campo === "acepta" && (
              <p className={styles.errorCampo}>{errorCampo.texto}</p>
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
