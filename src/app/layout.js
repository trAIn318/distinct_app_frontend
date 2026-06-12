import { Cormorant_Garamond, DM_Sans, DM_Mono, Playfair_Display } from "next/font/google";
import "../styles/tokens.css";
import "../styles/global.css";
import "../styles/components/buttons.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-accent",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-label",
});

import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import CookieBanner from "../components/CookieBanner";
import { getLocale, getMessages } from "../i18n/server";
import { I18nProvider } from "../i18n/client";

export const metadata = {
  title: "Distinct Hospitality Solutions",
  description: "The AI Platform Built for Hospitality",
};

export default async function RootLayout({ children }) {
  // Idioma: cookie dx_lang (elección del usuario) > Accept-Language > 'en'
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <html
      lang={locale}
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Anti-flash de tema: aplica el tema guardado ANTES del primer paint.
            Sin esto, los usuarios con tema claro verían un destello oscuro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("dx_theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}`,
          }}
        />
        <I18nProvider locale={locale} messages={messages}>
          <Navigation />

          {/* Main Content */}
          <main>
            {children}
          </main>

          <Footer />
          <CookieBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
