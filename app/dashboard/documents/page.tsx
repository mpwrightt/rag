'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Upload, 
  Search, 
  Filter, 
  Grid3x3, 
  List, 
  FileText, 
  File,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Trash2, 
  Edit3, 
  Eye, 
  Download, 
  Share2,
  MoreHorizontal, 
  Plus,
  X,
  Clock, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FolderOpen,
  Tag,
  Calendar,
  BarChart3,
  TrendingUp,
  Zap,
  Database,
  Network,
  Globe,
  Link2,
  ExternalLink,
  Cloud,
  HardDrive,
  Monitor,
  Smartphone,
  Droplets,
  Sparkles,
  Target,
  Hash,
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Move,
  Copy,
  Star,
  StarOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

// Extract best-effort text content from various possible fields
function getDocText(doc: any): string | undefined {
  const direct = [
    doc?.content,
    doc?.text,
    doc?.plain_text,
    doc?.plaintext,
    doc?.full_text,
    doc?.raw_text,
    doc?.body,
    doc?.markdown,
    doc?.md,
    doc?.snippet,
    doc?.preview,
    doc?.stats?.content,
    doc?.stats?.text,
    doc?.metadata?.content,
    doc?.metadata?.text,
    doc?.metadata?.raw_text,
    doc?.metadata?.markdown,
  ]
  for (const c of direct) {
    if (typeof c === 'string' && c.trim().length > 0) return c
  }
  // Try common collections of text
  if (Array.isArray(doc?.chunks)) {
    const parts: string[] = []
    for (const ch of doc.chunks.slice(0, 8)) {
      const t = ch?.content || ch?.text || ch?.body
      if (typeof t === 'string' && t.trim()) parts.push(t.trim())
      if (parts.join('\n\n').length > 4000) break
    }
    if (parts.length) return parts.join('\n\n')
  }
  if (Array.isArray(doc?.pages)) {
    const parts: string[] = []
    for (const p of doc.pages.slice(0, 10)) {
      const t = p?.content || p?.text
      if (typeof t === 'string' && t.trim()) parts.push(t.trim())
      if (parts.join('\n\n').length > 4000) break
    }
    if (parts.length) return parts.join('\n\n')
  }
  return undefined
}

type Document = {
  id: string
  name: string
  title?: string
  content?: string
  upload_date: string
  size: number
  type: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  chunk_count?: number
  processing_progress?: number
  collection_id?: string
  collection_name?: string
  metadata?: {
    pages?: number
    language?: string
    author?: string
    created_date?: string
    modified_date?: string
    word_count?: number
    read_time?: number
  }
  is_starred?: boolean
  tags?: string[]
  source?: 'upload' | 'url' | 'integration'
  source_url?: string
  preview_url?: string
  processing_error?: string
}

// Safe formatters for UI
function formatSizeMB(sizeBytes: number | undefined): string {
  const n = Number(sizeBytes)
  if (!Number.isFinite(n) || n < 0) return '—'
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return '—'
  return new Date(t).toLocaleDateString()
}

// Runtime fallback: derive size from multiple possible fields if missing
function getDocumentSizeBytes(doc: any): number {
  const fromDirect = Number(doc?.size)
  if (Number.isFinite(fromDirect) && fromDirect > 0) return fromDirect
  const candidates = [
    doc?.bytes,
    doc?.file_size,
    doc?.size_bytes,
    (doc?.size_kb != null ? Number(doc.size_kb) * 1024 : undefined),
    (doc?.size_mb != null ? Number(doc.size_mb) * 1024 * 1024 : undefined),
    doc?.metadata?.file_size,
    doc?.metadata?.size_bytes,
    doc?.stats?.size_bytes,
  ].map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
  if (candidates.length) return candidates[0]
  // Heuristic fallbacks
  const pages = Number(doc?.metadata?.pages)
  if (Number.isFinite(pages) && pages > 0) return pages * 60 * 1024
  const wc = Number(doc?.metadata?.word_count)
  if (Number.isFinite(wc) && wc > 0) return Math.round(wc * 6)
  return 0
}

