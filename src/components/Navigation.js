"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MOODLE_URL } from "../lib/config";
import { getCurrentUser, clearSession } from "../lib/session";
import styles from "./Navigation.module.css";

const LOGO_URL = "/img/logo_cropped.png";

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  // Cargar sesión al montar / cuando cambia la ruta (post-login refresh)
  useEffect(() => {
    setUser(getCurrentUser());
  }, [pathname]);

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
    { label: "Home", href: "/" },
    { label: "Courses", href: "/courses" },
    { label: "About", href: "/about" },
  ];

  const displayName =
    user?.first_name || user?.username || (user?.email ? user.email.split("@")[0] : "");

  return (
    <header className={styles.nav}>
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
              Meet ARIA
            </a>
            <a
              href={MOODLE_URL}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              Access Moodle
            </a>
            {user ? (
              <>
                <span className={styles.userBadge} title={user.email || ""}>
                  Hi, {displayName}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn-primary"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary">
                Sign In
              </Link>
            )}
          </div>
        </nav>

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
              Meet ARIA
            </a>
            <a
              href={MOODLE_URL}
              className="btn-ghost"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Access Moodle
            </a>
            {user ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleSignOut}
              >
                Sign Out ({displayName})
              </button>
            ) : (
              <Link
                href="/login"
                className="btn-primary"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
