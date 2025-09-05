"use client";

import HeroSection from "./hero-section";
import FeaturesOne from "./features-one";
import { BentoGrid, BentoGridItem } from "@/components/magicui/bento-grid";
import Testimonials from "./testimonials";
import FAQs from "./faqs";
import Footer from "./footer";
import CustomClerkPricing from "@/components/custom-clerk-pricing";
import PixelCard from "@/components/react-bits/pixel-card";
import ActivePixelCard from "@/components/react-bits/active-pixel-card";
import { InfiniteSlider } from "@/components/motion-primitives/infinite-slider";
import { AnimatedListCustom } from "./animated-list-custom";
import Panel from "@/components/magicui/panel";
import ShineBorder from "@/components/magicui/shine-border";
import DotPattern from "@/components/magicui/dot-pattern";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { SpotlightCard } from "@/components/magicui/spotlight-card";
import { OrbitingCircles } from "@/components/magicui/orbiting-circles";
import NumberTicker from "@/components/magicui/number-ticker";
import { useRef } from "react";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const card4Ref = useRef<HTMLDivElement>(null);

  const cardRefs = [card1Ref, card2Ref, card3Ref, card4Ref];

  return (
    <div className="relative min-h-screen">
      {/* Global dot pattern background across entire page */}
      <DotPattern 
        className="fixed inset-0 z-[-10]" 
        size={32}
        dotSize={2}
        color="rgba(255,255,255,0.3)"
        opacity={0.6}
      />
      <HeroSection />
      {/* Logo/tech marquee */}
      <section className="py-4 sm:py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Panel animated duration={14} className="p-4 sm:p-6">
              <InfiniteSlider speed={40} speedOnHover={80} gap={32} className="opacity-90">
                {[
                  { label: "Clerk", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
                  { label: "Supabase", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
                  { label: "Convex", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
                  { label: "Pinecone", color: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
                  { label: "OpenAI", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
                  { label: "Gemini", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
                  { label: "LangChain", color: "bg-lime-500/15 text-lime-300 border-lime-500/30" },
                  { label: "Next.js", color: "bg-zinc-800/60 text-zinc-100 border-white/10" },
                ].map(({ label, color }) => (
                  <span
                    key={label}
                    className={`rounded-full border px-4 py-2 sm:px-6 sm:py-3 lg:px-8 lg:py-3 text-sm sm:text-lg lg:text-xl font-semibold tracking-tight ${color} backdrop-blur-sm transition-transform duration-200 hover:scale-105 shadow-[0_0_0_1px] shadow-white/5`}
                  >
                    {label}
                  </span>
                ))}
              </InfiniteSlider>
          </Panel>
        </div>
      </section>
      <FeaturesOne />
      <section className="py-8 md:py-12 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-6 sm:mb-8 md:mb-12 lg:mb-16 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">Why Choose Our Platform?</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Discover the core advantages that make our RAG platform the industry leader
            </p>
          </div>
          
          {/* Interactive Platform Advantages with PixelCard Effects - Mobile Optimized */}
          <div ref={containerRef} className="relative mb-8 sm:mb-12 lg:mb-16 px-4">
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 relative">
              {/* Card 1 - Contextual Understanding - Mobile Optimized */}
              <div ref={card1Ref} className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
                <SpotlightCard
                  className="h-48 sm:h-56 md:h-64 p-4 sm:p-6 md:p-8 transition-all duration-300 hover:scale-[1.02] group"
                  radius={150}
                  strength={0.3}
                >
                  <div className="flex flex-col justify-center text-center h-full space-y-2 sm:space-y-3 md:space-y-4">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white group-hover:text-purple-200 transition-colors">
                      Contextual Understanding
                    </h3>
                    <p className="text-gray-300 text-sm sm:text-base md:text-lg leading-relaxed group-hover:text-gray-100 transition-colors">
                      Our RAG agent deeply understands your documents, providing highly relevant answers with perfect context awareness.
                    </p>
                  </div>
                </SpotlightCard>
              </div>

              {/* Card 2 - Seamless Integration - Mobile Optimized */}
              <div ref={card2Ref} className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
                <SpotlightCard
                  className="h-48 sm:h-56 md:h-64 p-4 sm:p-6 md:p-8 transition-all duration-300 hover:scale-[1.02] group"
                  radius={150}
                  strength={0.3}
                >
                  <div className="flex flex-col justify-center text-center h-full space-y-2 sm:space-y-3 md:space-y-4">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white group-hover:text-purple-200 transition-colors">
                      Seamless Integration
                    </h3>
                    <p className="text-gray-300 text-sm sm:text-base md:text-lg leading-relaxed group-hover:text-gray-100 transition-colors">
                      Easily integrate with your existing data sources and workflows through our comprehensive API ecosystem.
                    </p>
                  </div>
                </SpotlightCard>
              </div>

              {/* Card 3 - Scalable Knowledge Base - Mobile Optimized */}
              <div ref={card3Ref} className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
                <SpotlightCard
                  className="h-48 sm:h-56 md:h-64 p-4 sm:p-6 md:p-8 transition-all duration-300 hover:scale-[1.02] group"
                  radius={150}
                  strength={0.3}
                >
                  <div className="flex flex-col justify-center text-center h-full space-y-2 sm:space-y-3 md:space-y-4">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white group-hover:text-purple-200 transition-colors">
                      Scalable Knowledge Base
                    </h3>
                    <p className="text-gray-300 text-sm sm:text-base md:text-lg leading-relaxed group-hover:text-gray-100 transition-colors">
                      Grow your knowledge base without compromising on performance or accuracy, handling millions of documents.
                    </p>
                  </div>
                </SpotlightCard>
              </div>

              {/* Card 4 - Real-time Insights - Mobile Optimized */}
              <div ref={card4Ref} className="relative overflow-hidden rounded-2xl sm:rounded-3xl">
                <SpotlightCard
                  className="h-48 sm:h-56 md:h-64 p-4 sm:p-6 md:p-8 transition-all duration-300 hover:scale-[1.02] group"
                  radius={150}
                  strength={0.3}
                >
                  <div className="flex flex-col justify-center text-center h-full space-y-2 sm:space-y-3 md:space-y-4">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white group-hover:text-purple-200 transition-colors">
                      Real-time Insights
                    </h3>
                    <p className="text-gray-300 text-sm sm:text-base md:text-lg leading-relaxed group-hover:text-gray-100 transition-colors">
                      Get instant access to critical information from your documents with lightning-fast query processing.
                    </p>
                  </div>
                </SpotlightCard>
              </div>

              {/* Animated Beams connecting the cards */}
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={card1Ref}
                toRef={card2Ref}
                duration={3}
                delay={0}
                curvature={-30}
                gradientStartColor="#9333ea"
                gradientStopColor="#06b6d4"
              />
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={card2Ref}
                toRef={card4Ref}
                duration={3}
                delay={1}
                curvature={30}
                gradientStartColor="#06b6d4"
                gradientStopColor="#f59e0b"
              />
              <AnimatedBeam
                containerRef={containerRef}
                fromRef={card3Ref}
                toRef={card4Ref}
                duration={3}
                delay={2}
                curvature={-30}
                gradientStartColor="#f59e0b"
                gradientStopColor="#ef4444"
              />
            </div>
          </div>
        </div>
      </section>
      {/* Real-time Platform Metrics - Mobile Optimized */}
      <section className="relative py-12 sm:py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">Platform in Action</h3>
            <p className="text-base sm:text-lg md:text-xl text-gray-300">Real-time metrics from our global RAG network</p>
          </div>
          
          {/* Clean Metrics Grid - Mobile Optimized */}
          <div className="mb-12 sm:mb-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
              {[
                { label: 'Queries/min', value: 2847, color: 'text-cyan-400' },
                { label: 'Active Users', value: 156, color: 'text-emerald-400' },
                { label: 'Avg Response (ms)', value: 8.1, color: 'text-pink-400' },
                { label: 'Documents', value: 47832, color: 'text-yellow-400' }
              ].map((metric, index) => (
                <SpotlightCard key={index} className="p-3 sm:p-4 md:p-6 text-center h-24 sm:h-28 md:h-32 flex flex-col justify-center">
                  <NumberTicker 
                    value={metric.value} 
                    className={`text-xl sm:text-2xl md:text-3xl font-bold ${metric.color} mb-1 sm:mb-2`}
                    decimalPlaces={metric.value === 8.1 ? 1 : 0}
                  />
                  <div className="text-gray-400 text-xs sm:text-sm">{metric.label}</div>
                </SpotlightCard>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {[
                { label: 'Uptime', value: '99.8%', color: 'text-orange-400' },
                { label: 'Latency', value: '24ms', color: 'text-blue-400' },
                { label: 'Scale', value: 'Unlimited', color: 'text-green-400' }
              ].map((metric, index) => (
                <SpotlightCard key={index} className="p-4 sm:p-6 md:p-8 text-center">
                  <div className={`text-2xl sm:text-3xl md:text-4xl font-bold ${metric.color} mb-2 sm:mb-3`}>{metric.value}</div>
                  <div className="text-gray-400 text-sm sm:text-base">{metric.label}</div>
                </SpotlightCard>
              ))}
            </div>
          </div>

          {/* Bottom Stats Bar - Mobile Optimized */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: 'Data Centers', value: '12', color: 'text-purple-400' },
              { label: 'Languages', value: '47', color: 'text-cyan-400' },
              { label: 'Integrations', value: '200+', color: 'text-pink-400' },
              { label: 'Enterprise Clients', value: '50+', color: 'text-emerald-400' }
            ].map((stat, index) => (
              <SpotlightCard key={index} className="p-3 sm:p-4 md:p-6 text-center">
                <div className={`text-lg sm:text-xl md:text-2xl font-bold ${stat.color} mb-1 sm:mb-2`}>{stat.value}</div>
                <div className="text-gray-400 text-xs sm:text-sm">{stat.label}</div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-muted/50 py-8 sm:py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 sm:mb-12 mx-auto max-w-2xl space-y-4 sm:space-y-6 text-center">
              <h1 className="text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold">Pricing that Scales with You</h1>
              <p className="text-sm sm:text-base px-4">Gemini is evolving to be more than just the models. It supports an entire to the APIs and platforms helping developers and businesses innovate.</p>
          </div>
          <CustomClerkPricing />
        </div>
      </section>
      <Testimonials />
      <FAQs />
      <Footer />
    </div>
  );
}