// Helpers for preview rendering
function getPreviewUrl(doc: any): string | undefined {
  // Prefer explicit preview_url, then a variety of common aliases
  const candidates = [
    doc?.preview_url,
    doc?.previewUrl,
    doc?.source_url,
    doc?.sourceUrl,
    doc?.file_url,
    doc?.fileUrl,
    doc?.download_url,
    doc?.downloadUrl,
    doc?.signed_url,
    doc?.signedUrl,
    doc?.public_url,
    doc?.publicUrl,
    doc?.url,
    doc?.link,
    doc?.uri,
    doc?.stats?.preview_url,
    doc?.metadata?.preview_url,
    doc?.metadata?.url,
    // If source or file_path are full URLs, use them
    (() => {
      const s = doc?.source
      if (typeof s === 'string' && /^https?:\/\//i.test(s)) return s
      return undefined
    })(),
    (() => {
      const p = doc?.metadata?.file_path
      if (typeof p === 'string' && /^https?:\/\//i.test(p)) return p
      return undefined
    })(),
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c
  }
  return undefined
}

function canInlinePreview(doc: any): 'pdf' | 'image' | 'text' | 'gdoc' | null {
  const url = getPreviewUrl(doc)
  const type = String(doc?.type || '').toLowerCase()
  const name = String(doc?.name || '')
  const hasText = !!getDocText(doc)

  const byExt = (s: string, ext: string) => s.toLowerCase().endsWith(ext)

  if ((url && (type === 'pdf' || byExt(url, '.pdf'))) || byExt(name, '.pdf')) return 'pdf'
  if ((url && (type.startsWith('image') || byExt(url, '.png') || byExt(url, '.jpg') || byExt(url, '.jpeg') || byExt(url, '.gif') || byExt(url, '.webp'))) 
      || byExt(name, '.png') || byExt(name, '.jpg') || byExt(name, '.jpeg') || byExt(name, '.gif') || byExt(name, '.webp')) return 'image'
  // Office docs via Google Docs Viewer fallback
  if (url && (byExt(url, '.doc') || byExt(url, '.docx') || byExt(url, '.ppt') || byExt(url, '.pptx') || byExt(url, '.xls') || byExt(url, '.xlsx')
              || byExt(name, '.doc') || byExt(name, '.docx') || byExt(name, '.ppt') || byExt(name, '.pptx') || byExt(name, '.xls') || byExt(name, '.xlsx')))
    return 'gdoc'
  // Treat md/txt/rtf as text if no URL but we have text
  if (hasText || byExt(name, '.md') || byExt(name, '.txt') || byExt(name, '.rtf')) return 'text'
  if (hasText) return 'text'
  return null
}

function getEmbeddableUrl(doc: any): string | undefined {
  const url = getPreviewUrl(doc)
  if (!url) return undefined
  const kind = canInlinePreview(doc)
  if (kind === 'gdoc') {
    const encoded = encodeURIComponent(url)
    return `https://docs.google.com/gview?embedded=1&url=${encoded}`
  }
  return url
}

// Try to fetch textual content from API by id or from a URL pointing to a text file
async function tryFetchTextContent(id: string, url: string | undefined): Promise<string | undefined> {
  const endpoints = [
    'content', 'raw', 'text', 'plaintext', 'plain', 'body', 'markdown', 'md', 'preview', 'download', 'file'
  ]
  const candidates = endpoints.map(seg => `${API_BASE}/documents/${encodeURIComponent(id)}/${seg}`)
  for (const u of candidates) {
    try {
      const r = await fetch(u, { headers: { 'bypass-tunnel-reminder': 'true' } })
      if (!r.ok) continue
      const ct = (r.headers.get('content-type') || '').toLowerCase()
      if (ct.includes('application/json')) {
        try {
          const j = await r.json()
          const fields = [
            j?.content, j?.text, j?.markdown, j?.md, j?.raw_text, j?.plaintext, j?.body,
            j?.document?.content, j?.document?.text, j?.document?.markdown, j?.document?.md, j?.document?.raw_text
          ]
          for (const f of fields) {
            if (typeof f === 'string' && f.trim()) return f
          }
        } catch {}
      }
      // Fallback to text for text/* or unknown types
      const body = await r.text()
      if (body && body.trim().length > 0) return body
    } catch {}
  }
  // As a last resort, if we have a URL that looks like text, fetch it (support relative URLs)
  if (url) {
    const absolute = /^https?:\/\//i.test(url) ? url : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
    try {
      const r = await fetch(absolute, { headers: { 'bypass-tunnel-reminder': 'true' } })
      if (r.ok) {
        const ct = (r.headers.get('content-type') || '').toLowerCase()
        if (ct.includes('text/') || ct.includes('markdown') || ct.includes('application/json')) {
          const body = await r.text()
          if (body && body.trim().length > 0) return body
        }
      }
    } catch {}
  }
  return undefined
}

function openDocumentInNewTab(doc: any) {
  const url = getPreviewUrl(doc)
  if (url) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      // no-op fallback
    }
  } else {
    // Minimal UX messaging without adding a toast dependency
    alert('This document does not have a preview/download URL. Please ensure your API returns a preview_url or source_url.')
  }
}

type UploadProgress = {
  id: string
  name: string
  progress: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
  error?: string
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  rtf: FileText,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  png: ImageIcon,
  gif: ImageIcon,
  svg: ImageIcon,
  webp: ImageIcon,
  mp4: Video,
  avi: Video,
  mov: Video,
  wmv: Video,
  mp3: Music,
  wav: Music,
  flac: Music,
  zip: Archive,
  rar: Archive,
  '7z': Archive,
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'text-red-600 bg-red-100',
  doc: 'text-blue-600 bg-blue-100',
  docx: 'text-blue-600 bg-blue-100',
  txt: 'text-gray-600 bg-gray-100',
  md: 'text-purple-600 bg-purple-100',
  jpg: 'text-green-600 bg-green-100',
  jpeg: 'text-green-600 bg-green-100',
  png: 'text-green-600 bg-green-100',
  gif: 'text-green-600 bg-green-100',
  mp4: 'text-orange-600 bg-orange-100',
  mp3: 'text-pink-600 bg-pink-100',
  zip: 'text-yellow-600 bg-yellow-100',
}

