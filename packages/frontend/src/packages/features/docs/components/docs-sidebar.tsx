"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Globe,
  Blocks,
  ArrowRightLeft,
  Cpu,
  FileCode,
  Server,
  Code,
  Shield,
} from "lucide-react";
import { useTranslations } from "next-intl";

const sections = [
  { id: "overview", icon: Globe },
  { id: "concepts", icon: Blocks },
  { id: "protocol", icon: ArrowRightLeft },
  { id: "circuit", icon: Cpu },
  { id: "contracts", icon: FileCode },
  { id: "sequencer", icon: Server },
  { id: "sdk", icon: Code },
  { id: "compliance", icon: Shield },
] as const;

export function DocsSidebar() {
  const t = useTranslations("docs");
  const [activeSection, setActiveSection] = useState<string>("overview");

  useEffect(() => {
    function updateActiveSection() {
      const navbarOffset = 96;
      let currentId: string = sections[0].id;

      for (const { id } of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= navbarOffset + 1) {
          currentId = id;
        }
      }

      setActiveSection(currentId);
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <nav className="w-64 shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto hidden lg:block">
      <ul className="space-y-1">
        {sections.map(({ id, icon: Icon }) => {
          const isActive = activeSection === id;

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => handleClick(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
                  isActive
                    ? "text-amber-600 dark:text-amber-400 bg-amber-600/10 dark:bg-amber-400/10"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t(`sidebar.${id}`)}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 w-0.5 h-5 bg-amber-600 dark:bg-amber-400 rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
