'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Plus, 
  Search, 
  Filter, 
  Grid3x3, 
  List, 
  FolderOpen, 
  FileText, 
  Trash2, 
  Edit3, 
  Settings, 
  Share2, 
  Eye, 
  Database, 
  Network, 
  Brain, 
  Zap, 
  Clock, 
  Users, 
  Lock, 
  Unlock, 
  Star, 
  StarOff, 
  Download, 
  Upload, 
  MoreHorizontal, 
  Copy, 
  Archive, 
  Calendar,
  Tag,
  TrendingUp,
  BarChart3,
  Folder,
  FolderPlus,
  Move,
  Link2,
  Hash,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  X,
  ArrowRight,
  Sparkles,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDroppable, useDraggable, UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

type Document = {
  id: string
  name: string
  title?: string
  upload_date: string
  size?: number
  type: string
  status: 'processing' | 'ready' | 'error'
  chunk_count?: number
  collection_id?: string
}

type Collection = {
  id: string
  name: string
  description?: string
  color: string
  is_public: boolean
  is_starred: boolean
  created_at: string
  updated_at: string
  document_count: number
  total_chunks?: number
  size?: number
  tags?: string[]
  owner?: string
  access_level: 'private' | 'shared' | 'public'
  collaborators?: string[]
  processing_status?: 'idle' | 'processing' | 'error'
  last_activity?: string
}

type NewCollectionData = {
  name: string
  description: string
  color: string
  is_public: boolean
  tags: string[]
}

const COLLECTION_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
]

// Drag and Drop Components
function DroppableCollection({ collection, onDrop, isActive, onEdit, onDelete, onToggleStar, onTogglePublic }: { 
  collection: Collection
  onDrop: (documentId: string, collectionId: string) => void
  isActive: boolean,
  onEdit: (id: string) => void,
  onDelete: (id: string) => void,
  onToggleStar: (id: string) => void,
  onTogglePublic: (id: string) => void,
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: collection.id
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-all duration-200 rounded-lg border-2 border-dashed",
        isOver ? "border-primary bg-primary/5" : "border-transparent",
        isActive ? "border-primary/30" : ""
      )}
    >
      <CollectionCard 
        collection={collection} 
        onEdit={onEdit} 
        onDelete={onDelete} 
        onToggleStar={onToggleStar}
        onTogglePublic={onTogglePublic}
      />
    </div>
  )
}

