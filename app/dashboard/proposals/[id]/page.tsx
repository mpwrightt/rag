'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, Save, RefreshCw, Plus, Upload, FileSpreadsheet, FileText, Trash2 } from 'lucide-react'
import { RetrievalTimeline } from '@/components/retrieval-timeline'
import { Checkbox } from '@/components/ui/checkbox'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8058'

type Proposal = {
  id: string
  title: string
  client_fields?: Record<string, any>
  project_fields?: Record<string, any>
  status?: string
  metadata?: Record<string, any>
}

type CitationRef = {
  marker: number
  chunk_id: string
  document_source: string
  document_title?: string
  snippet?: string
  page?: number
}

type Section = {
  key: string
  title: string
  content?: string
  citations?: CitationRef[]
  generation_meta?: Record<string, any>
}

const DEFAULT_SECTIONS: Section[] = [
  { key: 'executive-summary', title: 'Executive Summary' },
  { key: 'scope-of-work', title: 'Scope of Work' },
  { key: 'methodology', title: 'Methodology' },
  { key: 'regulatory-compliance', title: 'Regulatory Compliance' },
  { key: 'deliverables', title: 'Deliverables' },
  { key: 'timeline', title: 'Timeline' },
  { key: 'pricing', title: 'Pricing' },
  { key: 'team-qualifications', title: 'Team & Qualifications' },
  { key: 'assumptions-exclusions', title: 'Assumptions & Exclusions' },
  { key: 'terms-conditions', title: 'Terms & Conditions' },
]

type PricingItem = {
  service: string
  unit_price: number
  quantity: number
  description?: string
  currency_symbol?: string
}

