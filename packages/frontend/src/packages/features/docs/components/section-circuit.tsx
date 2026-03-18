"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";

export function SectionCircuit() {
  const t = useTranslations("docs");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const constraints = [
    {
      num: 1,
      name: t("circuit.c1Name"),
      formula: t("circuit.c1Formula"),
      purpose: t("circuit.c1Purpose"),
    },
    {
      num: 2,
      name: t("circuit.c2Name"),
      formula: t("circuit.c2Formula"),
      purpose: t("circuit.c2Purpose"),
    },
    {
      num: 3,
      name: t("circuit.c3Name"),
      formula: t("circuit.c3Formula"),
      purpose: t("circuit.c3Purpose"),
    },
    {
      num: 4,
      name: t("circuit.c4Name"),
      formula: t("circuit.c4Formula"),
      purpose: t("circuit.c4Purpose"),
    },
    {
      num: 5,
      name: t("circuit.c5Name"),
      formula: t("circuit.c5Formula"),
      purpose: t("circuit.c5Purpose"),
    },
    {
      num: 6,
      name: t("circuit.c6Name"),
      formula: t("circuit.c6Formula"),
      purpose: t("circuit.c6Purpose"),
    },
  ];

  const poseidonRows = [
    {
      fn: "hash_2",
      inputs: 2,
      usage: t("circuit.poseidon.hash2Usage"),
    },
    {
      fn: "hash_3",
      inputs: 3,
      usage: t("circuit.poseidon.hash3Usage"),
    },
    {
      fn: "hash_5",
      inputs: 5,
      usage: t("circuit.poseidon.hash5Usage"),
    },
    {
      fn: "hash_6",
      inputs: 6,
      usage: t("circuit.poseidon.hash6Usage"),
    },
  ];

  const domainSeparators = [
    { name: "COMMITMENT", value: 1 },
    { name: "NULLIFIER", value: 2 },
    { name: "MERKLE", value: 3 },
    { name: "COMPLIANCE", value: 4 },
    { name: "NPK", value: 5 },
  ];

  const perfRows = [
    {
      metric: "Expression Width",
      keccak: "7,065",
      poseidon: "207",
      improvement: "34x",
    },
    {
      metric: "Proving Time",
      keccak: "5.14s",
      poseidon: "0.18s",
      improvement: "29x",
    },
    {
      metric: "Peak Memory",
      keccak: "1.74GB",
      poseidon: "34MB",
      improvement: "51x",
    },
  ];

  return (
    <section
      id="circuit"
      ref={ref}
      className="scroll-mt-24 pt-6 pb-16 border-b border-gray-200 dark:border-gray-800"
    >
      <div className="max-w-4xl mx-auto px-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <h2 className="text-3xl md:text-4xl tracking-tight mb-3 text-gray-900 dark:text-white">
            {t("circuit.title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t("circuit.subtitle")}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {t("circuit.intro")}
          </p>
        </motion.div>

        {/* Circuit Signature */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">
            {t("circuit.signatureTitle")}
          </h3>
          <div className="rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-700 dark:border-gray-800 p-5 overflow-x-auto">
            <pre className="font-mono text-sm leading-relaxed text-gray-100">
              <span className="text-amber-400">fn</span>{" "}
              <span className="text-blue-400">main</span>(
              {"\n"}
              <span className="text-gray-500">{"  "}// Private inputs</span>
              {"\n"}
              {"  "}secret: <span className="text-green-400">Field</span>,
              {"\n"}
              {"  "}nullifier_secret_key:{" "}
              <span className="text-green-400">Field</span>,{"\n"}
              {"  "}nullifier_pub_key:{" "}
              <span className="text-green-400">Field</span>,{"\n"}
              {"  "}merkle_siblings:{" "}
              <span className="text-green-400">[Field; 32]</span>,{"\n"}
              {"  "}path_indices:{" "}
              <span className="text-green-400">[Field; 32]</span>,{"\n"}
              {"  "}note_amount:{" "}
              <span className="text-green-400">Field</span>,{"\n"}
              {"  "}note_block_number:{" "}
              <span className="text-green-400">Field</span>,{"\n"}
              {"  "}note_depositor:{" "}
              <span className="text-green-400">Field</span>,{"\n"}
              {"  "}transfer_amount:{" "}
              <span className="text-green-400">Field</span>,{"\n"}
              {"  "}registration_siblings:{" "}
              <span className="text-green-400">[Field; 16]</span>,{"\n"}
              {"  "}registration_path_indices:{" "}
              <span className="text-green-400">[Field; 16]</span>,{"\n"}
              <span className="text-gray-500">
                {"  "}// Public inputs
              </span>
              {"\n"}
              {"  "}expected_root:{" "}
              <span className="text-purple-400">pub Field</span>,{"\n"}
              {"  "}nullifier:{" "}
              <span className="text-purple-400">pub Field</span>,{"\n"}
              {"  "}amount:{" "}
              <span className="text-purple-400">pub Field</span>,{"\n"}
              {"  "}recipient:{" "}
              <span className="text-purple-400">pub Field</span>,{"\n"}
              {"  "}compliance_hash:{" "}
              <span className="text-purple-400">pub Field</span>,{"\n"}
              {"  "}expected_registration_root:{" "}
              <span className="text-purple-400">pub Field</span>,{"\n"}
              )
            </pre>
          </div>
        </motion.div>

        {/* 6 Constraints Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">
            {t("circuit.constraintsTitle")}
          </h3>
          <div className="border rounded-lg overflow-hidden bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 w-10">
                      #
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.constraintCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.formulaCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.purposeCol")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {constraints.map((c) => (
                    <tr
                      key={c.num}
                      className="border-b border-gray-100 dark:border-gray-800/50 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-500">
                        {c.num}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-200">
                        {c.name}
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                          {c.formula}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {c.purpose}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Poseidon2 Sponge Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-2 text-gray-900 dark:text-white">
            {t("circuit.poseidonTitle")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("circuit.poseidonDesc")}
          </p>
          <div className="border rounded-lg overflow-hidden bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.poseidon.functionCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.poseidon.inputsCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.poseidon.usageCol")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {poseidonRows.map((row) => (
                    <tr
                      key={row.fn}
                      className="border-b border-gray-100 dark:border-gray-800/50 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                          {row.fn}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-200">
                        {row.inputs}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {row.usage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Domain Separators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-2 text-gray-900 dark:text-white">
            {t("circuit.domainTitle")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {t("circuit.domainDesc")}
          </p>
          <div className="flex flex-wrap gap-3">
            {domainSeparators.map((ds) => (
              <code
                key={ds.name}
                className="font-mono text-sm px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              >
                {ds.name}={ds.value}
              </code>
            ))}
          </div>
        </motion.div>

        {/* Performance Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">
            {t("circuit.perfTitle")}
          </h3>
          <div className="border rounded-lg overflow-hidden bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.perfMetricCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      keccak256
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      Poseidon2
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("circuit.perfImprovementCol")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {perfRows.map((row) => (
                    <tr
                      key={row.metric}
                      className="border-b border-gray-100 dark:border-gray-800/50 last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">
                        {row.metric}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {row.keccak}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {row.poseidon}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          {row.improvement}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
