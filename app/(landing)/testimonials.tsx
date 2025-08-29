import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import SpotlightCard from '@/components/magicui/spotlight-card'
import { MagicCard } from '@/components/magicui/magic-card'
import { Marquee } from '@/components/magicui/marquee'
import { Star, Quote } from 'lucide-react'

type Testimonial = {
    name: string
    role: string
    company: string
    image: string
    quote: string
    rating: number
    metric?: {
        value: string
        label: string
    }
}

const testimonials: Testimonial[] = [
    {
        name: 'Alex Rivera',
        role: 'CTO',
        company: 'Innovatech',
        image: 'https://i.pravatar.cc/48?u=alex-rivera',
        quote: 'This platform revolutionized how our team accesses internal documentation. What used to take hours of searching now takes seconds with a simple question.',
        rating: 5,
        metric: { value: '95%', label: 'Time Saved' }
    },
    {
        name: 'Dr. Samantha Grey',
        role: 'Lead Researcher',
        company: 'BioGenetics Inc.',
        image: 'https://i.pravatar.cc/48?u=samantha-grey',
        quote: 'The accuracy of the answers and the direct citations are game-changers for our research team. It has accelerated our discovery process significantly.',
        rating: 5,
        metric: { value: '3x', label: 'Faster Research' }
    },
    {
        name: 'David Chen',
        role: 'AI Engineer',
        company: 'QuantumLeap',
        image: 'https://i.pravatar.cc/48?u=david-chen',
        quote: 'We had our first RAG prototype running in a single afternoon. The ease of ingestion and deployment is incredible.',
        rating: 5,
        metric: { value: '2hrs', label: 'Setup Time' }
    },
    {
        name: 'Emily White',
        role: 'Head of Customer Support',
        company: 'FusionDesk',
        image: 'https://i.pravatar.cc/48?u=emily-white',
        quote: 'Our support agents can now find precise answers in our vast knowledge base instantly, leading to faster resolution times and happier customers.',
        rating: 5,
        metric: { value: '40%', label: 'Faster Resolution' }
    },
    {
        name: 'Marcus Thorne',
        role: 'Legal Analyst',
        company: 'Sterling Law',
        image: 'https://i.pravatar.cc/48?u=marcus-thorne',
        quote: 'Sifting through case law and contracts is 10x faster. The ability to ask complex questions and get summarized answers is invaluable.',
        rating: 5,
        metric: { value: '10x', label: 'Faster Analysis' }
    },
    {
        name: 'Fatimah Adebayo',
        role: 'University Librarian',
        company: 'Global University',
        image: 'https://i.pravatar.cc/48?u=fatimah-adebayo',
        quote: 'Students and faculty can now interact with our entire digital archive in a completely new way. It has transformed our library into a living resource.',
        rating: 5,
        metric: { value: '500k', label: 'Documents Indexed' }
    },
]

const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => (
    <MagicCard className="w-96 p-6 mx-4">
        <div className="flex items-start gap-4 mb-4">
            <Avatar className="size-12">
                <AvatarImage
                    alt={testimonial.name}
                    src={testimonial.image}
                    loading="lazy"
                />
                <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-white">{testimonial.name}</h3>
                        <p className="text-sm text-gray-400">{testimonial.role} at {testimonial.company}</p>
                    </div>
                    <div className="flex">
                        {Array.from({ length: testimonial.rating }, (_, i) => (
                            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
        
        <div className="relative">
            <Quote className="absolute -top-1 -left-1 w-6 h-6 text-purple-400 opacity-50" />
            <blockquote className="text-gray-300 text-sm leading-relaxed pl-6">
                {testimonial.quote}
            </blockquote>
        </div>

        {testimonial.metric && (
            <div className="mt-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400">{testimonial.metric.value}</div>
                    <div className="text-xs text-gray-400">{testimonial.metric.label}</div>
                </div>
            </div>
        )}
    </MagicCard>
)

export default function WallOfLoveSection() {
    const firstRow = testimonials.slice(0, 3)
    const secondRow = testimonials.slice(3, 6)

    return (
        <section className="py-12 md:py-20 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 to-transparent" />
            
            <div className="relative z-10">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl font-bold text-white mb-6">
                            Loved by{" "}
                            <span className="text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
                                Innovative Teams
                            </span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                            Join thousands of companies transforming their document intelligence with our RAG platform
                        </p>
                    </div>

                    {/* Floating Testimonial Cards in Marquees */}
                    <div className="space-y-8">
                        {/* First row - left to right */}
                        <Marquee className="[--duration:60s]" pauseOnHover>
                            {firstRow.map((testimonial, index) => (
                                <TestimonialCard key={`first-${index}`} testimonial={testimonial} />
                            ))}
                        </Marquee>

                        {/* Second row - right to left */}
                        <Marquee className="[--duration:60s]" reverse pauseOnHover>
                            {secondRow.map((testimonial, index) => (
                                <TestimonialCard key={`second-${index}`} testimonial={testimonial} />
                            ))}
                        </Marquee>
                    </div>

                    {/* Trust Indicators */}
                    <div className="mt-16 text-center">
                        <p className="text-gray-400 mb-8">Trusted by companies of all sizes</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
                            {['Innovatech', 'BioGenetics', 'QuantumLeap', 'FusionDesk'].map((company) => (
                                <div key={company} className="text-gray-500 font-semibold text-lg">
                                    {company}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

