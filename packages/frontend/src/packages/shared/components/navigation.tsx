"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sun, Moon, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Link } from "~i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";

export function Navigation() {
  const t = useTranslations("navigation");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isLandingPage = pathname === "/" || /^\/[a-z]{2}$/.test(pathname);
  const isDocsPage = pathname.includes("/docs");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const scrollToSection = (id: string) => {
    setIsMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navItems = [
    { label: t("features"), id: "features" },
    { label: t("howItWorks"), id: "how-it-works" },
    { label: t("compliance"), id: "compliance" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled || isMobileMenuOpen
            ? "bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <Link href="/">
              <div className="text-xl tracking-wider font-light flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity text-gray-900 dark:text-white">
                <div className="w-2 h-2 rounded-full animate-pulse bg-amber-600 dark:bg-amber-400 shadow-[0_0_10px_rgba(217,119,6,0.7)] dark:shadow-[0_0_10px_rgba(251,191,36,0.7)]" />
                {t("brand")}
              </div>
            </Link>
            {isDocsPage && (
              <>
                <span className="text-gray-300 dark:text-gray-600">/</span>
                <span className="text-sm tracking-wide text-amber-600 dark:text-amber-400 font-medium">
                  {t("docs")}
                </span>
              </>
            )}
          </motion.div>

          {/* Desktop nav */}
          {!isDocsPage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="hidden md:flex items-center gap-12 absolute left-1/2 -translate-x-1/2"
            >
              {navItems.map((item) =>
                isLandingPage ? (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="text-sm tracking-wide transition-colors min-h-[44px] flex items-center text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-gray-300"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.id}
                    href={`/#${item.id}`}
                    className="text-sm tracking-wide transition-colors min-h-[44px] flex items-center text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-gray-300"
                  >
                    {item.label}
                  </Link>
                ),
              )}
              <Link
                href="/docs"
                className="text-sm tracking-wide transition-colors min-h-[44px] flex items-center text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-gray-300"
              >
                {t("docs")}
              </Link>
            </motion.div>
          )}

          <div className="flex items-center gap-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Link
                href="/app"
                className="text-sm tracking-wide font-medium transition-all duration-300 relative group min-h-[44px] flex items-center bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-400 dark:to-amber-500 bg-clip-text text-transparent"
              >
                {t("app")}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-400 dark:to-amber-500" />
              </Link>
            </motion.div>

            <LocaleSwitcher />

            {mounted && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg transition-all duration-300 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300"
                aria-label={t("toggleTheme")}
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: theme === "dark" ? 180 : 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {theme === "dark" ? (
                    <Moon className="w-5 h-5" />
                  ) : (
                    <Sun className="w-5 h-5" />
                  )}
                </motion.div>
              </motion.button>
            )}

            {/* Hamburger — mobile only */}
            {!isDocsPage && (
              <button
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label={t("toggleMenu")}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && !isDocsPage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[88px] bottom-0 z-40 md:hidden bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl"
          >
            <div className="flex flex-col px-6 py-4 space-y-1">
              {navItems.map((item) =>
                isLandingPage ? (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="w-full text-left px-4 py-3 min-h-[44px] text-base tracking-wide transition-colors rounded-lg text-gray-700 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-gray-800"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.id}
                    href={`/#${item.id}`}
                    className="w-full text-left px-4 py-3 min-h-[44px] text-base tracking-wide transition-colors rounded-lg text-gray-700 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-gray-800"
                  >
                    {item.label}
                  </Link>
                ),
              )}
              <Link
                href="/docs"
                className="w-full text-left px-4 py-3 min-h-[44px] text-base tracking-wide transition-colors rounded-lg text-gray-700 hover:bg-gray-100 dark:text-white/70 dark:hover:bg-gray-800"
              >
                {t("docs")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
