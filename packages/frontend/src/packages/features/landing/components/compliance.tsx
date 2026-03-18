"use client";

import { motion } from "motion/react";
import {
  Shield,
  Eye,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";

export function Compliance() {
  const t = useTranslations("compliance");

  const pillars = [
    {
      icon: Lock,
      title: t("pillar1Title"),
      subtitle: t("pillar1Subtitle"),
      desc: t("pillar1Desc"),
      mechanism: t("pillar1Mechanism"),
    },
    {
      icon: Shield,
      title: t("pillar2Title"),
      subtitle: t("pillar2Subtitle"),
      desc: t("pillar2Desc"),
      mechanism: t("pillar2Mechanism"),
    },
    {
      icon: CheckCircle,
      title: t("pillar3Title"),
      subtitle: t("pillar3Subtitle"),
      desc: t("pillar3Desc"),
      mechanism: t("pillar3Mechanism"),
    },
  ];

  const operatorSteps = [
    { step: t("opStep1Num"), title: t("opStep1Title"), desc: t("opStep1Desc") },
    { step: t("opStep2Num"), title: t("opStep2Title"), desc: t("opStep2Desc") },
    { step: t("opStep3Num"), title: t("opStep3Title"), desc: t("opStep3Desc") },
    { step: t("opStep4Num"), title: t("opStep4Title"), desc: t("opStep4Desc") },
  ];

  const publicLabels = [
    t("publicLabel1"),
    t("publicLabel2"),
    t("publicLabel3"),
    t("publicLabel4"),
  ];

  const operatorItems = [
    { label: t("publicLabel1"), value: t("operatorValue1") },
    { label: t("publicLabel2"), value: t("operatorValue2") },
    { label: t("publicLabel3"), value: t("operatorValue3") },
    { label: t("publicLabel4"), value: t("operatorValue4") },
  ];

  return (
    <section id="compliance" className="relative py-32 px-6 overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-20 left-10 w-96 h-96 rounded-full blur-3xl bg-gray-300/20 dark:bg-gray-600/10"
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl bg-gray-300/20 dark:bg-gray-600/10"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.1, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="inline-block mb-4 px-4 py-2 border border-gray-300/40 bg-gray-200/20 dark:border-gray-500/30 dark:bg-gray-500/5">
            <span className="text-sm tracking-widest uppercase text-gray-600 dark:text-gray-400">
              {t("label")}
            </span>
          </div>
          <h2 className="text-4xl md:text-6xl tracking-tight mb-6 text-gray-900 dark:text-white">
            {t("heading")}
            <br />
            <span className="text-gradient">{t("headingHighlight")}</span>
          </h2>
          <p className="text-lg max-w-3xl mx-auto text-gray-600 dark:text-white/60">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Three Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: idx * 0.2 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 to-gray-700/10 dark:from-gray-400/5 dark:to-gray-600/5 opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl" />
              <div className="relative p-8 border backdrop-blur-sm transition-all duration-500 border-gray-200 bg-white/60 group-hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/40 dark:group-hover:border-gray-700">
                <div className="inline-flex p-4 mb-6 bg-gradient-to-br from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700">
                  <pillar.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl mb-2 text-gray-900 dark:text-white">
                  {pillar.title}
                </h3>
                <p className="text-sm mb-4 tracking-wide text-gray-600 dark:text-gray-400">
                  {pillar.subtitle}
                </p>
                <p className="mb-4 leading-relaxed text-gray-600 dark:text-white/60">
                  {pillar.desc}
                </p>
                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-xs uppercase tracking-wider mb-2 text-gray-500 dark:text-white/40">
                    {t("mechanism")}
                  </p>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {pillar.mechanism}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Information Visibility */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-24"
        >
          <h3 className="text-3xl mb-6 text-center text-gray-900 dark:text-white">
            {t("privacyFirstHeading")} <span className="text-gradient">{t("privacyFirstHighlight")}</span>
          </h3>
          <p className="text-lg text-center mb-16 max-w-3xl mx-auto text-gray-600 dark:text-white/60">
            {t("privacyFirstDesc").split("\n").map((line: string, i: number) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Public View */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className="card-surface p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-gray-400 to-gray-600 dark:from-gray-600 dark:to-gray-800">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl text-gray-900 dark:text-white">
                      {t("publicObserverTitle")}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-white/50">
                      {t("publicObserverSubtitle")}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {publicLabels.map((label, i) => (
                    <div
                      key={i}
                      className="p-4 border bg-gray-50 border-gray-200 dark:bg-black/50 dark:border-gray-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700 dark:text-white/70">
                          {label}
                        </span>
                        <XCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="h-6 rounded flex items-center px-3 bg-gray-100 dark:bg-white/5">
                        <span className="text-xs font-mono text-gray-400 dark:text-white/30">
                          {i === 3 ? t("publicUninferable") : t("publicHidden")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-white/60">
                      {t("publicNote")}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Operator View */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              <div className="border backdrop-blur-sm p-8 border-gray-400 bg-gray-100/50 dark:border-gray-600 dark:bg-gray-800/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-gradient-to-br from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl text-gray-900 dark:text-white">
                      {t("operatorTitle")}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t("operatorSubtitle")}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {operatorItems.map((item, i) => (
                    <div
                      key={i}
                      className="p-4 border bg-white border-gray-300 dark:bg-black/30 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-700 dark:text-white/70">
                          {item.label}
                        </span>
                        <CheckCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="h-6 rounded flex items-center px-3 bg-gray-200 dark:bg-gray-700/50">
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                          {item.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-700">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-white/60">
                      {t("operatorNote")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-3 -right-3">
                <div className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-gray-500 to-gray-600 shadow-[0_0_20px_rgba(75,85,99,0.3)] dark:from-gray-600 dark:to-gray-700 dark:shadow-[0_0_20px_rgba(156,163,175,0.3)]">
                  {t("conditionalAccess")}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Key Message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mt-12 max-w-4xl mx-auto"
          >
            <div className="p-6 border border-gray-300 bg-gradient-to-r from-gray-100/50 to-transparent dark:border-gray-700 dark:from-gray-800/50 dark:to-transparent">
              <div className="flex items-start gap-4">
                <div className="p-2 flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                  <Eye className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h4 className="text-lg mb-2 text-gray-700 dark:text-gray-300">
                    {t("keyMessageTitle")}
                  </h4>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-white/70">
                    {t.rich("keyMessageContent", {
                      highlight: (chunks) => (
                        <span className="font-medium text-gray-700 dark:text-gray-400">
                          {chunks}
                        </span>
                      ),
                    })}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* 2-Stage Withdrawal */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h3 className="text-3xl mb-12 text-center text-gray-900 dark:text-white">
            <span className="text-gradient">{t("twoStageHeading").split(" ")[0]}</span>{" "}
            {t("twoStageHeading").split(" ").slice(1).join(" ")}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Stage 1 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="card-surface p-8"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center w-12 h-12 text-white text-2xl font-light btn-primary">
                  1
                </div>
                <div>
                  <h4 className="text-xl text-gray-900 dark:text-white">
                    {t("stage1Title")}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t("stage1Subtitle")}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {[t("stage1Step1"), t("stage1Step2"), t("stage1Step3")].map(
                  (text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm text-gray-600 dark:text-white/60">
                        {text}
                      </p>
                    </div>
                  ),
                )}
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                <code className="text-xs font-mono text-gray-700 dark:text-gray-300">
                  initiateWithdrawal(proof, publicInputs)
                </code>
              </div>
            </motion.div>

            {/* Stage 2 */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="card-surface p-8"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center justify-center w-12 h-12 text-white text-2xl font-light btn-primary">
                  2
                </div>
                <div>
                  <h4 className="text-xl text-gray-900 dark:text-white">
                    {t("stage2Title")}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t("stage2Subtitle")}
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t("operatorApproval")}
                    </p>
                  </div>
                  <p className="text-xs ml-7 text-gray-600 dark:text-white/60">
                    {t("operatorApprovalDesc")}
                  </p>
                  <code className="text-xs font-mono ml-7 block mt-2 text-gray-700 dark:text-gray-300">
                    attestWithdrawal(nullifier)
                  </code>
                </div>
                <div className="border-t pt-4 border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t("timeoutTitle")}
                    </p>
                  </div>
                  <p className="text-xs ml-7 text-gray-600 dark:text-white/60">
                    {t("timeoutDesc")}
                  </p>
                  <code className="text-xs font-mono ml-7 block mt-2 text-gray-700 dark:text-gray-300">
                    claimWithdrawal(nullifier)
                  </code>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Operator Verification */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-24"
        >
          <h3 className="text-3xl mb-12 text-center text-gray-900 dark:text-white">
            {t("operatorVerificationHeading")}
          </h3>

          <div className="max-w-4xl mx-auto">
            <div className="card-surface p-8">
              <div className="space-y-6">
                {operatorSteps.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                    className="flex items-start gap-6 group"
                  >
                    <div className="flex items-center justify-center w-10 h-10 flex-shrink-0 group-hover:scale-110 transition-transform duration-300 text-white text-sm font-medium btn-primary">
                      {item.step}
                    </div>
                    <div className="flex-1 pt-1">
                      <h4 className="text-lg mb-2 transition-colors duration-300 text-gray-900 group-hover:text-gray-600 dark:text-white dark:group-hover:text-gray-400">
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-white/60">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Security Note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-8 p-6 border border-gray-300 bg-gray-100/50 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 flex-shrink-0 mt-1 text-gray-600 dark:text-gray-400" />
                <div>
                  <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-400">
                    {t("securityGuaranteeTitle")}
                  </h4>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-white/60">
                    {t("securityGuaranteeNote")}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
