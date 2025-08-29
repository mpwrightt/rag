import { MagicCard } from '@/components/magicui/magic-card'
import DotPattern from '@/components/magicui/dot-pattern'
import { SpotlightCard } from '@/components/magicui/spotlight-card'
import { Meteors } from '@/components/magicui/meteors'
import { WordRotate } from '@/components/magicui/word-rotate'

export default function FAQs() {
    const questionWords = ["Questions", "Answers", "Solutions", "Help", "Support"]
    
    const faqs = [
        {
            question: "What is Retrieval-Augmented Generation (RAG)?",
            answer: "Retrieval-Augmented Generation (RAG) is an AI technique that enhances large language models (LLMs) by providing them with relevant, up-to-date information from your private knowledge base before they generate a response. This makes the answers more accurate, timely, and specific to your data."
        },
        {
            question: "What kind of documents can I use?",
            answer: "You can ingest a wide variety of file types, including PDFs, Word documents, text files, and Markdown files. You can also connect to external data sources like Google Drive to keep your knowledge base synchronized."
        },
        {
            question: "Is my data secure?",
            answer: "Yes, security is our top priority. Your data is encrypted both in transit and at rest. We use industry-standard security protocols to ensure that your knowledge base is isolated and accessible only to your authorized users."
        },
        {
            question: "How does the knowledge graph work?",
            answer: "As your documents are ingested, our system automatically identifies key entities (like people, products, and concepts) and the relationships between them. This creates a dynamic knowledge graph, allowing the AI to understand context and connections, leading to deeper insights."
        }
    ]

    return (
        <section className="relative scroll-py-8 py-8 md:scroll-py-16 md:py-16 overflow-hidden">
            {/* Background Effects */}
            <DotPattern className="absolute inset-0 z-0 opacity-20" />
            <Meteors number={20} />
            
            <div className="relative z-10 mx-auto max-w-6xl px-6">
                <div className="text-center mb-16 space-y-6">
                    <h2 className="mx-auto text-balance text-4xl font-bold md:text-5xl text-white leading-tight">
                        Frequently Asked{" "}
                        <br className="hidden sm:inline" />
                        <span className="inline-block text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text min-w-[200px] sm:min-w-[240px] md:min-w-[300px]">
                            <WordRotate words={questionWords} />
                        </span>
                    </h2>
                    <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        Have questions? We have answers. Here are some of the most common questions we get.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                    {faqs.map((faq, index) => (
                        <SpotlightCard
                            key={index}
                            className="p-8 h-full transition-all duration-300 hover:scale-[1.02] group"
                            radius={150}
                            strength={0.3}
                        >
                            <div className="space-y-4">
                                <h3 className="font-semibold text-xl text-white group-hover:text-purple-200 transition-colors">
                                    {faq.question}
                                </h3>
                                <p className="text-gray-300 leading-relaxed group-hover:text-gray-100 transition-colors">
                                    {faq.answer}
                                </p>
                            </div>
                        </SpotlightCard>
                    ))}
                </div>
            </div>
        </section>
    )
}

