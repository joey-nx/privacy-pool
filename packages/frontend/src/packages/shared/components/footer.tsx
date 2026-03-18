"use client";

import { Twitter, Github, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "~i18n/navigation";

export function Footer() {
  const t = useTranslations("footer");

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="relative border-t py-16 px-6 lg:px-8 border-gray-200 dark:border-white/10">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-black" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full animate-pulse bg-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.7)] dark:bg-amber-400 dark:shadow-[0_0_10px_rgba(251,191,36,0.7)]" />
              <h3 className="text-xl tracking-wider font-light text-gray-900 dark:text-white">
                {t("brand")}
              </h3>
            </div>
            <p className="text-sm leading-relaxed max-w-md mb-2 text-gray-600 dark:text-white/50">
              {t("description")}
            </p>
            <div className="flex items-center gap-4 mt-6">
              {[
                { icon: Twitter, label: "Twitter" },
                { icon: Github, label: "Github" },
                { icon: MessageCircle, label: "Discord" },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  className="w-10 h-10 border flex items-center justify-center transition-all duration-300 border-gray-300 hover:bg-gray-100 hover:border-gray-400 dark:border-white/20 dark:hover:bg-gray-500/20 dark:hover:border-gray-500/50"
                  aria-label={label}
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm tracking-wider mb-4 text-gray-700 dark:text-white/70">
              {t("product")}
            </h4>
            <ul className="space-y-2 text-sm">
              {[
                { label: t("features"), id: "features" },
                { label: t("howItWorks"), id: "how-it-works" },
                { label: t("compliance"), id: "compliance" },
              ].map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => scrollToSection(item.id)}
                    className="transition-colors text-gray-600 hover:text-gray-900 dark:text-white/50 dark:hover:text-gray-300"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm tracking-wider mb-4 text-gray-700 dark:text-white/70">
              {t("resources")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/docs"
                  className="transition-colors text-gray-600 hover:text-gray-900 dark:text-white/50 dark:hover:text-gray-300"
                >
                  {t("documentation")}
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="transition-colors text-gray-600 hover:text-gray-900 dark:text-white/50 dark:hover:text-gray-300"
                >
                  {t("github")}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 border-gray-200 dark:border-white/10">
          <p className="text-sm text-gray-500 dark:text-white/30">
            {t("copyright")}
          </p>
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-white/30">
            <a
              href="#"
              className="transition-colors hover:text-gray-900 dark:hover:text-gray-300"
            >
              {t("terms")}
            </a>
            <a
              href="#"
              className="transition-colors hover:text-gray-900 dark:hover:text-gray-300"
            >
              {t("privacy")}
            </a>
          </div>
        </div>

        <div className="mt-8 p-4 border rounded text-center border-gray-300/30 bg-gray-100/50 dark:border-gray-500/20 dark:bg-gray-500/5">
          <p className="text-xs text-gray-600 dark:text-white/40">
            {t("disclaimer")}
          </p>
        </div>
      </div>
    </footer>
  );
}
