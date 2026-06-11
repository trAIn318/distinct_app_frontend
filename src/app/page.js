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

export default function Home() {
  return (
    <>
      <GoldenThread />
      <ScrollRail />
      <Hero />
      <ValuePropBar />
      <ProblemApproach />
      <FeaturedCourses />
      <HomeTestimonials />
      <PlatformOverview />
      <HowItWorks />
      <AriaFeature />
      <ContactForm />
      <HomePartners />
    </>
  );
}
