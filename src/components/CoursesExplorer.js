"use client";

/**
 * CoursesExplorer — catálogo interactivo de cursos.
 *
 * - Búsqueda en tiempo real (título, descripción, código) sobre el contenido
 *   en el idioma activo de la UI.
 * - Filtros: categoría, nivel, idioma original, precio. Todos corresponden
 *   a columnas reales de moodle_course.
 * - Los filtros y la búsqueda viven en la URL (?q=&category=&level=&lang=&price=)
 *   → enlaces compartibles y compatibles con el botón atrás del navegador.
 * - 3 vistas: Cards / List / Summary. La elección persiste en localStorage.
 *
 * El filtrado es client-side: el catálogo completo (~25 cursos) llega del
 * server component y filtrar en memoria es instantáneo. Si el catálogo
 * creciera a cientos, mover el filtrado al backend con query params.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import CourseCard from "./CourseCard";
import { getCourseTitle, getCourseDescription } from "../lib/courseText";
import { useT, useLocale } from "../i18n/client";
import styles from "./CoursesExplorer.module.css";

const VIEW_KEY = "dx_courses_view";
const VIEWS = ["cards", "list", "summary"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const LANGS = ["en", "es"];

export default function CoursesExplorer({ courses }) {
  const t = useT("explorer");
  const tCard = useT("card");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Estado inicial desde la URL (compartible / back-compatible) ──
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [level, setLevel] = useState(searchParams.get("level") || "");
  const [lang, setLang] = useState(searchParams.get("lang") || "");
  const [price, setPrice] = useState(searchParams.get("price") || "");
  const [view, setView] = useState("cards");

  // Vista persistida en localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (VIEWS.includes(saved)) setView(saved);
    } catch {}
  }, []);

  const changeView = (v) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  // Si el usuario navega atrás/adelante, re-sincroniza el estado con la URL
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
    setCategory(searchParams.get("category") || "");
    setLevel(searchParams.get("level") || "");
    setLang(searchParams.get("lang") || "");
    setPrice(searchParams.get("price") || "");
  }, [searchParams]);

  // ── Sincronización con la URL ──
  const debounceRef = useRef(0);

  const writeUrl = useCallback(
    (next, { push = false } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const handleQuery = (value) => {
    setQuery(value); // filtrado instantáneo
    clearTimeout(debounceRef.current);
    // la URL se actualiza con debounce para no spamear el history
    debounceRef.current = setTimeout(() => writeUrl({ q: value }), 400);
  };

  const handleFilter = (setter, key) => (value) => {
    setter(value);
    writeUrl({ [key]: value }, { push: true }); // push → botón atrás funciona
  };

  const clearAll = () => {
    setQuery("");
    setCategory("");
    setLevel("");
    setLang("");
    setPrice("");
    router.push(pathname, { scroll: false });
  };

  // ── Opciones de categoría (derivadas de los datos reales) ──
  const categories = useMemo(() => {
    const seen = new Map();
    for (const c of courses) {
      if (c.category_name && !seen.has(String(c.category))) {
        seen.set(String(c.category), c.category_name);
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [courses]);

  // ── Filtrado en memoria ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (q) {
        const haystack = [
          getCourseTitle(c, locale),
          getCourseDescription(c, locale),
          c.title,
          c.code,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (category && String(c.category) !== category) return false;
      if (level && (c.level || "") !== level) return false;
      if (lang && (c.original_language || "") !== lang) return false;
      if (price === "free" && !c.is_free) return false;
      if (price === "paid" && c.is_free) return false;
      return true;
    });
  }, [courses, query, category, level, lang, price, locale]);

  const hasActiveFilters = query || category || level || lang || price;

  return (
    <div className={styles.explorer}>
      {/* ── Barra de búsqueda + vistas ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <input
            type="search"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className={styles.search}
            aria-label={t("searchPlaceholder")}
          />
        </div>

        <div className={styles.viewToggle} role="radiogroup" aria-label={t("viewMode")}>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              className={`${styles.viewBtn} ${view === v ? styles.viewBtnActive : ""}`}
              onClick={() => changeView(v)}
            >
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className={styles.filters}>
        <select
          value={category}
          onChange={(e) => handleFilter(setCategory, "category")(e.target.value)}
          className={styles.select}
          aria-label={t("category")}
        >
          <option value="">{t("allCategories")}</option>
          {categories.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        <select
          value={level}
          onChange={(e) => handleFilter(setLevel, "level")(e.target.value)}
          className={styles.select}
          aria-label={t("level")}
        >
          <option value="">{t("allLevels")}</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{t(`levels.${l}`)}</option>
          ))}
        </select>

        <select
          value={lang}
          onChange={(e) => handleFilter(setLang, "lang")(e.target.value)}
          className={styles.select}
          aria-label={t("language")}
        >
          <option value="">{t("allLanguages")}</option>
          {LANGS.map((l) => (
            <option key={l} value={l}>{tCard(`lang.${l}`)}</option>
          ))}
        </select>

        <select
          value={price}
          onChange={(e) => handleFilter(setPrice, "price")(e.target.value)}
          className={styles.select}
          aria-label={t("price")}
        >
          <option value="">{t("allPrices")}</option>
          <option value="free">{t("free")}</option>
          <option value="paid">{t("paid")}</option>
        </select>

        {hasActiveFilters && (
          <button type="button" onClick={clearAll} className={styles.clearBtn}>
            {t("clear")}
          </button>
        )}
      </div>

      {/* ── Contador de resultados ── */}
      <p className={styles.count} role="status">
        {t("results", { n: filtered.length })}
      </p>

      {/* ── Resultados ── */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <p>{t("noResults")}</p>
        </div>
      ) : view === "cards" ? (
        <div className={styles.grid}>
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : view === "list" ? (
        <ul className={styles.list}>
          {filtered.map((c) => (
            <li key={c.id} className={styles.listRow}>
              <div className={styles.listMain}>
                <span className={styles.listCode}>{c.code}</span>
                <Link href={`/courses/${c.id}`} className={styles.listTitle}>
                  {getCourseTitle(c, locale)}
                </Link>
                <p className={styles.listDesc}>
                  {(getCourseDescription(c, locale) || "").slice(0, 110)}
                  {(getCourseDescription(c, locale) || "").length > 110 ? "…" : ""}
                </p>
              </div>
              <div className={styles.listMeta}>
                {c.original_language && (
                  <span className={styles.chip}>{tCard(`lang.${c.original_language}`)}</span>
                )}
                {c.level && <span className={styles.chip}>{t(`levels.${c.level}`)}</span>}
                <Link href={`/courses/${c.id}`} className="btn-ghost">
                  {tCard("viewMore")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.summaryWrap}>
          <table className={styles.summary}>
            <thead>
              <tr>
                <th>{t("colCode")}</th>
                <th>{t("colTitle")}</th>
                <th>{t("colCategory")}</th>
                <th>{t("colLevel")}</th>
                <th>{t("colLanguage")}</th>
                <th>{t("colModules")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className={styles.cellCode}>{c.code}</td>
                  <td>
                    <Link href={`/courses/${c.id}`} className={styles.summaryLink}>
                      {getCourseTitle(c, locale)}
                    </Link>
                  </td>
                  <td>{c.category_name || "—"}</td>
                  <td>{c.level ? t(`levels.${c.level}`) : "—"}</td>
                  <td>{c.original_language ? tCard(`lang.${c.original_language}`) : "—"}</td>
                  <td>{c.modules || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
