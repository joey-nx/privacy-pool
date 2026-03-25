"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function HowItWorks() {
  const t = useTranslations("howItWorks");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    { number: "01", title: t("step1Title"), description: t("step1Desc") },
    { number: "02", title: t("step2Title"), description: t("step2Desc") },
    { number: "03", title: t("step3Title"), description: t("step3Desc") },
    { number: "04", title: t("step4Title"), description: t("step4Desc") },
  ];

  const headingLines = t("heading").split("\n");

  return (
    <section
      id="how-it-works"
      className="py-20 lg:py-24 px-6 lg:px-8 relative overflow-hidden"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] bg-gray-300/10 dark:bg-gray-500/5" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div ref={ref} className="lg:grid lg:grid-cols-[1fr_1.5fr] lg:gap-16 mb-16">
          {/* Left: section intro — left-aligned, sticky on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-12 lg:mb-0 lg:sticky lg:top-28 lg:self-start"
          >
            <div className="text-sm tracking-widest uppercase mb-4 text-gray-600 dark:text-gray-400">
              {t("label")}
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-balance mb-6 text-gray-900 dark:text-white">
              {headingLines[0]}
              <br />
              <span className="text-gradient">{headingLines[1]}</span>
            </h2>
          </motion.div>

          {/* Right: steps — single column flow */}
          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.15 }}
              >
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-light border-amber-600 text-amber-600 bg-amber-600/5 dark:border-amber-400 dark:text-amber-400 dark:bg-amber-400/5">
                      {step.number}
                    </div>
                  </div>
                  <div className="flex-1 pt-2">
                    <h3 className="text-2xl font-medium mb-3 text-gray-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="leading-relaxed mb-4 text-gray-600 dark:text-white/70">
                      {step.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 p-8 border backdrop-blur-sm border-gray-300/30 bg-gradient-to-br from-gray-200/20 to-transparent dark:border-gray-500/20 dark:bg-gradient-to-br dark:from-gray-500/10 dark:to-transparent"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl mb-2 text-gray-900 dark:text-white">
                {t("securityTitle")}
              </h3>
              <p className="text-sm text-gray-600 dark:text-white/70">
                {t("securityDesc")}
              </p>
            </div>
            <Link href="/docs" className="px-6 py-3 border-2 transition-all duration-300 whitespace-nowrap border-amber-600 text-amber-600 hover:bg-amber-600/10 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-400/10">
              {t("viewDocs")}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
