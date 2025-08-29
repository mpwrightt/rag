"use client";

import HeroSection from "./hero-section";
import FeaturesOne from "./features-one";
import { BentoGrid, BentoGridItem } from "@/components/magicui/bento-grid";
import Testimonials from "./testimonials";
import CallToAction from "./call-to-action";
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
import { useRef } from "react";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const card4Ref = useRef<HTMLDivElement>(null);

  const cardRefs = [card1Ref, card2Ref, card3Ref, card4Ref];

  return (
    <div className="relative">
      {/* Global dot pattern background */}
      <DotPattern className="fixed inset-0 z-[-60] opacity-20" />
      <HeroSection />
      {/* Logo/tech marquee */}
      <section className="py-6">
        <div className="mx-auto max-w-7xl px-6">
          <Panel animated duration={14} className="p-6">
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
                    className={`rounded-full border px-8 py-3 text-xl font-semibold tracking-tight ${color} backdrop-blur-sm transition-transform duration-200 hover:scale-105 shadow-[0_0_0_1px] shadow-white/5`}
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
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-5xl font-bold text-white mb-4">Why Choose Our Platform?</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Discover the core advantages that make our RAG platform the industry leader
            </p>
          </div>
          
          {/* Interactive Platform Advantages with PixelCard Effects */}
          <div ref={containerRef} className="relative mb-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
              {/* Card 1 - Contextual Understanding */}
              <div ref={card1Ref} className="relative overflow-hidden rounded-3xl">
                <ShineBorder 
                  color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                  duration={12}
                  borderWidth={2}
                  className="h-full rounded-3xl overflow-hidden"
                >
                  <ActivePixelCard variant="blue" className="h-64 p-8 rounded-3xl">
                    <div className="absolute inset-0 flex flex-col justify-center text-center p-8 z-20">
                      <h3 className="text-2xl font-bold text-white mb-4">Contextual Understanding</h3>
                      <p className="text-gray-300 text-lg leading-relaxed">
                        Our RAG agent deeply understands your documents, providing highly relevant answers with perfect context awareness.
                      </p>
                    </div>
                  </ActivePixelCard>
                </ShineBorder>
              </div>

              {/* Card 2 - Seamless Integration */}
              <div ref={card2Ref} className="relative overflow-hidden rounded-3xl">
                <ShineBorder 
                  color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                  duration={10}
                  borderWidth={2}
                  className="h-full rounded-3xl overflow-hidden"
                >
                  <ActivePixelCard variant="pink" className="h-64 p-8 rounded-3xl">
                    <div className="absolute inset-0 flex flex-col justify-center text-center p-8 z-20">
                      <h3 className="text-2xl font-bold text-white mb-4">Seamless Integration</h3>
                      <p className="text-gray-300 text-lg leading-relaxed">
                        Easily integrate with your existing data sources and workflows through our comprehensive API ecosystem.
                      </p>
                    </div>
                  </ActivePixelCard>
                </ShineBorder>
              </div>

              {/* Card 3 - Scalable Knowledge Base */}
              <div ref={card3Ref} className="relative overflow-hidden rounded-3xl">
                <ShineBorder 
                  color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                  duration={8}
                  borderWidth={2}
                  className="h-full rounded-3xl overflow-hidden"
                >
                  <ActivePixelCard variant="yellow" className="h-64 p-8 rounded-3xl">
                    <div className="absolute inset-0 flex flex-col justify-center text-center p-8 z-20">
                      <h3 className="text-2xl font-bold text-white mb-4">Scalable Knowledge Base</h3>
                      <p className="text-gray-300 text-lg leading-relaxed">
                        Grow your knowledge base without compromising on performance or accuracy, handling millions of documents.
                      </p>
                    </div>
                  </ActivePixelCard>
                </ShineBorder>
              </div>

              {/* Card 4 - Real-time Insights */}
              <div ref={card4Ref} className="relative overflow-hidden rounded-3xl">
                <ShineBorder 
                  color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                  duration={14}
                  borderWidth={2}
                  className="h-full rounded-3xl overflow-hidden"
                >
                  <ActivePixelCard variant="default" className="h-64 p-8 rounded-3xl">
                    <div className="absolute inset-0 flex flex-col justify-center text-center p-8 z-20">
                      <h3 className="text-2xl font-bold text-white mb-4">Real-time Insights</h3>
                      <p className="text-gray-300 text-lg leading-relaxed">
                        Get instant access to critical information from your documents with lightning-fast query processing.
                      </p>
                    </div>
                  </ActivePixelCard>
                </ShineBorder>
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
      {/* Live feed style animated list */}
      <section className="bg-muted/40 py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 text-center">
            <h3 className="text-2xl font-semibold">What’s happening now</h3>
            <p className="text-muted-foreground">Recent activity across projects</p>
          </div>
          <AnimatedListCustom />
        </div>
      </section>
      <section className="bg-muted/50 py-8 md:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 mx-auto max-w-2xl space-y-6 text-center">
              <h1 className="text-center text-4xl font-semibold lg:text-5xl">Pricing that Scales with You</h1>
              <p>Gemini is evolving to be more than just the models. It supports an entire to the APIs and platforms helping developers and businesses innovate.</p>
          </div>
          <CustomClerkPricing />
        </div>
      </section>
      <Testimonials />
      <CallToAction />
      <FAQs />
      <Footer />
    </div>
  );
}