export default function ProposalEditorPage() {
  const params = useParams() as { id?: string }
  const proposalId = params?.id || ''

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS)
  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_SECTIONS[0].key)
  const [instructions, setInstructions] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const [liveText, setLiveText] = useState<string>('')
  const sessionRef = useRef<string | null>(null)
  const [liveRetrieval, setLiveRetrieval] = useState<any[]>([])
  const [validation, setValidation] = useState<{ status: 'ok' | 'warnings' | 'errors' | null, warnings: string[], errors: string[] } | null>(null)

  // Pricing state
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([])
  const [taxRate, setTaxRate] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Context scoping state
  const [contextMode, setContextMode] = useState<'all' | 'collections' | 'documents'>('all')
  const [collections, setCollections] = useState<Array<{ id: string, name: string }>>([])
  const [documents, setDocuments] = useState<Array<{ id: string, name?: string, title?: string }>>([])
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])

  // Upload state
  const [uploadingExample, setUploadingExample] = useState<boolean>(false)
  const [uploadingDraft, setUploadingDraft] = useState<boolean>(false)
  const [exampleSummary, setExampleSummary] = useState<string>("")
  const [draftSummary, setDraftSummary] = useState<string>("")

  // Regulatory sources scoped to this proposal
  type RegDoc = { id: string, title?: string, source?: string, created_at?: string }
  const [regDocs, setRegDocs] = useState<RegDoc[]>([])
  const [uploadingReg, setUploadingReg] = useState<boolean>(false)

  const selectedIndex = useMemo(() => sections.findIndex(s => s.key === selectedKey), [sections, selectedKey])
  const selectedSection = sections[selectedIndex] || sections[0]

  const loadProposal = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/proposals/${proposalId}`, { headers: { 'bypass-tunnel-reminder': 'true' } })
      if (res.ok) {
        const data = await res.json()
        setProposal(data)
      }
    } catch (e) {
      console.warn('Failed to load proposal', e)
    }
  }, [proposalId])

  useEffect(() => {
    if (proposalId) void loadProposal()
  }, [proposalId, loadProposal])

  // Load proposal-scoped regulatory docs
  const loadRegDocs = useCallback(async () => {
    if (!proposalId) return
    try {
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/regulatory`, { headers: { 'bypass-tunnel-reminder': 'true' } })
      if (res.ok) {
        const data = await res.json()
        setRegDocs(Array.isArray(data.documents) ? data.documents : [])
      }
    } catch {}
  }, [proposalId])

  useEffect(() => {
    if (proposalId) void loadRegDocs()
  }, [proposalId, loadRegDocs])

  // If regulatory docs exist and user hasn't chosen a scope yet, default to Documents
  useEffect(() => {
    if (regDocs.length > 0 && contextMode === 'all' && selectedDocuments.length === 0) {
      setContextMode('documents')
      setSelectedDocuments(regDocs.map(d => d.id).filter(Boolean))
    }
  }, [regDocs, contextMode, selectedDocuments.length])

  // Load collections/documents for scoping
  useEffect(() => {
    const loadContext = async () => {
      try {
        const cRes = await fetch(`${API_BASE}/collections`, { headers: { 'bypass-tunnel-reminder': 'true' } })
        if (cRes.ok) {
          const data = await cRes.json()
          const cols = data.collections || []
          setCollections(cols.map((c: any) => ({ id: c.id, name: c.name })))
          // Preselect Regulatory if exists
          const reg = cols.find((c: any) => (c.name || '').toLowerCase().includes('regulatory'))
          if (reg) setSelectedCollections([reg.id])
        }
      } catch {}
      try {
        const dRes = await fetch(`${API_BASE}/documents`, { headers: { 'bypass-tunnel-reminder': 'true' } })
        if (dRes.ok) {
          const data = await dRes.json()
          const docs = Array.isArray(data) ? data : (data.documents || [])
          setDocuments(docs.map((d: any) => ({ id: d.id || d.document_id, name: d.name || d.title, title: d.title })))
        }
      } catch {}
    }
    void loadContext()
  }, [])

  const setSectionContent = (key: string, content: string) => {
    setSections(prev => prev.map(s => s.key === key ? { ...s, content } : s))
  }

  const handleGenerate = async () => {
    if (!proposalId || !selectedSection) return
    setIsStreaming(true)
    setLiveText('')
    setLiveRetrieval([])

    try {
      const controller = new AbortController()
      const sessionId = crypto.randomUUID()
      sessionRef.current = sessionId
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({
          section_title: selectedSection.title,
          section_instructions: instructions || undefined,
          metadata: {
            force_guided: true,
            contextMode,
            selectedCollections: contextMode === 'collections' ? selectedCollections : [],
            selectedDocuments: contextMode === 'documents' ? selectedDocuments : [],
          },
          search_type: 'hybrid'
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
            if (data.type === 'text' || data.type === 'delta') {
              const delta: string = data.content || data.delta || ''
              setLiveText(prev => prev + delta)
              // IMPORTANT: append to the latest section state, not the snapshot
              setSections(prev => prev.map(s => s.key === selectedSection.key
                ? { ...s, content: (s.content || '') + delta }
                : s
              ))
            }
            // Retrieval and summary events
            if (data.type === 'retrieval') {
              const retrievalData = data.data || data
              const tool = retrievalData.tool
              const evt = retrievalData.event
              const isBasicToolEvent = retrievalData.type === 'retrieval' && (tool === 'graph_search' || tool === 'vector_search' || tool === 'hybrid_search')
              if (isBasicToolEvent) {
                const step = tool === 'graph_search' ? 'graph_search' : (tool === 'vector_search' ? 'vector_search' : 'hybrid_search')
                const status = evt === 'start' ? 'start' : (evt === 'end' ? 'complete' : 'update')
                const dataPayload = evt === 'results'
                  ? { results: Array.isArray(retrievalData.results) ? retrievalData.results.length : 0, sample: Array.isArray(retrievalData.results) ? retrievalData.results.slice(0, 2) : [] }
                  : (evt === 'end' ? { results: typeof retrievalData.count === 'number' ? retrievalData.count : undefined, elapsed_ms: typeof retrievalData.elapsed_ms === 'number' ? retrievalData.elapsed_ms : undefined } : (retrievalData.args || {}))
                setLiveRetrieval(prev => [...prev, { type: 'retrieval_step', step, status, data: dataPayload, timestamp: new Date().toISOString() }])
              } else {
                setLiveRetrieval(prev => [...prev, retrievalData])
              }
            } else if (data.type === 'retrieval_step' || data.type === 'retrieval_summary') {
              setLiveRetrieval(prev => [...prev, data])
            }
            // retrieval/tool events are available if we want to surface timeline later
          } catch (e) {
            console.error('Stream parse error', e)
          }
        }
      }
    } catch (e) {
      console.error('Generate stream failed', e)
    } finally {
      setIsStreaming(false)
    }
  }

  const handleSaveVersion = async () => {
    if (!proposalId) return
    try {
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({ html: null, sections, citations: [] })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Optionally show toast
    } catch (e) {
      console.error('Save version failed', e)
    }
  }

  const handleExport = async () => {
    // Ensure we saved a version first for latest export
    await handleSaveVersion()
    const url = `${API_BASE}/proposals/${proposalId}/export?download=false`
    // Open in a new tab; browsers will render the PDF inline
    window.open(url, '_blank')
  }

  const handleExportDocx = async () => {
    await handleSaveVersion()
    const url = `${API_BASE}/proposals/${proposalId}/export/docx?download=true`
    window.open(url, '_blank')
  }

  const handleValidate = async () => {
    if (!proposalId) return
    try {
      // validate latest, but ensure we just saved
      await handleSaveVersion()
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({})
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setValidation({ status: data.status, warnings: data.warnings || [], errors: data.errors || [] })
    } catch (e) {
      console.error('Validate failed', e)
      setValidation({ status: 'errors', warnings: [], errors: ['Validation request failed'] })
    }
  }

  // Pricing helpers
  const addPricingRow = () => {
    setPricingItems(prev => [...prev, { service: '', unit_price: 0, quantity: 1, currency_symbol: '$' }])
  }

  const updatePricingItem = (idx: number, field: keyof PricingItem, value: any) => {
    setPricingItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const removePricingRow = (idx: number) => {
    setPricingItems(prev => prev.filter((_, i) => i !== idx))
  }

  const parsePricingFile = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/pricing/parse`, {
      method: 'POST',
      body: form,
      headers: { 'bypass-tunnel-reminder': 'true' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const items = (data.items || []) as PricingItem[]
    setPricingItems(items)
  }

  const insertPricingTable = async () => {
    try {
      const res = await fetch(`${API_BASE}/pricing/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({ items: pricingItems, tax_rate_percent: taxRate, discount_amount: discount })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { html: string, totals: Record<string, number> }
      setSectionContent('pricing', data.html)
    } catch (e) {
      console.error('Insert pricing table failed', e)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4 p-4 sm:p-6">
      {/* Sidebar */}
      <div className="w-full lg:w-72 space-y-3 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {sections.map(s => (
              <button
                key={s.key}
                onClick={() => setSelectedKey(s.key)}
                className={`w-full text-left px-2 py-2 rounded-md border text-sm ${selectedKey === s.key ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50'}`}
              >
                {s.title}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Regulatory Sources (scoped to this proposal) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Regulatory Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <div className="font-medium">Upload Regulatory PDF/DOC</div>
              <Input multiple type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv,.tsv,.xlsx,.xls" onChange={async (e) => {
                const files = Array.from(e.target.files || [])
                if (files.length === 0) return
                setUploadingReg(true)
                try {
                  for (const f of files) {
                    const fd = new FormData(); fd.append('file', f)
                    // fast=true skips graph building to avoid timeouts
                    const res = await fetch(`${API_BASE}/proposals/${proposalId}/regulatory/upload?fast=1`, { method: 'POST', body: fd, headers: { 'bypass-tunnel-reminder': 'true' } })
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  }
                  // refresh list after batch
                  await loadRegDocs()
                  // reset input value so same files can be selected again if needed
                  e.currentTarget.value = ''
                } catch (err) {
                  // no-op; you can add toast here
                } finally {
                  setUploadingReg(false)
                }
              }}/>
              {uploadingReg && <div className="text-muted-foreground">Uploading regulatory files…</div>}
            </div>

            <div className="space-y-1">
              <div className="font-medium">Attached</div>
              {regDocs.length === 0 ? (
                <div className="text-muted-foreground">No regulatory sources uploaded yet.</div>
              ) : (
                <ul className="space-y-1">
                  {regDocs.map(d => (
                    <li key={d.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1">
                      <div className="truncate">
                        <div className="truncate font-medium">{d.title || d.source || d.id}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.created_at ? new Date(d.created_at).toLocaleString() : ''}</div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        try {
                          const res = await fetch(`${API_BASE}/proposals/${proposalId}/regulatory/${d.id}`, { method: 'DELETE', headers: { 'bypass-tunnel-reminder': 'true' } })
                          if (res.ok) await loadRegDocs()
                        } catch {}
                      }}>
                        <Trash2 className="w-4 h-4"/>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" variant="secondary" onClick={handleSaveVersion}>
              <Save className="w-4 h-4 mr-2"/>
              Save Version
            </Button>
            <Button className="w-full" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2"/>
              Export PDF
            </Button>
            <Button className="w-full" onClick={handleExportDocx}>
              <Download className="w-4 h-4 mr-2"/>
              Export DOCX
            </Button>
            <Button className="w-full" variant="outline" onClick={handleValidate}>
              Validate
            </Button>
          </CardContent>
        </Card>

        {/* Context Scoping */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {/* Mode Switch */}
            <div className="flex gap-2">
              <Button size="sm" variant={contextMode === 'all' ? 'default' : 'outline'} onClick={() => setContextMode('all')}>All</Button>
              <Button size="sm" variant={contextMode === 'collections' ? 'default' : 'outline'} onClick={() => setContextMode('collections')}>Collections</Button>
              <Button size="sm" variant={contextMode === 'documents' ? 'default' : 'outline'} onClick={() => setContextMode('documents')}>Documents</Button>
            </div>

            {/* Collections list */}
            {contextMode === 'collections' && (
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {collections.length === 0 ? (
                  <div className="text-muted-foreground">No collections found.</div>
                ) : collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedCollections.includes(c.id)}
                      onCheckedChange={(v) => {
                        setSelectedCollections(prev => v ? Array.from(new Set([...prev, c.id])) : prev.filter(id => id !== c.id))
                      }}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Documents list */}
            {contextMode === 'documents' && (
              <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {documents.length === 0 ? (
                  <div className="text-muted-foreground">No documents found.</div>
                ) : documents.map((d) => (
                  <label key={d.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedDocuments.includes(d.id)}
                      onCheckedChange={(v) => {
                        setSelectedDocuments(prev => v ? Array.from(new Set([...prev, d.id])) : prev.filter(id => id !== d.id))
                      }}
                    />
                    <span className="truncate">{d.title || d.name || d.id}</span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Example & Draft */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Example & Draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <div className="font-medium">Upload Example Proposal</div>
              <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return
                setUploadingExample(true); setExampleSummary("")
                try {
                  const fd = new FormData(); fd.append('file', f)
                  const res = await fetch(`${API_BASE}/proposals/${proposalId}/example/upload`, { method: 'POST', body: fd, headers: { 'bypass-tunnel-reminder': 'true' } })
                  if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  const data = await res.json()
                  const secCount = (data.analysis?.sections || []).length
                  setExampleSummary(`Analyzed: ${secCount} sections; style captured.`)
                } catch (err) {
                  setExampleSummary('Upload failed')
                } finally {
                  setUploadingExample(false)
                }
              }}/>
              {uploadingExample && <div className="text-muted-foreground">Analyzing example…</div>}
              {exampleSummary && <div className="text-muted-foreground">{exampleSummary}</div>}
            </div>

            <div className="space-y-1">
              <div className="font-medium">Upload Draft</div>
              <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return
                setUploadingDraft(true); setDraftSummary("")
                try {
                  const fd = new FormData(); fd.append('file', f)
                  const res = await fetch(`${API_BASE}/proposals/${proposalId}/draft/upload`, { method: 'POST', body: fd, headers: { 'bypass-tunnel-reminder': 'true' } })
                  if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  const data = await res.json()
                  setDraftSummary(`Draft text: ${data.characters || 0} chars captured.`)
                } catch (err) {
                  setDraftSummary('Upload failed')
                } finally {
                  setUploadingDraft(false)
                }
              }}/>
              {uploadingDraft && <div className="text-muted-foreground">Processing draft…</div>}
              {draftSummary && <div className="text-muted-foreground">{draftSummary}</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editor */}
      <div className="flex-1 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4"/>
              {selectedSection?.title || 'Section'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Instructions + Generate */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Section Instructions (optional)</label>
              <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} placeholder="Add guidance for generation (tone, points to include, constraints, etc.)"/>
              <div className="flex items-center gap-2">
                <Button onClick={handleGenerate} disabled={isStreaming}>
                  {isStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                  Generate
                </Button>
                {isStreaming && <Badge variant="secondary">Streaming…</Badge>}
              </div>
            </div>

            <Separator/>

            {/* Content editor or pricing editor */}
            {selectedSection?.key === 'pricing' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Pricing Table</div>
                  <div className="flex items-center gap-2">
                    <Input type="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={(e) => {
                      const f = e.target.files?.[0]; if (f) void parsePricingFile(f)
                    }}/>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2"/>
                      Import CSV/XLSX
                    </Button>
                    <Button variant="secondary" onClick={addPricingRow}>
                      <Plus className="w-4 h-4 mr-2"/>
                      Add Row
                    </Button>
                    <Button onClick={insertPricingTable}>
                      <FileSpreadsheet className="w-4 h-4 mr-2"/>
                      Insert Table
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-2">Service</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Unit Price</th>
                        <th className="text-left p-2">Description</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pricingItems.map((it, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2"><Input value={it.service} onChange={e => updatePricingItem(idx, 'service', e.target.value)}/></td>
                          <td className="p-2 text-right"><Input type="number" step="0.01" value={it.quantity} onChange={e => updatePricingItem(idx, 'quantity', parseFloat(e.target.value || '0'))}/></td>
                          <td className="p-2 text-right"><Input type="number" step="0.01" value={it.unit_price} onChange={e => updatePricingItem(idx, 'unit_price', parseFloat(e.target.value || '0'))}/></td>
                          <td className="p-2"><Input value={it.description || ''} onChange={e => updatePricingItem(idx, 'description', e.target.value)}/></td>
                          <td className="p-2 text-right"><Button variant="ghost" onClick={() => removePricingRow(idx)}>Remove</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm">Tax Rate (%)</label>
                    <Input type="number" step="0.01" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value || '0'))}/>
                  </div>
                  <div>
                    <label className="text-sm">Discount Amount</label>
                    <Input type="number" step="0.01" value={discount} onChange={e => setDiscount(parseFloat(e.target.value || '0'))}/>
                  </div>
                </div>

                {/* Show the section content (rendered HTML snippet) */}
                <div className="border rounded-md p-3 bg-white">
                  <div dangerouslySetInnerHTML={{ __html: selectedSection?.content || '<em>No pricing table inserted yet.</em>' }} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Section Content</label>
                <Textarea
                  rows={16}
                  value={selectedSection?.content || ''}
                  onChange={e => setSectionContent(selectedSection.key, e.target.value)}
                  placeholder={`Write or generate content for ${selectedSection?.title}`}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retrieval Timeline */}
      <div className="w-full lg:w-80 space-y-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Retrieval</CardTitle>
          </CardHeader>
          <CardContent>
            <RetrievalTimeline events={liveRetrieval} isLoading={isStreaming} />
          </CardContent>
        </Card>
        {validation && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                Status: <span className={`font-medium ${validation.status === 'errors' ? 'text-red-600' : validation.status === 'warnings' ? 'text-yellow-600' : 'text-green-600'}`}>{validation.status}</span>
              </div>
              {validation.warnings?.length > 0 && (
                <div>
                  <div className="font-medium text-yellow-700 mb-1">Warnings</div>
                  <ul className="list-disc ml-5 space-y-1">
                    {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
              {validation.errors?.length > 0 && (
                <div>
                  <div className="font-medium text-red-700 mb-1">Errors</div>
                  <ul className="list-disc ml-5 space-y-1">
                    {validation.errors.map((er, i) => <li key={i}>{er}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
