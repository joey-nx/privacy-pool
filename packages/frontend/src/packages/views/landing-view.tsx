"use client";

import { Navigation } from "~shared/components/navigation";
import { Footer } from "~shared/components/footer";
import { Hero } from "~features/landing/components/hero";
import { FeaturesSection } from "~features/landing/components/features-section";
import { HowItWorks } from "~features/landing/components/how-it-works";
import { Compliance } from "~features/landing/components/compliance";

export function LandingView() {
  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-gray-50 via-white to-slate-50 text-gray-900 dark:bg-none dark:bg-gray-950 dark:text-white">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-gray-100/50 via-white to-gray-50 dark:from-gray-900/30 dark:via-gray-950 dark:to-black" />
      <div className="relative z-10">
        <Navigation />
        <main>
          <Hero />
          <FeaturesSection />
          <HowItWorks />
          <Compliance />
        </main>
        <Footer />
      </div>
    </div>
  );
}
