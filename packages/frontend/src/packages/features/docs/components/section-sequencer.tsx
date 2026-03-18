"use client";

import { Fragment, useRef } from "react";
import { motion, useInView } from "motion/react";
import { Server, Scan, Shield } from "lucide-react";
import { useTranslations } from "next-intl";

const INSERT_ALGORITHM = `insert(leaf):
  nodes["0:leafIndex"] = leaf
  for level 0..31:
    sibling = nodes[level:siblingIdx] ?? zeroHashes[level]
    parent = H(current, sibling)
    nodes[level+1:idx/2] = parent
  root = current`;

export function SectionSequencer() {
  const t = useTranslations("docs");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const roles = [
    {
      icon: Server,
      titleKey: "sequencer.roles.treeManager.title",
      descKey: "sequencer.roles.treeManager.description",
    },
    {
      icon: Scan,
      titleKey: "sequencer.roles.noteScanner.title",
      descKey: "sequencer.roles.noteScanner.description",
    },
    {
      icon: Shield,
      titleKey: "sequencer.roles.operatorService.title",
      descKey: "sequencer.roles.operatorService.description",
    },
  ];

  const endpoints = [
    {
      category: "sequencer.api.categories.relayerCompatible",
      items: [
        { method: "GET", endpoint: "/health", descKey: "sequencer.api.health" },
        { method: "GET", endpoint: "/root", descKey: "sequencer.api.root" },
        {
          method: "GET",
          endpoint: "/proof/:leafIndex",
          descKey: "sequencer.api.proofLeaf",
        },
      ],
    },
    {
      category: "sequencer.api.categories.merkle",
      items: [
        { method: "GET", endpoint: "/stats", descKey: "sequencer.api.stats" },
        {
          method: "GET",
          endpoint: "/proofs",
          descKey: "sequencer.api.proofs",
        },
      ],
    },
    {
      category: "sequencer.api.categories.noteScanner",
      items: [
        { method: "GET", endpoint: "/notes", descKey: "sequencer.api.notes" },
      ],
    },
    {
      category: "sequencer.api.categories.registration",
      items: [
        {
          method: "GET",
          endpoint: "/registration/root",
          descKey: "sequencer.api.registrationRoot",
        },
        {
          method: "GET",
          endpoint: "/registration/proof/:npk",
          descKey: "sequencer.api.registrationProof",
        },
      ],
    },
    {
      category: "sequencer.api.categories.operatorPublic",
      items: [
        {
          method: "GET",
          endpoint: "/operator/pubkey",
          descKey: "sequencer.api.operatorPubkey",
        },
      ],
    },
    {
      category: "sequencer.api.categories.operatorAuth",
      items: [
        {
          method: "POST",
          endpoint: "/operator/register",
          descKey: "sequencer.api.operatorRegister",
        },
        {
          method: "GET",
          endpoint: "/operator/users",
          descKey: "sequencer.api.operatorUsers",
        },
        {
          method: "GET",
          endpoint: "/operator/withdrawals",
          descKey: "sequencer.api.operatorWithdrawals",
        },
        {
          method: "GET",
          endpoint: "/operator/withdrawals/:nullifier",
          descKey: "sequencer.api.operatorWithdrawalByNullifier",
        },
        {
          method: "POST",
          endpoint: "/operator/attest/:nullifier",
          descKey: "sequencer.api.operatorAttest",
        },
        {
          method: "POST",
          endpoint: "/operator/decrypt",
          descKey: "sequencer.api.operatorDecrypt",
        },
      ],
    },
  ];

  return (
    <section
      id="sequencer"
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
            {t("sequencer.title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t("sequencer.subtitle")}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {t("sequencer.intro")}
          </p>
        </motion.div>

        {/* 3 Roles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sequencer.rolesTitle")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role, index) => (
              <motion.div
                key={role.titleKey}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 + index * 0.1 }}
                className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-amber-600/10 dark:bg-amber-400/10">
                  <role.icon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                  {t(role.titleKey)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(role.descKey)}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Incremental Merkle Tree */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sequencer.merkle.title")}
          </h3>
          <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("sequencer.merkle.description")}
            </p>
          </div>
          <div className="rounded-lg overflow-hidden">
            <div className="bg-gray-900 dark:bg-gray-950 p-6">
              <pre className="text-sm font-mono text-gray-300 leading-relaxed whitespace-pre overflow-x-auto">
                {INSERT_ALGORITHM}
              </pre>
            </div>
          </div>
        </motion.div>

        {/* HTTP API */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sequencer.api.title")}
          </h3>
          <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {t("sequencer.api.columnMethod")}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {t("sequencer.api.columnEndpoint")}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {t("sequencer.api.columnDescription")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((group) => (
                    <Fragment key={group.category}>
                      <tr
                        className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-800/30"
                      >
                        <td
                          colSpan={3}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500"
                        >
                          {t(group.category)}
                        </td>
                      </tr>
                      {group.items.map((item) => (
                        <tr
                          key={item.endpoint}
                          className="border-b border-gray-200 dark:border-gray-800 last:border-b-0"
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                item.method === "GET"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}
                            >
                              {item.method}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-300">
                            {item.endpoint}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {t(item.descKey)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Batch Strategy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
            {t("sequencer.batch.title")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
              <div className="text-3xl font-bold mb-2 text-amber-600 dark:text-amber-400">
                100
              </div>
              <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                {t("sequencer.batch.countTitle")}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("sequencer.batch.countDescription")}
              </p>
            </div>
            <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
              <div className="text-3xl font-bold mb-2 text-amber-600 dark:text-amber-400">
                30s
              </div>
              <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                {t("sequencer.batch.timeTitle")}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("sequencer.batch.timeDescription")}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
