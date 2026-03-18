"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Shield, Eye, Zap, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

export function FeaturesSection() {
  const t = useTranslations("features");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const features = [
    {
      icon: Shield,
      title: t("zkProofsTitle"),
      description: t("zkProofsDesc"),
    },
    {
      icon: Eye,
      title: t("untraceableTitle"),
      description: t("untraceableDesc"),
    },
    {
      icon: Zap,
      title: t("gameChainTitle"),
      description: t("gameChainDesc"),
    },
    {
      icon: Lock,
      title: t("stealthTitle"),
      description: t("stealthDesc"),
    },
  ];

  const headingLines = t("heading").split("\n");

  return (
    <section ref={ref} className="py-32 px-6 relative" id="features">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-gray-100/10 to-gray-50 dark:from-gray-950 dark:via-gray-900/10 dark:to-gray-950" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="text-sm tracking-widest uppercase mb-4 text-gray-600 dark:text-gray-400">
            {t("label")}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6 text-gray-900 dark:text-white">
            {headingLines[0]}
            <br />
            <span className="text-gradient">{headingLines[1]}</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl bg-gradient-to-br from-gray-300/20 to-transparent dark:from-gray-500/10 dark:to-transparent" />
              <div className="relative p-8 border backdrop-blur-sm transition-all duration-500 border-gray-200 bg-white/60 group-hover:border-gray-400/50 dark:border-white/10 dark:bg-gray-900/40 dark:group-hover:border-gray-500/30">
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 bg-amber-600/10 dark:bg-amber-400/10">
                    <feature.icon className="w-6 h-6 stroke-[1.5] text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <h3 className="text-2xl mb-4 transition-colors duration-300 text-gray-900 group-hover:text-gray-700 dark:text-white dark:group-hover:text-gray-300">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-gray-600 dark:text-white/60">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
