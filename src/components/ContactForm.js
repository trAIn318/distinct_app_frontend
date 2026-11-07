"use client";

import { useState } from "react";
import { useT } from "../i18n/client";
import { sendContactApi } from "../lib/api";
import { BOOKING_URL } from "../lib/config";
import styles from "./ContactForm.module.css";

export default function ContactForm() {
  const t = useT("contact");
  // `website` es el campo trampa: invisible y fuera del recorrido con Tab, asi
  // que una persona nunca lo llena y un bot que rellena todo, si. Reemplaza a
  // la casilla de "no soy un robot" que habia antes, que no detenia a nadie.
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error when user types
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;          // dos clics mandan una sola vez

    setSendError(null);
    setSent(false);

    const newErrors = {};
    if (!formData.email) {
      newErrors.email = t("emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t("emailInvalid");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSending(true);
    try {
      await sendContactApi(formData);
      // Solo se declara enviado cuando el backend lo confirma. Antes esta
      // pantalla mostraba "exito" sin haber mandado nada a ninguna parte.
      setSent(true);
      setFormData({ name: "", email: "", message: "", website: "" });
    } catch {
      setSendError(t("errSend"));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="contact-heading">
      <div className="container">
        <h2 id="contact-heading" className={styles.headline}>
          {t("title")}
        </h2>

        <div className={styles.grid}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            <p className={styles.sidebarCopy}>{t("sidebar")}</p>
            <a
              href="https://wa.me/13055481826"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappLink}
            >
              {t("whatsapp")}
            </a>
            {/* Canal aparte, en su propia línea y separado del de WhatsApp.
                Antes era un botón pegado debajo, y la flecha de "Message us on
                WhatsApp →" parecía apuntarle, así que se leía como si el botón
                fuera de WhatsApp. Es un enlace de texto, no un botón, y no usa
                el dorado: claude.md permite un solo elemento dorado por
                pantalla y el de WhatsApp ya lo gasta.

                Solo aparece si hay un calendario configurado. La dirección que
                estuvo aquí fija apuntaba a un dominio inexistente, así que
                ofrecía un canal que no llevaba a ninguna parte. Ver BOOKING_URL
                en lib/config.js. */}
            {BOOKING_URL && (
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.meetingLink}
              >
                {t("meeting")}
              </a>
            )}
          </div>

          {/* Form */}
          <div className={styles.formContainer}>
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.formGroup}>
                <label htmlFor="name" className={styles.label}>{t("name")}</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder={t("namePlaceholder")}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  {t("email")} <span className={styles.required} aria-hidden="true">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder={t("emailPlaceholder")}
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <span id="email-error" className={styles.errorText} role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="message" className={styles.label}>{t("message")}</label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder={t("messagePlaceholder")}
                />
              </div>

              {/* Campo trampa. Oculto para lectores de pantalla y fuera del
                  recorrido con Tab: si llega lleno, lo lleno un bot. */}
              <div className={styles.honeypot} aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                className={`btn-primary ${styles.submitBtn}`}
                disabled={sending}
              >
                {sending ? t("sending") : t("send")}
              </button>

              {sent && (
                <p className={styles.notice} role="status">
                  {t("success")}
                </p>
              )}
              {sendError && (
                <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
                  {sendError}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
