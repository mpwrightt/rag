'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles, 
  MessageSquare, 
  Copy, 
  ThumbsUp, 
  ThumbsDown, 
  Bookmark, 
  RefreshCw, 
  Brain, 
  Search, 
  FileText, 
  Eye, 
  Clock, 
  Mic,
  Image as ImageIcon,
  Paperclip,
  MoreHorizontal,
  Share2,
  Download,
  Zap,
  Database,
  Network
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Protect } from '@clerk/nextjs'
import CustomClerkPricing from '@/components/custom-clerk-pricing'
import { MagicCard } from '@/components/magicui/magic-card'
import { AnimatedList } from '@/components/magicui/animated-list'
import Particles from '@/components/magicui/particles'
import TypingAnimation from '@/components/magicui/typing-animation'
import ShimmerButton from '@/components/magicui/shimmer-button'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

// Enhanced message types
type ModernChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  isStreaming?: boolean
  reactions?: { type: 'like' | 'dislike' | 'bookmark'; count: number }[]
  tools_used?: Array<{ tool_name?: string; args?: any; tool_call_id?: string }>
  sources?: Array<{ 
    filename: string
    chunk_id: string
    relevance_score: number
    document_title?: string
    preview?: string
  }>
  metadata?: {
    processingTime?: number
    tokens?: number
    model?: string
    confidence?: number
  }
  attachments?: Array<{
    type: 'image' | 'file' | 'audio'
    url: string
    name: string
    size: number
  }>
}

function UpgradeCard() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      <Particles className="absolute inset-0" color="#6366f1" quantity={50} />
      <div className="relative z-10 space-y-8 text-center max-w-2xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <MagicCard className="p-8">
            <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Upgrade to Experience the Future
            </h1>
            <p className="text-muted-foreground mb-6">
              Unlock the most advanced RAG chat interface with cutting-edge AI features, 
              real-time streaming, and sophisticated document analysis.
            </p>
            <div className="space-y-4">
              <CustomClerkPricing />
            </div>
          </MagicCard>
        </motion.div>
      </div>
    </div>
  )
}