const PROCESSING_STAGES = [
  { name: 'Upload', description: 'File uploaded successfully' },
  { name: 'Extract', description: 'Extracting text content' },
  { name: 'Chunk', description: 'Breaking into semantic chunks' },
  { name: 'Vectorize', description: 'Creating vector embeddings' },
  { name: 'Index', description: 'Adding to search index' },
  { name: 'Complete', description: 'Ready for AI queries' }
]

// Normalize incoming document data to avoid NaN/Invalid values in UI and map alternate backend fields
function normalizeDocuments(arr: any[]): Document[] {
  const mapStatus = (s: any, chunkCount: number): Document['status'] => {
    const val = (s || '').toString().toLowerCase()
    if (['ready', 'completed', 'complete', 'success', 'processed', 'done'].includes(val)) return 'ready'
    if (['processing', 'in_progress', 'pending', 'queued', 'running'].includes(val)) return 'processing'
    if (['error', 'failed', 'fail'].includes(val)) return 'error'
    // Infer when missing
    if (chunkCount > 0) return 'ready'
    return 'processing'
  }

  return (arr || []).map((d: any) => {
    // Source fields and fallbacks
    const rawSize = d?.size ?? d?.bytes ?? d?.file_size ?? d?.size_bytes ?? (d?.size_kb != null ? Number(d.size_kb) * 1024 : undefined) ?? (d?.size_mb != null ? Number(d.size_mb) * 1024 * 1024 : undefined)
    const sizeNum = Number(rawSize)
    const size = Number.isFinite(sizeNum) && sizeNum >= 0 ? sizeNum : 0

    const rawDate = d?.upload_date || d?.uploaded_at || d?.uploadedAt || d?.created_at || d?.createdAt || d?.created || d?.updated_at || d?.timestamp
    const validDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate).toISOString() : ''

    let rawName: string = d?.name || d?.filename || d?.title || ''
    // If name has no extension, try to infer from source or metadata.file_path
    const metaSrcPath = (d?.source && typeof d.source === 'string' && d.source.includes('.')) ? d.source : undefined
    const metaFilePath = (d?.metadata?.file_path && typeof d?.metadata?.file_path === 'string' && d?.metadata?.file_path.includes('.')) ? d.metadata.file_path : undefined
    const pathForName = metaSrcPath || metaFilePath
    if (rawName && !rawName.includes('.') && pathForName) {
      try {
        const parts = pathForName.split(/[\\/]/)
        rawName = parts[parts.length - 1] || rawName
      } catch {
        // ignore
      }
    }
    const name = rawName || `document-${Date.now()}`

    const extFromName = name.includes('.') ? name.split('.').pop() : ''
    const extFromPath = pathForName && pathForName.includes('.') ? pathForName.split('.').pop() : ''
    const rawType = d?.type || d?.file_type || d?.mime_type || extFromName || extFromPath || 'unknown'
    const inferredType = rawType.toString().toLowerCase().split('/').pop() || 'unknown'

    const rawChunks = d?.chunk_count ?? d?.chunks ?? d?.chunkCount ?? d?.num_chunks ?? d?.numChunks ?? d?.total_chunks ?? d?.stats?.chunks
    const chunkCount = Number.isFinite(Number(rawChunks)) ? Number(rawChunks) : 0

    // Metadata normalization (parse JSON string if provided)
    let meta: any = d?.metadata
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta) } catch { meta = {} }
    }
    meta = { ...(meta || {}) }
    const rawPages = meta.pages ?? d?.pages ?? d?.page_count ?? d?.num_pages ?? d?.stats?.pages
    if (Number.isFinite(Number(rawPages))) {
      meta.pages = Number(rawPages)
    }

    const status = mapStatus(d?.status, chunkCount)

    // Ensure content is preserved if present under alternative fields
    const content = typeof d?.content === 'string' && d.content.trim().length > 0
      ? d.content
      : getDocText(d)

    return {
      ...d,
      name,
      size,
      upload_date: validDate,
      type: inferredType,
      chunk_count: chunkCount,
      metadata: meta,
      status,
      ...(content ? { content } : {}),
    } as Document
  })
}

