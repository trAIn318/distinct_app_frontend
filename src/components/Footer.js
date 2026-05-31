"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  const [email, setEmail] = useState("");

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    
    // Form endpoint omitted pending client decision (PRD §8.4)
    console.log("Newsletter subscription simulated:", email);
    alert("Thank you for subscribing! (Simulated)");
    setEmail("");
  };

  return (
    <footer className={styles.footer} aria-label="Global Footer">
      <div className="container">
        <div className={styles.footerLogo}>
          <Link href="/">
            <img
              src="/img/logo_cropped.png"
              alt="Distinct Hospitality Solutions"
              className={styles.footerLogoImage}
            />
          </Link>
        </div>

        <div className={styles.grid}>
          {/* Newsletter Section */}
          <div className={styles.newsletter}>
            <span className={styles.newsletterLabel}>
              Subscribe — Stay Ahead of the Curve
            </span>
            <p className={styles.newsletterBody}>
              Get hospitality AI insights, platform updates, and industry intelligence delivered to your inbox.
            </p>
            <form onSubmit={handleSubscribe} className={styles.form}>
              <label htmlFor="newsletter-email" className="sr-only">Email Address</label>
              <input
                type="email"
                id="newsletter-email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className={styles.input}
              />
              <button type="submit" className="btn-primary">
                Sign up
              </button>
            </form>
          </div>

          {/* Info Section */}
          <div className={styles.infoColumn}>
            <p className={styles.infoText}>
              <Link href="/privacy-policy" className={styles.privacyLink}>
                Privacy Policy
              </Link>
            </p>
            <p className={styles.infoText}>
              Location: Based in Miami, FL. Operating across the USA, Latin America, and Southeast Asia.
            </p>
            <p className={styles.infoText}>
              Response time: We respond to all inquiries within 24 hours.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <span className={styles.copyright}>
            © 2026 Distinct Hospitality Solutions LLC — All Rights Reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
