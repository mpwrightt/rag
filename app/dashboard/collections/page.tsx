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
  FolderOpen, 
  FileText, 
  Users, 
  Calendar, 
  MoreHorizontal,
  Trash2,
  Edit,
  Share
} from 'lucide-react'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

type Collection = {
  id: string
  name: string
  description: string
  document_count: number
  created_at: string
  last_activity: string
  tags: string[]
  privacy: 'private' | 'shared' | 'public'
  created_by: string
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newCollection, setNewCollection] = useState({
    name: '',
    description: '',
    privacy: 'private' as 'private' | 'shared' | 'public'
  })

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const load = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ page: '1', per_page: '24' })
        if (searchQuery.trim()) params.set('search', searchQuery.trim())

        const res = await fetch(`${API_BASE}/api/collections?${params.toString()}`, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`)
        const data = await res.json()

        const mapped: Collection[] = (data?.collections || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          document_count: c.document_count ?? 0,
          created_at: c.created_at || new Date().toISOString(),
          last_activity: c.last_accessed || c.updated_at || c.created_at || new Date().toISOString(),
          tags: (c.metadata && Array.isArray(c.metadata.tags)) ? c.metadata.tags : [],
          privacy: (c.metadata && (c.metadata.visibility === 'public' || c.metadata.is_public)) ? 'public' : (c.is_shared ? 'shared' : 'private'),
          created_by: c.created_by || ''
        }))
        if (isActive) setCollections(mapped)
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Error loading collections', err)
          if (isActive) setCollections([])
        }
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    const timeout = setTimeout(load, 300)
    return () => {
      isActive = false
      controller.abort()
      clearTimeout(timeout)
    }
  }, [searchQuery])

  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    collection.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleCreateCollection = async () => {
    if (!newCollection.name.trim()) return

    try {
      const isPublic = newCollection.privacy === 'public'
      const isShared = newCollection.privacy === 'shared'
      const params = new URLSearchParams()
      if (isPublic) params.set('visibility', 'public')

      const res = await fetch(`${API_BASE}/api/collections${params.toString() ? `?${params.toString()}` : ''}` , {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optionally pass user/workspace context if available
          // 'x-user-id': currentUserId,
          // 'x-workspace-id': currentWorkspaceId,
        },
        body: JSON.stringify({
          name: newCollection.name,
          description: newCollection.description || undefined,
          color: '#6366f1',
          icon: 'folder',
          is_shared: isShared,
        })
      })

      if (!res.ok) throw new Error(`Failed to create collection: ${res.status}`)
      const c = await res.json()

      const created: Collection = {
        id: c.id,
        name: c.name,
        description: c.description || '',
        document_count: c.document_count ?? 0,
        created_at: c.created_at || new Date().toISOString(),
        last_activity: c.last_accessed || c.updated_at || c.created_at || new Date().toISOString(),
        tags: (c.metadata && Array.isArray(c.metadata.tags)) ? c.metadata.tags : [],
        privacy: (c.metadata && (c.metadata.visibility === 'public' || c.metadata.is_public)) ? 'public' : (c.is_shared ? 'shared' : 'private'),
        created_by: c.created_by || ''
      }

      setCollections(prev => [created, ...prev])
      setNewCollection({ name: '', description: '', privacy: 'private' })
      setIsCreateOpen(false)
    } catch (err) {
      console.error('Error creating collection', err)
    }
  }

  const getPrivacyColor = (privacy: string) => {
    switch (privacy) {
      case 'private': return 'bg-gray-100 text-gray-800'
      case 'shared': return 'bg-blue-100 text-blue-800'
      case 'public': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'shared': return <Users className="w-3 h-3" />
      case 'public': return <Share className="w-3 h-3" />
      default: return null
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Collections</h1>
            <p className="text-muted-foreground">
              Organize your documents and prompts into collections
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Collection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Collection Name</Label>
                  <Input
                    id="name"
                    value={newCollection.name}
                    onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter collection name..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newCollection.description}
                    onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this collection contains..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacy">Privacy</Label>
                  <select
                    id="privacy"
                    value={newCollection.privacy}
                    onChange={(e) => setNewCollection(prev => ({ 
                      ...prev, 
                      privacy: e.target.value as 'private' | 'shared' | 'public' 
                    }))}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="private">Private</option>
                    <option value="shared">Shared</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCollection}>
                    Create Collection
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? 'No collections found' : 'No collections yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Create your first collection to organize your content'
                }
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Collection
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCollections.map((collection) => (
                <Card key={collection.id} className="group hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FolderOpen className="w-5 h-5 text-primary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">{collection.name}</CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-xs px-2 py-1 ${getPrivacyColor(collection.privacy)}`}>
                          <div className="flex items-center gap-1">
                            {getPrivacyIcon(collection.privacy)}
                            {collection.privacy}
                          </div>
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {collection.description || 'No description provided'}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{collection.document_count} documents</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(collection.last_activity).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {collection.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {collection.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {collection.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{collection.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t">
                      <Button variant="ghost" size="sm" className="flex-1">
                        View Collection
                      </Button>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}