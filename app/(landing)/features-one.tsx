"use client";

import { useRef } from "react";
import { BentoGrid, BentoGridItem } from "@/components/magicui/bento-grid";
import { MagicCard } from "@/components/magicui/magic-card";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import NumberTicker from "@/components/magicui/number-ticker";

import {
  FileSearch,
  Network,
  UploadCloud,
  Share2,
  Database,
  Lock,
  FileText,
  Brain,
  MessageSquare,
  Bot,
  Zap,
  ArrowRight,
} from "lucide-react";

// RAG Pipeline Steps
const pipelineSteps = [
  {
    icon: FileText,
    title: "Document Ingestion",
    description: "Upload and parse documents from multiple sources",
    color: "from-blue-500 to-cyan-500",
    stats: "10k+ docs/min"
  },
  {
    icon: Brain,
    title: "AI Processing",
    description: "Extract embeddings and semantic understanding",
    color: "from-purple-500 to-pink-500",
    stats: "99.9% accuracy"
  },
  {
    icon: Database,
    title: "Vector Storage",
    description: "Store in optimized vector database for fast retrieval",
    color: "from-green-500 to-emerald-500",
    stats: "<50ms query"
  },
  {
    icon: MessageSquare,
    title: "Intelligent Answers",
    description: "Generate contextual responses with citations",
    color: "from-orange-500 to-red-500",
    stats: "Human-like responses"
  },
];

export default function FeaturesOne() {
  const containerRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);

  const stepRefs = [step1Ref, step2Ref, step3Ref, step4Ref];

  return (
    <section className="pt-8 pb-4 md:pt-12 md:pb-6 relative overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-6">
            <div className="text-center mb-8 sm:mb-12 md:mb-16">
                <h2 className="text-foreground text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 px-4">How RAG Intelligence Works</h2>
                <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-3xl mx-auto px-4">
                  Experience the future of document intelligence with our advanced RAG pipeline that transforms raw data into conversational AI
                </p>
            </div>
            
            {/* Interactive Pipeline Visualization - Mobile Optimized */}
            <div ref={containerRef} className="relative mb-12 sm:mb-16">
              {/* Desktop Horizontal Layout (md and up) */}
              <div className="hidden md:flex justify-between items-center gap-6 relative">
                {pipelineSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  return (
                    <div
                      key={step.title}
                      ref={stepRefs[index]}
                      className="flex-1 max-w-xs"
                    >
                      <MagicCard className="p-6 text-center h-64 flex flex-col justify-center">
                        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-4`}>
                          <StepIcon className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-white">{step.title}</h3>
                        <p className="text-gray-400 text-sm mb-3 leading-relaxed">{step.description}</p>
                        <div className="text-cyan-400 font-mono text-xs bg-black/50 rounded px-2 py-1">
                          {step.stats}
                        </div>
                      </MagicCard>
                    </div>
                  );
                })}

                {/* Animated Beams connecting the steps - Desktop only */}
                {stepRefs.slice(0, -1).map((_, index) => (
                  <AnimatedBeam
                    key={index}
                    containerRef={containerRef}
                    fromRef={stepRefs[index]}
                    toRef={stepRefs[index + 1]}
                    duration={2}
                    delay={index * 0.5}
                    curvature={0}
                    gradientStartColor="#9333ea"
                    gradientStopColor="#06b6d4"
                  />
                ))}
              </div>

              {/* Mobile Vertical Layout (md and below) */}
              <div className="md:hidden space-y-6">
                {pipelineSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={step.title} className="relative">
                      <MagicCard className="p-6 text-center">
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-4`}>
                          <StepIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">{step.title}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-3">{step.description}</p>
                        <div className="text-cyan-400 font-mono text-xs bg-black/50 rounded px-2 py-1 inline-block">
                          {step.stats}
                        </div>
                      </MagicCard>
                      {/* Arrow between steps on mobile */}
                      {index < pipelineSteps.length - 1 && (
                        <div className="flex justify-center my-3">
                          <ArrowRight className="w-6 h-6 text-purple-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance Metrics Cards - Mobile Optimized */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
              <MagicCard className="p-4 sm:p-6 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-purple-400 mb-2">
                  <NumberTicker value={99.9} decimalPlaces={1} />%
                </div>
                <p className="text-gray-400 text-sm sm:text-base">Answer Accuracy</p>
              </MagicCard>
              
              <MagicCard className="p-4 sm:p-6 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-cyan-400 mb-2">
                  <NumberTicker value={47} />ms
                </div>
                <p className="text-gray-400 text-sm sm:text-base">Average Response Time</p>
              </MagicCard>
              
              <MagicCard className="p-4 sm:p-6 text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-400 mb-2">
                  <NumberTicker value={1000000} />+
                </div>
                <p className="text-gray-400 text-sm sm:text-base">Documents Processed</p>
              </MagicCard>
            </div>

            {/* Feature Highlights - Mobile Optimized */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <MagicCard className="p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Lightning Fast Retrieval</h3>
                    <p className="text-gray-400 text-sm sm:text-base leading-relaxed">Advanced vector search with semantic understanding for instant, relevant results from massive document collections.</p>
                  </div>
                </div>
              </MagicCard>

              <MagicCard className="p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold mb-2 text-white">Enterprise Security</h3>
                    <p className="text-gray-400 text-sm sm:text-base leading-relaxed">End-to-end encryption, role-based access control, and compliance with industry standards like SOC2 and GDPR.</p>
                  </div>
                </div>
              </MagicCard>
            </div>
        </div>
    </section>
  );
}