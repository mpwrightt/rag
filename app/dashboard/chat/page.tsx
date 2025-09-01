'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  MessageSquare, 
  Copy, 
  RefreshCw, 
  Bookmark, 
  MoreHorizontal,
  Settings, 
  X, 
  FileText,
  Search,
  Brain,
  Sparkles,
  Database,
  Network,
  Zap,
  Filter,
  Clock,
  Shield,
  Gauge,
  ExternalLink,
  Hash,
  Eye,
  ChevronDown,
  ChevronRight,
  Folder,
  Globe,
  Mic,
  Paperclip,
  Volume2,
  VolumeX,
  Download,
  Save,
  Plus,
  History,
  GitBranch,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Info,
  HelpCircle,
  RotateCcw,
  Share2,
  Edit3,
  SlidersHorizontal,
  Menu
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Protect } from '@clerk/nextjs'
import CustomClerkPricing from '@/components/custom-clerk-pricing'

// Types
type MessageRole = 'user' | 'assistant' | 'system'

type Source = {
  filename: string
  chunk_id: string
  relevance_score: number
  document_title?: string
  preview?: string
  collection?: string
  page_number?: number
}

type ConfidenceMetrics = {
  overall: number
  factual_accuracy: number
  source_reliability: number
  completeness: number
  reasoning_quality: number
}

type MessageMetadata = {
  processingTime?: number
  tokens?: number
  model?: string
  temperature?: number
  searchQuery?: string
  searchMode?: 'vector' | 'hybrid' | 'keyword'
}

type ChatMessage = {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  isStreaming?: boolean
  sources?: Source[]
  confidence?: ConfidenceMetrics
  metadata?: MessageMetadata
  reactions?: Array<{ type: 'like' | 'dislike' | 'bookmark'; userId?: string }>
  isBookmarked?: boolean
  branchId?: string
  parentMessageId?: string
}

type ChatSettings = {
  systemPrompt: string
  temperature: number
  maxTokens: number
  model: 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-sonnet'
  searchMode: 'vector' | 'hybrid' | 'keyword'
  contextMode: 'all' | 'collections' | 'documents'
  selectedCollections: string[]
  selectedDocuments: string[]
  enableStreaming: boolean
  enableSources: boolean
  enableConfidence: boolean
  voiceEnabled: boolean
  topK: number
  similarityThreshold: number
}

type Collection = {
  id: string
  name: string
  documentCount: number
  description?: string
}

type Document = {
  id: string
  name: string
  title?: string
  collection?: string
  pageCount?: number
}

type Conversation = {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  isBookmarked?: boolean
  tags?: string[]
}

// Backend API configuration
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

