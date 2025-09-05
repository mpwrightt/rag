import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PulsatingButton } from '@/components/magicui/pulsating-button'
import { HeroHeader } from "./header"
import { Sparkle, FileText, Brain, Zap, Database, Search, Bot, MessageSquare, Cpu } from 'lucide-react'
import { BackgroundBeams } from '@/components/ui/background-beams'
import { RagAgentBootTerminal } from '@/components/magicui/terminal'
import { Meteors } from '@/components/magicui/meteors'
import { OrbitingCircles } from '@/components/magicui/orbiting-circles'
import { WordRotate } from '@/components/magicui/word-rotate'
import NumberTicker from '@/components/magicui/number-ticker'
import { MagicCard } from '@/components/magicui/magic-card'
import DotPattern from '@/components/magicui/dot-pattern'

export default function HeroSection() {
    const ragWords = ["Documents", "Knowledge", "Data", "Content", "Files"]
    const aiWords = ["Intelligence", "Insights", "Answers", "Understanding"]

    return (
        <>
            <HeroHeader />
            <main className="relative min-h-screen overflow-hidden">
                
                <section className="relative z-10">
                    <div className="py-12 md:py-20">
                        <div className="relative z-10 mx-auto max-w-6xl px-6">
                            
                            {/* Hero Content with Orbiting Elements */}
                            <div className="text-center relative">
                                {/* Floating stats cards - Repositioned for mobile safety */}
                                <div className="absolute -top-4 -left-16 hidden xl:block">
                                    <MagicCard className="p-3 w-28 h-16">
                                        <div className="text-center">
                                            <NumberTicker value={99.9} decimalPlaces={1} className="text-lg font-bold text-purple-400" />
                                            <p className="text-xs text-gray-400 leading-tight">% Accuracy</p>
                                        </div>
                                    </MagicCard>
                                </div>
                                
                                <div className="absolute -top-4 -right-16 hidden xl:block">
                                    <MagicCard className="p-3 w-28 h-16">
                                        <div className="text-center">
                                            <NumberTicker value={1200} className="text-lg font-bold text-cyan-400" />
                                            <p className="text-xs text-gray-400 leading-tight">Docs/sec</p>
                                        </div>
                                    </MagicCard>
                                </div>
                                
                                {/* Central orbiting visualization - Mobile optimized */}
                                <div className="relative h-[200px] w-[200px] sm:h-[280px] sm:w-[280px] md:h-[320px] md:w-[320px] lg:h-[400px] lg:w-[400px] mx-auto mb-6 sm:mb-8">
                                    {/* Central AI brain */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
                                            <Brain className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
                                        </div>
                                    </div>
                                    
                                    {/* Orbiting icons for RAG pipeline - Responsive radius */}
                                    <OrbitingCircles radius={50} duration={15} delay={0} className="sm:radius-[60px] lg:radius-[80px]">
                                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={50} duration={15} delay={5} className="sm:radius-[60px] lg:radius-[80px]">
                                        <Search className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={50} duration={15} delay={10} className="sm:radius-[60px] lg:radius-[80px]">
                                        <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </OrbitingCircles>
                                    
                                    <OrbitingCircles radius={90} duration={20} reverse delay={0} className="sm:radius-[110px] lg:radius-[140px]">
                                        <Database className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={90} duration={20} reverse delay={7} className="sm:radius-[110px] lg:radius-[140px]">
                                        <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={90} duration={20} reverse delay={14} className="sm:radius-[110px] lg:radius-[140px]">
                                        <Cpu className="w-3 h-3 sm:w-4 sm:h-4" />
                                    </OrbitingCircles>
                                </div>

                                {/* Enhanced hero text */}
                                <div className="mb-8">
                                    <Link
                                        href="#"
                                        className="hover:bg-foreground/5 mx-auto flex w-fit items-center justify-center gap-2 rounded-md py-0.5 pl-1 pr-3 transition-colors duration-150">
                                        <div
                                            aria-hidden
                                            className="border-background bg-linear-to-b dark:inset-shadow-2xs to-foreground from-primary relative flex size-5 items-center justify-center rounded border shadow-md shadow-black/20 ring-1 ring-black/10">
                                            <Sparkle className="size-3 fill-background stroke-background drop-shadow" />
                                        </div>
                                        <span className="font-medium">Next-Gen RAG Platform</span>
                                    </Link>
                                </div>

                                <h1 className="mx-auto mt-6 sm:mt-8 max-w-4xl text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-tight">
                                    <span className="block mb-2">Transform Your</span>
                                    <span className="block text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text mb-2">
                                        <WordRotate words={ragWords} className="inline-block min-h-[1.2em]" />
                                    </span>
                                    <span className="block mb-2">into AI-Powered</span>
                                    <span className="block text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text">
                                        <WordRotate words={aiWords} className="inline-block min-h-[1.2em]" />
                                    </span>
                                </h1>
                                
                                <p className="text-gray-300 mx-auto my-6 sm:my-8 max-w-2xl text-balance text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed px-4">
                                    The most advanced RAG pipeline that understands context, maintains conversations, and delivers precise answers from your private knowledge base.
                                </p>

                                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 px-4 w-full max-w-md sm:max-w-none mx-auto">
                                    <Link href="#link" className="w-full sm:w-auto">
                                        <PulsatingButton className="h-12 px-6 sm:px-8 text-base font-medium min-h-[44px] touch-manipulation w-full sm:w-auto">
                                            <span className="text-nowrap">Start Building →</span>
                                        </PulsatingButton>
                                    </Link>
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="outline"
                                        className="h-12 px-6 sm:px-8 text-base min-h-[44px] touch-manipulation w-full sm:w-auto">
                                        <Link href="#link">
                                            <span className="text-nowrap">🎥 Watch Demo</span>
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                            
                            {/* Enhanced terminal section */}
                            <div className="relative mx-auto max-w-5xl">
                                <MagicCard className="p-6">
                                    <RagAgentBootTerminal className="mx-auto" />
                                </MagicCard>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}