function DraggableDocument({ document, onRemove }: { 
  document: Document
  onRemove: (id: string) => void 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: document.id,
    data: { type: 'document', document }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-3 bg-card border rounded-lg cursor-move transition-all duration-200",
        isDragging ? "opacity-50 z-50 shadow-lg scale-105" : "hover:shadow-md"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{document.title || document.name}</p>
          <p className="text-xs text-muted-foreground">
            {document.chunk_count} chunks • {new Date(document.upload_date).toLocaleDateString()}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="w-6 h-6 p-0 hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(document.id)
          }}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function CollectionCard({ 
  collection, 
  onEdit, 
  onDelete, 
  onToggleStar, 
  onTogglePublic 
}: {
  collection: Collection
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  onTogglePublic: (id: string) => void
}) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
              style={{ backgroundColor: collection.color }}
            >
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">{collection.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant={collection.access_level === 'private' ? 'secondary' : collection.access_level === 'shared' ? 'outline' : 'default'}
                  className="text-xs px-2 py-0.5"
                >
                  {collection.access_level === 'private' && <Lock className="w-3 h-3 mr-1" />}
                  {collection.access_level === 'shared' && <Users className="w-3 h-3 mr-1" />}
                  {collection.access_level === 'public' && <Unlock className="w-3 h-3 mr-1" />}
                  {collection.access_level}
                </Badge>
                {collection.is_starred && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
              </div>
            </div>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onEdit(collection.id)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Collection
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onToggleStar(collection.id)}
                >
                  {collection.is_starred ? (
                    <>
                      <StarOff className="w-4 h-4 mr-2" />
                      Remove Star
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4 mr-2" />
                      Add Star
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onTogglePublic(collection.id)}
                >
                  {collection.is_public ? (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Make Private
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Make Public
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Collection
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </Button>
                <div className="border-t my-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => onDelete(collection.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Collection
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      
      <CardContent>
        {collection.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {collection.description}
          </p>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{collection.document_count}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{collection.total_chunks || 0}</p>
            <p className="text-xs text-muted-foreground">Chunks</p>
          </div>
        </div>
        
        {collection.tags && collection.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {collection.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5">
                #{tag}
              </Badge>
            ))}
            {collection.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{collection.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Updated {new Date(collection.updated_at).toLocaleDateString()}</span>
          </div>
          {collection.processing_status === 'processing' && (
            <div className="flex items-center gap-1 text-blue-600">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              <span>Processing</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" className="flex-1">
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Link href={`/dashboard/chat?collectionId=${encodeURIComponent(collection.id)}`} className="flex-1">
            <Button size="sm" variant="outline" className="w-full">
              <Brain className="w-4 h-4 mr-2" />
              Chat
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showOrganizeDialog, setShowOrganizeDialog] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [draggedDocument, setDraggedDocument] = useState<Document | null>(null)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  
  const [newCollection, setNewCollection] = useState<NewCollectionData>({
    name: '',
    description: '',
    color: COLLECTION_COLORS[0],
    is_public: false,
    tags: []
  })
  const [newTag, setNewTag] = useState('')

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [collectionsRes, documentsRes] = await Promise.all([
          fetch(`${API_BASE}/collections`, {
            headers: { 'bypass-tunnel-reminder': 'true' }
          }),
          fetch(`${API_BASE}/documents`, {
            headers: { 'bypass-tunnel-reminder': 'true' }
          })
        ])

        if (collectionsRes.ok) {
          const collectionsData = await collectionsRes.json()
          const normalized = (collectionsData.collections || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            color: c.color || '#6366f1',
            is_public: (c.metadata && (c.metadata.visibility === 'public' || c.metadata.is_public === true)) || false,
            is_starred: false,
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || new Date().toISOString(),
            document_count: c.document_count || 0,
            total_chunks: 0,
            size: c.total_size || 0,
            tags: (c.metadata && c.metadata.tags) || [],
            owner: c.created_by,
            access_level: ((c.metadata && c.metadata.visibility === 'public') ? 'public' : (c.is_shared ? 'shared' : 'private')) as 'private' | 'shared' | 'public',
            collaborators: [],
            processing_status: 'idle',
            last_activity: c.updated_at || c.created_at,
          }))
          setCollections(normalized)
        } else {
          // Mock data for demonstration
          setCollections([
            {
              id: 'env-collection',
              name: 'Environmental Studies',
              description: 'Collection of environmental impact reports and assessments',
              color: '#10b981',
              is_public: false,
              is_starred: true,
              created_at: '2024-01-15T10:00:00Z',
              updated_at: '2024-01-20T15:30:00Z',
              document_count: 12,
              total_chunks: 1847,
              access_level: 'private',
              tags: ['environmental', 'reports', 'impact'],
              processing_status: 'idle',
              last_activity: '2024-01-20T15:30:00Z'
            },
            {
              id: 'tech-collection',
              name: 'Technical Documentation',
              description: 'Technical specifications and engineering documents',
              color: '#3b82f6',
              is_public: true,
              is_starred: false,
              created_at: '2024-01-10T08:00:00Z',
              updated_at: '2024-01-19T12:45:00Z',
              document_count: 8,
              total_chunks: 1203,
              access_level: 'public',
              tags: ['technical', 'engineering', 'specs'],
              processing_status: 'idle',
              last_activity: '2024-01-19T12:45:00Z'
            },
            {
              id: 'legal-collection',
              name: 'Legal & Compliance',
              description: 'Legal documents and regulatory compliance materials',
              color: '#ef4444',
              is_public: false,
              is_starred: false,
              created_at: '2024-01-12T14:00:00Z',
              updated_at: '2024-01-18T09:15:00Z',
              document_count: 5,
              total_chunks: 892,
              access_level: 'shared',
              collaborators: ['legal-team'],
              tags: ['legal', 'compliance', 'regulatory'],
              processing_status: 'processing',
              last_activity: '2024-01-18T09:15:00Z'
            },
            {
              id: 'research-collection',
              name: 'Research Papers',
              description: 'Academic research and scientific publications',
              color: '#8b5cf6',
              is_public: true,
              is_starred: true,
              created_at: '2024-01-08T16:00:00Z',
              updated_at: '2024-01-21T11:20:00Z',
              document_count: 15,
              total_chunks: 2341,
              access_level: 'public',
              tags: ['research', 'academic', 'scientific'],
              processing_status: 'idle',
              last_activity: '2024-01-21T11:20:00Z'
            }
          ])
        }

        if (documentsRes.ok) {
          const documentsData = await documentsRes.json()
          const docsRaw = Array.isArray(documentsData) ? documentsData : (documentsData.documents || [])
          const normalizedDocs: Document[] = docsRaw.map((d: any) => ({
            id: d.id,
            name: d.title || d.source || `doc-${d.id}`,
            title: d.title,
            upload_date: d.created_at || new Date().toISOString(),
            type: 'doc',
            status: 'ready',
            chunk_count: d.chunk_count || 0,
          }))
          setDocuments(normalizedDocs)
        } else {
          // Mock data for unassigned documents
          setDocuments([
            {
              id: 'doc-unassigned-1',
              name: 'quarterly-report-q4.pdf',
              title: 'Q4 2023 Environmental Quarterly Report',
              upload_date: '2024-01-22T10:00:00Z',
              type: 'pdf',
              status: 'ready',
              chunk_count: 156,
              size: 2.4
            },
            {
              id: 'doc-unassigned-2',
              name: 'site-assessment-north.pdf',
              title: 'North Site Assessment Report',
              upload_date: '2024-01-21T14:30:00Z',
              type: 'pdf',
              status: 'processing',
              chunk_count: 89,
              size: 1.8
            },
            {
              id: 'doc-unassigned-3',
              name: 'remediation-plan-2024.docx',
              title: 'Comprehensive Remediation Plan 2024',
              upload_date: '2024-01-20T09:15:00Z',
              type: 'docx',
              status: 'ready',
              chunk_count: 203,
              size: 1.2
            }
          ])
        }
      } catch (error) {
        console.error('Failed to load collections:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Filter and sort collections
  const filteredCollections = collections
    .filter(collection => {
      if (searchQuery && !collection.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !collection.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (filterStatus === 'starred' && !collection.is_starred) return false
      if (filterStatus === 'public' && !collection.is_public) return false
      if (filterStatus === 'private' && collection.is_public) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name)
        case 'size': return (b.document_count || 0) - (a.document_count || 0)
        case 'created': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'updated':
        default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }
    })

  // Get unassigned documents
  const unassignedDocuments = documents.filter(doc => !doc.collection_id)

  const handleCreateCollection = async () => {
    try {
      if (editingCollection) {
        const res = await fetch(`${API_BASE}/collections/${editingCollection.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
          body: JSON.stringify({
            name: newCollection.name,
            description: newCollection.description,
            color: newCollection.color,
            // Treat public as shared visibility flag in metadata
            metadata: newCollection.is_public ? { visibility: 'public' } : { visibility: 'private' }
          })
        })
        if (!res.ok) throw new Error(`Failed to update collection`)
        const c = await res.json()
        // normalize
        const nc: Collection = {
          id: c.id,
          name: c.name,
          description: c.description || '',
          color: c.color || '#6366f1',
          is_public: (c.metadata && (c.metadata.visibility === 'public' || c.metadata.is_public === true)) || false,
          is_starred: editingCollection.is_starred,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
          document_count: c.document_count || 0,
          total_chunks: 0,
          access_level: ((c.metadata && c.metadata.visibility === 'public') ? 'public' : (c.is_shared ? 'shared' : 'private')) as any,
          tags: (c.metadata && c.metadata.tags) || [],
          processing_status: 'idle',
        }
        setCollections(prev => prev.map(x => x.id === nc.id ? nc : x))
      } else {
        const res = await fetch(`${API_BASE}/collections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
          body: JSON.stringify({
            name: newCollection.name,
            description: newCollection.description,
            color: newCollection.color,
            icon: 'folder',
            is_shared: newCollection.is_public,
            metadata: newCollection.is_public ? { visibility: 'public', tags: newCollection.tags } : { visibility: 'private', tags: newCollection.tags }
          })
        })
        if (!res.ok) throw new Error(`Failed to create collection`)
        const c = await res.json()
        const nc: Collection = {
          id: c.id,
          name: c.name,
          description: c.description || '',
          color: c.color || '#6366f1',
          is_public: (c.metadata && (c.metadata.visibility === 'public' || c.metadata.is_public === true)) || false,
          is_starred: false,
          created_at: c.created_at || new Date().toISOString(),
          updated_at: c.updated_at || new Date().toISOString(),
          document_count: c.document_count || 0,
          total_chunks: 0,
          access_level: ((c.metadata && c.metadata.visibility === 'public') ? 'public' : (c.is_shared ? 'shared' : 'private')) as any,
          tags: (c.metadata && c.metadata.tags) || [],
          processing_status: 'idle',
        }
        setCollections(prev => [...prev, nc])
      }
      setShowCreateDialog(false)
      setNewCollection({
        name: '',
        description: '',
        color: COLLECTION_COLORS[0],
        is_public: false,
        tags: []
      })
      setEditingCollection(null)
    } catch (error) {
      console.error('Failed to create collection:', error)
    }
  }

  const handleEditCollection = (id: string) => {
    const collection = collections.find(c => c.id === id)
    if (collection) {
      setEditingCollection(collection)
      setNewCollection({
        name: collection.name,
        description: collection.description || '',
        color: collection.color,
        is_public: collection.is_public,
        tags: collection.tags || []
      })
      setShowCreateDialog(true)
    }
  }

  const handleDeleteCollection = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/collections/${id}`, {
        method: 'DELETE',
        headers: { 'bypass-tunnel-reminder': 'true' }
      })
      if (!res.ok) throw new Error('Delete failed')
      setCollections(prev => prev.filter(c => c.id !== id))
    } catch (e) {
      console.error('Failed to delete collection', e)
    }
  }

  const handleToggleStar = (id: string) => {
    setCollections(prev => prev.map(c => 
      c.id === id ? { ...c, is_starred: !c.is_starred } : c
    ))
  }

  const handleTogglePublic = async (id: string) => {
    try {
      const current = collections.find(c => c.id === id)
      const makePublic = !current?.is_public
      const res = await fetch(`${API_BASE}/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({ metadata: makePublic ? { visibility: 'public' } : { visibility: 'private' } })
      })
      if (!res.ok) throw new Error('Toggle failed')
      setCollections(prev => prev.map(c => 
        c.id === id ? { 
          ...c, 
          is_public: makePublic,
          access_level: makePublic ? 'public' : (c.access_level === 'public' ? 'private' : c.access_level)
        } : c
      ))
    } catch (e) {
      console.error('Failed to toggle visibility', e)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !newCollection.tags.includes(newTag.trim())) {
      setNewCollection(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setNewCollection(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
    const document = documents.find(d => d.id === event.active.id)
    setDraggedDocument(document || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const documentId = active.id as string
      const collectionId = over.id as string
      
      try {
        const res = await fetch(`${API_BASE}/collections/${collectionId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
          body: JSON.stringify({ document_ids: [documentId] })
        })
        if (!res.ok) throw new Error('Failed to add document to collection')
        // Move document to collection locally
        setDocuments(prev => prev.map(doc => 
          doc.id === documentId ? { ...doc, collection_id: collectionId } : doc
        ))
        // Update collection document count
        setCollections(prev => prev.map(col => 
          col.id === collectionId ? { ...col, document_count: col.document_count + 1 } : col
        ))
      } catch (e) {
        console.error('Add to collection failed', e)
      }
    }
    
    setActiveId(null)
    setDraggedDocument(null)
  }

  const handleRemoveFromCollection = (documentId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === documentId ? { ...doc, collection_id: undefined } : doc
    ))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading collections...</p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-background">
        {/* Enhanced Header */}
        <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Document Collections
              </h1>
              <p className="text-muted-foreground mt-1">
                Organize your documents into intelligent collections for better knowledge management
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setShowOrganizeDialog(true)}
                variant="outline" 
                className="flex items-center gap-2"
              >
                <Move className="w-4 h-4" />
                Organize Documents
              </Button>
              <Button 
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Collection
              </Button>
            </div>
          </div>

          {/* Enhanced Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search collections by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collections</SelectItem>
                  <SelectItem value="starred">Starred</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Recently Updated</SelectItem>
                  <SelectItem value="created">Recently Created</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="size">Document Count</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center border rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none border-l"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Collections</p>
                    <p className="text-2xl font-bold">{collections.length}</p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Documents</p>
                    <p className="text-2xl font-bold">
                      {collections.reduce((sum, col) => sum + col.document_count, 0)}
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Network className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Knowledge Chunks</p>
                    <p className="text-2xl font-bold">
                      {collections.reduce((sum, col) => sum + (col.total_chunks || 0), 0)}
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unorganized</p>
                    <p className="text-2xl font-bold">{unassignedDocuments.length}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Collections Grid/List */}
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            )}>
              {filteredCollections.map((collection) => (
                <DroppableCollection
                  key={collection.id}
                  collection={collection}
                  onDrop={(documentId, collectionId) => {
                    // Drop handling is performed in onDragEnd global handler
                  }}
                  isActive={!!activeId}
                  onEdit={handleEditCollection}
                  onDelete={handleDeleteCollection}
                  onToggleStar={handleToggleStar}
                  onTogglePublic={handleTogglePublic}
                />
              ))}
            </div>

            {filteredCollections.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Database className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery || filterStatus !== 'all' ? 'No collections found' : 'No collections yet'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchQuery || filterStatus !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Get started by creating your first collection to organize your documents.'}
                </p>
                {(!searchQuery && filterStatus === 'all') && (
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Collection
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create Collection Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCollection ? 'Edit Collection' : 'Create New Collection'}
              </DialogTitle>
              <DialogDescription>
                {editingCollection 
                  ? 'Update your collection details and organization.'
                  : 'Organize your documents into a smart collection with AI-powered categorization.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Collection Name *</Label>
                  <Input
                    id="name"
                    value={newCollection.name}
                    onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Environmental Reports"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Collection Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {COLLECTION_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-all",
                          newCollection.color === color ? "border-foreground scale-110" : "border-border hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewCollection(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newCollection.description}
                  onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this collection contains and its purpose..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {newCollection.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      #{tag}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-destructive/20"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={newCollection.is_public}
                  onChange={(e) => setNewCollection(prev => ({ ...prev, is_public: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="isPublic" className="flex items-center gap-2">
                  {newCollection.is_public ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  Make this collection public
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false)
                  setEditingCollection(null)
                  setNewCollection({
                    name: '',
                    description: '',
                    color: COLLECTION_COLORS[0],
                    is_public: false,
                    tags: []
                  })
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateCollection} disabled={!newCollection.name.trim()}>
                <Sparkles className="w-4 h-4 mr-2" />
                {editingCollection ? 'Update Collection' : 'Create Collection'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Document Organization Dialog */}
        <Dialog open={showOrganizeDialog} onOpenChange={setShowOrganizeDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Move className="w-5 h-5" />
                Organize Documents
              </DialogTitle>
              <DialogDescription>
                Drag and drop documents into collections or manage document assignments.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-6 h-full">
                {/* Unassigned Documents */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Unassigned Documents ({unassignedDocuments.length})
                  </h3>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {unassignedDocuments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>All documents are organized!</p>
                      </div>
                    ) : (
                      unassignedDocuments.map((document) => (
                        <DraggableDocument
                          key={document.id}
                          document={document}
                          onRemove={handleRemoveFromCollection}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Collections as Drop Zones */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Collections ({collections.length})
                  </h3>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {collections.map((collection) => {
                      const assigned = documents.filter(d => d.collection_id === collection.id)
                      return (
                        <div
                          key={collection.id}
                          className="p-3 border rounded-lg bg-card hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: collection.color }}
                            >
                              <Database className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{collection.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {collection.document_count} documents
                              </p>
                            </div>
                          </div>

                          {activeId && (
                            <div className="border-2 border-dashed border-primary/30 rounded-lg p-2 text-center text-sm text-muted-foreground mb-2">
                              Drop document here to add to collection
                            </div>
                          )}

                          {assigned.length > 0 ? (
                            <div className="space-y-2">
                              {assigned.map((doc) => (
                                <DraggableDocument
                                  key={doc.id}
                                  document={doc}
                                  onRemove={async (docId) => {
                                    try {
                                      await fetch(`${API_BASE}/collections/${collection.id}/documents/${docId}`, {
                                        method: 'DELETE',
                                        headers: { 'bypass-tunnel-reminder': 'true' }
                                      })
                                    } catch (e) {
                                      console.error('Failed to remove from collection', e)
                                    }
                                    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, collection_id: undefined } : d))
                                    setCollections(prev => prev.map(col => col.id === collection.id ? { ...col, document_count: Math.max(0, col.document_count - 1) } : col))
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No documents yet</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setShowOrganizeDialog(false)}>
                Done Organizing
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedDocument && (
            <div className="p-3 bg-card border rounded-lg shadow-lg opacity-90 rotate-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{draggedDocument.title || draggedDocument.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {draggedDocument.chunk_count} chunks
                  </p>
                </div>
              </div>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}