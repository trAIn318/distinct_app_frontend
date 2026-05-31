import Hero from "../components/Hero";
import ValuePropBar from "../components/ValuePropBar";
import ProblemApproach from "../components/ProblemApproach";
import FeaturedCourses from "../components/FeaturedCourses";
import PlatformOverview from "../components/PlatformOverview";
import HowItWorks from "../components/HowItWorks";
import AriaFeature from "../components/AriaFeature";
import ContactForm from "../components/ContactForm";

export default function Home() {
  return (
    <>
      <Hero />
      <ValuePropBar />
      <ProblemApproach />
      <FeaturedCourses />
      <PlatformOverview />
      <HowItWorks />
      <AriaFeature />
      <ContactForm />
    </>
  );
}
