"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";

export function SectionContracts() {
  const t = useTranslations("docs");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const roleFunctions = [
    {
      role: "User",
      fn: "deposit()",
      description: t("contracts.roleUser"),
    },
    {
      role: "Relayer",
      fn: "proposeRoot()",
      description: t("contracts.roleRelayerPropose"),
    },
    {
      role: "Relayer",
      fn: "setRelayer()",
      description: t("contracts.roleRelayerSet"),
    },
    {
      role: "Operator",
      fn: "confirmRoot()",
      description: t("contracts.roleOperatorConfirm"),
    },
    {
      role: "Operator",
      fn: "updateRegistrationRoot()",
      description: t("contracts.roleOperatorRegistration"),
    },
    {
      role: "Operator",
      fn: "attestWithdrawal()",
      description: t("contracts.roleOperatorAttest"),
    },
    {
      role: "Anyone",
      fn: "claimWithdrawal()",
      description: t("contracts.roleAnyoneClaim"),
    },
  ];

  const stateVariables = [
    {
      name: "commitments[index]",
      description: t("contracts.stateCommitments"),
    },
    {
      name: "knownRoots[root]",
      description: t("contracts.stateKnownRoots"),
    },
    {
      name: "currentRoot",
      description: t("contracts.stateCurrentRoot"),
    },
    {
      name: "pendingRoot",
      description: t("contracts.statePendingRoot"),
    },
    {
      name: "nullifiers[nullifier]",
      description: t("contracts.stateNullifiers"),
    },
    {
      name: "knownRegistrationRoots[root]",
      description: t("contracts.stateRegistrationRoots"),
    },
    {
      name: "pendingWithdrawals[nullifier]",
      description: t("contracts.statePendingWithdrawals"),
    },
  ];

  const events = [
    "Deposit",
    "EncryptedNote",
    "RootProposed",
    "RootConfirmed",
    "WithdrawalInitiated",
    "WithdrawalAttested",
    "WithdrawalClaimed",
    "RelayerUpdated",
    "RegistrationRootUpdated",
  ];

  return (
    <section
      id="contracts"
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
            {t("contracts.title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t("contracts.subtitle")}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {t("contracts.intro")}
          </p>
        </motion.div>

        {/* Role-Based Functions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">
            {t("contracts.roleFunctionsTitle")}
          </h3>
          <div className="border rounded-lg overflow-hidden bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("contracts.roleCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("contracts.functionCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("contracts.descriptionCol")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roleFunctions.map((row, index) => (
                    <tr
                      key={`${row.role}-${row.fn}`}
                      className="border-b border-gray-100 dark:border-gray-800/50 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        {index === 0 ||
                        roleFunctions[index - 1].role !== row.role ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                            {row.role}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                          {row.fn}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* On-Chain State Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">
            {t("contracts.stateTitle")}
          </h3>
          <div className="border rounded-lg overflow-hidden bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("contracts.stateVarCol")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">
                      {t("contracts.descriptionCol")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stateVariables.map((sv) => (
                    <tr
                      key={sv.name}
                      className="border-b border-gray-100 dark:border-gray-800/50 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300">
                          {sv.name}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {sv.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">
            {t("contracts.eventsTitle")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {events.map((event) => (
              <code
                key={event}
                className="font-mono text-sm px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40"
              >
                {event}
              </code>
            ))}
          </div>
        </motion.div>

        {/* Dual-Approval Root */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-10"
        >
          <h3 className="text-xl font-medium mb-4 text-gray-900 dark:text-white">
            {t("contracts.dualApprovalTitle")}
          </h3>
          <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {t("contracts.dualApprovalDesc")}
            </p>
          </div>
        </motion.div>

        {/* Tests Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="border rounded-lg p-4 bg-gray-50/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {t("contracts.testsNote")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
