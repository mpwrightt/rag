'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  FolderOpen, 
  FileText, 
  RotateCcw, 
  MessageCircle,
  Filter,
  Database,
  Network,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Protect } from '@clerk/nextjs'
import CustomClerkPricing from '@/components/custom-clerk-pricing'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

type CollectionChatMessage = {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{
    filename: string
    chunk_id: string
    relevance_score: number
    document_title?: string
    collection_id?: string
  }>
  timestamp: string
}

type Collection = {
  id: string
  name: string
  description: string
  document_count: number
  last_activity: string
}

export default function CollectionChatPage() {
  const [messages, setMessages] = useState<CollectionChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string>('')
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoadingCollections, setIsLoadingCollections] = useState(true)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  function UpgradeCard() {
    return (
      <>
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h1 className="text-center text-2xl font-semibold lg:text-3xl">Upgrade to a paid plan</h1>
          <p>This page is available on paid plans. Choose a plan that fits your needs.</p>
        </div>
        <div className="px-8 lg:px-12">
          <CustomClerkPricing />
        </div>
      </>
    )
  }

  // Mock collections data
  const mockCollections: Collection[] = [
    {
      id: '1',
      name: 'Environmental Reports',
      description: 'Site assessments and remediation reports',
      document_count: 12,
      last_activity: '2024-01-20'
    },
    {
      id: '2',
      name: 'Technical Documentation',
      description: 'API docs, specifications, and manuals',
      document_count: 8,
      last_activity: '2024-01-18'
    },
    {
      id: '3',
      name: 'Company Policies',
      description: 'HR policies and procedures',
      document_count: 5,
      last_activity: '2024-01-16'
    }
  ]

  useEffect(() => {
    // Load collections
    setTimeout(() => {
      setCollections(mockCollections)
      setIsLoadingCollections(false)
    }, 1000)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !selectedCollection) return

    const userMessage: CollectionChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Mock API response - in production this would call your collection-specific chat endpoint
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const selectedCollectionData = collections.find(c => c.id === selectedCollection)
      const assistantMessage: CollectionChatMessage = {
        role: 'assistant',
        content: `Based on the documents in the "${selectedCollectionData?.name}" collection, I can help you with that question. Here's what I found relevant to your query about "${input.trim()}".

This is a mock response that demonstrates how the collection chat would work. In production, this would search specifically within the selected collection's documents and provide contextual answers based on those documents.`,
        sources: [
          {
            filename: 'example-doc.pdf',
            chunk_id: 'chunk_123',
            relevance_score: 0.95,
            document_title: 'Example Document from Collection',
            collection_id: selectedCollection
          },
          {
            filename: 'another-doc.md',
            chunk_id: 'chunk_456',
            relevance_score: 0.87,
            document_title: 'Related Document',
            collection_id: selectedCollection
          }
        ],
        timestamp: new Date().toISOString()
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId)
    setMessages([]) // Clear messages when switching collections
    
    // Load questions for this collection
    loadQuestionsForCollection(collectionId)
  }

  const loadQuestionsForCollection = async (collectionId: string) => {
    setIsLoadingQuestions(true)
    try {
      const res = await fetch(`${API_BASE}/api/questions/generate?collection_id=${collectionId}&limit=3`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      })
      if (res.ok) {
        const data = await res.json()
        setSuggestedQuestions(data.questions || [])
      }
    } catch (error) {
      console.error('Failed to load collection questions:', error)
      // Use fallback questions
      setSuggestedQuestions([
        "What are the main topics in this collection?",
        "Can you summarize the key documents?",
        "What are the common themes across documents?"
      ])
    } finally {
      setIsLoadingQuestions(false)
    }
  }

  return (
    <Protect
      condition={(has) => has({ plan: 'pro' })}
      fallback={<UpgradeCard />}
    >
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold">Collection Chat</h1>
              <p className="text-sm text-muted-foreground">
                Chat with your collections using AI. Select a collection to begin.
              </p>
            </div>
            {messages.length > 0 && (
              <Button onClick={clearChat} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear Chat
              </Button>
            )}
          </div>

          {/* Collection Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Collection:</span>
            </div>
            <div className="w-64">
              {isLoadingCollections ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedCollection} onValueChange={handleCollectionChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a collection to chat with..." />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{collection.name}</span>
                          <Badge variant="secondary" className="ml-2">
                            {collection.document_count} docs
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {selectedCollection && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {collections.find(c => c.id === selectedCollection)?.document_count} documents
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="max-w-4xl mx-auto space-y-4">
            {!selectedCollection ? (
              <div className="text-center py-12">
                <div className="mb-8">
                  <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center shadow-lg mx-auto">
                    <MessageCircle className="w-10 h-10 text-muted-foreground" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-3">Select a Collection</h2>
                <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Choose a collection from the dropdown above to start a focused conversation 
                  with the documents in that specific collection.
                </p>
                
                {!isLoadingCollections && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                    {collections.map((collection) => (
                      <Card 
                        key={collection.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleCollectionChange(collection.id)}
                      >
                        <CardContent className="p-4 text-center">
                          <FolderOpen className="w-8 h-8 text-primary mx-auto mb-2" />
                          <h3 className="font-medium mb-1">{collection.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{collection.description}</p>
                          <Badge variant="secondary">{collection.document_count} documents</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-8">
                  <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg mx-auto">
                    <Bot className="w-10 h-10 text-primary-foreground" />
                  </div>
                </div>
                <h2 className="text-3xl font-bold mb-3">
                  Chat with {collections.find(c => c.id === selectedCollection)?.name}
                </h2>
                <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Ask questions about the {collections.find(c => c.id === selectedCollection)?.document_count} documents 
                  in this collection. I'll provide answers based specifically on these documents.
                </p>
                
                {/* Feature Pills */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  <Badge variant="secondary" className="flex items-center gap-2 px-3 py-2">
                    <Filter className="w-4 h-4" />
                    Collection-Focused
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-2 px-3 py-2">
                    <Database className="w-4 h-4" />
                    Document Context
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-2 px-3 py-2">
                    <Network className="w-4 h-4" />
                    Related Information
                  </Badge>
                </div>

                {/* Dynamic Sample Questions */}
                <div className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">Try asking:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {isLoadingQuestions ? (
                      // Loading skeleton
                      Array.from({ length: 3 }).map((_, idx) => (
                        <div 
                          key={idx}
                          className="h-10 w-32 bg-muted/50 rounded-lg animate-pulse border border-border/50"
                        />
                      ))
                    ) : (
                      suggestedQuestions.map((question, idx) => (
                        <Button 
                          key={idx}
                          variant="outline" 
                          size="sm"
                          onClick={() => setInput(question)}
                          className="h-auto py-2 px-3 text-xs hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
                        >
                          {question.length > 50 ? `${question.substring(0, 47)}...` : question}
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-4 animate-in slide-in-from-bottom-2 fade-in duration-500",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  
                  <div 
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3",
                      message.role === 'user' 
                        ? "text-white ml-12" 
                        : "bg-muted"
                    )}
                    style={message.role === 'user' ? { backgroundColor: '#475569' } : {}}
                  >
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                    
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">Sources from this collection:</p>
                        <div className="space-y-1">
                          {message.sources.slice(0, 3).map((source, idx) => (
                            <div key={idx} className="text-xs bg-background/50 rounded px-2 py-1">
                              <span className="font-medium">{source.document_title || source.filename}</span>
                              <span className="text-muted-foreground ml-2">
                                (Relevance: {(source.relevance_score * 100).toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
                        <User className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
                <div className="max-w-[80%] rounded-xl bg-muted px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Searching {collections.find(c => c.id === selectedCollection)?.name}...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    selectedCollection 
                      ? `Ask questions about ${collections.find(c => c.id === selectedCollection)?.name}...`
                      : "Select a collection first..."
                  }
                  className="w-full min-h-[80px] max-h-[160px] resize-none rounded-xl border bg-background px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  disabled={isLoading || !selectedCollection}
                />
                <div className="absolute right-3 bottom-3 text-xs text-muted-foreground">
                  {input.length}/2000
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={!input.trim() || isLoading || !selectedCollection}
                size="icon"
                className="absolute right-3 top-3"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            
            {selectedCollection && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Filter className="w-3 h-3" />
                <span>
                  Searching in {collections.find(c => c.id === selectedCollection)?.name} 
                  ({collections.find(c => c.id === selectedCollection)?.document_count} documents)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Protect>
  )
}