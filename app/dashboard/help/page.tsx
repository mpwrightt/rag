'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { 
  HelpCircle,
  Search,
  Book,
  MessageCircle,
  ExternalLink,
  Play,
  FileText,
  Video,
  Mail,
  Phone,
  Clock
} from 'lucide-react'

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const faqs = [
    {
      question: 'How do I upload documents to my knowledge base?',
      answer: 'Go to the Documents page and either drag & drop files or click "Select Files". Supported formats include PDF, DOC, DOCX, TXT, and MD files.'
    },
    {
      question: 'What is AI enhancement for prompts?',
      answer: 'AI enhancement analyzes your prompts and suggests improvements for clarity, specificity, and effectiveness using advanced language models.'
    },
    {
      question: 'How does semantic search work?',
      answer: 'Semantic search understands the meaning of your queries, not just keywords, to find relevant information even when exact terms don\'t match.'
    },
    {
      question: 'Can I integrate with external services?',
      answer: 'Yes! We support integrations with Google Drive, Dropbox, Slack, Notion, and many other services through our Integrations marketplace.'
    },
    {
      question: 'How is my data secured?',
      answer: 'We use enterprise-grade encryption, secure cloud storage, and follow SOC 2 compliance standards to protect your data.'
    }
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-primary" />
              Help & Support
            </h1>
            <p className="text-muted-foreground">
              Get help with using DataDiver and find answers to common questions
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="faq" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="faq">FAQ</TabsTrigger>
              <TabsTrigger value="guides">Guides</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
            </TabsList>

            <TabsContent value="faq" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, idx) => (
                      <AccordionItem key={idx} value={`item-${idx}`}>
                        <AccordionTrigger>{faq.question}</AccordionTrigger>
                        <AccordionContent>{faq.answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guides" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Book className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Getting Started Guide</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Learn the basics of setting up and using DataDiver for the first time.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <FileText className="w-4 h-4 mr-1" />
                            Read Guide
                          </Button>
                          <span className="text-xs text-muted-foreground">5 min read</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Advanced Chat Features</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Master the advanced features of our AI chat interface.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <FileText className="w-4 h-4 mr-1" />
                            Read Guide
                          </Button>
                          <span className="text-xs text-muted-foreground">8 min read</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">API Integration</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Integrate DataDiver with your applications using our REST API.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <FileText className="w-4 h-4 mr-1" />
                            View Docs
                          </Button>
                          <span className="text-xs text-muted-foreground">Developer</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Best Practices</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Tips and best practices for optimizing your RAG workflow.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <FileText className="w-4 h-4 mr-1" />
                            Read Guide
                          </Button>
                          <span className="text-xs text-muted-foreground">12 min read</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="videos" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { title: 'DataDiver Overview', duration: '3:45', views: '12.5K' },
                  { title: 'Document Upload Tutorial', duration: '2:30', views: '8.2K' },
                  { title: 'AI Chat Best Practices', duration: '5:20', views: '15.1K' },
                  { title: 'Setting up Integrations', duration: '4:15', views: '6.8K' }
                ].map((video, idx) => (
                  <Card key={idx} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Play className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">{video.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {video.duration}
                            </span>
                            <span>{video.views} views</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <Play className="w-4 h-4 mr-1" />
                          Watch
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="contact" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Get in Touch</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium">Email Support</p>
                        <p className="text-sm text-muted-foreground">support@datadiver.ai</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium">Live Chat</p>
                        <p className="text-sm text-muted-foreground">Available Mon-Fri, 9AM-6PM PST</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="font-medium">Phone Support</p>
                        <p className="text-sm text-muted-foreground">Enterprise plans only</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input placeholder="Your email" />
                    <Input placeholder="Subject" />
                    <textarea 
                      className="w-full p-3 border rounded-lg min-h-[100px] resize-none"
                      placeholder="How can we help you?"
                    />
                    <Button className="w-full">
                      <Mail className="w-4 h-4 mr-2" />
                      Send Message
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}