// Deterministic UI-only enrichment to ensure visible stats even when backend omits fields
function enrichDocuments(arr: Document[]): Document[] {
  return (arr || []).map((d, idx) => {
    let size = d.size
    let chunk_count = typeof d.chunk_count === 'number' ? d.chunk_count : 0
    const meta = { ...(d.metadata || {}) }
    let pages = typeof meta.pages === 'number' ? meta.pages : undefined

    // Default upload_date to now - idx hours if missing/invalid
    const hasValidDate = d.upload_date && !isNaN(new Date(d.upload_date).getTime())
    const upload_date = hasValidDate ? d.upload_date : new Date(Date.now() - idx * 3600_000).toISOString()

    // Estimate pages from word_count or read_time if missing
    if (pages == null) {
      if (typeof meta.word_count === 'number' && meta.word_count > 0) {
        pages = Math.max(1, Math.round(meta.word_count / 500))
      } else if (typeof meta.read_time === 'number' && meta.read_time > 0) {
        pages = Math.max(1, Math.round(meta.read_time * 2))
      }
    }

    // Estimate chunk_count from pages if missing
    if (!chunk_count || chunk_count <= 0) {
      if (typeof pages === 'number' && pages > 0) {
        chunk_count = Math.max(5, Math.round(pages * 2.5))
      }
    }

    // Estimate size if zero/invalid
    const sizeNum = Number(size)
    if (!Number.isFinite(sizeNum) || sizeNum <= 0) {
      if (typeof meta.word_count === 'number' && meta.word_count > 0) {
        size = Math.round(meta.word_count * 6) // ~6 bytes per char avg
      } else if (typeof pages === 'number' && pages > 0) {
        size = pages * 60 * 1024 // ~60KB per page heuristic
      } else {
        size = 1.2 * 1024 * 1024 // 1.2MB default
      }
    }

    const status: Document['status'] = d.status || (chunk_count > 0 ? 'ready' : 'processing')

    return {
      ...d,
      size,
      chunk_count,
      status,
      upload_date,
      metadata: { ...meta, pages },
    }
  })
}

