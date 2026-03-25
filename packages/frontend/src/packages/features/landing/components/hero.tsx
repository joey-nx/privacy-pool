"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "~i18n/navigation";

export function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Subtle background glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,_rgba(209,213,219,0.5)_0%,_rgba(156,163,175,0.2)_30%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(156,163,175,0.3)_0%,_rgba(107,114,128,0.15)_30%,_transparent_70%)] blur-[80px]"
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Concentric circles — "pool" metaphor */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`circle-${i}`}
            className="absolute rounded-full border border-gray-300/30 dark:border-gray-500/20"
            style={{ width: 200 + i * 150, height: 200 + i * 150 }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.3, 0.2] }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 border border-gray-300/40 bg-gray-200/20 dark:border-gray-500/30 dark:bg-gray-500/10"
        >
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span className="text-sm tracking-widest uppercase text-gray-600 dark:text-gray-400">
            {t("label")}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-balance mb-6 bg-gradient-to-r from-gray-800 via-gray-600 to-gray-800 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent"
        >
          {t("heading")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="text-xl md:text-2xl mb-12 tracking-wide text-gray-600 dark:text-white/70"
        >
          {t("subheading")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/app" className="btn-primary px-8 py-4 group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              {t("launchApp")}
              <svg
                className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </Link>

          <Link href="/docs" className="px-8 py-4 border-2 transition-all duration-300 border-amber-600 text-amber-600 hover:bg-amber-600/10 dark:border-amber-400 dark:text-amber-400 dark:hover:bg-amber-400/10">
            {t("readDocs")}
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-[1px] h-16 bg-gradient-to-b from-gray-400/0 via-gray-400 to-gray-400/0 dark:from-gray-500/0 dark:via-gray-500 dark:to-gray-500/0"
        />
      </motion.div>
    </section>
  );
}
