"use client";

/**
 * src/i18n/client.js
 * i18n para CLIENT components.
 *
 * El layout (server) resuelve locale+mensajes y los inyecta vía
 * <I18nProvider>. Los client components usan `useT("namespace")`.
 */

import { createContext, useContext } from "react";
import { makeT } from "./t";
import en from "./messages/en.json";

const I18nContext = createContext({ locale: "en", messages: en });

export function I18nProvider({ locale, messages, children }) {
  return (
    <I18nContext.Provider value={{ locale, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(namespace) {
  const { messages } = useContext(I18nContext);
  return makeT(messages, namespace, en);
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
