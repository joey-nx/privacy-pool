"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";

export function SectionSdk() {
  const t = useTranslations("docs");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const modules = [
    { path: "core/crypto.ts", descKey: "sdk.modules.crypto" },
    { path: "core/keys.ts", descKey: "sdk.modules.keys" },
    { path: "core/merkle.ts", descKey: "sdk.modules.merkle" },
    { path: "core/notes.ts", descKey: "sdk.modules.notes" },
    { path: "proving/witness.ts", descKey: "sdk.modules.witness" },
    { path: "proving/prover.ts", descKey: "sdk.modules.prover" },
    { path: "chain/wallet.ts", descKey: "sdk.modules.wallet" },
    { path: "chain/contracts.ts", descKey: "sdk.modules.contracts" },
    { path: "api/sequencer.ts", descKey: "sdk.modules.sequencer" },
  ];

  const keyDerivationSteps = [
    { label: "personal_sign", descKey: "sdk.keyDerivation.step1" },
    { label: "keccak256", descKey: "sdk.keyDerivation.step2" },
    { label: "nsk", descKey: "sdk.keyDerivation.step3" },
    { label: "npk", descKey: "sdk.keyDerivation.step4" },
    { label: "encPubKey", descKey: "sdk.keyDerivation.step5" },
  ];

  const noteScanningSteps = [
    { step: "01", descKey: "sdk.noteScanning.step1" },
    { step: "02", descKey: "sdk.noteScanning.step2" },
    { step: "03", descKey: "sdk.noteScanning.step3" },
  ];

  const proofPipelineSteps = [
    { step: "01", descKey: "sdk.proofPipeline.step1" },
    { step: "02", descKey: "sdk.proofPipeline.step2" },
    { step: "03", descKey: "sdk.proofPipeline.step3" },
    { step: "04", descKey: "sdk.proofPipeline.step4" },
    { step: "05", descKey: "sdk.proofPipeline.step5" },
  ];

  const provingTimes = [
    {
      deviceKey: "sdk.provingTime.desktop",
      timeKey: "sdk.provingTime.desktopTime",
    },
    {
      deviceKey: "sdk.provingTime.mobileLatest",
      timeKey: "sdk.provingTime.mobileLatestTime",
    },
    {
      deviceKey: "sdk.provingTime.mobileMidRange",
      timeKey: "sdk.provingTime.mobileMidRangeTime",
    },
  ];

  const clientMethods = [
    "init()",
    "connect()",
    "deriveKeys()",
    "scanMyNotes()",
    "getPrivacyBalance()",
    "deposit()",
    "withdraw()",
    "claimWithdrawal()",
  ];

  return (
    <section
      id="sdk"
      className="scroll-mt-24 pt-6 pb-16 border-b border-gray-200 dark:border-gray-800"
    >
      <div ref={ref} className="max-w-4xl mx-auto px-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {t("sdk.title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t("sdk.subtitle")}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {t("sdk.intro")}
          </p>
        </motion.div>

        {/* Module Structure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sdk.modulesTitle")}
          </h3>
          <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
            {modules.map((mod, index) => (
              <div
                key={mod.path}
                className={`flex items-center gap-4 px-6 py-3 ${
                  index < modules.length - 1
                    ? "border-b border-gray-200 dark:border-gray-800"
                    : ""
                }`}
              >
                <code className="text-sm font-mono text-amber-600 dark:text-amber-400 shrink-0 min-w-[180px]">
                  {mod.path}
                </code>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t(mod.descKey)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Key Derivation Flow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sdk.keyDerivation.title")}
          </h3>
          <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <div className="flex flex-col items-center gap-2">
              {keyDerivationSteps.map((step, index) => (
                <div key={step.label} className="flex flex-col items-center">
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-950">
                      <code className="text-sm font-mono text-amber-400">
                        {step.label}
                      </code>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                      {t(step.descKey)}
                    </span>
                  </div>
                  {index < keyDerivationSteps.length - 1 && (
                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 my-1" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-6 text-center">
              {t("sdk.keyDerivation.note")}
            </p>
          </div>
        </motion.div>

        {/* Note Scanning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sdk.noteScanning.title")}
          </h3>
          <div className="space-y-4">
            {noteScanningSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.35 + index * 0.1 }}
                className="flex gap-4 items-start"
              >
                <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold shrink-0 border-amber-600 text-amber-600 bg-amber-600/5 dark:border-amber-400 dark:text-amber-400 dark:bg-amber-400/5">
                  {step.step}
                </div>
                <div className="border rounded-lg p-4 flex-1 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(step.descKey)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Proof Generation Pipeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sdk.proofPipeline.title")}
          </h3>
          <div className="space-y-4">
            {proofPipelineSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.45 + index * 0.1 }}
                className="flex gap-4 items-start"
              >
                <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold shrink-0 border-amber-600 text-amber-600 bg-amber-600/5 dark:border-amber-400 dark:text-amber-400 dark:bg-amber-400/5">
                  {step.step}
                </div>
                <div className="border rounded-lg p-4 flex-1 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(step.descKey)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Proving Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sdk.provingTime.title")}
          </h3>
          <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {t("sdk.provingTime.columnDevice")}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {t("sdk.provingTime.columnTime")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {provingTimes.map((row, index) => (
                  <tr
                    key={row.deviceKey}
                    className={
                      index < provingTimes.length - 1
                        ? "border-b border-gray-200 dark:border-gray-800"
                        : ""
                    }
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {t(row.deviceKey)}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-600 dark:text-amber-400">
                      {t(row.timeKey)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Client API */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sdk.clientApi.title")}
          </h3>
          <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
            {clientMethods.map((method, index) => (
              <div
                key={method}
                className={`flex items-center gap-4 px-6 py-3 ${
                  index < clientMethods.length - 1
                    ? "border-b border-gray-200 dark:border-gray-800"
                    : ""
                }`}
              >
                <code className="text-sm font-mono text-amber-600 dark:text-amber-400 shrink-0 min-w-[180px]">
                  {method}
                </code>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t(`sdk.clientApi.${method.replace("()", "")}`)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
