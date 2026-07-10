import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import StatcastSection from "@/components/StatcastSection";
import LeaderboardSection from "@/components/LeaderboardSection";
import FooterSection from "@/components/FooterSection";

export default function Home() {
  return (
    <>
      <NavBar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <StatcastSection />
        <LeaderboardSection />
      </main>
      <FooterSection />
    </>
  );
}
