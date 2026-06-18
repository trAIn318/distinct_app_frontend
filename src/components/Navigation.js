"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MOODLE_URL } from "../lib/config";
import { getCurrentUser, clearSession } from "../lib/session";
import SettingsPanel from "./SettingsPanel";
import { useT } from "../i18n/client";
import styles from "./Navigation.module.css";

const LOGO_URL = "/img/logo_cropped.png";

export default function Navigation() {
  const t = useT("nav");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Cargar sesión al montar / cuando cambia la ruta (post-login refresh)
  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

  // Nav compacto + fondo más sólido al hacer scroll
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleSignOut = () => {
    clearSession();
    setUser(null);
    setIsMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { label: t("home"), href: "/" },
    { label: t("courses"), href: "/courses" },
    { label: t("about"), href: "/about" },
  ];

  const displayName =
    user?.first_name || user?.username || (user?.email ? user.email.split("@")[0] : "");

  return (
    <header className={`${styles.nav} ${isScrolled ? styles.navScrolled : ""}`}>
      <div className={`container ${styles.navContainer}`}>
        <div className={styles.logoArea}>
          <Link href="/">
            <img
              src={LOGO_URL}
              alt="Distinct Hospitality Solutions"
              className={styles.logo}
            />
          </Link>
        </div>

        <div className={styles.rightCluster}>
        {/* Desktop Navigation */}
        <nav className={styles.navLinks} aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          <div className={styles.actionGroup}>
            <a
              href="https://aria-distinct.onrender.com"
              className="btn-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("meetAria")}
            </a>
            {/* Botón de acceso a Moodle ocultado temporalmente (puede reactivarse). */}
            {/* <a
              href={MOODLE_URL}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("accessMoodle")}
            </a> */}
            {user ? (
              <>
                <Link
                  href="/account"
                  className={styles.userBadge}
                  title={user.email || ""}
                >
                  {t("hi", { name: displayName })}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn-primary"
                >
                  {t("signOut")}
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary">
                {t("signIn")}
              </Link>
            )}
          </div>
        </nav>

        {/* Settings (⚙) — visible en desktop y móvil */}
        <SettingsPanel />

        {/* Mobile Menu Toggle */}
        <button
          className={`${styles.menuButton} ${isMobileMenuOpen ? styles.menuButtonOpen : ""}`}
          onClick={toggleMenu}
          aria-expanded={isMobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          <span className={styles.menuButtonLine}></span>
          <span className={styles.menuButtonLine}></span>
        </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      <div
        className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.mobileMenuOpen : ""}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <nav
          className={styles.mobileMenuLinks}
          aria-label="Mobile Navigation"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-6)" }}
        >
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <div className={styles.mobileActionGroup}>
            <a
              href="https://aria-distinct.onrender.com"
              className="btn-white"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("meetAria")}
            </a>
            {/* Botón de acceso a Moodle ocultado temporalmente (puede reactivarse). */}
            {/* <a
              href={MOODLE_URL}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("accessMoodle")}
            </a> */}
            {user ? (
              <>
                <Link
                  href="/account"
                  className="btn-ghost"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t("myAccount")}
                </Link>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSignOut}
                >
                  {t("signOut")} ({displayName})
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="btn-primary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t("signIn")}
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
