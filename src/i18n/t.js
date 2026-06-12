/**
 * src/i18n/t.js
 * Núcleo compartido del mini-i18n (sin dependencias).
 *
 * makeT(messages, namespace, fallback) devuelve una función t(key, vars):
 *   - busca "namespace.key" en messages; si no existe, en fallback (inglés);
 *     si tampoco, devuelve la ruta de la clave (visible para detectar faltantes).
 *   - interpola variables: t("hi", { name: "Ana" }) sobre "Hola, {name}".
 */

function lookup(obj, path) {
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function makeT(messages, namespace, fallback) {
  return function t(key, vars) {
    const path = namespace ? `${namespace}.${key}` : key;
    let value = lookup(messages, path);
    if (value === undefined && fallback) value = lookup(fallback, path);
    if (value === undefined) return path;
    if (vars) {
      for (const k of Object.keys(vars)) {
        value = value.split(`{${k}}`).join(String(vars[k]));
      }
    }
    return value;
  };
}
