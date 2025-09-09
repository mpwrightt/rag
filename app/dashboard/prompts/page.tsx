'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Copy, 
  Edit,
  Trash2,
  Star,
  Eye,
  Calendar,
  Tag,
  Filter,
  Globe,
  Lock,
  Users,
  Sparkles,
  Brain,
  Wand2,
  TrendingUp,
  BarChart3,
  Zap,
  Download,
  Upload,
  Share,
  History,
  Target,
  Lightbulb,
  FileText,
  Settings,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  Layers
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

type Prompt = {
  id: string
  title: string
  description: string
  content: string
  category: string
  tags: string[]
  created_at: string
  updated_at: string
  usage_count: number
  visibility: 'private' | 'public' | 'shared'
  is_favorite: boolean
  created_by: string
  ai_enhanced?: boolean
  performance_score?: number
  template_variables?: string[]
  use_cases?: string[]
  quality_metrics?: {
    clarity: number
    specificity: number
    effectiveness: number
    creativity: number
  }
  version_history?: Array<{
    version: string
    created_at: string
    content: string
    improvements: string[]
  }>
}

type PromptTemplate = {
  id: string
  name: string
  description: string
  category: string
  template: string
  variables: string[]
  icon: any
}

type AIEnhancement = {
  id: string
  original: string
  enhanced: string
  improvements: string[]
  confidence: number
  status: 'analyzing' | 'complete' | 'error'
}

// Demo mode: paywall removed

// Wrapper to satisfy Next.js Suspense requirement for useSearchParams
export default function PromptsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
      <PromptsPageContent />
    </Suspense>
  )
}

