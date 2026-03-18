"use client";

import { motion } from "motion/react";
import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";

export function DocsHero() {
  const t = useTranslations("docs");

  return (
    <section className="relative w-full overflow-hidden pt-32 pb-16">
      {/* Glowing circular gradient */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,_rgba(209,213,219,0.4)_0%,_rgba(156,163,175,0.15)_30%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(156,163,175,0.2)_0%,_rgba(107,114,128,0.1)_30%,_transparent_70%)] blur-[80px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 border border-gray-300/40 bg-gray-200/20 dark:border-gray-500/30 dark:bg-gray-500/10"
        >
          <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="text-sm tracking-widest uppercase text-gray-600 dark:text-gray-400">
            {t("hero.label")}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6 bg-gradient-to-r from-gray-800 via-gray-600 to-gray-800 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent"
        >
          {t("hero.heading")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-lg md:text-xl tracking-wide text-gray-600 dark:text-white/60"
        >
          {t("hero.description")}
        </motion.p>
      </div>
    </section>
  );
}
