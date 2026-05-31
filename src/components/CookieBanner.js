"use client";

import { useState, useEffect } from "react";
import styles from "./CookieBanner.module.css";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("distinct_cookie_consent");
    if (!consent) {
      // Small delay for entrance animation
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("distinct_cookie_consent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("distinct_cookie_consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible && typeof window !== "undefined" && localStorage.getItem("distinct_cookie_consent")) {
    return null;
  }

  return (
    <div className={`${styles.banner} ${isVisible ? styles.bannerVisible : ""}`} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <div className={`container ${styles.container}`}>
        <p className={styles.text}>
          This website uses cookies to ensure you get the best experience on our platform.
        </p>
        <div className={styles.actions}>
          <button onClick={handleDecline} className="btn-ghost">
            Decline
          </button>
          <button onClick={handleAccept} className="btn-primary">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