function PromptsPageContent() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEnhancerOpen, setIsEnhancerOpen] = useState(false)
  const [isTemplateOpen, setIsTemplateOpen] = useState(false)
  const [aiEnhancing, setAiEnhancing] = useState<AIEnhancement[]>([])
  const [activeTab, setActiveTab] = useState('my-prompts')
  const [newPrompt, setNewPrompt] = useState({
    title: '',
    description: '',
    content: '',
    category: 'general',
    tags: '',
    visibility: 'private' as 'private' | 'public' | 'shared'
  })

  const searchParams = useSearchParams()
  const router = useRouter()

  // Open create dialog when arriving with ?create=1, then clean the URL
  useEffect(() => {
    const create = searchParams.get('create')
    if (create === '1') {
      setIsCreateOpen(true)
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      params.delete('create')
      const query = params.toString()
      const cleaned = '/dashboard/prompts' + (query ? '?' + query : '')
      router.replace(cleaned)
    }
  }, [searchParams, router])

  // Enhanced mock data for prompts
  const mockPrompts: Prompt[] = [
    {
      id: '1',
      title: 'Document Summarization',
      description: 'Generate concise summaries of long documents',
      content: 'Please provide a comprehensive summary of the following document, highlighting the key points, main arguments, and important conclusions. Keep the summary concise but informative:\n\n{document_content}',
      category: 'summarization',
      tags: ['summary', 'analysis', 'documents'],
      created_at: '2024-01-15',
      updated_at: '2024-01-20',
      usage_count: 45,
      visibility: 'public',
      is_favorite: true,
      created_by: 'user@example.com',
      ai_enhanced: true,
      performance_score: 92,
      template_variables: ['document_content'],
      use_cases: ['Report analysis', 'Research paper review', 'Meeting notes'],
      quality_metrics: {
        clarity: 95,
        specificity: 88,
        effectiveness: 92,
        creativity: 85
      },
      version_history: [
        {
          version: '2.0',
          created_at: '2024-01-20',
          content: 'Enhanced version with better structure',
          improvements: ['Added context preservation', 'Improved readability', 'Better key point extraction']
        }
      ]
    },
    {
      id: '2',
      title: 'Technical Q&A Assistant',
      description: 'Answer technical questions based on documentation',
      content: 'You are a technical assistant. Based on the provided documentation, answer the following question accurately and provide specific references when possible:\n\nQuestion: {user_question}\n\nProvide a clear, technical answer with examples if relevant.',
      category: 'technical',
      tags: ['technical', 'qa', 'documentation'],
      created_at: '2024-01-10',
      updated_at: '2024-01-18',
      usage_count: 32,
      visibility: 'shared',
      is_favorite: false,
      created_by: 'user@example.com'
    },
    {
      id: '3',
      title: 'Code Review Assistant',
      description: 'Analyze code and provide improvement suggestions',
      content: 'Review the following code and provide:\n1. Code quality assessment\n2. Potential bugs or issues\n3. Performance optimization suggestions\n4. Best practices recommendations\n\nCode:\n{code_snippet}',
      category: 'development',
      tags: ['code', 'review', 'development'],
      created_at: '2024-01-05',
      updated_at: '2024-01-16',
      usage_count: 28,
      visibility: 'private',
      is_favorite: true,
      created_by: 'user@example.com'
    },
    {
      id: '4',
      title: 'Meeting Notes Analyzer',
      description: 'Extract action items and decisions from meeting notes',
      content: 'Analyze the following meeting notes and extract:\n1. Key decisions made\n2. Action items with assigned owners\n3. Important deadlines\n4. Follow-up topics\n\nMeeting Notes:\n{meeting_content}',
      category: 'business',
      tags: ['meetings', 'action-items', 'analysis'],
      created_at: '2024-01-12',
      updated_at: '2024-01-22',
      usage_count: 19,
      visibility: 'public',
      is_favorite: false,
      created_by: 'user@example.com'
    }
  ]

  const categories = ['all', 'summarization', 'technical', 'development', 'business', 'general', 'creative', 'analytical', 'educational']
  
  // Prompt templates for quick creation
  const promptTemplates: PromptTemplate[] = [
    {
      id: 'analysis',
      name: 'Document Analysis',
      description: 'Analyze documents for key insights',
      category: 'analytical',
      template: 'Analyze the following document for:\n1. Key findings\n2. Important metrics\n3. Actionable insights\n4. Potential concerns\n\nDocument: {document_content}',
      variables: ['document_content'],
      icon: BarChart3
    },
    {
      id: 'qa',
      name: 'Q&A Assistant',
      description: 'Answer questions based on context',
      category: 'technical',
      template: 'Based on the provided context, answer the following question accurately:\n\nContext: {context}\n\nQuestion: {question}\n\nProvide a detailed answer with relevant examples.',
      variables: ['context', 'question'],
      icon: MessageSquare
    },
    {
      id: 'creative',
      name: 'Creative Writer',
      description: 'Generate creative content',
      category: 'creative',
      template: 'Create engaging {content_type} about {topic} that:\n1. Captures attention\n2. Provides value\n3. Maintains {tone} tone\n4. Targets {audience}',
      variables: ['content_type', 'topic', 'tone', 'audience'],
      icon: Lightbulb
    },
    {
      id: 'comparison',
      name: 'Comparison Matrix',
      description: 'Compare multiple options systematically',
      category: 'analytical',
      template: 'Compare {items} across the following criteria:\n\n1. {criteria_1}\n2. {criteria_2}\n3. {criteria_3}\n\nProvide a detailed comparison matrix with scores and recommendations.',
      variables: ['items', 'criteria_1', 'criteria_2', 'criteria_3'],
      icon: Target
    }
  ]

  useEffect(() => {
    // Simulate API loading
    setTimeout(() => {
      setPrompts(mockPrompts)
      setIsLoading(false)
    }, 1000)
  }, [])

  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         prompt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         prompt.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === 'all' || prompt.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const handleCreatePrompt = async () => {
    if (!newPrompt.title.trim() || !newPrompt.content.trim()) return

    const prompt: Prompt = {
      id: Date.now().toString(),
      title: newPrompt.title,
      description: newPrompt.description,
      content: newPrompt.content,
      category: newPrompt.category,
      tags: newPrompt.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      created_at: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString().split('T')[0],
      usage_count: 0,
      visibility: newPrompt.visibility,
      is_favorite: false,
      created_by: 'user@example.com'
    }

    setPrompts(prev => [prompt, ...prev])
    setNewPrompt({ title: '', description: '', content: '', category: 'general', tags: '', visibility: 'private' })
    setIsCreateOpen(false)
  }

  const handleCopyPrompt = async (content: string) => {
    await navigator.clipboard.writeText(content)
    // In production, show a toast notification
  }

  const handleToggleFavorite = (id: string) => {
    setPrompts(prev => prev.map(prompt => 
      prompt.id === id ? { ...prompt, is_favorite: !prompt.is_favorite } : prompt
    ))
  }

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public': return <Globe className="w-3 h-3" />
      case 'shared': return <Users className="w-3 h-3" />
      default: return <Lock className="w-3 h-3" />
    }
  }

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'public': return 'bg-green-100 text-green-800'
      case 'shared': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  const enhancePromptWithAI = async (content: string) => {
    const enhancementId = Date.now().toString()
    const enhancement: AIEnhancement = {
      id: enhancementId,
      original: content,
      enhanced: '',
      improvements: [],
      confidence: 0,
      status: 'analyzing'
    }
    
    setAiEnhancing(prev => [...prev, enhancement])
    
    // Simulate AI enhancement process
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const improvedContent = [
      content,
      '',
      'Additional context: Ensure your response is comprehensive and well-structured. Consider the following aspects:',
      '1. Clarity and precision',
      '2. Actionable insights',
      '3. Relevant examples where appropriate',
      '4. Logical flow and organization',
    ].join('\n')
    
    const improvements = [
      'Enhanced clarity and structure',
      'Added context preservation instructions',
      'Improved specificity requirements',
      'Better output formatting guidance'
    ]
    
    setAiEnhancing(prev => prev.map(item => 
      item.id === enhancementId 
        ? {
          ...item,
          enhanced: improvedContent,
          improvements,
          confidence: 85 + Math.random() * 10,
          status: 'complete' as const
        }
        : item
    ))
  }
  
  const createFromTemplate = (template: PromptTemplate) => {
    setNewPrompt({
      title: template.name,
      description: template.description,
      content: template.template,
      category: template.category,
      tags: template.variables.join(', '),
      visibility: 'private'
    })
    setIsTemplateOpen(false)
    setIsCreateOpen(true)
  }
  
  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          AI Prompt Library
        </h1>
        <p className="text-muted-foreground">
          Create, enhance, and manage your AI prompts with intelligent assistance
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Badge variant="secondary" className="px-3 py-1">
            <Sparkles className="w-3 h-3 mr-1" />
            {prompts.filter(p => p.ai_enhanced).length} AI Enhanced
          </Badge>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Prompt
          </Button>
          <Button variant="outline" onClick={() => setIsTemplateOpen(true)}>
            <Layers className="w-4 h-4 mr-2" />
            Templates
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 p-6">
        {/* Search and Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="p-2 border rounded-lg bg-background"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-prompts" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              My Prompts ({prompts.length})
            </TabsTrigger>
            <TabsTrigger value="ai-enhanced" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Enhanced ({prompts.filter(p => p.ai_enhanced).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-prompts" className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPrompts.map((prompt) => (
                  <Card key={prompt.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{prompt.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{prompt.description}</p>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedPrompt(prompt); setIsViewOpen(true) }}>
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleCopyPrompt(prompt.content)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ai-enhanced" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {prompts.filter(p => p.ai_enhanced).map((prompt) => (
                <Card key={prompt.id} className="border-purple-200/50">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      {prompt.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{prompt.description}</p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Prompt Dialog (minimal) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Prompt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={newPrompt.title} onChange={(e) => setNewPrompt(prev => ({ ...prev, title: e.target.value }))} />
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" rows={4} value={newPrompt.content} onChange={(e) => setNewPrompt(prev => ({ ...prev, content: e.target.value }))} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePrompt}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Prompt Dialog (minimal) */}
      {selectedPrompt && (
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                {selectedPrompt.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">{selectedPrompt.description}</p>
              <div className="bg-muted rounded-lg p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap">{selectedPrompt.content}</pre>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
                <Button onClick={() => handleCopyPrompt(selectedPrompt.content)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Prompt
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}