"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowDown, Check, ExternalLink } from "lucide-react";

const linkClass =
  "underline underline-offset-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300";

function refLink(href: string) {
  return (chunks: React.ReactNode) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {chunks}
    </a>
  );
}

const richLinks = {
  paperLink: refLink(
    "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4563364",
  ),
  eipLink: refLink("https://eips.ethereum.org/EIPS/eip-5564"),
  eip191Link: refLink("https://eips.ethereum.org/EIPS/eip-191"),
  poseidonLink: refLink("https://eprint.iacr.org/2023/323"),
  poolsLink: refLink("https://www.privacypools.com/"),
  noirLink: refLink("https://noir-lang.org/"),
};

const references = [
  "paper",
  "eip5564",
  "eip191",
  "poseidon2",
  "privacyPools",
  "noir",
] as const;

const eciesSteps = ["step1", "step2", "step3", "step4", "step5"] as const;
const checkpointItems = ["item1", "item2", "item3", "item4", "item5"] as const;
const zkpProves = ["prove1", "prove2", "prove3"] as const;
const operatorSteps = ["operatorStep1", "operatorStep2", "operatorStep3"] as const;
const accessRows = ["observer", "operator", "contract"] as const;
const scanSteps = ["scanStep1", "scanStep2", "scanStep3", "scanStep4"] as const;

function Definition({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-r-lg my-4">
      <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
        {title}
      </h5>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {children}
      </p>
    </div>
  );
}

function Intuition({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 my-4 text-sm text-gray-500 dark:text-gray-500 italic">
      <span className="not-italic font-medium text-gray-600 dark:text-gray-400">
        Intuition —{" "}
      </span>
      {children}
    </div>
  );
}

function NumberedStep({
  num,
  children,
}: {
  num: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
        {num}
      </span>
      <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {children}
      </span>
    </li>
  );
}

function SectionDivider() {
  return <div className="my-12 border-t border-dashed border-gray-200 dark:border-gray-800" />;
}

