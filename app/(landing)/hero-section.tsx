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
                {/* Enhanced background layers */}
                <BackgroundBeams className="fixed inset-0 z-[-100]" />
                <Meteors number={15} />
                
                <section className="relative z-10">
                    <div className="py-12 md:py-20">
                        <div className="relative z-10 mx-auto max-w-6xl px-6">
                            
                            {/* Hero Content with Orbiting Elements */}
                            <div className="text-center relative">
                                {/* Floating stats cards */}
                                <div className="absolute top-5 -left-24 hidden lg:block">
                                    <MagicCard className="p-4 w-32 h-20">
                                        <div className="text-center">
                                            <NumberTicker value={99.9} decimalPlaces={1} className="text-xl font-bold text-purple-400" />
                                            <p className="text-xs text-gray-400">% Accuracy</p>
                                        </div>
                                    </MagicCard>
                                </div>
                                
                                <div className="absolute top-5 -right-24 hidden lg:block">
                                    <MagicCard className="p-4 w-36 h-20">
                                        <div className="text-center">
                                            <NumberTicker value={1200} className="text-xl font-bold text-cyan-400" />
                                            <p className="text-xs text-gray-400">Docs/sec</p>
                                        </div>
                                    </MagicCard>
                                </div>
                                
                                {/* Central orbiting visualization */}
                                <div className="relative h-[400px] w-[400px] mx-auto mb-8">
                                    {/* Central AI brain */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
                                            <Brain className="w-8 h-8 text-white" />
                                        </div>
                                    </div>
                                    
                                    {/* Orbiting icons for RAG pipeline */}
                                    <OrbitingCircles radius={80} duration={15} delay={0}>
                                        <FileText className="w-4 h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={80} duration={15} delay={5}>
                                        <Search className="w-4 h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={80} duration={15} delay={10}>
                                        <MessageSquare className="w-4 h-4" />
                                    </OrbitingCircles>
                                    
                                    <OrbitingCircles radius={140} duration={20} reverse delay={0}>
                                        <Database className="w-4 h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={140} duration={20} reverse delay={7}>
                                        <Bot className="w-4 h-4" />
                                    </OrbitingCircles>
                                    <OrbitingCircles radius={140} duration={20} reverse delay={14}>
                                        <Cpu className="w-4 h-4" />
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

                                <h1 className="mx-auto mt-8 max-w-4xl text-balance text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
                                    Transform Your
                                    <br className="block" />
                                    <span className="inline-block text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text min-w-[280px] sm:min-w-[320px] md:min-w-[400px] text-center">
                                        <WordRotate words={ragWords} />
                                    </span>
                                    <br />
                                    into AI-Powered
                                    <br className="block" />
                                    <span className="inline-block text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text min-w-[300px] sm:min-w-[360px] md:min-w-[450px] text-center">
                                        <WordRotate words={aiWords} />
                                    </span>
                                </h1>
                                
                                <p className="text-gray-300 mx-auto my-8 max-w-2xl text-balance text-xl md:text-2xl">
                                    The most advanced RAG pipeline that understands context, maintains conversations, and delivers precise answers from your private knowledge base.
                                </p>

                                <div className="flex items-center justify-center gap-4 mb-12">
                                    <Link href="#link">
                                        <PulsatingButton className="h-12 px-8 text-lg font-medium">
                                            <span className="text-nowrap">Start Building →</span>
                                        </PulsatingButton>
                                    </Link>
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="outline"
                                        className="h-12 px-8 text-lg">
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