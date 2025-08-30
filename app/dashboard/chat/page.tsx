'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Send, Bot, User, Loader2, Database, Network, Zap, RotateCcw, Plus, Sparkles, MessageSquare, Copy, ThumbsUp, ThumbsDown, Bookmark, Share2, RefreshCw, Brain, ChevronDown, Search, FileText, Eye, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Protect } from '@clerk/nextjs'
import CustomClerkPricing from '@/components/custom-clerk-pricing'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

// Local message types
type BaseMessage = { role: 'user' | 'assistant'; content: string; timestamp?: string; id?: string }
type ExtendedChatMessage = BaseMessage & {
  tools_used?: Array<{ tool_name?: string; args?: any; tool_call_id?: string }>
  sources?: Array<{ filename: string; chunk_id: string; relevance_score: number; document_title?: string }>
  metadata?: any
  isStreaming?: boolean
  reactions?: { type: 'like' | 'dislike' | 'bookmark'; count: number }[]
}

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

export default function ChatPage() {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState<boolean | null>(true) // Start optimistic
  const [isTyping, setIsTyping] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const res = await fetch(`${API_BASE}/health`, {
          headers: { 'bypass-tunnel-reminder': 'true' },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (res.ok) {
          setIsConnected(true)
        } else {
          console.warn('Health check failed, but continuing optimistically')
          // Don't set as disconnected immediately, let chat attempts determine this
        }
      } catch (error) {
        console.warn('Health check failed, but continuing optimistically:', error)
        // Don't set as disconnected immediately, let chat attempts determine this
      }
    }
    
    // Delay the initial check to give the app time to load
    setTimeout(checkConnection, 2000)
  }, [])

  // Load dynamic questions on component mount
  useEffect(() => {
    const loadQuestions = async () => {
      if (messages.length > 0) return
      
      setIsLoadingQuestions(true)
      console.log('Starting to load dynamic questions...')
      
      // First check debug info
      try {
        const debugRes = await fetch(`${API_BASE}/api/questions/debug`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })
        if (debugRes.ok) {
          const debugData = await debugRes.json()
          console.log('Database debug info:', debugData)
        }
      } catch (e) {
        console.log('Could not fetch debug info:', e)
      }
      
      try {
        const res = await fetch(`${API_BASE}/api/questions/generate?limit=6`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })
        if (res.ok) {
          const data = await res.json()
          console.log('Questions API response:', data)
          
          if (data.questions && data.questions.length > 0) {
            setSuggestedQuestions(data.questions)
            console.log('Set questions from API:', data.questions)
          } else {
            console.warn('No questions returned from API')
            setSuggestedQuestions([])
          }
        } else {
          console.error('Question API returned error:', res.status, res.statusText)
          throw new Error(`API returned ${res.status}`)
        }
      } catch (error) {
        console.error('Failed to load dynamic questions:', error)
        setSuggestedQuestions([])
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    // Load questions immediately when component mounts
    loadQuestions()
  }, [messages.length])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ExtendedChatMessage = { 
      role: 'user', 
      content: input.trim(), 
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsTyping(true)
    setStreamingText('')

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({ message: input.trim(), session_id: sessionIdRef.current }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let assistantMessage: ExtendedChatMessage = { 
        role: 'assistant', 
        content: '', 
        tools_used: [], 
        sources: [], 
        timestamp: new Date().toISOString(),
        id: Date.now().toString(),
        isStreaming: true
      }
      setMessages(prev => [...prev, assistantMessage])

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              // Support both 'text' (backend default) and legacy 'content'
              if (data.type === 'text' || data.type === 'content') {
                setStreamingText(prev => prev + (data.content || ''))
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content += data.content || ''
                    lastMessage.isStreaming = true
                  } else if (data.content) {
                    newMessages.push({ 
                      role: 'assistant', 
                      content: data.content, 
                      timestamp: new Date().toISOString(),
                      id: Date.now().toString(),
                      isStreaming: true
                    })
                  }
                  return newMessages
                })
              } else if (data.type === 'tools' && Array.isArray(data.tools)) {
                // Attach tool calls to the current assistant message
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.tools_used = data.tools
                  }
                  return newMessages
                })
              } else if (data.type === 'graph' && data.graph) {
                // Attach graph metadata for potential UI use
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.metadata = { ...(lastMessage.metadata || {}), graph: data.graph }
                  }
                  return newMessages
                })
              } else if (data.type === 'session') {
                // Store session_id for future requests
                if (data.session_id) {
                  sessionIdRef.current = data.session_id
                }
              } else if (data.type === 'end') {
                // Stream finished
                setIsTyping(false)
                setStreamingText('')
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.isStreaming = false
                  }
                  return newMessages
                })
              } else if (data.type === 'error') {
                // Surface streaming errors to the user instead of failing silently
                const errorText = typeof data.content === 'string' && data.content
                  ? data.content
                  : 'Sorry, an error occurred while streaming the response.'
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.content) {
                    lastMessage.content = errorText
                  } else {
                    newMessages.push({ role: 'assistant', content: errorText })
                  }
                  return newMessages
                })
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      
      // Check if this is a network/connection error
      const isNetworkError = error instanceof Error && (
        error.name === 'TypeError' || 
        error.message.includes('fetch') || 
        error.message.includes('Network') ||
        error.message.includes('Failed to get response')
      )
      
      if (isNetworkError) {
        setIsConnected(false)
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Unable to connect to the backend. Please check your connection and try again.' 
        }])
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error. Please try again.' 
        }])
      }
    } finally {
      setIsLoading(false)
      setIsTyping(false)
      setStreamingText('')
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
    setStreamingText('')
    setIsTyping(false)
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const reactToMessage = (messageId: string, reaction: 'like' | 'dislike' | 'bookmark') => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || []
        const existingReaction = reactions.find(r => r.type === reaction)
        if (existingReaction) {
          existingReaction.count += 1
        } else {
          reactions.push({ type: reaction, count: 1 })
        }
        return { ...msg, reactions }
      }
      return msg
    }))
  }


  return (
    <Protect
      condition={(has) => has({ plan: 'pro' })}
      fallback={<UpgradeCard />}
    >
      {isConnected === false && messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <Card className="p-8 max-w-md text-center">
            <CardContent className="space-y-4">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <Database className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Connection Issue</h3>
              <p className="text-muted-foreground">
                Unable to reach the backend. This may be temporary - you can try sending a message or refresh.
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  onClick={() => {
                    setIsConnected(true)
                    setMessages([])
                  }} 
                  variant="outline"
                >
                  Try Again
                </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Refresh Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden bg-background">
          {/* Enhanced Header */}
          <div className="flex-shrink-0 border-b bg-background p-2 md:p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg">
                    <Brain className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">RAG Intelligence</h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    AI-powered document analysis with hybrid search
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <Badge variant="secondary" className="px-3 py-1">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    {messages.length} messages
                  </Badge>
                )}
                {messages.length > 0 && (
                  <Button onClick={clearChat} variant="outline" size="sm" className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Clear Chat
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0">
            <div className="max-w-4xl mx-auto space-y-3 h-full">
              {messages.length === 0 && (
                <div className="text-center py-3 md:py-5 relative flex flex-col items-center justify-center h-full overflow-hidden">
                  {/* Animated background elements */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full animate-pulse" />
                    <div className="absolute bottom-20 right-20 w-24 h-24 bg-gradient-to-br from-secondary/10 to-transparent rounded-full animate-pulse delay-1000" />
                    <div className="absolute top-40 right-10 w-16 h-16 bg-gradient-to-br from-accent/10 to-transparent rounded-full animate-pulse delay-500" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="mb-5 md:mb-6 relative">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-3xl flex items-center justify-center shadow-2xl mx-auto relative">
                        <Bot className="w-8 h-8 md:w-10 md:h-10 text-primary-foreground animate-bounce" />
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 to-transparent" />
                      </div>
                      <div className="absolute -inset-2 md:-inset-3 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-full blur-xl animate-pulse" />
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-bold mb-2.5 bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent">
                      Welcome to RAG Intelligence
                    </h2>
                    <p className="text-muted-foreground mb-4 md:mb-6 max-w-2xl md:max-w-3xl mx-auto text-sm md:text-base leading-relaxed">
                      Unlock the power of your documents with advanced AI. I combine vector search, knowledge graphs, 
                      and natural language processing to provide intelligent, contextual answers.
                    </p>
                    
                    {/* Enhanced Feature Pills */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 md:mb-4 max-w-3xl mx-auto">
                      <Card className="p-3 hover:shadow-lg transition-all duration-300 hover:scale-105 bg-card border">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <Database className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="font-semibold text-sm">Vector Search</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Semantic similarity matching across all document content</p>
                      </Card>
                      
                      <Card className="p-3 hover:shadow-lg transition-all duration-300 hover:scale-105 bg-card border">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Network className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="font-semibold text-sm">Knowledge Graph</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Relationship-based understanding of document entities</p>
                      </Card>
                      
                      <Card className="p-3 hover:shadow-lg transition-all duration-300 hover:scale-105 bg-card border">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="font-semibold text-sm">Hybrid AI</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Combined approach for comprehensive insights</p>
                      </Card>
                    </div>

                    {/* Enhanced Sample Questions */}
                    <div className="space-y-2 md:space-y-3">
                      <div className="flex items-center gap-2 justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-primary">Suggested Questions</p>
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-3xl mx-auto">
                        {/* Debug info */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="col-span-full text-xs text-muted-foreground">
                            Debug: Loading={isLoadingQuestions.toString()}, Questions={suggestedQuestions.length}, Connected={isConnected?.toString()}
                          </div>
                        )}
                        {isLoadingQuestions ? (
                          // Loading skeleton
                          Array.from({ length: 6 }).map((_, idx) => (
                            <div 
                              key={idx}
                              className="h-14 bg-muted/50 rounded-lg animate-pulse border border-border/50"
                            />
                          ))
                        ) : (
                          suggestedQuestions.slice(0, 6).map((question, idx) => (
                            <Button 
                              key={idx}
                              variant="outline" 
                              size="sm"
                              onClick={() => setInput(question)}
                              className="h-auto py-2 px-3 text-left hover:bg-primary/5 hover:border-primary/30 transition-all duration-300 group min-h-8 flex-wrap"
                            >
                              <div className="flex items-start gap-2 w-full">
                                <Search className="w-3 h-3 mt-0.5 text-primary group-hover:scale-110 transition-transform flex-shrink-0" />
                                <span className="text-xs leading-relaxed text-wrap break-words">{question}</span>
                              </div>
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={cn(
                    "flex gap-4 animate-in slide-in-from-bottom-2 fade-in duration-500 group",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className={cn(
                        "w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300",
                        message.isStreaming && "animate-pulse"
                      )}>
                        <Bot className="w-5 h-5 text-primary-foreground" />
                        {message.isStreaming && (
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent animate-pulse" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2 max-w-[80%]">
                    <div 
                      className={cn(
                        "rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-all duration-300 relative group",
                        message.role === 'user' 
                          ? "ml-12 bg-primary text-primary-foreground" 
                          : "bg-card border border-border/50"
                      )}
                    >
                      {message.role === 'assistant' && message.timestamp && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                      
                      <div className={cn(
                        "whitespace-pre-wrap text-sm leading-relaxed",
                        message.isStreaming && "relative"
                      )}>
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-5 bg-primary/60 animate-pulse ml-1" />
                        )}
                      </div>
                      
                      {/* Message Actions */}
                      {message.role === 'assistant' && !message.isStreaming && (
                        <div className="absolute -bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 hover:bg-background/80 rounded-full"
                            onClick={() => copyMessage(message.content)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 hover:bg-background/80 rounded-full"
                            onClick={() => reactToMessage(message.id!, 'like')}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 hover:bg-background/80 rounded-full"
                            onClick={() => reactToMessage(message.id!, 'bookmark')}
                          >
                            <Bookmark className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {message.tools_used && message.tools_used.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/30">
                          <div className="flex items-center gap-2 mb-3">
                            <RefreshCw className="w-3 h-3 text-blue-500" />
                            <p className="text-xs font-medium text-blue-600">AI Tools Used</p>
                          </div>
                          <div className="space-y-2">
                            {message.tools_used.map((tool, idx) => (
                              <div key={idx} className="flex items-center gap-3 text-xs bg-blue-50/80 dark:bg-blue-950/30 rounded-lg px-3 py-2 border border-blue-200/50 dark:border-blue-800/50">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Zap className="w-3 h-3 text-white" />
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium text-blue-700 dark:text-blue-300">{tool.tool_name || 'Tool'}</span>
                                  {tool.tool_call_id && (
                                    <span className="text-blue-500 dark:text-blue-400 ml-2 font-mono">#{tool.tool_call_id.slice(-6)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {message.metadata?.graph && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-2">Knowledge Graph:</p>
                          <pre className="text-xs bg-background/50 rounded px-2 py-1 overflow-x-auto">
                            {JSON.stringify(message.metadata.graph, null, 2)}
                          </pre>
                        </div>
                      )}

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border/30">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-3 h-3 text-green-500" />
                            <p className="text-xs font-medium text-green-600">Reference Sources</p>
                          </div>
                          <div className="space-y-2">
                            {message.sources.slice(0, 3).map((source, idx) => (
                              <div key={idx} className="group flex items-start gap-3 text-xs bg-green-50/80 dark:bg-green-950/30 rounded-lg px-3 py-3 border border-green-200/50 dark:border-green-800/50 hover:bg-green-100/80 dark:hover:bg-green-900/40 transition-colors cursor-pointer">
                                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-green-700 dark:text-green-300 truncate">
                                    {source.document_title || source.filename}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200">
                                      {(source.relevance_score * 100).toFixed(0)}% match
                                    </Badge>
                                    <span className="text-green-500 dark:text-green-400 font-mono">#{source.chunk_id.slice(-6)}</span>
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            {message.sources.length > 3 && (
                              <div className="text-center">
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-green-600">
                                  <ChevronDown className="w-3 h-3 mr-1" />
                                  Show {message.sources.length - 3} more sources
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Message Reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {message.reactions.map((reaction, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs px-2 py-1">
                            {reaction.type === 'like' ? '👍' : reaction.type === 'dislike' ? '👎' : '🔖'} {reaction.count}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                        <User className="w-5 h-5 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-4 animate-in slide-in-from-bottom-2 fade-in duration-500">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                      <Bot className="w-5 h-5 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="max-w-[80%] rounded-2xl bg-card border border-border/50 px-5 py-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce delay-200" />
                      </div>
                      <span className="text-sm text-muted-foreground">Analyzing documents...</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Search className="w-3 h-3 animate-spin" />
                      <span>Searching knowledge base</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Enhanced Input Area */}
          <div className="flex-shrink-0 border-t bg-background p-2 md:p-3 shadow-sm">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSubmit} className="relative">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about your documents... Try asking about environmental assessments, remediation plans, or regulatory requirements."
                    className="w-full min-h-[84px] md:min-h-[96px] max-h-[200px] resize-none rounded-2xl border bg-card px-5 py-3 pr-28 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
                    disabled={isLoading}
                    rows={3}
                  />
                  
                  {/* Input Status Bar */}
                  <div className="absolute right-20 bottom-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full transition-colors",
                      input.length > 1800 ? "bg-destructive/10 text-destructive" :
                      input.length > 1500 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600" :
                      "text-muted-foreground"
                    )}>
                      <span>{input.length}/2000</span>
                    </div>
                    {isConnected && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span>Connected</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {input.trim() && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full hover:bg-muted/80"
                        onClick={() => setInput('')}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      type="submit" 
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className={cn(
                        "h-10 w-10 rounded-xl shadow-lg transition-all duration-300",
                        !input.trim() || isLoading 
                          ? "bg-muted text-muted-foreground cursor-not-allowed" 
                          : "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary hover:shadow-xl hover:scale-105 text-primary-foreground"
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs hover:bg-primary/10 hover:text-primary"
                      onClick={() => setInput('What environmental concerns are mentioned in the documents?')}
                    >
                      <Search className="w-3 h-3 mr-1" />
                      Environmental concerns
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs hover:bg-primary/10 hover:text-primary"
                      onClick={() => setInput('Summarize the remediation methods discussed')}
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Remediation methods
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>Press</span>
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd>
                    <span>to send</span>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Protect>
  )
}