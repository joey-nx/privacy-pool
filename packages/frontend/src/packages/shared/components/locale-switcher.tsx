"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "~i18n/navigation";
import type { Locale } from "~i18n/config";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <div className="flex items-center border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700">
      <button
        onClick={() => switchLocale("en")}
        className={`px-2 py-1 text-xs font-medium transition-colors ${
          locale === "en"
            ? "bg-amber-600 text-white dark:bg-amber-500"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => switchLocale("ko")}
        className={`px-2 py-1 text-xs font-medium transition-colors ${
          locale === "ko"
            ? "bg-amber-600 text-white dark:bg-amber-500"
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        KO
      </button>
    </div>
  );
}
