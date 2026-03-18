"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useTranslations } from "next-intl";
import {
  Send,
  UserCheck,
  Eye,
  ShieldCheck,
  GitBranch,
  Lock,
  Cpu,
  ArrowRight,
} from "lucide-react";

const steps = [1, 2, 3, 4, 5, 6, 7] as const;

const actorGroups = [
  { key: "public", color: "green", actors: ["alice", "bob", "observer"] },
  { key: "trusted", color: "amber", actors: ["operator", "sequencer"] },
  { key: "onChain", color: "purple", actors: ["pool", "circuit"] },
] as const;

const actorIcons: Record<string, React.ElementType> = {
  alice: Send,
  bob: UserCheck,
  observer: Eye,
  operator: ShieldCheck,
  sequencer: GitBranch,
  pool: Lock,
  circuit: Cpu,
};

const flowPhases = ["setup", "transfer", "claim"] as const;

const flowColors: Record<string, { border: string; bg: string; text: string }> = {
  setup: {
    border: "border-blue-500/50 dark:border-blue-400/40",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  transfer: {
    border: "border-amber-500/50 dark:border-amber-400/40",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  claim: {
    border: "border-green-500/50 dark:border-green-400/40",
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-300",
  },
};

const groupBadgeColors: Record<string, string> = {
  green: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
};

const recipientNoteSegments = [
  { key: "ephemeralPubKey", bytes: 33, color: "bg-amber-500/80 dark:bg-amber-500/60" },
  { key: "ciphertext", bytes: 128, color: "bg-blue-500/80 dark:bg-blue-500/60" },
  { key: "mac", bytes: 32, color: "bg-purple-500/80 dark:bg-purple-500/60" },
  { key: "viewTag", bytes: 1, color: "bg-green-500/80 dark:bg-green-500/60" },
] as const;

const operatorNoteSegments = [
  { key: "ephemeralPubKey", bytes: 33, color: "bg-amber-500/80 dark:bg-amber-500/60" },
  { key: "ciphertext", bytes: 32, color: "bg-blue-500/80 dark:bg-blue-500/60" },
  { key: "mac", bytes: 32, color: "bg-purple-500/80 dark:bg-purple-500/60" },
] as const;

export function SectionProtocol() {
  const t = useTranslations("docs");

  const titleRef = useRef(null);
  const actorsRef = useRef(null);
  const flowRef = useRef(null);
  const seqDiagramRef = useRef(null);
  const timelineRef = useRef(null);
  const notesRef = useRef(null);

  const titleInView = useInView(titleRef, { once: true, amount: 0.05 });
  const actorsInView = useInView(actorsRef, { once: true, amount: 0.1 });
  const flowInView = useInView(flowRef, { once: true, amount: 0.1 });
  const seqDiagramInView = useInView(seqDiagramRef, { once: true, amount: 0.05 });
  const timelineInView = useInView(timelineRef, { once: true, amount: 0.05 });
  const notesInView = useInView(notesRef, { once: true, amount: 0.1 });

  const actors = ["sender", "recipient", "contract", "sequencer", "operator"] as const;

  const seqMessages: {
    from: number;
    to: number;
    msgKey: string;
    selfNote?: boolean;
  }[] = [
    { from: 1, to: 0, msgKey: "m1" },
    { from: 0, to: 2, msgKey: "m2" },
    { from: 3, to: 2, msgKey: "m3" },
    { from: 3, to: 2, msgKey: "m4" },
    { from: 1, to: 3, msgKey: "m5" },
    { from: 3, to: 1, msgKey: "m6" },
    { from: 1, to: 1, msgKey: "m7", selfNote: true },
    { from: 1, to: 2, msgKey: "m8" },
    { from: 4, to: 4, msgKey: "m9", selfNote: true },
    { from: 4, to: 2, msgKey: "m10" },
    { from: 2, to: 1, msgKey: "m11" },
  ];

  return (
    <section
      id="protocol"
      className="scroll-mt-24 pt-6 pb-16 border-b border-gray-200 dark:border-gray-800"
    >
      <div className="space-y-16">
        {/* Title + Subtitle */}
        <motion.div
          ref={titleRef}
          initial={{ opacity: 0, y: 30 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl tracking-tight mb-4 bg-gradient-to-r from-gray-800 via-gray-600 to-gray-800 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
            {t("protocol.title")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t("protocol.subtitle")}
          </p>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {t("protocol.intro")}
          </p>
        </motion.div>

        {/* ① Actors Grid */}
        <div ref={actorsRef} className="space-y-6">
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={actorsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-2xl font-semibold text-gray-900 dark:text-white"
          >
            {t("protocol.actorsTitle")}
          </motion.h3>

          <div className="space-y-8">
            {actorGroups.map((group, gi) => (
              <motion.div
                key={group.key}
                initial={{ opacity: 0, y: 20 }}
                animate={actorsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: gi * 0.15 }}
                className="space-y-3"
              >
                {/* Group header */}
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${groupBadgeColors[group.color]}`}
                  >
                    {t(`protocol.actorGroups.${group.key}.label`)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-500">
                    {t(`protocol.actorGroups.${group.key}.description`)}
                  </span>
                </div>

                {/* Actor cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.actors.map((actor, ai) => {
                    const Icon = actorIcons[actor];
                    return (
                      <motion.div
                        key={actor}
                        initial={{ opacity: 0, y: 10 }}
                        animate={actorsInView ? { opacity: 1, y: 0 } : {}}
                        transition={{
                          duration: 0.4,
                          delay: gi * 0.15 + ai * 0.08,
                        }}
                        className="border rounded-lg p-4 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${groupBadgeColors[group.color]}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {t(`protocol.actors.${actor}.name`)}
                              </h4>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                {t(`protocol.actors.${actor}.tag`)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                              {t(`protocol.actors.${actor}.description`)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ② User Flow Overview */}
        <div ref={flowRef} className="space-y-6">
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={flowInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-2xl font-semibold text-gray-900 dark:text-white"
          >
            {t("protocol.flowTitle")}
          </motion.h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {flowPhases.map((phase, i) => {
              const colors = flowColors[phase];
              return (
                <div key={phase} className="flex items-stretch gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={flowInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: i * 0.15 }}
                    className={`flex-1 border-l-4 ${colors.border} border rounded-lg p-5 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}
                      >
                        {i + 1}
                      </span>
                      <h4
                        className={`text-base font-semibold ${colors.text}`}
                      >
                        {t(`protocol.flow.${phase}.title`)}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                      {t(`protocol.flow.${phase}.description`)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {t(`protocol.flow.${phase}.actors`)}
                      </span>
                    </div>
                  </motion.div>

                  {/* Arrow between phases (hidden on mobile, hidden after last) */}
                  {i < flowPhases.length - 1 && (
                    <div className="hidden md:flex items-center">
                      <ArrowRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ③ Sequence Diagram */}
        <div ref={seqDiagramRef} className="space-y-6">
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={seqDiagramInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-2xl font-semibold text-gray-900 dark:text-white"
          >
            {t("protocol.sequenceDiagramTitle")}
          </motion.h3>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={seqDiagramInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="border rounded-lg bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 overflow-x-auto"
          >
            <div className="min-w-[640px] p-6">
              {/* Actor headers */}
              <div className="grid grid-cols-5 gap-0 mb-2">
                {actors.map((actor) => (
                  <div key={actor} className="flex justify-center">
                    <div className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-800 dark:text-amber-300 text-center">
                      {t(`protocol.sequenceDiagram.actors.${actor}`)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Lifelines + Messages */}
              <div className="relative">
                {/* Vertical lifelines */}
                {actors.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-dashed border-gray-300 dark:border-gray-700"
                    style={{ left: `${(i + 0.5) * 20}%` }}
                  />
                ))}

                {/* Messages */}
                <div className="relative space-y-0">
                  {seqMessages.map((msg, i) => {
                    const leftCol = Math.min(msg.from, msg.to);
                    const rightCol = Math.max(msg.from, msg.to);
                    const goesLeft = msg.to < msg.from;

                    if (msg.selfNote) {
                      return (
                        <motion.div
                          key={msg.msgKey}
                          initial={{ opacity: 0 }}
                          animate={seqDiagramInView ? { opacity: 1 } : {}}
                          transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                          className="relative h-12 flex items-center"
                        >
                          <div
                            className="absolute flex items-center"
                            style={{
                              left: `${(msg.from + 0.5) * 20}%`,
                              transform: "translateX(4px)",
                            }}
                          >
                            <div className="border border-dashed border-gray-400 dark:border-gray-600 rounded-md px-2.5 py-1 ml-1">
                              <span className="text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {t(
                                  `protocol.sequenceDiagram.messages.${msg.msgKey}`,
                                )}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div
                        key={msg.msgKey}
                        initial={{ opacity: 0 }}
                        animate={seqDiagramInView ? { opacity: 1 } : {}}
                        transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                        className="relative h-12 flex items-center"
                      >
                        {/* Arrow line */}
                        <div
                          className="absolute h-px bg-gray-400 dark:bg-gray-600"
                          style={{
                            left: `${(leftCol + 0.5) * 20}%`,
                            width: `${(rightCol - leftCol) * 20}%`,
                          }}
                        />
                        {/* Arrowhead */}
                        <div
                          className="absolute w-0 h-0"
                          style={{
                            left: `${(msg.to + 0.5) * 20}%`,
                            transform: goesLeft
                              ? "translateX(-4px)"
                              : "translateX(-4px)",
                            borderTop: "4px solid transparent",
                            borderBottom: "4px solid transparent",
                            ...(goesLeft
                              ? {
                                  borderRight:
                                    "6px solid rgb(156 163 175 / 1)",
                                }
                              : {
                                  borderLeft:
                                    "6px solid rgb(156 163 175 / 1)",
                                }),
                          }}
                        />
                        {/* Label */}
                        <div
                          className="absolute -top-3 pointer-events-none"
                          style={{
                            left: `${((leftCol + rightCol + 1) * 10)}%`,
                            transform: "translateX(-50%)",
                          }}
                        >
                          <span className="text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap bg-white/80 dark:bg-gray-900/80 px-1.5 rounded">
                            {t(
                              `protocol.sequenceDiagram.messages.${msg.msgKey}`,
                            )}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Actor footers */}
              <div className="grid grid-cols-5 gap-0 mt-2">
                {actors.map((actor) => (
                  <div key={actor} className="flex justify-center">
                    <div className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-800 dark:text-amber-300 text-center">
                      {t(`protocol.sequenceDiagram.actors.${actor}`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ④ 7-Step Timeline */}
        <div ref={timelineRef} className="space-y-4">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            {t("protocol.timelineTitle")}
          </h3>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />

            <div className="space-y-4">
              {steps.map((step, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={timelineInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.15 + i * 0.1 }}
                  className="relative pl-14"
                >
                  {/* Step number circle */}
                  <div className="absolute left-0 top-4 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500 dark:border-amber-400 flex items-center justify-center z-10">
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      {step}
                    </span>
                  </div>

                  <div className="border-l-4 border-l-amber-500/50 dark:border-l-amber-400/40 border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t(`protocol.steps.${step}.title`)}
                      </h4>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 w-fit">
                        {t(`protocol.steps.${step}.actor`)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {t(`protocol.steps.${step}.description`)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-3 leading-relaxed">
                      {t(`protocol.steps.${step}.detail`)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-500">
                        {t("protocol.privacyMechanism")}:
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                        {t(`protocol.steps.${step}.privacy`)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ④ Encrypted Note Structure */}
        <motion.div
          ref={notesRef}
          initial={{ opacity: 0, y: 20 }}
          animate={notesInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="space-y-8"
        >
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("protocol.noteStructureTitle")}
          </h3>

          {/* Recipient Note */}
          <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("protocol.recipientNote.title")}
              </h4>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                194 bytes
              </span>
            </div>

            {/* Bar visualization */}
            <div className="flex w-full rounded-md overflow-hidden h-10">
              {recipientNoteSegments.map((seg) => (
                <div
                  key={seg.key}
                  className={`${seg.color} flex items-center justify-center text-xs font-mono text-white font-medium`}
                  style={{
                    width: `${(seg.bytes / 194) * 100}%`,
                    minWidth: seg.bytes < 5 ? "2rem" : undefined,
                  }}
                >
                  {seg.bytes}B
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              {recipientNoteSegments.map((seg) => (
                <div key={seg.key} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${seg.color}`} />
                  <span className="text-gray-600 dark:text-gray-400">
                    {t(`protocol.recipientNote.fields.${seg.key}`)} ({seg.bytes}B)
                  </span>
                </div>
              ))}
            </div>

            {/* Decrypted contents */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2">
                {t("protocol.recipientNote.decryptedTitle")}
              </p>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {["amount", "senderPublicKey", "blindingFactor", "memo"].map(
                  (field) => (
                    <li key={field} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                      {t(`protocol.recipientNote.decrypted.${field}`)}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>

          {/* Operator Note */}
          <div className="border rounded-lg p-6 bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("protocol.operatorNote.title")}
              </h4>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                97 bytes
              </span>
            </div>

            {/* Bar visualization */}
            <div className="flex w-full rounded-md overflow-hidden h-10">
              {operatorNoteSegments.map((seg) => (
                <div
                  key={seg.key}
                  className={`${seg.color} flex items-center justify-center text-xs font-mono text-white font-medium`}
                  style={{ width: `${(seg.bytes / 97) * 100}%` }}
                >
                  {seg.bytes}B
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              {operatorNoteSegments.map((seg) => (
                <div key={seg.key} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${seg.color}`} />
                  <span className="text-gray-600 dark:text-gray-400">
                    {t(`protocol.operatorNote.fields.${seg.key}`)} ({seg.bytes}B)
                  </span>
                </div>
              ))}
            </div>

            {/* Decrypted contents */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2">
                {t("protocol.operatorNote.decryptedTitle")}
              </p>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                  {t("protocol.operatorNote.decrypted.secret")}
                </li>
              </ul>
            </div>

            {/* On-chain data note */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-2">
                {t("protocol.operatorNote.onChainTitle")}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t("protocol.operatorNote.onChainDesc")}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