// Markdown renderer component for message content
function MarkdownContent({ content, isUser = false }: { content: string, isUser?: boolean }) {
  // Simple markdown-like rendering for common patterns
  const renderContent = (text: string) => {
    // Handle code blocks
    if (text.includes('```')) {
      const parts = text.split(/(```[\s\S]*?```)/);
      return parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const codeContent = part.slice(3, -3).trim();
          const lines = codeContent.split('\n');
          const language = lines[0].includes(' ') ? '' : lines[0];
          const code = language ? lines.slice(1).join('\n') : codeContent;
          
          return (
            <div key={index} className="my-4 rounded-xl overflow-hidden bg-gray-900 border border-gray-200">
              {language && (
                <div className="px-4 py-2 bg-gray-800 text-gray-300 text-xs font-mono flex items-center gap-2">
                  <Hash className="w-3 h-3" />
                  <span>{language}</span>
                </div>
              )}
              <ScrollArea className="max-h-96">
                <pre className="p-4 text-sm font-mono text-gray-100 overflow-x-auto">
                  <code>{code}</code>
                </pre>
              </ScrollArea>
            </div>
          );
        } else {
          return <span key={index}>{formatInlineElements(part)}</span>;
        }
      });
    }
    
    return formatInlineElements(text);
  };
  
  // Handle inline formatting
  const formatInlineElements = (text: string) => {
    // Handle bold text **bold**
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Handle italic text *italic*
    formattedText = formattedText.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    
    // Handle inline code `code`
    formattedText = formattedText.replace(/`([^`]+)`/g, 
      '<code class="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-sm font-mono border">$1</code>');
    
    // Handle numbered lists
    if (formattedText.includes('\n1. ')) {
      const lines = formattedText.split('\n');
      let inList = false;
      let result = [];
      
      for (let line of lines) {
        if (/^\d+\. /.test(line)) {
          if (!inList) {
            result.push('<ol class="list-decimal list-inside space-y-1 my-3 ml-4">');
            inList = true;
          }
          result.push(`<li class="text-sm leading-relaxed">${line.replace(/^\d+\. /, '')}</li>`);
        } else if (inList && line.trim() === '') {
          // Continue list
        } else {
          if (inList) {
            result.push('</ol>');
            inList = false;
          }
          if (line.trim()) result.push(line);
        }
      }
      if (inList) result.push('</ol>');
      formattedText = result.join('\n');
    }
    
    // Handle bullet points
    if (formattedText.includes('\n- ') || formattedText.includes('\n• ')) {
      const lines = formattedText.split('\n');
      let inList = false;
      let result = [];
      
      for (let line of lines) {
        if (/^[•-] /.test(line)) {
          if (!inList) {
            result.push('<ul class="list-disc list-inside space-y-1 my-3 ml-4">');
            inList = true;
          }
          result.push(`<li class="text-sm leading-relaxed">${line.replace(/^[•-] /, '')}</li>`);
        } else if (inList && line.trim() === '') {
          // Continue list
        } else {
          if (inList) {
            result.push('</ul>');
            inList = false;
          }
          if (line.trim()) result.push(line);
        }
      }
      if (inList) result.push('</ul>');
      formattedText = result.join('\n');
    }
    
    return formattedText;
  };
  
  const processedContent = renderContent(content);
  
  if (typeof processedContent === 'string') {
    return (
      <div 
        className={cn(
          "text-[15px] leading-relaxed font-normal tracking-wide",
          isUser ? "text-white/90" : "text-gray-800"
        )}
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    );
  }
  
  return (
    <div className={cn(
      "text-[15px] leading-relaxed font-normal tracking-wide",
      isUser ? "text-white/90" : "text-gray-800"
    )}>
      {processedContent}
    </div>
  );
}

// Upgrade card for non-pro users
function UpgradeCard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/60 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Brain className="w-12 h-12 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold lg:text-4xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Upgrade to DataDiver Pro
        </h1>
        <p className="text-lg text-muted-foreground max-w-lg mx-auto">
          Experience the most advanced RAG chat interface with AI-powered document analysis, 
          real-time streaming, and intelligent context management.
        </p>
      </div>
      <div className="px-8 lg:px-12 mt-8 w-full max-w-4xl">
        <CustomClerkPricing />
      </div>
    </div>
  )
}

// Main chat component
export default function ModernRAGChatPage() {
  // Core chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  // UI state
  const [showSources, setShowSources] = useState(false)

  // Dynamic questions state
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)

  // Context data
  const [collections, setCollections] = useState<Collection[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeSources, setActiveSources] = useState<Source[]>([])

  // Settings
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    systemPrompt: 'You are a helpful AI assistant with access to a comprehensive knowledge base. Provide accurate, detailed responses based on the available context. Always cite your sources when referencing specific documents.',
    temperature: 0.7,
    maxTokens: 2000,
    model: 'gpt-4-turbo',
    searchMode: 'hybrid',
    contextMode: 'all',
    selectedCollections: [],
    selectedDocuments: [],
    enableStreaming: true,
    enableSources: true,
    enableConfidence: true,
    voiceEnabled: false,
    topK: 5,
    similarityThreshold: 0.7,
  })

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Check backend connection
  const checkConnection = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`${API_BASE}/health`, {
        headers: { 'bypass-tunnel-reminder': 'true' },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      setIsConnected(response.ok)
    } catch (error) {
      console.warn('Backend connection check failed:', error)
      setIsConnected(false)
    }
  }, [])

  // Load suggested questions (CRITICAL: Preserve this functionality)
  const loadSuggestedQuestions = useCallback(async () => {
    if (messages.length > 0) return
    
    setIsLoadingQuestions(true)
    try {
      const response = await fetch(`${API_BASE}/api/questions/generate?limit=8`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSuggestedQuestions(data.questions || [])
      } else {
        throw new Error('Failed to load questions')
      }
    } catch (error) {
      // Fallback questions with environmental focus
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
  }, [messages.length])

  // Load context data
  const loadContextData = useCallback(async () => {
    try {
      // Load collections
      const collectionsResponse = await fetch(`${API_BASE}/collections`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      })
      
      if (collectionsResponse.ok) {
        const data = await collectionsResponse.json()
        setCollections(data.collections || [])
      }

      // Load documents
      const documentsResponse = await fetch(`${API_BASE}/documents`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      })
      
      if (documentsResponse.ok) {
        const data = await documentsResponse.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to load context data:', error)
      // Set demo data
      setCollections([
        { id: 'env', name: 'Environmental Studies', documentCount: 12, description: 'Environmental impact assessments and reports' },
        { id: 'tech', name: 'Technical Reports', documentCount: 8, description: 'Technical analysis and methodology documents' },
        { id: 'legal', name: 'Legal Documents', documentCount: 5, description: 'Compliance and regulatory documentation' }
      ])
      setDocuments([
        { id: 'doc1', name: 'report_2024.pdf', title: 'Environmental Impact Report 2024', collection: 'env', pageCount: 45 },
        { id: 'doc2', name: 'analysis.pdf', title: 'Technical Analysis Document', collection: 'tech', pageCount: 23 },
        { id: 'doc3', name: 'compliance.pdf', title: 'Regulatory Compliance Guide', collection: 'legal', pageCount: 67 }
      ])
    }
  }, [])

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    
    // Create streaming assistant message
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      sources: [],
      confidence: {
        overall: 0,
        factual_accuracy: 0,
        source_reliability: 0,
        completeness: 0,
        reasoning_quality: 0
      },
      metadata: {
        model: chatSettings.model,
        temperature: chatSettings.temperature,
        searchMode: chatSettings.searchMode
      }
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({
          message: userMessage.content,
          session_id: sessionIdRef.current,
          settings: {
            system_prompt: chatSettings.systemPrompt,
            temperature: chatSettings.temperature,
            max_tokens: chatSettings.maxTokens,
            model: chatSettings.model,
            search_mode: chatSettings.searchMode,
            enable_sources: chatSettings.enableSources,
            enable_confidence: chatSettings.enableConfidence,
            top_k: chatSettings.topK,
            similarity_threshold: chatSettings.similarityThreshold
          },
          context: chatSettings.contextMode !== 'all' ? {
            mode: chatSettings.contextMode,
            collections: chatSettings.selectedCollections,
            documents: chatSettings.selectedDocuments
          } : null
        })
      })

      if (!response.ok) throw new Error('Chat request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

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
              
              if (data.type === 'content' || data.type === 'text') {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage?.role === 'assistant') {
                    lastMessage.content += data.content || ''
                  }
                  return newMessages
                })
              } else if (data.type === 'sources' && data.sources) {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage?.role === 'assistant') {
                    lastMessage.sources = data.sources
                    setActiveSources(data.sources)
                  }
                  return newMessages
                })
              } else if (data.type === 'confidence' && data.confidence) {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage?.role === 'assistant') {
                    lastMessage.confidence = data.confidence
                  }
                  return newMessages
                })
              } else if (data.type === 'session' && data.session_id) {
                sessionIdRef.current = data.session_id
              } else if (data.type === 'end') {
                setMessages(prev => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]
                  if (lastMessage?.role === 'assistant') {
                    lastMessage.isStreaming = false
                    lastMessage.metadata = {
                      ...lastMessage.metadata,
                      processingTime: Date.now() - startTime,
                      tokens: lastMessage.content.split(/\s+/).length
                    }
                  }
                  return newMessages
                })
              }
            } catch (e) {
              console.error('Error parsing stream data:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage?.role === 'assistant') {
          lastMessage.content = 'Sorry, I encountered an error. Please try again.'
          lastMessage.isStreaming = false
        }
        return newMessages
      })
      setIsConnected(false)
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // Copy message content
  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content)
  }, [])

  // Clear conversation
  const clearChat = useCallback(() => {
    setMessages([])
    setActiveSources([])
    sessionIdRef.current = null
  }, [])

  // Export conversation
  const exportConversation = useCallback(() => {
    const exportData = {
      conversation: {
        title: `RAG Chat - ${new Date().toLocaleDateString()}`,
        messages: messages,
        settings: chatSettings,
        exportedAt: new Date().toISOString()
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rag-chat-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [messages, chatSettings])

  // Initialize data
  useEffect(() => {
    checkConnection()
    loadContextData()
    loadSuggestedQuestions()
  }, [checkConnection, loadContextData, loadSuggestedQuestions])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }, [input])

  return (
    <Protect
      condition={(has) => has({ plan: 'pro' })}
      fallback={<UpgradeCard />}
    >
      <div className="flex h-full min-h-0 flex-col bg-background">
        {/* Top Toolbar */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center shadow-lg">
                    <Brain className="w-5 h-5 text-primary-foreground" />
                  </div>
                  {isConnected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    DataDiver RAG Chat
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-3 h-3" />
                    <span>AI-powered document intelligence</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Collections Filter Quick Access */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "transition-colors",
                      chatSettings.contextMode !== 'all' ? "bg-blue-50 border-blue-200 text-blue-700" : ""
                    )}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    {chatSettings.contextMode === 'all' ? 'All Documents' : 
                     chatSettings.contextMode === 'collections' ? `${chatSettings.selectedCollections.length} Collections` :
                     `${chatSettings.selectedDocuments.length} Documents`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Search Scope</label>
                      <Select 
                        value={chatSettings.contextMode} 
                        onValueChange={(value: 'all' | 'collections' | 'documents') => 
                          setChatSettings(prev => ({ 
                            ...prev, 
                            contextMode: value, 
                            selectedCollections: [], 
                            selectedDocuments: [] 
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              All Documents ({documents.length})
                            </div>
                          </SelectItem>
                          <SelectItem value="collections">
                            <div className="flex items-center gap-2">
                              <Folder className="w-4 h-4" />
                              Select Collections
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Collection Selection */}
                    {chatSettings.contextMode === 'collections' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Collections</label>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {collections.map((collection) => (
                            <div key={collection.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`collection-${collection.id}`}
                                checked={chatSettings.selectedCollections.includes(collection.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setChatSettings(prev => ({ 
                                      ...prev, 
                                      selectedCollections: [...prev.selectedCollections, collection.id]
                                    }))
                                  } else {
                                    setChatSettings(prev => ({ 
                                      ...prev, 
                                      selectedCollections: prev.selectedCollections.filter(id => id !== collection.id)
                                    }))
                                  }
                                }}
                                className="rounded"
                              />
                              <label 
                                htmlFor={`collection-${collection.id}`}
                                className="text-sm flex items-center gap-2 cursor-pointer flex-1"
                              >
                                <Folder className="w-3 h-3" />
                                <div className="flex-1">
                                  <div className="font-medium">{collection.name}</div>
                                  <div className="text-xs text-muted-foreground">{collection.description}</div>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {collection.documentCount}
                                </Badge>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Search Mode Quick Access */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {chatSettings.searchMode === 'hybrid' ? <Network className="w-4 h-4 mr-2" /> :
                     chatSettings.searchMode === 'vector' ? <Database className="w-4 h-4 mr-2" /> :
                     <Search className="w-4 h-4 mr-2" />}
                    {chatSettings.searchMode}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Search Method</label>
                    <div className="space-y-2">
                      {[
                        { value: 'hybrid', label: 'Hybrid Search', desc: 'Vector + keyword matching', icon: Network },
                        { value: 'vector', label: 'Vector Search', desc: 'Semantic similarity', icon: Database },
                        { value: 'keyword', label: 'Keyword Search', desc: 'Exact text matching', icon: Search }
                      ].map((mode) => {
                        const IconComponent = mode.icon
                        return (
                          <div
                            key={mode.value}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                              chatSettings.searchMode === mode.value
                                ? "bg-primary/10 border border-primary/20"
                                : "hover:bg-muted"
                            )}
                            onClick={() => setChatSettings(prev => ({ ...prev, searchMode: mode.value as any }))}
                          >
                            <IconComponent className="w-4 h-4 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{mode.label}</div>
                              <div className="text-xs text-muted-foreground">{mode.desc}</div>
                            </div>
                            {chatSettings.searchMode === mode.value && (
                              <div className="w-2 h-2 bg-primary rounded-full mt-1" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Settings Modal Trigger */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="end">
                  <Tabs defaultValue="model" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="model">Model</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    <TabsContent value="model" className="space-y-4">
                      {/* Model Selection */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium">AI Model</label>
                        <Select 
                          value={chatSettings.model} 
                          onValueChange={(value: ChatSettings['model']) => 
                            setChatSettings(prev => ({ ...prev, model: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Recommended)</SelectItem>
                            <SelectItem value="gpt-4">GPT-4</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                            <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Temperature */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Creativity: {chatSettings.temperature.toFixed(1)}</label>
                        <Slider
                          value={[chatSettings.temperature]}
                          onValueChange={(value) => setChatSettings(prev => ({ ...prev, temperature: value[0] }))}
                          max={1}
                          min={0}
                          step={0.1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Precise</span>
                          <span>Creative</span>
                        </div>
                      </div>

                      {/* System Prompt */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium">System Prompt</label>
                        <Textarea
                          value={chatSettings.systemPrompt}
                          onChange={(e) => setChatSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                          rows={3}
                          className="text-sm"
                          placeholder="Define how the AI should behave..."
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4">
                      {/* Feature Toggles */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">Streaming</span>
                          </div>
                          <Switch
                            checked={chatSettings.enableStreaming}
                            onCheckedChange={(checked) => setChatSettings(prev => ({ ...prev, enableStreaming: checked }))}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium">Sources</span>
                          </div>
                          <Switch
                            checked={chatSettings.enableSources}
                            onCheckedChange={(checked) => setChatSettings(prev => ({ ...prev, enableSources: checked }))}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-indigo-500" />
                            <span className="text-sm font-medium">Confidence</span>
                          </div>
                          <Switch
                            checked={chatSettings.enableConfidence}
                            onCheckedChange={(checked) => setChatSettings(prev => ({ ...prev, enableConfidence: checked }))}
                          />
                        </div>
                      </div>

                      <Separator />

                      {/* Search Parameters */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Search Parameters</h4>
                        
                        <div className="space-y-3">
                          <label className="text-sm font-medium">Results: {chatSettings.topK}</label>
                          <Slider
                            value={[chatSettings.topK]}
                            onValueChange={(value) => setChatSettings(prev => ({ ...prev, topK: value[0] }))}
                            max={20}
                            min={1}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-medium">Threshold: {chatSettings.similarityThreshold.toFixed(1)}</label>
                          <Slider
                            value={[chatSettings.similarityThreshold]}
                            onValueChange={(value) => setChatSettings(prev => ({ ...prev, similarityThreshold: value[0] }))}
                            max={1}
                            min={0.1}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </PopoverContent>
              </Popover>

              {messages.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportConversation}
                    className="hover:bg-blue-50 hover:border-blue-200"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearChat}
                    className="hover:bg-destructive/10 hover:border-destructive/20 hover:text-destructive"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="max-w-4xl mx-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 w-full overflow-x-hidden">
                  {/* Welcome Section */}
                  <div className="text-center mb-8 max-w-2xl px-4 w-full">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                      <Bot className="w-10 h-10 text-primary-foreground" />
                    </div>
                    
                    <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                      Welcome to DataDiver RAG Chat
                    </h2>
                    
                    <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                      Ask me anything about your documents. I'll search through your knowledge base, 
                      analyze the content, and provide detailed answers with citations.
                    </p>

                    {/* Feature Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 w-full max-w-3xl mx-auto">
                      <Card className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                          <Database className="w-5 h-5 text-blue-500" />
                          <h3 className="font-semibold text-sm">Smart Search</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Vector, hybrid, and keyword search modes</p>
                      </Card>
                      
                      <Card className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                          <Shield className="w-5 h-5 text-green-500" />
                          <h3 className="font-semibold text-sm">Confidence Scoring</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Quality metrics for every response</p>
                      </Card>
                      
                      <Card className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="w-5 h-5 text-purple-500" />
                          <h3 className="font-semibold text-sm">Source Citations</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">Detailed references and previews</p>
                      </Card>
                    </div>
                  </div>

                  {/* CRITICAL: Dynamic Questions Section - This must be preserved! */}
                  <div className="w-full max-w-5xl px-4">
                    <div className="flex items-center gap-2 justify-center mb-6">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h3 className="text-lg font-semibold text-primary">Suggested Questions</h3>
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3 max-w-4xl mx-auto">
                      {isLoadingQuestions ? (
                        Array.from({ length: 8 }).map((_, idx) => (
                          <Skeleton key={idx} className="h-20 rounded-lg w-full" />
                        ))
                      ) : (
                        suggestedQuestions.slice(0, 8).map((question, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setInput(question)
                              setTimeout(() => {
                                inputRef.current?.focus()
                                inputRef.current?.setSelectionRange(question.length, question.length)
                              }, 0)
                            }}
                            className="h-auto py-4 px-4 text-left hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group min-h-[4.5rem] w-full flex items-start justify-start"
                          >
                            <div className="flex items-start gap-3 w-full">
                              <Search className="w-4 h-4 mt-0.5 text-primary group-hover:scale-110 transition-transform flex-shrink-0" />
                              <span className="text-sm leading-relaxed text-left whitespace-normal break-words hyphens-auto flex-1">{question}</span>
                            </div>
                          </Button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-8">
                    {messages.map((message, index) => (
                      <div key={message.id} className={cn(
                        "flex gap-6 animate-in slide-in-from-bottom-2 fade-in duration-500",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}>
                        {/* Enhanced Assistant Avatar */}
                        {message.role === 'assistant' && (
                          <div className="flex-shrink-0 relative">
                            <div className={cn(
                              "w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white",
                              message.isStreaming && "animate-pulse shadow-indigo-200"
                            )}>
                              <Bot className="w-6 h-6 text-white" />
                            </div>
                            {/* Status indicator */}
                            {message.isStreaming ? (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white animate-pulse" />
                            ) : (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-3 max-w-[85%] min-w-0">
                          {/* Enhanced Message Bubble */}
                          <div className={cn(
                            "relative group transition-all duration-300 ease-out",
                            message.role === 'user' 
                              ? "ml-16" 
                              : ""
                          )}>
                            <div className={cn(
                              "rounded-3xl px-6 py-5 shadow-lg border transition-all duration-300 hover:shadow-xl relative overflow-hidden",
                              message.role === 'user' 
                                ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-500/20 shadow-blue-200/50" 
                                : "bg-white/80 backdrop-blur-sm border-gray-200/50 shadow-gray-100/50 hover:bg-white/90"
                            )}>
                              {/* Background pattern for AI messages */}
                              {message.role === 'assistant' && (
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-purple-50/20 to-blue-50/20 opacity-50" />
                              )}
                              
                              <div className="relative z-10">
                                {/* Enhanced Message Header for Assistant */}
                                {message.role === 'assistant' && (
                                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="font-medium">{message.timestamp.toLocaleTimeString()}</span>
                                      </div>
                                      {message.metadata?.model && (
                                        <Badge variant="secondary" className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 font-medium">
                                          <Sparkles className="w-3 h-3 mr-1" />
                                          {message.metadata.model.replace('gpt-', 'GPT-')}
                                        </Badge>
                                      )}
                                      {message.metadata?.processingTime && (
                                        <Badge variant="outline" className="text-xs px-2 py-0.5 text-gray-600">
                                          {message.metadata.processingTime}ms
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {/* Enhanced Confidence Badge */}
                                    {message.confidence && !message.isStreaming && (
                                      <HoverCard>
                                        <HoverCardTrigger asChild>
                                          <div className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold cursor-help transition-all hover:scale-105",
                                            message.confidence.overall >= 90 ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                            message.confidence.overall >= 75 ? "bg-blue-100 text-blue-800 border border-blue-200" :
                                            message.confidence.overall >= 60 ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                            "bg-red-100 text-red-800 border border-red-200"
                                          )}>
                                            <Gauge className="w-3.5 h-3.5" />
                                            <span>{message.confidence.overall}% Confidence</span>
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-64 p-4">
                                          <div className="space-y-3">
                                            <h4 className="font-semibold text-sm flex items-center gap-2">
                                              <Shield className="w-4 h-4 text-indigo-500" />
                                              Response Quality
                                            </h4>
                                            <div className="space-y-2">
                                              {[
                                                { key: 'factual_accuracy', label: 'Factual Accuracy', icon: '🎯' },
                                                { key: 'source_reliability', label: 'Source Quality', icon: '📚' },
                                                { key: 'completeness', label: 'Completeness', icon: '✅' },
                                                { key: 'reasoning_quality', label: 'Reasoning', icon: '🧠' }
                                              ].map((metric) => (
                                                <div key={metric.key} className="flex items-center justify-between">
                                                  <span className="text-xs text-gray-600 flex items-center gap-1">
                                                    <span>{metric.icon}</span>
                                                    {metric.label}
                                                  </span>
                                                  <div className="flex items-center gap-2">
                                                    <Progress 
                                                      value={message.confidence![metric.key as keyof ConfidenceMetrics]} 
                                                      className="w-16 h-2"
                                                    />
                                                    <span className="text-xs font-mono w-8 text-right">
                                                      {message.confidence![metric.key as keyof ConfidenceMetrics]}%
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                    )}
                                  </div>
                                )}

                                {/* Enhanced Message Content with Markdown Support */}
                                <div className={cn(
                                  "prose prose-sm max-w-none",
                                  message.role === 'user' 
                                    ? "prose-invert" 
                                    : "prose-gray",
                                  message.isStreaming && "relative"
                                )}>
                                  {message.content ? (
                                    <div className="whitespace-pre-wrap">
                                      <MarkdownContent 
                                        content={message.content} 
                                        isUser={message.role === 'user'}
                                      />
                                      {message.isStreaming && (
                                        <span className="inline-flex items-center ml-1">
                                          <span className="w-0.5 h-5 bg-indigo-400 animate-pulse rounded-full" />
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center py-8 text-gray-400">
                                      <div className="text-center">
                                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No response generated</p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Enhanced Message Actions */}
                                {message.role === 'assistant' && !message.isStreaming && (
                                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                                            onClick={() => copyMessage(message.content)}
                                          >
                                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                                            Copy
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Copy response to clipboard</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                                            onClick={() => {/* TODO: Regenerate response */}}
                                          >
                                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                            Regenerate
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Generate a new response</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                                            onClick={() => {/* TODO: Bookmark message */}}
                                          >
                                            <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                                            Save
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Bookmark this response</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                                            onClick={() => {/* TODO: Share response */}}
                                          >
                                            <Share2 className="w-3.5 h-3.5 mr-1.5" />
                                            Share
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Share this response</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      <div className="flex items-center gap-1 ml-2">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 w-8 p-0 hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                                              onClick={() => {/* TODO: Like response */}}
                                            >
                                              <ThumbsUp className="w-3.5 h-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>This response was helpful</p>
                                          </TooltipContent>
                                        </Tooltip>
                                        
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 w-8 p-0 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                              onClick={() => {/* TODO: Dislike response */}}
                                            >
                                              <ThumbsDown className="w-3.5 h-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>This response needs improvement</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Enhanced Sources Section */}
                            {message.sources && message.sources.length > 0 && (
                              <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100">
                                <Collapsible>
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-between p-0 h-auto hover:bg-transparent group"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                                          <FileText className="w-4 h-4 text-green-600" />
                                        </div>
                                        <div className="text-left">
                                          <h4 className="font-semibold text-green-800 text-sm">Source Citations</h4>
                                          <p className="text-xs text-green-600">{message.sources.length} references found</p>
                                        </div>
                                      </div>
                                      <ChevronDown className="w-4 h-4 text-green-600 transition-transform group-data-[state=open]:rotate-180" />
                                    </Button>
                                  </CollapsibleTrigger>
                                  
                                  <CollapsibleContent className="mt-4">
                                    <ScrollArea className="max-h-64">
                                      <div className="grid gap-3">
                                        {message.sources.map((source, idx) => (
                                          <Card 
                                            key={idx}
                                            className="p-4 bg-white/70 border-green-200/50 hover:bg-white/90 hover:shadow-md transition-all duration-200 cursor-pointer group"
                                          >
                                            <div className="flex items-start gap-3">
                                              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                                <FileText className="w-5 h-5 text-white" />
                                              </div>
                                              
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between mb-2">
                                                  <h5 className="font-semibold text-sm text-gray-800 truncate pr-2 group-hover:text-green-700 transition-colors">
                                                    {source.document_title || source.filename}
                                                  </h5>
                                                  <Badge className="bg-green-100 text-green-700 text-xs px-2 py-1 font-medium">
                                                    {Math.round(source.relevance_score * 100)}% match
                                                  </Badge>
                                                </div>
                                                
                                                {source.preview && (
                                                  <blockquote className="border-l-3 border-green-300 pl-3 mb-3 bg-green-50/50 py-2 rounded-r-lg">
                                                    <p className="text-sm text-gray-700 italic leading-relaxed">
                                                      "{source.preview}"
                                                    </p>
                                                  </blockquote>
                                                )}
                                                
                                                <div className="flex items-center gap-3 text-xs">
                                                  <div className="flex items-center gap-1 text-gray-500">
                                                    <Hash className="w-3 h-3" />
                                                    <span className="font-mono">{source.chunk_id.slice(-8)}</span>
                                                  </div>
                                                  {source.page_number && (
                                                    <div className="flex items-center gap-1 text-gray-500">
                                                      <span>Page {source.page_number}</span>
                                                    </div>
                                                  )}
                                                  {source.collection && (
                                                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                                                      {source.collection}
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </Card>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                    
                                    {message.sources.length > 3 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setActiveSources(message.sources || [])
                                          setShowSources(true)
                                        }}
                                        className="w-full mt-3 border-green-200 hover:bg-green-50 hover:border-green-300 text-green-700"
                                      >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        View All Sources in Detail
                                      </Button>
                                    )}
                                  </CollapsibleContent>
                                </Collapsible>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Enhanced User Avatar */}
                        {message.role === 'user' && (
                          <div className="flex-shrink-0 relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white">
                              <User className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Enhanced Typing Indicator */}
                    {isLoading && (
                      <div className="flex gap-6 animate-in slide-in-from-bottom-2 fade-in duration-500">
                        <div className="flex-shrink-0 relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl border-2 border-white animate-pulse">
                            <Bot className="w-6 h-6 text-white" />
                          </div>
                          {/* Thinking indicator */}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white animate-pulse" />
                        </div>
                        
                        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-3xl px-6 py-5 max-w-[85%] shadow-lg">
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 via-purple-50/20 to-blue-50/20 opacity-50 rounded-3xl" />
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" />
                                <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce delay-100" />
                                <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce delay-200" />
                              </div>
                              <span className="text-sm font-medium text-gray-700">AI is analyzing...</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Brain className="w-3.5 h-3.5 animate-pulse" />
                              <span className="animate-pulse">Searching knowledge base and crafting response</span>
                            </div>
                            {/* Progress indicators */}
                            <div className="mt-3 space-y-1.5">
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                <span>Processing your question</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse delay-300" />
                                <span>Searching relevant documents</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse delay-500" />
                                <span>Generating intelligent response</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Enhanced Input Area */}
          <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 shadow-sm">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about your documents... I can analyze, summarize, compare, and answer questions with intelligent context and real-time citations."
                    className="min-h-[60px] max-h-[200px] resize-none rounded-xl border bg-card pr-24 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    disabled={isLoading}
                    rows={2}
                  />

                  {/* Input Actions */}
                  <div className="absolute right-3 top-3 flex items-center gap-2">
                    {chatSettings.voiceEnabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                      >
                        <Mic className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>

                    <Button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-xl shadow-lg transition-all duration-300",
                        !input.trim() || isLoading 
                          ? "bg-muted text-muted-foreground cursor-not-allowed" 
                          : "bg-gradient-to-r from-primary to-primary/80 hover:shadow-xl hover:scale-105"
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Input Status Bar */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {/* Context Indicator */}
                    {chatSettings.contextMode !== 'all' && (chatSettings.selectedCollections.length > 0 || chatSettings.selectedDocuments.length > 0) && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
                        <Filter className="w-2 h-2" />
                        <span>
                          {chatSettings.contextMode === 'collections' 
                            ? `${chatSettings.selectedCollections.length} collections`
                            : `${chatSettings.selectedDocuments.length} docs`
                          }
                        </span>
                      </div>
                    )}

                    {/* Search Mode */}
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-600 rounded-full">
                      {chatSettings.searchMode === 'hybrid' ? <Network className="w-2 h-2" /> :
                       chatSettings.searchMode === 'vector' ? <Database className="w-2 h-2" /> :
                       <Search className="w-2 h-2" />}
                      <span>{chatSettings.searchMode}</span>
                    </div>

                    {/* Connection Status */}
                    {isConnected !== null && (
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full",
                        isConnected 
                          ? "bg-green-100 text-green-600" 
                          : "bg-red-100 text-red-600"
                      )}>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                        )} />
                        <span>{isConnected ? 'Connected' : 'Offline'}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Character Count */}
                    <div className={cn(
                      "px-2 py-1 rounded-full",
                      input.length > 1800 ? "bg-destructive/10 text-destructive" :
                      input.length > 1500 ? "bg-yellow-100 text-yellow-600" :
                      "text-muted-foreground"
                    )}>
                      {input.length}/2000
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd>
                      <span>send</span>
                      <span>•</span>
                      <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Shift+Enter</kbd>
                      <span>new line</span>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Sources Modal */}
        {showSources && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Source Citations</h2>
                  {activeSources.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeSources.length} sources
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSources(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeSources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Sources Yet</h3>
                    <p className="text-muted-foreground max-w-sm">
                      When you ask questions, I'll show you exactly which documents I referenced 
                      to provide accurate, cited answers.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeSources.map((source, idx) => (
                      <Card key={idx} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm truncate pr-2">
                                {source.document_title || source.filename}
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                {Math.round(source.relevance_score * 100)}% match
                              </Badge>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Hash className="w-3 h-3" />
                                <span className="font-mono">{source.chunk_id.slice(-8)}</span>
                              </div>
                              {source.page_number && (
                                <Badge variant="outline" className="text-xs">
                                  Page {source.page_number}
                                </Badge>
                              )}
                            </div>
                            
                            {source.preview && (
                              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                                <p className="text-sm text-muted-foreground italic">
                                  "{source.preview}"
                                </p>
                              </div>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-xs h-7"
                            >
                              <Eye className="w-3 h-3 mr-2" />
                              View Full Content
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Protect>
  )
}