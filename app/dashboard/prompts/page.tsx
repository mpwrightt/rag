'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Users
} from 'lucide-react'
import { Protect } from '@clerk/nextjs'
import CustomClerkPricing from '@/components/custom-clerk-pricing'

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
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [newPrompt, setNewPrompt] = useState({
    title: '',
    description: '',
    content: '',
    category: 'general',
    tags: '',
    visibility: 'private' as 'private' | 'public' | 'shared'
  })

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

  // Mock data for prompts
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
      created_by: 'user@example.com'
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

  const categories = ['all', 'summarization', 'technical', 'development', 'business', 'general']

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

  return (
    <Protect condition={(has) => has({ plan: 'pro' })} fallback={<UpgradeCard />}>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold">Prompt Library</h1>
              <p className="text-muted-foreground">
                Manage your AI prompts and templates
              </p>
            </div>
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
                <h3 className="text-lg font-medium mb-2">No prompts found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search terms or filters'
                    : 'Create your first prompt to get started'
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Prompt
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredPrompts.map((prompt) => (
                  <Card key={prompt.id} className="group hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base truncate">{prompt.title}</CardTitle>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
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
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>{prompt.usage_count} uses</span>
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
    </Protect>
  )
}