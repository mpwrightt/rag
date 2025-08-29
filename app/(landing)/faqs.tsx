export default function FAQs() {
    return (
        <section className="scroll-py-8 py-8 md:scroll-py-16 md:py-16">
            <div className="mx-auto max-w-5xl px-6">
                <div className="grid gap-y-12 px-2 lg:[grid-template-columns:1fr_auto]">
                    <div className="text-center lg:text-left">
                        <h2 className="mb-4 text-3xl font-semibold md:text-4xl">
                            Frequently <br className="hidden lg:block" /> Asked <br className="hidden lg:block" />
                            Questions
                        </h2>
                        <p className="text-muted-foreground">Have questions? We have answers. Here are some of the most common questions we get.</p>
                    </div>

                    <div className="divide-y divide-dashed sm:mx-auto sm:max-w-lg lg:mx-0">
                        <div className="pb-6">
                            <h3 className="font-medium">What is Retrieval-Augmented Generation (RAG)?</h3>
                            <p className="text-muted-foreground mt-4">Retrieval-Augmented Generation (RAG) is an AI technique that enhances large language models (LLMs) by providing them with relevant, up-to-date information from your private knowledge base before they generate a response. This makes the answers more accurate, timely, and specific to your data.</p>
                        </div>
                        <div className="py-6">
                            <h3 className="font-medium">What kind of documents can I use?</h3>
                            <p className="text-muted-foreground mt-4">You can ingest a wide variety of file types, including PDFs, Word documents, text files, and Markdown files. You can also connect to external data sources like Google Drive to keep your knowledge base synchronized.</p>
                        </div>
                        <div className="py-6">
                            <h3 className="font-medium">Is my data secure?</h3>
                            <p className="text-muted-foreground my-4">Yes, security is our top priority. Your data is encrypted both in transit and at rest. We use industry-standard security protocols to ensure that your knowledge base is isolated and accessible only to your authorized users.</p>
                        </div>
                        <div className="py-6">
                            <h3 className="font-medium">How does the knowledge graph work?</h3>
                            <p className="text-muted-foreground mt-4">As your documents are ingested, our system automatically identifies key entities (like people, products, and concepts) and the relationships between them. This creates a dynamic knowledge graph, allowing the AI to understand context and connections, leading to deeper insights.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

