'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
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
  Menu,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RetrievalTimeline } from '@/components/retrieval-timeline'

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
  temperature?: number
  searchQuery?: string
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
  contextMode: 'all' | 'collections' | 'documents'
  selectedCollections: string[]
  selectedDocuments: string[]
  enableStreaming: boolean
  enableSources: boolean
  enableConfidence: boolean
  voiceEnabled: boolean
  topK: number
  similarityThreshold: number,
  searchMode: 'hybrid' | 'vector' | 'keyword'
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

// Demo mode: paywall removed

// Main chat component
export default function ModernRAGChatPage() {
  // Mobile detection
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  
  // Core chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  // UI state
  const [showSources, setShowSources] = useState(false)
  const [showRetrievalSidebar, setShowRetrievalSidebar] = useState(false)

  // Dynamic questions state
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)

  // Context data
  const [collections, setCollections] = useState<Collection[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeSources, setActiveSources] = useState<Source[]>([])
  const [liveRetrieval, setLiveRetrieval] = useState<any[]>([])

  // Settings
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    systemPrompt: 'You are a helpful AI assistant with access to a comprehensive knowledge base. Provide accurate, detailed responses based on the available context. Always cite your sources when referencing specific documents.',
    temperature: 0.7,
    maxTokens: 2000,
    contextMode: 'all',
    selectedCollections: [],
    selectedDocuments: [],
    enableStreaming: true,
    enableSources: true,
    enableConfidence: true,
    voiceEnabled: false,
    topK: 5,
    similarityThreshold: 0.7,
    searchMode: 'hybrid',
  })

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Copy response helper
  const copyMessage = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text || '')
    } catch (e) {
      console.error('Clipboard copy failed', e)
    }
  }, [])

  // Core send logic (reused by regenerate)
  const sendPrompt = useCallback(async (prompt: string) => {
    // Clear sources and retrieval events for new message
    setActiveSources([])
    setLiveRetrieval([])

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
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
      }
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const controller = new AbortController()
      const startTime = Date.now()
      // Generate a valid UUID v4 for session ID
      const sessionId = crypto.randomUUID()
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({
          message: prompt,
          search_type: chatSettings.searchMode,
          session_id: sessionId,
          metadata: {
            force_guided: true,
            selectedCollections: chatSettings.selectedCollections || [],
            selectedDocuments: chatSettings.selectedDocuments || [],
            contextMode: chatSettings.contextMode,
          }
        }),
        signal: controller.signal
      })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const evt of events) {
          if (!evt.startsWith('data:')) continue
          const json = evt.slice(5).trim()
          if (!json) continue
          try {
            const data = JSON.parse(json)
            if (data.type === 'delta' || data.type === 'text') {
              const delta: string = data.delta || data.content || ''
              setMessages(prev => {
                const newMessages = [...prev]
                const last = newMessages[newMessages.length - 1]
                if (last?.role === 'assistant') {
                  last.content = (last.content || '') + delta
                }
                return newMessages
              })
            }
            if (data.type === 'metrics' && data.metrics) {
              const metrics = data.metrics
              setMessages(prev => {
                const newMessages = [...prev]
                const last = newMessages[newMessages.length - 1]
                if (last?.role === 'assistant') {
                  last.confidence = {
                    overall: Math.round((metrics.overall || 0) * 100),
                    factual_accuracy: Math.round((metrics.factual_accuracy || 0) * 100),
                    source_reliability: Math.round((metrics.source_reliability || 0) * 100),
                    completeness: Math.round((metrics.completeness || 0) * 100),
                    reasoning_quality: Math.round((metrics.reasoning_quality || 0) * 100)
                  }
                }
                return newMessages
              })
            }
            if (data.type === 'sources' && Array.isArray(data.sources)) {
              setMessages(prev => {
                const newMessages = [...prev]
                const last = newMessages[newMessages.length - 1]
                if (last?.role === 'assistant') {
                  last.sources = data.sources
                }
                return newMessages
              })
            }
            // Handle retrieval events for the sidebar
            if (data.type === 'retrieval') {
              console.log('Received retrieval event:', data)
              const retrievalData = data.data || data
              // The actual event is nested in data.data
              if (retrievalData) {
                console.log('Adding retrieval data to sidebar:', retrievalData)
                const tool = retrievalData.tool
                const event = retrievalData.event
                const isBasicToolEvent =
                  retrievalData.type === 'retrieval' &&
                  (tool === 'graph_search' || tool === 'vector_search' || tool === 'hybrid_search')

                if (isBasicToolEvent) {
                  const step = tool === 'graph_search' ? 'graph_search' : 'vector_search'
                  const status =
                    event === 'start' ? 'start' :
                    event === 'end' ? 'complete' :
                    'update'
                  const dataPayload =
                    event === 'results'
                      ? {
                          results: Array.isArray(retrievalData.results) ? retrievalData.results.length : 0,
                          sample: Array.isArray(retrievalData.results) ? retrievalData.results.slice(0, 2) : []
                        }
                      : event === 'end'
                        ? {
                            results: typeof retrievalData.count === 'number' ? retrievalData.count : undefined,
                            elapsed_ms: typeof retrievalData.elapsed_ms === 'number' ? retrievalData.elapsed_ms : undefined
                          }
                        : (retrievalData.args || {})

                  setLiveRetrieval(prev => [
                    ...prev,
                    {
                      type: 'retrieval_step',
                      step,
                      status,
                      data: dataPayload,
                      timestamp: new Date().toISOString()
                    }
                  ])
                } else {
                  // Already in retrieval_step form from EnhancedRetriever or other custom events
                  setLiveRetrieval(prev => [...prev, retrievalData])
                }
              }
            } else if (data.type === 'retrieval_step' || data.type === 'retrieval_summary') {
              setLiveRetrieval(prev => [...prev, data])
            }
          } catch (e) {
            console.error('Error parsing stream data:', e)
          }
        }
      }

      // Finalize assistant message
      setMessages(prev => {
        const newMessages = [...prev]
        const last = newMessages[newMessages.length - 1]
        if (last?.role === 'assistant') {
          last.isStreaming = false
          last.timestamp = new Date()
          last.metadata = {
            ...(last.metadata || {}),
            processingTime: Date.now() - startTime,
            tokens: (last.content || '').split(/\s+/).length
          }
        }
        return newMessages
      })
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => {
        const newMessages = [...prev]
        const last = newMessages[newMessages.length - 1]
        if (last?.role === 'assistant') {
          last.isStreaming = false
          last.content = last.content || 'Sorry, I ran into a problem generating the response.'
        }
        return newMessages
      })
    } finally {
      setIsLoading(false)
      setStreamingText('')
    }
  }, [API_BASE, chatSettings.searchMode, isLoading])

  // Copy confidence metrics helper
  const copyConfidenceMetrics = useCallback((message: ChatMessage) => {
    const c = message?.confidence
    if (!c) return
    const text = [
      'Confidence Metrics',
      `Overall: ${c.overall}%`,
      `Factual accuracy: ${c.factual_accuracy}%`,
      `Source reliability: ${c.source_reliability}%`,
      `Completeness: ${c.completeness}%`,
      `Reasoning quality: ${c.reasoning_quality}%`,
    ].join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }, [])

  // Regenerate helper: re-send the closest preceding user prompt
  const regenerateFrom = useCallback((assistantMessageId: string) => {
    const idx = messages.findIndex(m => m.id === assistantMessageId)
    if (idx <= 0) return
    let prompt = ''
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && messages[i].content?.trim()) {
        prompt = messages[i].content
        break
      }
    }
    if (!prompt) return
    void sendPrompt(prompt)
  }, [messages, sendPrompt])

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
        const docs = Array.isArray(data) ? data : (data.documents || [])
        setDocuments(docs)
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
    const prompt = input
    setInput('')
    await sendPrompt(prompt)
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // Copy message content (duplicate removed; see copyMessage above)

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

  // Preselect collection from URL (?collectionId=...)
  useEffect(() => {
    try {
      const id = searchParams?.get('collectionId')
      if (id) {
        setChatSettings(prev => ({
          ...prev,
          contextMode: 'collections',
          selectedCollections: [id]
        }))
      }
    } catch (e) {
      // no-op
    }
  }, [searchParams])

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
      <div className="flex flex-1 min-h-0 sm:min-h-0 min-h-[100dvh] flex-col bg-background overflow-hidden overflow-x-hidden relative pt-12 sm:pt-0">
        {/* Top Toolbar */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-primary/60 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                    <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  {isConnected && (
                    <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent truncate">
                    {isMobile ? 'RAG Chat' : 'DataDiver RAG Chat'}
                  </h1>
                  {!isMobile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="w-3 h-3" />
                      <span>AI-powered document intelligence</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mobile menu for small screens */}
              {isMobile && !isInputFocused && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Menu className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRetrievalSidebar(true)}
                        className="w-full justify-start"
                      >
                        <GitBranch className="w-4 h-4 mr-2" />
                        Retrieval Path
                      </Button>
                      {messages.length > 0 && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={exportConversation}
                            className="w-full justify-start"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export Chat
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearChat}
                            className="w-full justify-start text-destructive"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Clear Chat
                          </Button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Collections Filter Quick Access */}
              {!isInputFocused && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "transition-colors",
                      chatSettings.contextMode !== 'all' ? "bg-blue-50 border-blue-200 text-blue-700" : "",
                      isMobile && "h-8 px-2"
                    )}
                  >
                    <Filter className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {chatSettings.contextMode === 'all' ? 'All Documents' : 
                       chatSettings.contextMode === 'collections' ? `${chatSettings.selectedCollections.length} Collections` :
                       `${chatSettings.selectedDocuments.length} Documents`}
                    </span>
                    <span className="sm:hidden">
                      {chatSettings.contextMode === 'all' ? 'All' : 
                       chatSettings.contextMode === 'collections' ? chatSettings.selectedCollections.length :
                       chatSettings.selectedDocuments.length}
                    </span>
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
              )}

              {/* Retrieval Path Sidebar Trigger - Hidden on mobile */}
              {!isMobile && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowRetrievalSidebar(true)}
                  className="bg-purple-600 hover:bg-purple-600/90 text-white"
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  Retrieval Path
                </Button>
              )}

              {/* Desktop-only actions */}
              {!isMobile && messages.length > 0 && (
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
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2 sm:p-4 min-h-0 pb-20 sm:pb-0">
            <div className="max-w-4xl mx-auto">
              {messages.length === 0 && !(isMobile && isInputFocused) ? (
                <div className="flex flex-col items-center h-auto py-2 sm:py-3 w-full overflow-x-hidden">
                  {/* Compact Title/Blurb */}
                  <div className="w-full max-w-3xl px-4 text-center mb-2 sm:mb-3">
                    <div className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-primary/90">
                      <Bot className="w-5 h-5" />
                      <span>RAG Chat</span>
                    </div>
                    <p className="mt-1 text-sm sm:text-base text-muted-foreground line-clamp-2">
                      Ask about your documents and get concise, cited answers.
                    </p>
                  </div>

                  {/* CRITICAL: Dynamic Questions Section - This must be preserved! */}
                  <div className="w-full max-w-3xl px-4">
                    <div className="flex items-center gap-2 justify-center mb-3 sm:mb-4">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h3 className="text-sm sm:text-base font-semibold text-primary">Suggested Questions</h3>
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>

                    {isLoadingQuestions ? (
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <Skeleton key={idx} className="h-10 rounded-lg w-full" />
                        ))}
                      </div>
                    ) : (
                      <Accordion type="single" collapsible className="w-full space-y-2">
                        {suggestedQuestions.slice(0, 8).map((question, idx) => (
                          <AccordionItem
                            key={idx}
                            value={`q-${idx}`}
                            className="border rounded-2xl bg-card/60 overflow-hidden hover:bg-muted/40 transition-colors"
                          >
                            <AccordionTrigger className="px-3 py-2 hover:no-underline w-full min-w-0 overflow-hidden text-left">
                              <div className="flex items-start gap-2.5 w-full min-w-0 overflow-hidden">
                                <Search className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                <span className="text-xs sm:text-sm flex-1 min-w-0 block truncate sm:whitespace-normal sm:line-clamp-2 sm:leading-snug">
                                  {question}
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4 pt-0">
                              <div className="text-sm text-muted-foreground mb-3 whitespace-normal break-words">
                                {question}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    setInput(question)
                                    setTimeout(() => {
                                      inputRef.current?.focus()
                                      inputRef.current?.setSelectionRange(question.length, question.length)
                                    }, 0)
                                  }}
                                >
                                  Use
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try { await navigator.clipboard.writeText(question) } catch {}
                                  }}
                                >
                                  <Copy className="w-3.5 h-3.5 mr-2" /> Copy
                                </Button>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </div>
                </div>
              ) : (
                <TooltipProvider>
                  <div className="space-y-6 sm:space-y-8">
                    {messages.map((message, index) => (
                      <div key={message.id} className={cn(
                        "flex gap-6 animate-in slide-in-from-bottom-2 fade-in duration-500",
                        message.role === 'user' ? "justify-end" : "justify-start"
                      )}>
                        {/* Enhanced Assistant Avatar */}
                        {message.role === 'assistant' && (
                          <div className="flex-shrink-0 relative">
                            <div className={cn(
                              "w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border-2 border-white",
                              message.isStreaming && "animate-pulse shadow-indigo-200"
                            )}>
                              <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            {/* Status indicator */}
                            {message.isStreaming ? (
                              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-yellow-400 rounded-full border-2 border-white animate-pulse" />
                            ) : (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-3 max-w-[92%] sm:max-w-[85%] min-w-0">
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
                                    <div className="flex items-center gap-2 sm:gap-3">
                                      <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="font-medium">{message.timestamp.toLocaleTimeString()}</span>
                                      </div>
                                      <Badge variant="secondary" className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 font-medium">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        Gemini
                                      </Badge>
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
                                  {message.content && (
                                    <div className="whitespace-pre-wrap">
                                      <MarkdownContent 
                                        content={message.content} 
                                        isUser={message.role === 'user'}
                                      />
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
                                            onClick={() => copyConfidenceMetrics(message)}
                                          >
                                            <Gauge className="w-3.5 h-3.5 mr-1.5" />
                                            Copy confidence
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Copy confidence breakdown</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors"
                                            onClick={() => regenerateFrom(message.id)}
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
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xl border-2 border-white">
                              <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
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
                        
                        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-4 sm:py-5 max-w-[92%] sm:max-w-[85%] shadow-lg">
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
          <div className={cn(
            "fixed sm:sticky bottom-0 left-0 right-0 z-30 flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 sm:p-4 shadow-sm overflow-x-hidden",
            isMobile && isInputFocused ? "py-1" : ""
          )}>
            <div className="max-w-4xl mx-auto w-full min-w-0 pb-[max(env(safe-area-inset-bottom),0px)]">
              <form onSubmit={handleSubmit} className="space-y-3 w-full min-w-0 overflow-x-hidden">
                <div className="relative w-full max-w-full min-w-0 overflow-x-hidden">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isMobile 
                      ? "Ask about your documents…"
                      : "Ask me anything about your documents... I can analyze, summarize, compare, and answer questions with intelligent context and real-time citations."}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    className="w-full max-w-full box-border min-h-[52px] sm:min-h-[60px] max-h-[200px] resize-none rounded-xl border bg-card pr-16 sm:pr-24 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    disabled={isLoading}
                    rows={isMobile ? 1 : 2}
                  />

                  {/* Input Actions */}
                  <div className="absolute right-3 top-3 flex items-center gap-1 sm:gap-2 pointer-events-auto">
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
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
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
                    <div className="hidden sm:flex items-center gap-1">
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

        {/* Retrieval Path Right Sidebar */}
        <Sheet open={showRetrievalSidebar} onOpenChange={setShowRetrievalSidebar}>
          <SheetContent side="right" className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-600" />
                Retrieval Path
              </SheetTitle>
            </SheetHeader>
            <div className="p-4 pt-0">
              <RetrievalTimeline events={liveRetrieval} isLoading={isLoading} />
            </div>
          </SheetContent>
        </Sheet>

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
  )
}