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
import { Protect } from '@clerk/nextjs'
import CustomClerkPricing from '@/components/custom-clerk-pricing'
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

function UpgradeCard() {
  return (
    <>
      <div className="text-center py-8">
        <h1 className="text-center text-2xl font-semibold lg:text-3xl">Upgrade to a paid plan</h1>
        <p>This page is available on paid plans. Choose a plan that fits your needs.</p>
      </div>
      <div className="px-8 lg:px-12">
        <CustomClerkPricing />
      </div>
    </>
  )
}

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
      router.replace(`/dashboard/prompts${query ? `?${query}` : ''}`)
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
    
    const improvedContent = `${content}\n\nAdditional context: Ensure your response is comprehensive and well-structured. Consider the following aspects:\n1. Clarity and precision\n2. Actionable insights\n3. Relevant examples where appropriate\n4. Logical flow and organization`
    
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
    <Protect condition={(has) => has({ plan: 'pro' })} fallback={<UpgradeCard />}>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                AI Prompt Library
              </h1>
              <p className="text-muted-foreground">
                Create, enhance, and manage your AI prompts with intelligent assistance
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-3 py-1">
                <Sparkles className="w-3 h-3 mr-1" />
                {prompts.filter(p => p.ai_enhanced).length} AI Enhanced
              </Badge>
              <Dialog open={isTemplateOpen} onOpenChange={setIsTemplateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Layers className="w-4 h-4 mr-2" />
                    Templates
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Prompt Templates</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    {promptTemplates.map((template) => {
                      const IconComponent = template.icon
                      return (
                        <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => createFromTemplate(template)}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <IconComponent className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium mb-1">{template.name}</h3>
                                <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{template.category}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {template.variables.length} variables
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isEnhancerOpen} onOpenChange={setIsEnhancerOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Wand2 className="w-4 h-4 mr-2" />
                    AI Enhancer
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      AI Prompt Enhancer
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Original Prompt</Label>
                      <Textarea 
                        placeholder="Paste your prompt here to enhance it with AI..."
                        rows={4}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => enhancePromptWithAI('Sample prompt content')}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Enhance with AI
                      </Button>
                      <Button variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        Enhancement Settings
                      </Button>
                    </div>
                    
                    {aiEnhancing.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-medium">Enhancement Results</h3>
                        {aiEnhancing.map((enhancement) => (
                          <Card key={enhancement.id} className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {enhancement.status === 'analyzing' && 'Analyzing prompt...'}
                                  {enhancement.status === 'complete' && 'Enhancement Complete'}
                                  {enhancement.status === 'error' && 'Enhancement Failed'}
                                </span>
                                {enhancement.status === 'complete' && (
                                  <Badge className="bg-green-100 text-green-700">
                                    {enhancement.confidence.toFixed(0)}% confident
                                  </Badge>
                                )}
                              </div>
                              
                              {enhancement.status === 'analyzing' && (
                                <div className="space-y-2">
                                  <Progress value={65} className="h-2" />
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Analyzing structure, clarity, and effectiveness...
                                  </div>
                                </div>
                              )}
                              
                              {enhancement.status === 'complete' && (
                                <div className="space-y-3">
                                  <div className="bg-muted rounded-lg p-3">
                                    <p className="text-sm font-mono">{enhancement.enhanced}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Improvements Made:</h4>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                      {enhancement.improvements.map((improvement, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                          <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0" />
                                          {improvement}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline">
                                      <Copy className="w-3 h-3 mr-1" />
                                      Copy Enhanced
                                    </Button>
                                    <Button size="sm" variant="outline">
                                      <Plus className="w-3 h-3 mr-1" />
                                      Save as New
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Prompt
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Prompt</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newPrompt.title}
                        onChange={(e) => setNewPrompt(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter prompt title..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <select
                        id="category"
                        value={newPrompt.category}
                        onChange={(e) => setNewPrompt(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full p-2 border rounded-lg"
                      >
                        {categories.slice(1).map(cat => (
                          <option key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newPrompt.description}
                      onChange={(e) => setNewPrompt(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the prompt..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Prompt Content</Label>
                    <Textarea
                      id="content"
                      value={newPrompt.content}
                      onChange={(e) => setNewPrompt(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Enter your prompt content here. Use {variable_name} for placeholders..."
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        value={newPrompt.tags}
                        onChange={(e) => setNewPrompt(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="tag1, tag2, tag3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="visibility">Visibility</Label>
                      <select
                        id="visibility"
                        value={newPrompt.visibility}
                        onChange={(e) => setNewPrompt(prev => ({ 
                          ...prev, 
                          visibility: e.target.value as 'private' | 'public' | 'shared' 
                        }))}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="private">Private</option>
                        <option value="shared">Shared</option>
                        <option value="public">Public</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreatePrompt}>
                      Create Prompt
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
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
              className="p-2 border rounded-lg"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Enhanced Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="my-prompts" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  My Prompts ({prompts.length})
                </TabsTrigger>
                <TabsTrigger value="ai-enhanced" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Enhanced ({prompts.filter(p => p.ai_enhanced).length})
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="marketplace" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Marketplace
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
                ) : filteredPrompts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery 
                        ? 'Try adjusting your search terms or filters'
                        : 'Create your first prompt to get started'
                      }
                    </p>
                    {!searchQuery && (
                      <div className="flex gap-3 justify-center">
                        <Button onClick={() => setIsCreateOpen(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Prompt
                        </Button>
                        <Button variant="outline" onClick={() => setIsTemplateOpen(true)}>
                          <Layers className="w-4 h-4 mr-2" />
                          Use Template
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredPrompts.map((prompt) => (
                    <Card key={prompt.id} className="group hover:shadow-md transition-shadow hover:border-primary/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {prompt.ai_enhanced ? (
                              <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-blue-500 rounded flex items-center justify-center shrink-0">
                                <Sparkles className="w-3 h-3 text-white" />
                              </div>
                            ) : (
                              <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base truncate">{prompt.title}</CardTitle>
                                {prompt.ai_enhanced && (
                                  <Badge variant="secondary" className="text-xs px-2">
                                    <Zap className="w-2 h-2 mr-1" />
                                    AI
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {prompt.performance_score && (
                              <Badge variant="outline" className="text-xs px-2">
                                {prompt.performance_score}%
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleFavorite(prompt.id)}
                            >
                              <Star 
                                className={`w-4 h-4 ${prompt.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
                              />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {prompt.description}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm font-mono line-clamp-3">
                            {prompt.content}
                          </p>
                          {prompt.template_variables && prompt.template_variables.length > 0 && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <Tag className="w-3 h-3" />
                              <span>Variables: {prompt.template_variables.join(', ')}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Quality Metrics */}
                        {prompt.quality_metrics && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Quality Score</span>
                              <span className={getQualityColor(prompt.performance_score || 0)}>
                                {prompt.performance_score}%
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Clarity</span>
                                <span>{prompt.quality_metrics.clarity}%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Effectiveness</span>
                                <span>{prompt.quality_metrics.effectiveness}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              <span>{prompt.usage_count} uses</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(prompt.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge className={`text-xs px-2 py-1 ${getVisibilityColor(prompt.visibility)}`}>
                            <div className="flex items-center gap-1">
                              {getVisibilityIcon(prompt.visibility)}
                              {prompt.visibility}
                            </div>
                          </Badge>
                        </div>

                      {prompt.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {prompt.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {prompt.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{prompt.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                        <div className="flex gap-2 pt-2 border-t">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              setSelectedPrompt(prompt)
                              setIsViewOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleCopyPrompt(prompt.content)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                          {!prompt.ai_enhanced && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => enhancePromptWithAI(prompt.content)}
                              className="text-purple-600 hover:text-purple-700"
                            >
                              <Wand2 className="w-4 h-4 mr-1" />
                              Enhance
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                )}
              </TabsContent>
              
              <TabsContent value="ai-enhanced" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {prompts.filter(p => p.ai_enhanced).map((prompt) => (
                    <Card key={prompt.id} className="group hover:shadow-md transition-shadow border-purple-200/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm font-medium text-purple-600">AI Enhanced</span>
                        </div>
                        <CardTitle className="text-base">{prompt.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{prompt.description}</p>
                      </CardHeader>
                      <CardContent>
                        {prompt.version_history && prompt.version_history.length > 0 && (
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="improvements">
                              <AccordionTrigger className="text-sm">
                                View AI Improvements ({prompt.version_history[0].improvements.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  {prompt.version_history[0].improvements.map((improvement, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <ChevronRight className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                                      {improvement}
                                    </li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="analytics" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BarChart3 className="w-5 h-5" />
                        Usage Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Prompts</span>
                          <span className="font-medium">{prompts.length}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">AI Enhanced</span>
                          <span className="font-medium text-purple-600">
                            {prompts.filter(p => p.ai_enhanced).length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Uses</span>
                          <span className="font-medium">
                            {prompts.reduce((sum, p) => sum + p.usage_count, 0)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="w-5 h-5" />
                        Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Avg Quality Score</span>
                            <span className="font-medium">87%</span>
                          </div>
                          <Progress value={87} className="h-2" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Enhancement Rate</span>
                            <span className="font-medium text-green-600">+23%</span>
                          </div>
                          <Progress value={23} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="w-5 h-5" />
                        Top Categories
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {['Technical', 'Business', 'Creative'].map((category, idx) => (
                          <div key={category} className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{category}</span>
                            <Badge variant="secondary">{3 - idx} prompts</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="marketplace" className="mt-6">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Prompt Marketplace</h3>
                  <p className="text-muted-foreground mb-4">
                    Discover and share prompts with the community
                  </p>
                  <Button variant="outline">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Explore Marketplace
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* View Prompt Dialog */}
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
                
                <div className="space-y-2">
                  <Label>Prompt Content</Label>
                  <div className="bg-muted rounded-lg p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {selectedPrompt.content}
                    </pre>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Category</Label>
                    <p className="text-muted-foreground capitalize">{selectedPrompt.category}</p>
                  </div>
                  <div>
                    <Label>Usage Count</Label>
                    <p className="text-muted-foreground">{selectedPrompt.usage_count} times</p>
                  </div>
                </div>

                {selectedPrompt.tags.length > 0 && (
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPrompt.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsViewOpen(false)}>
                    Close
                  </Button>
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
      </div>
    </Protect>
  )
}