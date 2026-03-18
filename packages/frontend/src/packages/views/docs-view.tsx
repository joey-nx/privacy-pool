"use client";

import { Navigation } from "~shared/components/navigation";
import { Footer } from "~shared/components/footer";
import { DocsSidebar } from "~features/docs/components/docs-sidebar";
import { SectionOverview } from "~features/docs/components/section-overview";
import { SectionConcepts } from "~features/docs/components/section-concepts";
import { SectionProtocol } from "~features/docs/components/section-protocol";
import { SectionCircuit } from "~features/docs/components/section-circuit";
import { SectionContracts } from "~features/docs/components/section-contracts";
import { SectionSequencer } from "~features/docs/components/section-sequencer";
import { SectionSdk } from "~features/docs/components/section-sdk";
import { SectionCompliance } from "~features/docs/components/section-compliance";

export function DocsView() {
  return (
    <div className="min-h-screen transition-colors duration-300 bg-gradient-to-br from-gray-50 via-white to-slate-50 text-gray-900 dark:bg-none dark:bg-gray-950 dark:text-white">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-gray-100/50 via-white to-gray-50 dark:from-gray-900/30 dark:via-gray-950 dark:to-black" />
      <div className="relative z-10">
        <Navigation />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-28 pb-24">
          <div className="flex gap-12">
            <DocsSidebar />
            <article className="flex-1 min-w-0">
              <SectionOverview />
              <SectionConcepts />
              <SectionProtocol />
              <SectionCircuit />
              <SectionContracts />
              <SectionSequencer />
              <SectionSdk />
              <SectionCompliance />
            </article>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
