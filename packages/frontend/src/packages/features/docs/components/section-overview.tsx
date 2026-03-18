"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";

const comparisonItems = ["privacy", "compliance", "traceability"] as const;
const systems = ["traditional", "tornado", "latent"] as const;

const layers = [
  { key: "stealthAddress", color: "amber" },
  { key: "encryptedNote", color: "blue" },
  { key: "privacyPool", color: "purple" },
  { key: "zkProof", color: "green" },
] as const;

const observers = [
  "publicObserver",
  "recipient",
  "operator",
  "regulator",
] as const;
const accessItems = [
  "txExists",
  "amount",
  "senderIdentity",
  "recipientIdentity",
  "senderAddress",
] as const;

const architectureComponents = [
  { key: "client", color: "amber" },
  { key: "offChain", color: "blue" },
  { key: "onChain", color: "purple" },
  { key: "circuit", color: "green" },
] as const;

export function SectionOverview() {
  const t = useTranslations("docs");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section
      id="overview"
      ref={ref}
      className="scroll-mt-24 pb-16 border-b border-gray-200 dark:border-gray-800"
    >
      <div className="space-y-16">
        {/* Document Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-4xl tracking-tight mb-6 bg-gradient-to-r from-gray-800 via-gray-600 to-gray-800 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
            {t("overview.title")}
          </h2>
          <div className="space-y-4 text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            <p>{t("overview.intro1")}</p>
            <p>{t("overview.intro2")}</p>
            <p>
              {t.rich("overview.intro3", {
                paperLink: (chunks) => (
                  <a
                    href="https://edoc.unibas.ch/entities/publication/c7accf16-4638-48e3-8197-bb648a0be3ce"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                  >
                    {chunks}
                  </a>
                ),
                eipLink: (chunks) => (
                  <a
                    href="https://eips.ethereum.org/EIPS/eip-5564"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                  >
                    {chunks}
                  </a>
                ),
                poolsLink: (chunks) => (
                  <a
                    href="https://privacypools.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                  >
                    {chunks}
                  </a>
                ),
                noirLink: (chunks) => (
                  <a
                    href="https://aztec.network/noir"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="space-y-4"
        >
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("overview.comparisonTitle")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-3 pr-6 font-semibold text-gray-900 dark:text-white" />
                  {systems.map((system) => (
                    <th
                      key={system}
                      className="text-left py-3 pr-6 font-semibold text-gray-900 dark:text-white"
                    >
                      {t(`overview.comparison.${system}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonItems.map((item, i) => (
                  <tr
                    key={item}
                    className={
                      i < comparisonItems.length - 1
                        ? "border-b border-gray-100 dark:border-gray-800/50"
                        : ""
                    }
                  >
                    <td className="py-3 pr-6 font-medium text-gray-700 dark:text-gray-300">
                      {t(`overview.comparison.labels.${item}`)}
                    </td>
                    {systems.map((system) => (
                      <td
                        key={system}
                        className="py-3 pr-6 text-gray-600 dark:text-gray-400"
                      >
                        {t(`overview.comparison.${system}.${item}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* 4-Layer Mechanism */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("overview.layersTitle")}
          </h3>
          <div className="space-y-3">
            {layers.map((layer, i) => {
              const colorMap = {
                amber: "text-amber-600 dark:text-amber-400",
                blue: "text-blue-600 dark:text-blue-400",
                purple: "text-purple-600 dark:text-purple-400",
                green: "text-green-600 dark:text-green-400",
              };
              return (
                <motion.div
                  key={layer.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                  className="flex items-start gap-4"
                >
                  <span
                    className={`text-xs font-mono mt-1 shrink-0 ${colorMap[layer.color]}`}
                  >
                    L{i + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {t(`overview.layers.${layer.key}.name`)}
                    </span>
                    <span className="mx-2 text-gray-400">·</span>
                    <span className="text-sm font-mono text-gray-500 dark:text-gray-500">
                      {t(`overview.layers.${layer.key}.tech`)}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {t(`overview.layers.${layer.key}.description`)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Information Access Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="space-y-4"
        >
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("overview.matrixTitle")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-3 pr-6 font-semibold text-gray-900 dark:text-white">
                    {t("overview.matrix.information")}
                  </th>
                  {observers.map((observer) => (
                    <th
                      key={observer}
                      className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white"
                    >
                      {t(`overview.matrix.observers.${observer}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accessItems.map((item, i) => (
                  <tr
                    key={item}
                    className={
                      i < accessItems.length - 1
                        ? "border-b border-gray-100 dark:border-gray-800/50"
                        : ""
                    }
                  >
                    <td className="py-3 pr-6 font-medium text-gray-700 dark:text-gray-300">
                      {t(`overview.matrix.items.${item}.label`)}
                    </td>
                    {observers.map((observer) => {
                      const val = t(
                        `overview.matrix.items.${item}.${observer}`,
                      );
                      const isAccessible = val === "O";
                      return (
                        <td key={observer} className="text-center py-3 px-4">
                          <span
                            className={`font-bold ${
                              isAccessible
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-500 dark:text-red-400"
                            }`}
                          >
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* System Architecture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="space-y-4"
        >
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("overview.architectureTitle")}
          </h3>
          <div className="space-y-3">
            {architectureComponents.map((comp, i) => {
              const colorMap = {
                amber: "text-amber-600 dark:text-amber-400",
                blue: "text-blue-600 dark:text-blue-400",
                purple: "text-purple-600 dark:text-purple-400",
                green: "text-green-600 dark:text-green-400",
              };
              return (
                <motion.div
                  key={comp.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.08 }}
                  className="flex items-start gap-4"
                >
                  <span
                    className={`text-sm font-bold mt-0.5 shrink-0 ${colorMap[comp.color]}`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {t(`overview.architecture.${comp.key}.name`)}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {t(`overview.architecture.${comp.key}.description`)}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(
                        t(
                          `overview.architecture.${comp.key}.tags`,
                        ) as string
                      )
                        .split(",")
                        .map((tag: string) => (
                          <span
                            key={tag}
                            className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          >
                            {tag.trim()}
                          </span>
                        ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