export function SectionConcepts() {
  const t = useTranslations("docs");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.02 });

  return (
    <section
      id="concepts"
      ref={ref}
      className="scroll-mt-24 pt-6 pb-16 border-b border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-4xl mx-auto px-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl md:text-4xl tracking-tight mb-3 text-gray-900 dark:text-white">
            {t("concepts.title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t.rich("concepts.subtitle", richLinks)}
          </p>
        </motion.div>

        {/* ① Problem */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.problem.title")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("concepts.problem.desc")}
          </p>
          <div className="border rounded-lg p-5 bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {t("concepts.problem.question")}
            </p>
          </div>
        </motion.div>

        <SectionDivider />

        {/* ② Locker Idea + Commitment + Merkle Tree */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mb-8"
        >
          <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.locker.title")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {t("concepts.locker.desc")}
          </p>

          <Intuition>{t("concepts.locker.intuition")}</Intuition>

          {/* Commitment term */}
          <Definition title={t("concepts.locker.commitmentTitle")}>
            {t.rich("concepts.locker.commitmentDesc", richLinks)}
          </Definition>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-6">
            <code className="text-xs text-gray-700 dark:text-gray-300 font-mono break-all">
              {t("concepts.locker.commitmentFormula")}
            </code>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("concepts.locker.poseidonNote")}
          </p>

          {/* Merkle Tree */}
          <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            {t("concepts.merkle.title")}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("concepts.merkle.desc")}
          </p>
          <Definition title={t("concepts.merkle.termTitle")}>
            {t("concepts.merkle.termDesc")}
          </Definition>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t("concepts.merkle.specs")}
          </p>
        </motion.div>

        <SectionDivider />

        {/* ③ Key Delivery Problem + Stealth Address + ECIES/ECDH */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.keyDelivery.title")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("concepts.keyDelivery.naiveDesc")}
          </p>
          <div className="border rounded-lg p-4 bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 mb-6">
            <p className="text-sm text-red-800 dark:text-red-300">
              {t("concepts.keyDelivery.naiveProblem")}
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("concepts.keyDelivery.solutionIntro")}
          </p>

          {/* Term boxes */}
          <Definition title={t("concepts.keyDelivery.stealthTitle")}>
            {t.rich("concepts.keyDelivery.stealthTermDesc", richLinks)}
          </Definition>
          <Definition title={t("concepts.keyDelivery.eciesTitle")}>
            {t.rich("concepts.keyDelivery.eciesTermDesc", richLinks)}
          </Definition>
          <Definition title={t("concepts.keyDelivery.ecdhTitle")}>
            {t("concepts.keyDelivery.ecdhTermDesc")}
          </Definition>

          {/* ECDH math */}
          <div className="border rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 my-4 space-y-4">
            <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t("concepts.keyDelivery.ecdhMathTitle")}
            </h5>
            <div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-2">
                <code className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre">
                  {t("concepts.keyDelivery.ecdhMathKeys")}
                </code>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("concepts.keyDelivery.ecdhMathKeysDesc")}
              </p>
            </div>
            <div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-2">
                <code className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre">
                  {t("concepts.keyDelivery.ecdhMathShared")}
                </code>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("concepts.keyDelivery.ecdhMathSharedDesc")}
              </p>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <code className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre">
                  {t("concepts.keyDelivery.ecdhMathSecurity")}
                </code>
              </div>
            </div>
          </div>

          {/* ECIES flow steps */}
          <h4 className="text-lg font-semibold mb-4 mt-6 text-gray-900 dark:text-white">
            {t("concepts.keyDelivery.flowTitle")}
          </h4>
          <ol className="space-y-3 mb-4">
            {eciesSteps.map((step, i) => (
              <NumberedStep key={step} num={i + 1}>
                {t(`concepts.keyDelivery.${step}`)}
              </NumberedStep>
            ))}
          </ol>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed my-4">
            {t("concepts.keyDelivery.kdfDetail")}
          </p>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 my-4 overflow-x-auto">
            <code className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre">
              {t("concepts.keyDelivery.wireFormat")}
            </code>
          </div>
          <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30">
            <p className="text-sm text-green-800 dark:text-green-300">
              {t("concepts.keyDelivery.result")}
            </p>
          </div>
        </motion.div>

        <SectionDivider />

        {/* ④ Note Scanning — How Bob discovers his notes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mb-8"
        >
          <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.noteScanning.title")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("concepts.noteScanning.desc")}
          </p>

          <Definition title={t("concepts.noteScanning.viewTagTitle")}>
            {t("concepts.noteScanning.viewTagDesc")}
          </Definition>

          {/* How viewTag works */}
          <h4 className="text-lg font-semibold mb-3 mt-6 text-gray-900 dark:text-white">
            {t("concepts.noteScanning.howTitle")}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Sender side */}
            <div className="border rounded-lg p-4 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
              <h5 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">
                {t("concepts.noteScanning.senderSide")}
              </h5>
              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                  {t("concepts.noteScanning.senderStep1")}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                  {t("concepts.noteScanning.senderStep2")}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                  {t("concepts.noteScanning.senderStep3")}
                </p>
              </div>
            </div>

            {/* Receiver side */}
            <div className="border rounded-lg p-4 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
              <h5 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">
                {t("concepts.noteScanning.receiverSide")}
              </h5>
              <div className="space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                  {t("concepts.noteScanning.receiverStep1")}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                  {t("concepts.noteScanning.receiverStep2")}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                  {t("concepts.noteScanning.receiverStep3")}
                </p>
              </div>
            </div>
          </div>

          {/* Scanning flow */}
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.noteScanning.flowTitle")}
          </h4>
          <ol className="space-y-3 mb-4">
            {scanSteps.map((step, i) => (
              <NumberedStep key={step} num={i + 1}>
                {t(`concepts.noteScanning.${step}`)}
              </NumberedStep>
            ))}
          </ol>

          {/* Efficiency note */}
          <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {t("concepts.noteScanning.efficiency")}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mt-4">
            <code className="text-xs text-gray-700 dark:text-gray-300 font-mono">
              {t("concepts.noteScanning.falsePositiveRate")}
            </code>
          </div>
        </motion.div>

        <SectionDivider />

        {/* ⑤ Checkpoint */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.checkpoint.title")}
          </h3>
          <div className="border rounded-lg p-5 bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30">
            <ul className="space-y-2">
              {checkpointItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-green-800 dark:text-green-300"
                >
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{t(`concepts.checkpoint.${item}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <SectionDivider />

        {/* ⑥ Withdrawal Privacy Problem + ZKP */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mb-8"
        >
          <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.withdrawProblem.title")}
          </h3>

          <Intuition>{t("concepts.withdrawProblem.intuition")}</Intuition>

          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {t("concepts.withdrawProblem.onChainDesc")}
          </p>

          {/* Transform */}
          <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            {t("concepts.withdrawProblem.transformTitle")}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("concepts.withdrawProblem.transformDesc")}
          </p>

          {/* ZKP term */}
          <Definition title={t("concepts.withdrawProblem.zkpTitle")}>
            {t("concepts.withdrawProblem.zkpTermDesc")}
          </Definition>

          {/* What ZKP proves */}
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-3 mt-4">
            {t("concepts.withdrawProblem.zkpProves")}
          </p>
          <ul className="space-y-2 mb-6">
            {zkpProves.map((key) => (
              <li
                key={key}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="text-amber-600 dark:text-amber-400 mt-0.5">▸</span>
                <span>{t(`concepts.withdrawProblem.${key}`)}</span>
              </li>
            ))}
          </ul>

          {/* Constraints preview table */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.withdrawProblem.constraintCol")}
                  </th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.withdrawProblem.formulaCol")}
                  </th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.withdrawProblem.purposeCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(["c1", "c2", "c3", "c4", "c5", "c6"] as const).map((c) => (
                  <tr key={c} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                      {t(`concepts.withdrawProblem.${c}Name`)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400 font-mono text-xs">
                      {t(`concepts.withdrawProblem.${c}Formula`)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      {t(`concepts.withdrawProblem.${c}Purpose`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nullifier */}
          <Definition title={t("concepts.withdrawProblem.nullifierTitle")}>
            {t("concepts.withdrawProblem.nullifierDesc")}
          </Definition>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <code className="text-xs text-gray-700 dark:text-gray-300 font-mono break-all">
              {t("concepts.withdrawProblem.nullifierFormula")}
            </code>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {t("concepts.withdrawProblem.provingTime")}
          </p>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mt-2">
            <code className="text-xs text-gray-700 dark:text-gray-300 font-mono whitespace-pre">
              {t("concepts.withdrawProblem.domainSeparators")}
            </code>
          </div>
        </motion.div>

        <SectionDivider />

        {/* ⑦ Compliance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8"
        >
          <h3 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.compliance.title")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            {t("concepts.compliance.dilemma")}
          </p>

          <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            {t("concepts.compliance.solutionTitle")}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t.rich("concepts.compliance.solutionDesc", richLinks)}
          </p>

          {/* Compliance Hash */}
          <Definition title={t("concepts.compliance.hashTitle")}>
            {t("concepts.compliance.hashDesc")}
          </Definition>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-6">
            <code className="text-xs text-gray-700 dark:text-gray-300 font-mono break-all">
              {t("concepts.compliance.hashFormula")}
            </code>
          </div>

          {/* Operator role */}
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.compliance.operatorTitle")}
          </h4>
          <ol className="space-y-3 mb-4">
            {operatorSteps.map((step, i) => (
              <NumberedStep key={step} num={i + 1}>
                {t(`concepts.compliance.${step}`)}
              </NumberedStep>
            ))}
          </ol>

          {/* Operator knows */}
          <div className="border rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30 mb-6">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t("concepts.compliance.operatorKnows")}
            </p>
          </div>

          {/* Access matrix */}
          <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.compliance.accessTitle")}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.compliance.accessHeaderWho")}
                  </th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.compliance.accessHeaderKnows")}
                  </th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.compliance.accessHeaderCannot")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {accessRows.map((row) => (
                  <tr
                    key={row}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                      {t(`concepts.compliance.access${row.charAt(0).toUpperCase() + row.slice(1)}`)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      {t(`concepts.compliance.access${row.charAt(0).toUpperCase() + row.slice(1)}Knows`)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      {t(`concepts.compliance.access${row.charAt(0).toUpperCase() + row.slice(1)}Cannot`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Threat matrix */}
          <h4 className="text-lg font-semibold mb-4 mt-8 text-gray-900 dark:text-white">
            {t("concepts.compliance.threatTitle")}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.compliance.threatAttackCol")}
                  </th>
                  <th className="text-left py-2 px-3 text-gray-900 dark:text-white font-semibold">
                    {t("concepts.compliance.threatDefenseCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {([1, 2, 3, 4] as const).map((n) => (
                  <tr key={n} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3 text-gray-900 dark:text-white">
                      {t(`concepts.compliance.threatAttack${n}`)}
                    </td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                      {t(`concepts.compliance.threatDefense${n}`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30 mt-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {t("concepts.compliance.trustAssumption")}
            </p>
          </div>
        </motion.div>

        <SectionDivider />

        {/* ⑧ Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          <h3 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("concepts.summary.title")}
          </h3>
          <div className="flex flex-col items-center gap-2 mb-6">
            {(["deposit", "withdraw"] as const).map((phase, i) => (
              <div key={phase} className="flex flex-col items-center w-full max-w-lg">
                <div className="w-full border rounded-lg p-4 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-center">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                    {t(`concepts.summary.${phase}Label`)}
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    {t(`concepts.summary.${phase}Desc`)}
                  </p>
                </div>
                {i < 1 && (
                  <ArrowDown className="w-4 h-4 text-gray-300 dark:text-gray-600 my-1" />
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("concepts.summary.observerConclusion")}
            </p>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t("concepts.summary.operatorConclusion")}
            </p>
          </div>
        </motion.div>

        <SectionDivider />

        {/* ⑨ References */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {t("concepts.references.title")}
          </h3>
          <ul className="space-y-3">
            {references.map((ref) => (
              <li key={ref} className="flex items-start gap-2 text-sm">
                <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t.rich(`concepts.references.${ref}`, richLinks)}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
