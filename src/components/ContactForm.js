"use client";

import { useState } from "react";
import styles from "./ContactForm.module.css";

export default function ContactForm() {
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [isVerified, setIsVerified] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error when user types
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Inline validation
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required.";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!isVerified) {
      newErrors.recaptcha = "Please verify that you are human.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Form endpoint omitted pending client decision (PRD §8.3)
    console.log("Form submission simulated:", formData);
    alert("Thank you! Your message has been sent. (Simulated)");
    setFormData({ name: "", email: "" });
    setIsVerified(false);
  };

  return (
    <section className={styles.section} aria-labelledby="contact-heading">
      <div className="container">
        <h2 id="contact-heading" className={styles.headline}>
          Let&apos;s Talk.
        </h2>

        <div className={styles.grid}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            <p className={styles.sidebarCopy}>
              Whether you&apos;re a hotel operator, investor, or potential partner — we want to hear from you. Distinct moves fast and so do we.
            </p>
            <a
              href="https://wa.me/13055481826"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappLink}
            >
              Message us on WhatsApp →
            </a>
          </div>

          {/* Form */}
          <div className={styles.formContainer}>
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.formGroup}>
                <label htmlFor="name" className={styles.label}>Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Your Name"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email <span className={styles.required} aria-hidden="true">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="your.email@example.com"
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <span id="email-error" className={styles.errorText} role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              {/* Mock reCAPTCHA */}
              <div className={styles.formGroup}>
                <label className={styles.recaptchaMock}>
                  <input
                    type="checkbox"
                    checked={isVerified}
                    onChange={(e) => {
                      setIsVerified(e.target.checked);
                      if (errors.recaptcha) setErrors({ ...errors, recaptcha: null });
                    }}
                    className={styles.checkbox}
                  />
                  <span className={styles.recaptchaText}>I am not a robot</span>
                </label>
                {errors.recaptcha && (
                  <span className={styles.errorText} role="alert">
                    {errors.recaptcha}
                  </span>
                )}
              </div>

              <p className={styles.legalText}>
                Protected by Google reCAPTCHA. Privacy Policy:{" "}
                <a href="https://policies.google.com/privacy" className={styles.legalLink} target="_blank" rel="noopener noreferrer">
                  https://policies.google.com/privacy
                </a>{" "}
                | Terms:{" "}
                <a href="https://policies.google.com/terms" className={styles.legalLink} target="_blank" rel="noopener noreferrer">
                  https://policies.google.com/terms
                </a>
              </p>

              <button
                type="submit"
                className={`btn-primary ${styles.submitBtn}`}
                disabled={!isVerified}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
