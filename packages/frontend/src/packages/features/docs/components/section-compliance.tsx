"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";
import { Lock, FileCheck, Timer } from "lucide-react";

export function SectionCompliance() {
  const t = useTranslations("docs");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const requirements = [
    {
      icon: Lock,
      titleKey: "compliance.requirements.privacy.title",
      descKey: "compliance.requirements.privacy.description",
      mechanismKey: "compliance.requirements.privacy.mechanism",
    },
    {
      icon: FileCheck,
      titleKey: "compliance.requirements.regulatory.title",
      descKey: "compliance.requirements.regulatory.description",
      mechanismKey: "compliance.requirements.regulatory.mechanism",
    },
    {
      icon: Timer,
      titleKey: "compliance.requirements.censorship.title",
      descKey: "compliance.requirements.censorship.description",
      mechanismKey: "compliance.requirements.censorship.mechanism",
    },
  ];

  const attackDefenseRows = [
    {
      attackKey: "compliance.complianceHash.attacks.row1.attack",
      defenseKey: "compliance.complianceHash.attacks.row1.defense",
    },
    {
      attackKey: "compliance.complianceHash.attacks.row2.attack",
      defenseKey: "compliance.complianceHash.attacks.row2.defense",
    },
    {
      attackKey: "compliance.complianceHash.attacks.row3.attack",
      defenseKey: "compliance.complianceHash.attacks.row3.defense",
    },
    {
      attackKey: "compliance.complianceHash.attacks.row4.attack",
      defenseKey: "compliance.complianceHash.attacks.row4.defense",
    },
  ];

  const withdrawalStages = [
    {
      labelKey: "compliance.withdrawal.stage1.label",
      descKey: "compliance.withdrawal.stage1.description",
      color: "amber",
    },
    {
      labelKey: "compliance.withdrawal.stage2a.label",
      descKey: "compliance.withdrawal.stage2a.description",
      color: "emerald",
    },
    {
      labelKey: "compliance.withdrawal.stage2b.label",
      descKey: "compliance.withdrawal.stage2b.description",
      color: "blue",
    },
  ];

  const visibilityObservers = [
    "compliance.visibility.depositor",
    "compliance.visibility.recipient",
    "compliance.visibility.operator",
    "compliance.visibility.public",
  ];

  const visibilityRows = [
    {
      labelKey: "compliance.visibility.depositAmount",
      cells: ["O", "O", "O", "O"],
    },
    {
      labelKey: "compliance.visibility.withdrawalAmount",
      cells: ["O", "O", "O", "O"],
    },
    {
      labelKey: "compliance.visibility.depositorAddress",
      cells: ["O", "X", "O", "O"],
    },
    {
      labelKey: "compliance.visibility.recipientStealth",
      cells: [
        "compliance.visibility.labels.creator",
        "O",
        "compliance.visibility.labels.noteDecrypt",
        "X",
      ],
    },
    {
      labelKey: "compliance.visibility.secret",
      cells: [
        "O",
        "X",
        "compliance.visibility.labels.operatorNote",
        "X",
      ],
    },
    {
      labelKey: "compliance.visibility.link",
      cells: [
        "compliance.visibility.labels.selfOnly",
        "compliance.visibility.labels.selfOnly",
        "compliance.visibility.labels.noteDecrypt",
        "X",
      ],
    },
    {
      labelKey: "compliance.visibility.compliancePreimage",
      cells: ["O", "X", "O", "X"],
    },
    {
      labelKey: "compliance.visibility.nsk",
      cells: [
        "compliance.visibility.labels.selfOnly",
        "compliance.visibility.labels.selfOnly",
        "X",
        "X",
      ],
    },
  ];

  const verificationSteps = [
    "compliance.verification.step1",
    "compliance.verification.step2",
    "compliance.verification.step3",
    "compliance.verification.step4",
  ];

  function renderVisibilityCell(cell: string) {
    if (cell === "O") {
      return (
        <span className="inline-block w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold leading-6 text-center">
          O
        </span>
      );
    }
    if (cell === "X") {
      return (
        <span className="inline-block w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold leading-6 text-center">
          X
        </span>
      );
    }
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
        {t(cell)}
      </span>
    );
  }

  return (
    <section id="compliance" className="scroll-mt-24 pt-6 pb-16">
      <div ref={ref} className="max-w-4xl mx-auto px-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {t("compliance.title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t("compliance.subtitle")}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {t("compliance.intro")}
          </p>
        </motion.div>

        {/* Three Requirements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("compliance.requirementsTitle")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {requirements.map((req, index) => (
              <motion.div
                key={req.titleKey}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 + index * 0.1 }}
                className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-amber-600/10 dark:bg-amber-400/10">
                  <req.icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                  {t(req.titleKey)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {t(req.descKey)}
                </p>
                <div className="text-xs font-mono px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {t(req.mechanismKey)}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Compliance Hash Binding */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("compliance.complianceHash.title")}
          </h3>
          <div className="rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-900 dark:bg-gray-950 p-6">
              <pre className="text-sm font-mono text-gray-300 leading-relaxed whitespace-pre overflow-x-auto">
                {t("compliance.complianceHash.formula")}
              </pre>
            </div>
          </div>
          <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("compliance.complianceHash.description")}
            </p>
          </div>
          <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {t("compliance.complianceHash.columnAttack")}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {t("compliance.complianceHash.columnDefense")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attackDefenseRows.map((row, index) => (
                  <tr
                    key={row.attackKey}
                    className={
                      index < attackDefenseRows.length - 1
                        ? "border-b border-gray-200 dark:border-gray-800"
                        : ""
                    }
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-white">
                      {t(row.attackKey)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {t(row.defenseKey)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* 2-Stage Withdrawal */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("compliance.withdrawal.title")}
          </h3>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
            <div className="space-y-6">
              {withdrawalStages.map((stage, index) => (
                <motion.div
                  key={stage.labelKey}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.35 + index * 0.1 }}
                  className="relative pl-14"
                >
                  <div
                    className={`absolute left-3.5 w-5 h-5 rounded-full border-2 ${
                      stage.color === "amber"
                        ? "border-amber-600 bg-amber-600/20 dark:border-amber-400 dark:bg-amber-400/20"
                        : stage.color === "emerald"
                          ? "border-emerald-600 bg-emerald-600/20 dark:border-emerald-400 dark:bg-emerald-400/20"
                          : "border-blue-600 bg-blue-600/20 dark:border-blue-400 dark:bg-blue-400/20"
                    }`}
                  />
                  <div className="border rounded-lg p-4 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
                    <h4 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">
                      {t(stage.labelKey)}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t(stage.descKey)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* KYC Registration Tree */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("compliance.kycTree.title")}
          </h3>
          <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("compliance.kycTree.description")}
            </p>
          </div>
        </motion.div>

        {/* Information Visibility Matrix */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("compliance.visibility.title")}
          </h3>
          <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {t("compliance.visibility.columnInfo")}
                    </th>
                    {visibilityObservers.map((obs) => (
                      <th
                        key={obs}
                        className="text-center px-4 py-3 font-semibold text-gray-900 dark:text-white"
                      >
                        {t(obs)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibilityRows.map((row, index) => (
                    <tr
                      key={row.labelKey}
                      className={
                        index < visibilityRows.length - 1
                          ? "border-b border-gray-200 dark:border-gray-800"
                          : ""
                      }
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">
                        {t(row.labelKey)}
                      </td>
                      {row.cells.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-4 py-3 text-center"
                        >
                          {renderVisibilityCell(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Operator Verification Process */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("compliance.verification.title")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {verificationSteps.map((stepKey, index) => (
              <motion.div
                key={stepKey}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.65 + index * 0.1 }}
                className="border rounded-lg p-4 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold shrink-0 border-amber-600 text-amber-600 bg-amber-600/5 dark:border-amber-400 dark:text-amber-400 dark:bg-amber-400/5">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 pt-1">
                    {t(stepKey)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Security Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <div className="border rounded-lg p-6 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t("compliance.securityNote")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