export default function ModernChatPage() {
  const [messages, setMessages] = useState<ModernChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [isConnected, setIsConnected] = useState<boolean | null>(true)
  const [streamingText, setStreamingText] = useState('')
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Enhanced animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.6,
        staggerChildren: 0.1 
      }
    }
  }

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30 
      }
    }
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Load dynamic questions
  useEffect(() => {
    const loadQuestions = async () => {
      if (messages.length > 0) return
      
      setIsLoadingQuestions(true)
      try {
        const res = await fetch(`${API_BASE}/api/questions/generate?limit=8`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })
        if (res.ok) {
          const data = await res.json()
          setSuggestedQuestions(data.questions || [
            "What are the key environmental findings in my documents?",
            "Analyze the remediation strategies mentioned across all reports",
            "Compare the site assessment methodologies used",
            "What regulatory requirements are highlighted?",
            "Summarize the contamination levels found",
            "What are the recommended next steps?",
            "Identify potential environmental risks",
            "What timeline is suggested for remediation?"
          ])
        } else {
          throw new Error('Failed to load questions')
        }
      } catch (error) {
        setSuggestedQuestions([
          "What are the key environmental findings in my documents?",
          "Analyze the remediation strategies mentioned across all reports",
          "Compare the site assessment methodologies used",
          "What regulatory requirements are highlighted?",
          "Summarize the contamination levels found",
          "What are the recommended next steps?",
          "Identify potential environmental risks",
          "What timeline is suggested for remediation?"
        ])
      } finally {
        setIsLoadingQuestions(false)
      }
    }

    loadQuestions()
  }, [messages.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: ModernChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsTyping(true)

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

      let assistantMessage: ModernChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        tools_used: [],
        sources: [],
        timestamp: new Date().toISOString(),
        isStreaming: true,
        metadata: {}
      }
      
      setMessages(prev => [...prev, assistantMessage])

      const decoder = new TextDecoder()
      let buffer = ''
      const startTime = Date.now()

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
              
              if (data.type === 'text' || data.type === 'content') {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content += data.content || ''
                    lastMessage.isStreaming = true
                  }
                  return newMessages
                })
              } else if (data.type === 'tools' && Array.isArray(data.tools)) {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.tools_used = data.tools
                  }
                  return newMessages
                })
              } else if (data.type === 'sources' && Array.isArray(data.sources)) {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.sources = data.sources
                  }
                  return newMessages
                })
              } else if (data.type === 'session' && data.session_id) {
                sessionIdRef.current = data.session_id
              } else if (data.type === 'end') {
                setIsTyping(false)
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.isStreaming = false
                    lastMessage.metadata = {
                      ...lastMessage.metadata,
                      processingTime: Date.now() - startTime,
                      tokens: lastMessage.content.split(' ').length
                    }
                  }
                  return newMessages
                })
              } else if (data.type === 'error') {
                const errorText = typeof data.content === 'string' && data.content
                  ? data.content
                  : 'Sorry, an error occurred while streaming the response.'
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage && lastMessage.role === 'assistant' && !lastMessage.content) {
                    lastMessage.content = errorText
                  } else {
                    newMessages.push({ 
                      id: `error-${Date.now()}`,
                      role: 'assistant', 
                      content: errorText,
                      timestamp: new Date().toISOString()
                    })
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
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to connect to the backend. Please check your connection and try again.',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  const reactToMessage = useCallback((messageId: string, reaction: 'like' | 'dislike' | 'bookmark') => {
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
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    sessionIdRef.current = null
  }, [])

  return (
    <Protect
      condition={(has) => has({ plan: 'pro' })}
      fallback={<UpgradeCard />}
    >
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/10 relative overflow-hidden">
        {/* Subtle background particles */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full animate-pulse" />
          <div className="absolute bottom-20 right-20 w-24 h-24 bg-gradient-to-br from-secondary/5 to-transparent rounded-full animate-pulse delay-1000" />
          <div className="absolute top-40 right-10 w-16 h-16 bg-gradient-to-br from-accent/5 to-transparent rounded-full animate-pulse delay-500" />
        </div>

        {/* Modern Header */}
        <div className="relative z-10 border-b bg-background/80 backdrop-blur-xl p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <MagicCard className="w-14 h-14 flex items-center justify-center p-0 border-0">
                  <Brain className="w-7 h-7 text-primary" />
                </MagicCard>
                <motion.div 
                  className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div>
                <TypingAnimation 
                  text="RAG Intelligence Pro"
                  className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent"
                  duration={100}
                />
                <motion.p 
                  className="text-sm text-muted-foreground flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2 }}
                >
                  <Sparkles className="w-3 h-3" />
                  Advanced AI • Real-time Analysis • Multi-modal Input
                </motion.p>
              </div>
            </div>

            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {messages.length > 0 && (
                <Badge variant="secondary" className="px-3 py-2 bg-primary/10 text-primary border-primary/20">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  {messages.length} messages
                </Badge>
              )}
              {messages.length > 0 && (
                <ShimmerButton
                  onClick={clearChat}
                  className="px-4 py-2 text-sm"
                  shimmerColor="#ef4444"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Chat
                </ShimmerButton>
              )}
            </motion.div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 && (
                <motion.div 
                  className="text-center space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <MagicCard className="max-w-4xl mx-auto p-4 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-primary via-primary/80 to-secondary rounded-full flex items-center justify-center shadow-xl mx-auto mb-3 relative overflow-hidden">
                        <Bot className="w-6 h-6 text-white relative z-10" />
                        <motion.div 
                          className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    </motion.div>

                    <h2 className="text-xl font-bold mb-2 bg-gradient-to-r from-primary via-primary/80 to-secondary bg-clip-text text-transparent">
                      Welcome to RAG Intelligence Pro
                    </h2>
                    <p className="text-muted-foreground mb-4 max-w-xl mx-auto leading-relaxed text-xs">
                      Advanced AI-powered document analysis with real-time streaming and intelligent context.
                    </p>

                    {/* Enhanced Feature Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                      {[
                        {
                          icon: Database,
                          title: "Hybrid Search",
                          description: "Vector + Knowledge Graph fusion",
                          color: "from-blue-500 to-blue-600"
                        },
                        {
                          icon: Network,
                          title: "Real-time Streaming",
                          description: "Live AI response generation",
                          color: "from-purple-500 to-purple-600"
                        },
                        {
                          icon: Zap,
                          title: "Multi-modal AI",
                          description: "Text, voice, and file input",
                          color: "from-green-500 to-green-600"
                        }
                      ].map((feature, index) => (
                        <motion.div
                          key={feature.title}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                        >
                          <MagicCard className="p-2 hover:scale-105 transition-all duration-300">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-6 h-6 bg-gradient-to-br ${feature.color} rounded flex items-center justify-center`}>
                                <feature.icon className="w-3 h-3 text-white" />
                              </div>
                              <h3 className="font-medium text-xs">{feature.title}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground leading-tight">{feature.description}</p>
                          </MagicCard>
                        </motion.div>
                      ))}
                    </div>

                    {/* Smart Question Suggestions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1 justify-center">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <p className="text-xs font-medium text-primary">Intelligent Suggestions</p>
                        <Sparkles className="w-3 h-3 text-primary" />
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-w-4xl mx-auto">
                        {isLoadingQuestions ? (
                          Array.from({ length: 6 }).map((_, idx) => (
                            <Skeleton key={idx} className="h-12 rounded-lg" />
                          ))
                        ) : (
                          suggestedQuestions.slice(0, 6).map((question, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.3, delay: idx * 0.05 }}
                              whileHover={{ scale: 1.01, y: -1 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <Button
                                variant="outline"
                                onClick={() => setInput(question)}
                                className="h-auto py-2 px-2 text-left hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group w-full min-h-[2.5rem]"
                              >
                                <div className="flex items-start gap-1 w-full">
                                  <Search className="w-2 h-2 mt-1 text-primary group-hover:scale-110 transition-transform flex-shrink-0" />
                                  <span className="text-xs leading-tight text-left hyphens-auto break-words overflow-hidden line-clamp-2">
                                    {question}
                                  </span>
                                </div>
                              </Button>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </MagicCard>
                </motion.div>
              )}

              {/* Enhanced Messages */}
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  variants={messageVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  layout
                  className={cn(
                    "flex gap-4 group relative",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <motion.div className="flex-shrink-0 mt-1">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className={cn(
                          "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
                          message.isStreaming && "animate-pulse"
                        )}>
                          <Bot className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      {message.isStreaming && (
                        <motion.div 
                          className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/30 to-transparent blur-md"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                    </motion.div>
                  )}

                  <div className="flex flex-col gap-2 max-w-[80%] min-w-0">
                    <MagicCard 
                      className={cn(
                        "p-5 relative group/message",
                        message.role === 'user' 
                          ? "ml-12 bg-primary text-primary-foreground border-primary/20" 
                          : "bg-card/50 backdrop-blur-sm border-border/50"
                      )}
                    >
                      {/* Message metadata */}
                      {message.role === 'assistant' && message.timestamp && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Clock className="w-3 h-3" />
                          {new Date(message.timestamp).toLocaleTimeString()}
                          {message.metadata?.processingTime && (
                            <Badge variant="outline" className="text-xs px-2 py-0.5 ml-2">
                              {message.metadata.processingTime}ms
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Message content */}
                      <div className={cn(
                        "whitespace-pre-wrap text-sm leading-relaxed",
                        message.isStreaming && "relative"
                      )}>
                        {message.content}
                        {message.isStreaming && (
                          <motion.span 
                            className="inline-block w-2 h-5 bg-primary/60 ml-1"
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        )}
                      </div>

                      {/* Enhanced message actions */}
                      {message.role === 'assistant' && !message.isStreaming && (
                        <motion.div 
                          className="absolute -bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-300"
                          initial={{ y: 10 }}
                          animate={{ y: 0 }}
                        >
                          {[
                            { icon: Copy, action: () => copyMessage(message.content), tooltip: "Copy" },
                            { icon: ThumbsUp, action: () => reactToMessage(message.id!, 'like'), tooltip: "Like" },
                            { icon: Bookmark, action: () => reactToMessage(message.id!, 'bookmark'), tooltip: "Bookmark" },
                            { icon: Share2, action: () => {}, tooltip: "Share" }
                          ].map(({ icon: Icon, action, tooltip }, idx) => (
                            <motion.div key={tooltip} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-background/80 rounded-full"
                                onClick={action}
                                title={tooltip}
                              >
                                <Icon className="w-3 h-3" />
                              </Button>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}

                      {/* Enhanced tools display */}
                      {message.tools_used && message.tools_used.length > 0 && (
                        <motion.div 
                          className="mt-4 pt-4 border-t border-border/30"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <RefreshCw className="w-3 h-3 text-blue-500" />
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">AI Tools Applied</p>
                          </div>
                          <div className="space-y-2">
                            {message.tools_used.map((tool, idx) => (
                              <motion.div 
                                key={idx}
                                className="flex items-center gap-3 text-xs bg-blue-50/80 dark:bg-blue-950/30 rounded-lg px-3 py-2 border border-blue-200/50 dark:border-blue-800/50"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                              >
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Zap className="w-3 h-3 text-white" />
                                </div>
                                <span className="font-medium text-blue-700 dark:text-blue-300">
                                  {tool.tool_name || 'Advanced Tool'}
                                </span>
                                {tool.tool_call_id && (
                                  <Badge variant="outline" className="text-xs">
                                    #{tool.tool_call_id.slice(-6)}
                                  </Badge>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Enhanced sources display */}
                      {message.sources && message.sources.length > 0 && (
                        <motion.div 
                          className="mt-4 pt-4 border-t border-border/30"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.7 }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-3 h-3 text-green-500" />
                            <p className="text-xs font-medium text-green-600 dark:text-green-400">Reference Sources</p>
                            <Badge variant="outline" className="text-xs">
                              {message.sources.length} found
                            </Badge>
                          </div>
                          <div className="space-y-3">
                            {message.sources.slice(0, 3).map((source, idx) => (
                              <motion.div
                                key={idx}
                                className="group/source flex items-start gap-3 text-xs bg-green-50/80 dark:bg-green-950/30 rounded-lg px-3 py-3 border border-green-200/50 dark:border-green-800/50 hover:bg-green-100/80 dark:hover:bg-green-900/40 transition-colors cursor-pointer"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: idx * 0.1 }}
                                whileHover={{ x: 4 }}
                              >
                                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-green-700 dark:text-green-300 truncate mb-1">
                                    {source.document_title || source.filename}
                                  </div>
                                  {source.preview && (
                                    <div className="text-green-600 dark:text-green-400 mb-2 line-clamp-2">
                                      "{source.preview}"
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200">
                                      {(source.relevance_score * 100).toFixed(0)}% match
                                    </Badge>
                                    <span className="text-green-500 dark:text-green-400 font-mono">
                                      #{source.chunk_id.slice(-6)}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover/source:opacity-100 transition-opacity"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              </motion.div>
                            ))}
                            {message.sources.length > 3 && (
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-green-600 w-full">
                                <MoreHorizontal className="w-3 h-3 mr-1" />
                                Show {message.sources.length - 3} more sources
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </MagicCard>

                    {/* Message reactions */}
                    {message.reactions && message.reactions.length > 0 && (
                      <motion.div 
                        className="flex items-center gap-2 ml-2"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {message.reactions.map((reaction, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs px-2 py-1">
                            {reaction.type === 'like' ? '👍' : reaction.type === 'dislike' ? '👎' : '🔖'} {reaction.count}
                          </Badge>
                        ))}
                      </motion.div>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <motion.div className="flex-shrink-0 mt-1">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                    </motion.div>
                  )}
                </motion.div>
              ))}

              {/* Enhanced typing indicator */}
              {isTyping && (
                <motion.div 
                  className="flex gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground animate-pulse">
                      <Bot className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <MagicCard className="max-w-[80%] p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            className="w-2 h-2 bg-primary/60 rounded-full"
                            animate={{ y: [-2, 2, -2] }}
                            transition={{ 
                              duration: 0.6, 
                              repeat: Infinity, 
                              delay: i * 0.2 
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">AI is thinking...</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Search className="w-3 h-3 animate-spin" />
                      <span>Analyzing documents and generating response</span>
                    </div>
                  </MagicCard>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Enhanced Input Area */}
        <motion.div 
          className="border-t bg-background/80 backdrop-blur-xl p-3 relative z-10 shadow-lg"
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="max-w-6xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <MagicCard className="p-0 border-border/50">
                <div className="relative group">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about your documents... I can analyze, summarize, compare, and answer questions with intelligent context."
                    className="w-full min-h-[80px] max-h-[160px] resize-none rounded-lg border-0 bg-transparent px-4 py-3 pr-28 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                    disabled={isLoading}
                    rows={3}
                  />
                  
                  {/* Enhanced input status */}
                  <div className="absolute right-24 bottom-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <motion.div 
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full transition-colors",
                        input.length > 1800 ? "bg-destructive/10 text-destructive" :
                        input.length > 1500 ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600" :
                        "text-muted-foreground"
                      )}
                      animate={{ scale: input.length > 1800 ? [1, 1.05, 1] : 1 }}
                      transition={{ duration: 0.5, repeat: input.length > 1800 ? Infinity : 0 }}
                    >
                      <span>{input.length}/2000</span>
                    </motion.div>
                    {isConnected && (
                      <motion.div 
                        className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        <motion.div 
                          className="w-2 h-2 bg-green-500 rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span>Connected</span>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Enhanced action buttons */}
                  <div className="absolute right-3 top-3 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-muted/80"
                      title="Voice input"
                      onClick={() => setIsVoiceRecording(!isVoiceRecording)}
                    >
                      <Mic className={cn("w-4 h-4", isVoiceRecording && "text-red-500")} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-muted/80"
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-muted/80"
                      title="Add image"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                    <ShimmerButton
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className="h-10 w-10 rounded-xl p-0"
                      shimmerColor={!input.trim() || isLoading ? "#6b7280" : "#ffffff"}
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </ShimmerButton>
                  </div>
                </div>
              </MagicCard>
              
              {/* Quick actions and shortcuts */}
              <div className="flex items-center justify-end mt-3">
                
                <motion.div 
                  className="text-xs text-muted-foreground flex items-center gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <span>Press</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⏎</kbd>
                  <span>to send •</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">⇧⏎</kbd>
                  <span>new line</span>
                </motion.div>
              </div>

            </form>
          </div>
        </motion.div>
      </div>
    </Protect>
  )
}