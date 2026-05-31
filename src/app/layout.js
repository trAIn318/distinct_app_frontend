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

export const metadata = {
  title: "Distinct Hospitality Solutions",
  description: "The AI Platform Built for Hospitality",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}>
      <body>
        <Navigation />
        
        {/* Main Content */}
        <main>
          {children}
        </main>
        
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
