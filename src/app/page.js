import Hero from "../components/Hero";
import ValuePropBar from "../components/ValuePropBar";
import ProblemApproach from "../components/ProblemApproach";
import FeaturedCourses from "../components/FeaturedCourses";
import PlatformOverview from "../components/PlatformOverview";
import HowItWorks from "../components/HowItWorks";
import AriaFeature from "../components/AriaFeature";
import ContactForm from "../components/ContactForm";
import HomeTestimonials from "../components/HomeTestimonials";
import HomePartners from "../components/HomePartners";
import ScrollRail from "../components/ScrollRail";
import GoldenThread from "../components/GoldenThread";
import OrganizationSchema from "../components/OrganizationSchema";
import { getEnabledHomeSections } from "../lib/homeSections";

// Mapa key→componente. Las keys, el orden canónico y qué secciones se muestran
// viven en lib/homeSections (parametrizable por la env var NEXT_PUBLIC_HOME_SECTIONS).
// GoldenThread y ScrollRail son overlays estructurales: siempre presentes.
const SECTION_COMPONENTS = {
  hero: Hero,
  valueProp: ValuePropBar,
  problemApproach: ProblemApproach,
  featuredCourses: FeaturedCourses,
  testimonials: HomeTestimonials,
  platformOverview: PlatformOverview,
  howItWorks: HowItWorks,
  aria: AriaFeature,
  contact: ContactForm,
  partners: HomePartners,
};

export default function Home() {
  const sections = getEnabledHomeSections();
  return (
    <>
      {/* Quien es la empresa y como escribirle, en la RAIZ del sitio: es la
          pagina por la que entra cualquiera que lo rastree. Hasta ahora esto
          solo estaba en /insights, asi que la portada no declaraba ni la
          identidad ni el correo de contacto. */}
      <OrganizationSchema />
      <GoldenThread />
      <ScrollRail />
      {sections.map((key) => {
        const Section = SECTION_COMPONENTS[key];
        return Section ? <Section key={key} /> : null;
      })}
    </>
  );
}