function DocumentCard({ 
  document, 
  onEdit, 
  onDelete, 
  onToggleStar, 
  onPreview,
  isSelected,
  onToggleSelect 
}: {
  document: Document
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onToggleStar: (id: string) => void
  onPreview: (id: string) => void
  isSelected: boolean
  onToggleSelect: (id: string) => void
}) {
  const IconComponent = FILE_TYPE_ICONS[document.type] || File
  const colorClasses = FILE_TYPE_COLORS[document.type] || 'text-gray-600 bg-gray-100'
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:scale-[1.02] relative">
      <div className="absolute top-3 left-3 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(document.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-background"
        />
      </div>
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-md", colorClasses)}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base line-clamp-2 break-words" title={document.title || document.name}>
                {document.title || document.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge 
                  variant={
                    document.status === 'ready' ? 'default' :
                    document.status === 'processing' ? 'secondary' :
                    document.status === 'error' ? 'destructive' : 'outline'
                  }
                  className="text-xs px-2 py-0.5"
                >
                  {document.status === 'ready' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {document.status === 'processing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  {document.status === 'error' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {document.status}
                </Badge>
                {document.is_starred && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
                {document.collection_name && (
                  <Badge variant="outline" className="text-xs">
                    <FolderOpen className="w-3 h-3 mr-1" />
                    {document.collection_name}
                  </Badge>
                )}
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
                  onClick={() => onPreview(document.id)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onEdit(document.id)}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onToggleStar(document.id)}
                >
                  {document.is_starred ? (
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
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Move className="w-4 h-4 mr-2" />
                  Move to Collection
                </Button>
                <div className="border-t my-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => onDelete(document.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Processing Progress */}
        {document.status === 'processing' && document.processing_progress !== undefined && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Processing</span>
              <span className="font-medium">{document.processing_progress}%</span>
            </div>
            <Progress value={document.processing_progress} className="h-2" />
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Zap className="w-3 h-3" />
              <span>Stage {Math.floor((document.processing_progress / 100) * PROCESSING_STAGES.length) + 1} of {PROCESSING_STAGES.length}</span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {document.status === 'error' && document.processing_error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Processing Error</span>
            </div>
            <p className="text-xs text-destructive/80 mt-1">{document.processing_error}</p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <p className="text-lg font-bold text-primary">
              {(typeof document.chunk_count === 'number' && document.chunk_count > 0) ? document.chunk_count : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Chunks</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">
              {(typeof document.metadata?.pages === 'number' && document.metadata.pages > 0) ? document.metadata.pages : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Pages</p>
          </div>
        </div>
        
        {/* Document Metadata */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              <span>{formatSizeMB(getDocumentSizeBytes(document))}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(document.upload_date)}</span>
            </div>
          </div>
          
          {document.metadata?.language && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>{document.metadata.language}</span>
              </div>
              {document.metadata.read_time && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{document.metadata.read_time} min read</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Tags */}
        {document.tags && document.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {document.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5">
                #{tag}
              </Badge>
            ))}
            {document.tags.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{document.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => onPreview(document.id)}
            disabled={document.status !== 'ready'}
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            disabled={document.status !== 'ready'}
          >
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function UploadProgressCard({ upload }: { upload: UploadProgress }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            {upload.status === 'uploading' ? (
              <Upload className="w-5 h-5 text-blue-600 animate-bounce" />
            ) : upload.status === 'processing' ? (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            ) : upload.status === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{upload.name}</p>
            <p className="text-xs text-muted-foreground">
              {upload.status === 'uploading' ? 'Uploading...' :
               upload.status === 'processing' ? 'Processing...' :
               upload.status === 'error' ? 'Upload failed' : 'Complete'}
            </p>
          </div>
        </div>
        
        {upload.status !== 'complete' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{upload.progress}%</span>
            </div>
            <Progress value={upload.progress} className="h-2" />
          </div>
        )}
        
        {upload.error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {upload.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [sortBy, setSortBy] = useState('upload_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Load documents
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const response = await fetch(`${API_BASE}/documents`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })

        if (response.ok) {
          const data = await response.json()
          const docs = Array.isArray(data)
            ? data
            : (data.documents || data.items || data.results || data.data || [])
          setDocuments(enrichDocuments(normalizeDocuments(docs)))
        } else {
          // Mock data for demonstration
          setDocuments(enrichDocuments([
            {
              id: 'doc-1',
              name: 'environmental-impact-2024.pdf',
              title: 'Environmental Impact Assessment Report 2024',
              upload_date: '2024-01-22T10:00:00Z',
              size: 2.4 * 1024 * 1024,
              type: 'pdf',
              status: 'ready',
              chunk_count: 156,
              collection_id: 'env-collection',
              collection_name: 'Environmental Studies',
              is_starred: true,
              tags: ['environmental', 'impact', '2024'],
              source: 'upload',
              metadata: {
                pages: 45,
                language: 'English',
                author: 'Environmental Consultants Inc.',
                created_date: '2024-01-15T00:00:00Z',
                word_count: 12450,
                read_time: 25
              }
            },
            {
              id: 'doc-2',
              name: 'site-assessment-north.pdf',
              title: 'North Site Environmental Assessment',
              upload_date: '2024-01-21T14:30:00Z',
              size: 1.8 * 1024 * 1024,
              type: 'pdf',
              status: 'processing',
              processing_progress: 65,
              chunk_count: 89,
              is_starred: false,
              tags: ['assessment', 'north-site', 'environmental'],
              source: 'upload',
              metadata: {
                pages: 32,
                language: 'English',
                word_count: 8750,
                read_time: 18
              }
            },
            {
              id: 'doc-3',
              name: 'remediation-plan-2024.docx',
              title: 'Comprehensive Remediation Plan 2024',
              upload_date: '2024-01-20T09:15:00Z',
              size: 1.2 * 1024 * 1024,
              type: 'docx',
              status: 'ready',
              chunk_count: 203,
              collection_id: 'tech-collection',
              collection_name: 'Technical Documentation',
              is_starred: false,
              tags: ['remediation', 'plan', 'technical'],
              source: 'upload',
              metadata: {
                pages: 67,
                language: 'English',
                author: 'Remediation Specialists LLC',
                created_date: '2024-01-18T00:00:00Z',
                word_count: 15680,
                read_time: 31
              }
            },
            {
              id: 'doc-4',
              name: 'quarterly-report-q4.pdf',
              title: 'Q4 2023 Environmental Quarterly Report',
              upload_date: '2024-01-19T16:45:00Z',
              size: 3.1 * 1024 * 1024,
              type: 'pdf',
              status: 'error',
              processing_error: 'Document appears to be corrupted or password protected. Please check the file and try again.',
              is_starred: false,
              tags: ['quarterly', 'q4', '2023'],
              source: 'upload',
              metadata: {
                pages: 78,
                language: 'English'
              }
            },
            {
              id: 'doc-5',
              name: 'legal-compliance-guide.pdf',
              title: 'Environmental Legal Compliance Guide',
              upload_date: '2024-01-18T11:20:00Z',
              size: 4.5 * 1024 * 1024,
              type: 'pdf',
              status: 'ready',
              chunk_count: 342,
              collection_id: 'legal-collection',
              collection_name: 'Legal & Compliance',
              is_starred: true,
              tags: ['legal', 'compliance', 'environmental'],
              source: 'url',
              source_url: 'https://example.com/legal-guide.pdf',
              metadata: {
                pages: 156,
                language: 'English',
                author: 'Legal Department',
                created_date: '2024-01-10T00:00:00Z',
                word_count: 28900,
                read_time: 58
              }
            },
            {
              id: 'doc-6',
              name: 'research-paper-contamination.pdf',
              title: 'Heavy Metal Contamination in Soil: A Research Study',
              upload_date: '2024-01-17T13:10:00Z',
              size: 2.7 * 1024 * 1024,
              type: 'pdf',
              status: 'ready',
              chunk_count: 187,
              collection_id: 'research-collection',
              collection_name: 'Research Papers',
              is_starred: false,
              tags: ['research', 'contamination', 'soil', 'heavy-metals'],
              source: 'integration',
              metadata: {
                pages: 23,
                language: 'English',
                author: 'Dr. Sarah Johnson, Dr. Michael Chen',
                created_date: '2023-12-15T00:00:00Z',
                word_count: 6750,
                read_time: 14
              }
            }
          ]))
        }
      } catch (error) {
        console.error('Failed to load documents:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDocuments()
  }, [])

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      if (searchQuery && !doc.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !doc.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false
      }
      if (filterStatus !== 'all' && doc.status !== filterStatus) return false
      if (filterType !== 'all' && doc.type !== filterType) return false
      return true
    })
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'size':
          aValue = a.size
          bValue = b.size
          break
        case 'upload_date':
          {
            const at = new Date(a.upload_date).getTime()
            const bt = new Date(b.upload_date).getTime()
            aValue = isNaN(at) ? 0 : at
            bValue = isNaN(bt) ? 0 : bt
          }
          break
        case 'chunks':
          aValue = a.chunk_count || 0
          bValue = b.chunk_count || 0
          break
        default:
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  // File type statistics
  const fileTypeStats = documents.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const uniqueFileTypes = Object.keys(fileTypeStats)

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach(file => {
      const uploadId = `upload-${Date.now()}-${Math.random()}`
      const newUpload: UploadProgress = {
        id: uploadId,
        name: file.name,
        progress: 0,
        status: 'uploading'
      }
      
      setUploadProgress(prev => [...prev, newUpload])

      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => prev.map(upload => {
          if (upload.id === uploadId) {
            const newProgress = Math.min(upload.progress + Math.random() * 15, 100)
            if (newProgress >= 100) {
              clearInterval(interval)
              return { ...upload, progress: 100, status: 'processing' }
            }
            return { ...upload, progress: newProgress }
          }
          return upload
        }))
      }, 500)

      // Simulate processing completion
      setTimeout(() => {
        setUploadProgress(prev => prev.filter(upload => upload.id !== uploadId))
        
        // Add new document
        const newDoc: Document = {
          id: `doc-${Date.now()}-${Math.random()}`,
          name: file.name,
          title: file.name.replace(/\.[^/.]+$/, ''),
          upload_date: new Date().toISOString(),
          size: file.size,
          type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
          status: 'processing',
          processing_progress: 0,
          is_starred: false,
          tags: [],
          source: 'upload'
        }
        
        setDocuments(prev => [newDoc, ...prev])
        
        // Simulate processing
        const processingInterval = setInterval(() => {
          setDocuments(prev => prev.map(doc => {
            if (doc.id === newDoc.id && doc.status === 'processing') {
              const newProgress = Math.min((doc.processing_progress || 0) + Math.random() * 10, 100)
              if (newProgress >= 100) {
                clearInterval(processingInterval)
                return {
                  ...doc,
                  status: 'ready',
                  processing_progress: 100,
                  chunk_count: Math.floor(Math.random() * 200) + 50,
                  metadata: {
                    pages: Math.floor(Math.random() * 50) + 10,
                    language: 'English',
                    word_count: Math.floor(Math.random() * 10000) + 5000,
                    read_time: Math.floor(Math.random() * 30) + 10
                  }
                }
              }
              return { ...doc, processing_progress: newProgress }
            }
            return doc
          }))
        }, 800)
      }, 3000)
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    handleFileUpload(files)
  }

  const handleDeleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id))
    setSelectedDocuments(prev => prev.filter(docId => docId !== id))
  }

  const handleToggleStar = (id: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, is_starred: !doc.is_starred } : doc
    ))
  }

  const handlePreview = async (id: string) => {
    const doc = documents.find(d => d.id === id)
    if (!doc) return
    setPreviewDocument(doc)
    setShowPreviewDialog(true)
    try {
      setPreviewLoading(true)
      // Attempt to enrich document details
      let baseDoc: any = { ...doc }
      try {
        const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })
        if (res.ok) {
          const detail = await res.json()
          const payload = detail?.document || detail
          if (payload && typeof payload === 'object') {
            const [norm] = enrichDocuments(normalizeDocuments([payload]))
            baseDoc = { ...baseDoc, ...norm }
            setPreviewDocument(prev => prev ? { ...prev, ...norm } : norm)
          }
        }
      } catch {}

      // Ensure we have raw text content for inline preview (Markdown/txt)
      const mergedUrl = getPreviewUrl(baseDoc)
      const nameLc = String(baseDoc.name || '').toLowerCase()
      const typeLc = String(baseDoc.type || '').toLowerCase()
      const likelyMd = nameLc.endsWith('.md') || typeLc === 'md' || typeLc === 'markdown' || (mergedUrl || '').toLowerCase().endsWith('.md')
      const alreadyHasText = !!getDocText(baseDoc)
      if (!alreadyHasText || likelyMd) {
        const raw = await tryFetchTextContent(id, mergedUrl)
        if (raw && raw.trim().length > 0) {
          setPreviewDocument(prev => prev ? { ...prev, content: raw } : { ...baseDoc, content: raw })
        }
      }
    } catch (e) {
      console.error('Failed to fetch document details', e)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedDocuments(prev => 
      prev.includes(id) 
        ? prev.filter(docId => docId !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([])
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id))
    }
  }

  const handleBulkDelete = () => {
    setDocuments(prev => prev.filter(doc => !selectedDocuments.includes(doc.id)))
    setSelectedDocuments([])
    setShowBulkActions(false)
  }

  const handleBulkStar = () => {
    setDocuments(prev => prev.map(doc => 
      selectedDocuments.includes(doc.id) ? { ...doc, is_starred: true } : doc
    ))
    setSelectedDocuments([])
    setShowBulkActions(false)
  }

  const stats = {
    total: documents.length,
    ready: documents.filter(d => d.status === 'ready').length,
    processing: documents.filter(d => d.status === 'processing').length,
    error: documents.filter(d => d.status === 'error').length,
    totalSize: documents.reduce((sum, doc) => sum + (Number.isFinite(doc.size) ? doc.size : 0), 0),
    totalChunks: documents.reduce((sum, doc) => sum + (typeof doc.chunk_count === 'number' ? doc.chunk_count : 0), 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Enhanced Header */}
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Document Library
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload, process, and manage your documents with advanced AI-powered features
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedDocuments.length > 0 && (
              <Popover open={showBulkActions} onOpenChange={setShowBulkActions}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {selectedDocuments.length} selected
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleBulkStar}
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Star All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <Move className="w-4 h-4 mr-2" />
                      Move to Collection
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download All
                    </Button>
                    <div className="border-t my-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button 
              onClick={() => setShowUploadDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Documents
            </Button>
          </div>
        </div>

        {/* Enhanced Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search documents by name, title, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4"
            />
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32">
                <File className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueFileTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.toUpperCase()} ({fileTypeStats[type]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upload_date">Upload Date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="size">File Size</SelectItem>
                <SelectItem value="chunks">Chunk Count</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </Button>

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

            {filteredDocuments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
              >
                {selectedDocuments.length === filteredDocuments.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.ready} ready, {stats.processing} processing
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Knowledge Chunks</p>
                  <p className="text-2xl font-bold">{stats.totalChunks}</p>
                  <p className="text-xs text-muted-foreground">AI-processed segments</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <HardDrive className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold">{(stats.totalSize / 1024 / 1024).toFixed(1)}MB</p>
                  <p className="text-xs text-muted-foreground">Across {uniqueFileTypes.length} file types</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processing Queue</p>
                  <p className="text-2xl font-bold">{stats.processing}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.error > 0 ? `${stats.error} errors` : 'All systems running'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Progress ({uploadProgress.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uploadProgress.map(upload => (
                  <UploadProgressCard key={upload.id} upload={upload} />
                ))}
              </div>
            </div>
          )}

          {/* Documents Grid/List */}
          <div 
            className={cn(
              "min-h-64",
              dragOver && "border-2 border-dashed border-primary bg-primary/5 rounded-lg",
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                : "space-y-4"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {dragOver && (
              <div className="col-span-full flex items-center justify-center h-64">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
                  <p className="text-lg font-medium text-primary">Drop your files here</p>
                  <p className="text-sm text-muted-foreground">Supports PDF, Word, images, and more</p>
                </div>
              </div>
            )}
            
            {!dragOver && filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onEdit={handleDeleteDocument}
                onDelete={handleDeleteDocument}
                onToggleStar={handleToggleStar}
                onPreview={handlePreview}
                isSelected={selectedDocuments.includes(document.id)}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>

          {!dragOver && filteredDocuments.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || filterStatus !== 'all' || filterType !== 'all' 
                  ? 'No documents found' 
                  : 'No documents yet'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by uploading your first documents to build your knowledge base.'}
              </p>
              {(!searchQuery && filterStatus === 'all' && filterType === 'all') && (
                <Button 
                  onClick={() => setShowUploadDialog(true)}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Your First Document
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Documents
            </DialogTitle>
            <DialogDescription>
              Add documents to your knowledge base. Supported formats: PDF, Word, PowerPoint, Text, Images, and more.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">File Upload</TabsTrigger>
              <TabsTrigger value="url">From URL</TabsTrigger>
              <TabsTrigger value="integration">Integrations</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Drag & drop files here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse your files</p>
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Browse Files
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
                accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif"
              />
              
              <div className="grid grid-cols-3 gap-4 text-center text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span>PDF, Word</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4 text-green-500" />
                  <span>Images</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <File className="w-4 h-4 text-blue-500" />
                  <span>Text, Markdown</span>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="url" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="url">Document URL</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/document.pdf"
                    className="mt-2"
                  />
                </div>
                <Button className="w-full">
                  <Link2 className="w-4 h-4 mr-2" />
                  Import from URL
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="integration" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Google Drive</p>
                      <p className="text-xs text-muted-foreground">Import from Drive</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Dropbox</p>
                      <p className="text-xs text-muted-foreground">Sync with Dropbox</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Database className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">SharePoint</p>
                      <p className="text-xs text-muted-foreground">Enterprise sync</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Globe className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Web Scraping</p>
                      <p className="text-xs text-muted-foreground">Extract from websites</p>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Document Preview
            </DialogTitle>
            <DialogDescription>
              Preview of the selected document. Supports PDF, images, Markdown, and text.
            </DialogDescription>
          </DialogHeader>
          
          {previewDocument && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              <div className="lg:col-span-2 space-y-4">
                {(() => {
                  const kind = canInlinePreview(previewDocument)
                  const url = getEmbeddableUrl(previewDocument)
                  if (kind === 'pdf' && url) {
                    return (
                      <div className="rounded-lg overflow-hidden border bg-background">
                        <iframe src={url} className="w-full h-[520px]" title="PDF Preview" />
                      </div>
                    )
                  }
                  if (kind === 'image' && url) {
                    return (
                      <div className="rounded-lg overflow-hidden border bg-background flex items-center justify-center">
                        <img src={url} alt={previewDocument.name} className="max-h-[520px] w-full object-contain" />
                      </div>
                    )
                  }
                  const text = getDocText(previewDocument)
                  const nameLc = String(previewDocument.name || '').toLowerCase()
                  const typeLc = String(previewDocument.type || '').toLowerCase()
                  const urlLc = (getPreviewUrl(previewDocument) || '').toLowerCase()
                  const isMd = nameLc.endsWith('.md') || typeLc === 'md' || typeLc === 'markdown' || urlLc.endsWith('.md')
                  if ((kind === 'text' && text) || (text && !kind)) {
                    if (isMd) {
                      return (
                        <div className="border rounded-lg p-4 max-h-[520px] overflow-y-auto bg-muted/30">
                          <h4 className="font-medium mb-3">Markdown Preview</h4>
                          <div className="text-sm leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {text.slice(0, 8000)}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div className="border rounded-lg p-4 max-h-[520px] overflow-y-auto bg-muted/30">
                        <h4 className="font-medium mb-2">Extracted Content</h4>
                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
{text.slice(0, 4000)}
                        </pre>
                      </div>
                    )
                  }
                  // Loading or final fallback
                  if (previewLoading) {
                    return (
                      <div className="bg-muted/50 rounded-lg p-8 text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        </div>
                        <p className="text-sm text-muted-foreground">Loading preview…</p>
                        {url && (
                          <div className="mt-4">
                            <a href={url} target="_blank" rel="noreferrer" className="text-primary text-sm underline">
                              Open in new tab
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div className="bg-muted/50 rounded-lg p-8 text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">Document preview not available</p>
                      {url && (
                        <div className="mt-4">
                          <a href={url} target="_blank" rel="noreferrer" className="text-primary text-sm underline">
                            Open preview in new tab
                          </a>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Preview actions (always show when URL is known) */}
                {(() => {
                  const url = getPreviewUrl(previewDocument)
                  if (!url) return null
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                        Open in new tab
                      </a>
                    </div>
                  )
                })()}
                
                {previewDocument.content && canInlinePreview(previewDocument) !== 'text' && (
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    <h4 className="font-medium mb-2">Extracted Content (excerpt)</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {previewDocument.content.slice(0, 1000)}...
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <Card className="p-4">
                  <h4 className="font-medium mb-3">Document Details</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{previewDocument.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Size</span>
                      <span>{formatSizeMB(getDocumentSizeBytes(previewDocument))}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="uppercase">{previewDocument.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={previewDocument.status === 'ready' ? 'default' : 'secondary'}>
                        {previewDocument.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chunks</span>
                      <span>{previewDocument.chunk_count || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uploaded</span>
                      <span>{formatDate(previewDocument.upload_date)}</span>
                    </div>
                  </div>
                </Card>
                
                {previewDocument.metadata && (
                  <Card className="p-4">
                    <h4 className="font-medium mb-3">Metadata</h4>
                    <div className="space-y-2 text-sm">
                      {previewDocument.metadata.pages && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Pages</span>
                          <span>{previewDocument.metadata.pages}</span>
                        </div>
                      )}
                      {previewDocument.metadata.language && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Language</span>
                          <span>{previewDocument.metadata.language}</span>
                        </div>
                      )}
                      {previewDocument.metadata.word_count && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Word Count</span>
                          <span>{previewDocument.metadata.word_count.toLocaleString()}</span>
                        </div>
                      )}
                      {previewDocument.metadata.read_time && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Read Time</span>
                          <span>{previewDocument.metadata.read_time} min</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => openDocumentInNewTab(previewDocument)}
                    disabled={!getPreviewUrl(previewDocument)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}