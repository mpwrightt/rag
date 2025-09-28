'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, Save, RefreshCw, Plus, Upload, FileSpreadsheet, FileText, Trash2, Eraser } from 'lucide-react'
import { RetrievalTimeline } from '@/components/retrieval-timeline'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

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

type ExampleOutlineEntry = {
  title: string
  preview: string
  word_count: number
  start_index?: number
}

type ExampleLetterStructure = {
  recipient_lines?: string[]
  re_line?: string
  salutation?: string
  intro_paragraph?: string
  intro_preview?: string
  first_section_title?: string
}

type ExampleTaskSection = {
  task_id: string
  title: string
  preview: string
  word_count: number
}

type ExampleAnalysis = {
  section_outline?: ExampleOutlineEntry[]
  letter_structure?: ExampleLetterStructure
  task_sections?: ExampleTaskSection[]
  aoc_actions?: string[]
}

const DEFAULT_SECTIONS: Section[] = [
  { key: 'cover-letter', title: 'Cover Letter' },
  { key: 'executive-summary', title: 'Executive Summary' },
  { key: 'scope-of-work', title: 'Scope of Work' },
  { key: 'schedule', title: 'Schedule & Milestones' },
  { key: 'aoc-roster', title: 'Areas of Concern (AOC)' },
  { key: 'pricing', title: 'Professional Fees & Pricing' },
  { key: 'assumptions-exclusions', title: 'Assumptions & Exclusions' },
  { key: 'terms-conditions', title: 'Terms & Conditions' },
  { key: 'proposal-acceptance', title: 'Proposal Acceptance' },
  { key: 'appendices', title: 'Appendices & Supporting Documents' },
]

type PricingItem = {
  service: string
  unit_price: number
  quantity: number
  description?: string
  currency_symbol?: string
}

type AocItem = {
  id: string
  code: string // e.g., AOC-3 or AOC 8
  title: string // short title
  details: string // full paragraph details
  output?: string // generated content for this AOC
  status?: 'idle' | 'generating' | 'done' | 'error'
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
  const [latestVersionId, setLatestVersionId] = useState<string | null>(null)

  // Pricing state
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([])
  const [taxRate, setTaxRate] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // AOC state
  const [aocItems, setAocItems] = useState<AocItem[]>([])
  const [aocStreamingId, setAocStreamingId] = useState<string | null>(null)
  const aocRef = useRef<AocItem[]>([])
  useEffect(() => { aocRef.current = aocItems }, [aocItems])
  // Backfill IDs for any pre-existing rows without an id
  useEffect(() => {
    if (aocItems.some(it => !it.id)) {
      setAocItems(prev => prev.map(it => it.id ? it : { ...it, id: crypto.randomUUID() }))
    }
  }, [aocItems])

  // Title quality check: at least 2 alpha words after trimming punctuation/parentheses
  function isTitleQuality(s: string): boolean {
    let t = (s || '').trim()
    if (!t) return false
    t = t.replace(/^[()\[\]\s]+|[()\[\]\s]+$/g, '').trim()
    if (t.length < 3) return false
    const words = t.split(/\s+/).filter(w => /[A-Za-z]/.test(w))
    return words.length >= 2
  }

  // Clean up AOC titles: remove dot leaders/ellipses and trailing punctuation/spaces
  const sanitizeAocTitle = (s: string) => {
    const original = (s || '').trim()
    let t = original.replace(/\s+/g, ' ').trim()
    // Remove dot leaders (contiguous or spaced) and bullet-like dots anywhere
    t = t.replace(/(?:\s*[\.\u2024\u2027\u2219\u00B7•\u2022]\s*){3,}/g, '')
    // Remove long runs of connector punctuation near end or anywhere
    t = t.replace(/[\.\u2024\u2027\u2219\u00B7•\u2022_\-–—]{4,}$/g, '')
    t = t.replace(/[\.\u2024\u2027\u2219\u00B7•\u2022_\-–—]{4,}/g, ' ')
    // Special-case stray trailing "- Back-" fragments from line wraps
    t = t.replace(/\s*[-–—]\s*Back\s*[-–—]?\s*$/i, '')
    // Collapse multiple spaces again after removals
    t = t.replace(/\s{2,}/g, ' ').trim()
    // Remove trailing punctuation and spaces
    t = t.replace(/[\s\.\-–—:;,]+$/g, '').trim()
    // Remove leading punctuation
    t = t.replace(/^[\s\.\-–—:;,]+/g, '').trim()
    // If we over-cleaned to empty, fall back to original trimmed (without spaced dot leaders)
    if (!t) t = original.replace(/(?:\s*[\.\u2024\u2027\u2219\u00B7•\u2022]\s*){3,}/g, '').trim()
    return t
  }

  // Infer a reasonable short title from details text when tags are missing
  const inferTitleFromDetails = (details: string, code?: string) => {
    let text = (details || '').trim()
    if (!text) return ''
    const firstLine = text.split(/\n/)[0] || ''
    let line = firstLine
    if (code) {
      const codeEsc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      line = line.replace(new RegExp(`^\n?\s*(?:${codeEsc}|AOC\s*-?\s*[0-9]+[A-Za-z]?)\s*[-–:]+\s*`, 'i'), '')
    }
    // Take up to the first period or a max length and limit words
    let seg = line.split(/[\.]/)[0]
    if (!seg || seg.trim().length < 3) seg = line.slice(0, 80)
    const words = seg.trim().split(/\s+/).slice(0, 10)
    const candidate = words.join(' ')
    return sanitizeAocTitle(candidate)
  }
  const aocDoneCount = useMemo(() => aocItems.filter(it => (it.status === 'done') || ((it.output || '').trim().length > 0)).length, [aocItems])
  const aocBatchRunningRef = useRef<boolean>(false)
  const aocQueueRef = useRef<string[]>([])
  const [aocDiscovering, setAocDiscovering] = useState<boolean>(false)

  const runAocQueue = async () => {
    if (aocBatchRunningRef.current !== true) return
    while (aocQueueRef.current.length > 0) {
      const rowId = aocQueueRef.current.shift() as string
      console.debug('[AOC] Start row', rowId, 'remaining:', aocQueueRef.current.length)
      await generateAocRowById(rowId)
      await new Promise(r => setTimeout(r, 0))
    }
    aocBatchRunningRef.current = false
    console.debug('[AOC] Batch complete')
  }

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
  const [collapseReg, setCollapseReg] = useState<boolean>(true)
  const [collapseContext, setCollapseContext] = useState<boolean>(true)

  const selectedIndex = useMemo(() => sections.findIndex(s => s.key === selectedKey), [sections, selectedKey])
  const selectedSection = sections[selectedIndex] || sections[0]

  // Example analysis metadata
  const [exampleAnalysis, setExampleAnalysis] = useState<ExampleAnalysis | null>(null)

  const findOutlinePreview = useCallback((matchers: Array<string | RegExp>) => {
    if (!exampleAnalysis?.section_outline) return ''
    const lower = exampleAnalysis.section_outline.map(entry => ({
      title: (entry.title || '').toLowerCase(),
      preview: entry.preview || '',
      raw: entry,
    }))
    for (const matcher of matchers) {
      const found = lower.find(entry => typeof matcher === 'string'
        ? entry.title.includes(matcher.toLowerCase())
        : matcher.test(entry.title))
      if (found) return found.preview
    }
    return ''
  }, [exampleAnalysis])

  const buildSectionAgentInstructions = useCallback((sectionKey: string) => {
    const lines: string[] = []
    const outlinePreview = (matchers: Array<string | RegExp>) => {
      const text = findOutlinePreview(matchers)
      return text ? text : ''
    }
    switch (sectionKey) {
      case 'cover-letter': {
        lines.push('Draft a formal cover letter that mirrors the example template: start with the recipient block, include a “RE:” subject line, add a salutation, provide 2-3 concise paragraphs summarizing the engagement, and close with a professional signature block.')
        const letter = exampleAnalysis?.letter_structure
        if (letter?.re_line) {
          lines.push(`Model the “RE:” line on the example format: ${letter.re_line}. Update names, addresses, proposal number, and site details to match the current project.`)
        }
        if (letter?.intro_preview) {
          lines.push(`The intro paragraph should touch on scope, NJDEP/SRRA obligations, and next steps—similar in tone to: ${letter.intro_preview}`)
        }
        lines.push('Keep the letter under ~300 words with short paragraphs and avoid generic placeholders like “<Your Name>”. Use real proposal metadata when available.')
        break
      }
      case 'executive-summary': {
        lines.push('Write an executive summary that hits the same beats as the example: project purpose, regulatory drivers, investigation scope, and high-level budget/next steps.')
        const preview = outlinePreview(['executive summary'])
        if (preview) {
          lines.push(`Anchor the narrative around key talking points reflected in the example: ${preview}`)
        }
        lines.push('Use 3-5 short paragraphs or bullet clusters; clearly state the value, regulatory alignment, and anticipated deliverables.')
        break
      }
      case 'scope-of-work': {
        lines.push('Lay out the full scope of work in the same structure as the example proposal. Introduce the scope, then break it into clearly labeled Task subsections.')
        if (exampleAnalysis?.task_sections?.length) {
          const bullets = exampleAnalysis.task_sections
            .map(task => `Task ${task.task_id}: ${task.title} — ${task.preview}`.replace(/\s+/g, ' ').trim())
          lines.push('Mirror these task themes from the example (update specifics to this project):')
          bullets.slice(0, 4).forEach(b => lines.push(b))
        } else {
          lines.push('Include subsections for Task 1 (Administrative & Planning), Task 2 (Field Activities), Task 3 (Site Investigation Report), and Task 4 (Project Management). For each task, provide purpose, key actions, and deliverables.')
        }
        const aocActions = exampleAnalysis?.aoc_actions || []
        if (aocActions.length) {
          lines.push('In Task 2 (Field Activities), explicitly enumerate the planned actions for each AOC, similar to the example:')
          aocActions.slice(0, 8).forEach((action: string) => lines.push(action))
        }
        lines.push('Use concise paragraphs with occasional bullet lists; ensure each AOC includes drilling, sampling, analyses, and cross-links to related tasks when applicable (e.g., shared monitoring wells).')
        break
      }
      case 'schedule': {
        lines.push('Produce a schedule/milestones section structured like the example: list the main tasks or phases with start/end timing and dependencies.')
        const preview = outlinePreview(['schedule', 'timeline'])
        if (preview) {
          lines.push(`Reference the example cadence: ${preview}`)
        }
        lines.push('Present the schedule in a readable table or bullet list with dates or relative durations, and highlight critical deliverables (e.g., SIR submission).')
        break
      }
      case 'pricing': {
        lines.push('Summarize professional fees the same way the example does: break costs down by task, include totals, and mention reimbursable expenses or hourly rates as needed.')
        const preview = outlinePreview(['professional fees', 'cost summary'])
        if (preview) {
          lines.push(`Keep the tone aligned with the example’s pricing discussion: ${preview}`)
        }
        lines.push('Produce a concise narrative plus a markdown table for Task costs (Task, description, lump sum) followed by any hourly rate table or reimbursable expenses note.')
        break
      }
      case 'assumptions-exclusions': {
        lines.push('List assumptions and exclusions exactly like the example: short bullet points grouped logically (permitting, access, utilities, change orders, analytical scope, etc.).')
        const preview = outlinePreview(['assumptions', 'assumptions & exclusions'])
        if (preview) {
          lines.push(`Use the example’s tone and level of detail: ${preview}`)
        }
        lines.push('Ensure each assumption/exclusion is a single bullet sentence; avoid paragraphs.')
        break
      }
      case 'terms-conditions': {
        lines.push('Document the proposal terms consistent with the example: validity period, payment terms, limitation of liability, insurance, governing law, etc.')
        lines.push('Keep the section concise (bullets or short paragraphs) and professional in tone.')
        break
      }
      case 'proposal-acceptance': {
        lines.push('Provide a proposal acceptance section matching the example: include acceptance statement, signature blocks for the client and your firm, printed name/title lines, and a date field.')
        lines.push('Add any instructions for returning the signed agreement or issuing a purchase order, as in the example.')
        break
      }
      case 'appendices': {
        lines.push('List appendices and supporting documents (e.g., Cost Summary, Historical Operations, Certifications) as the example does.')
        lines.push('Include brief descriptions and note that full documents are attached separately. Use bullet list format.')
        break
      }
      default:
        return ''
    }
    return lines.join('\n')
  }, [exampleAnalysis, findOutlinePreview])

  const sectionAgentInstructions = useMemo(() => buildSectionAgentInstructions(selectedSection?.key || ''), [selectedSection?.key, buildSectionAgentInstructions])

  useEffect(() => {
    if (!exampleAnalysis) return
    setSections(prev => prev.map(section => {
      const existing = (section.content || '').trim()
      if (existing.length > 20) return section
      const instructions = buildSectionAgentInstructions(section.key)
      const normalizedTitle = section.title.toLowerCase()
      const exampleSection = exampleAnalysis.section_outline?.find(entry => (entry.title || '').toLowerCase().includes(normalizedTitle))
      let previewText = exampleSection?.preview
      if (!previewText && section.key === 'appendices') {
        const appendixEntries = exampleAnalysis.section_outline?.filter(entry => (entry.title || '').toLowerCase().startsWith('appendix')) || []
        if (appendixEntries.length > 0) {
          previewText = appendixEntries.map(entry => `${entry.title}: ${(entry.preview || '').trim()}`).join('\n')
        }
      }
      if (!previewText && section.key === 'scope-of-work' && (exampleAnalysis.aoc_actions?.length ?? 0) > 0) {
        previewText = (exampleAnalysis.aoc_actions || []).join('\n')
      }
      if (!instructions && !previewText) return section
      const seedLines: string[] = []
      if (instructions) {
        seedLines.push('### Guidance from example template')
        seedLines.push(instructions)
      }
      if (previewText) {
        seedLines.push('### Example preview')
        seedLines.push(previewText)
      }
      return { ...section, content: seedLines.join('\n\n').trim() }
    }))
  }, [exampleAnalysis, buildSectionAgentInstructions])

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

  // AOC helpers (component scope)
  const addAocRow = () => setAocItems(prev => [...prev, { id: crypto.randomUUID(), code: '', title: '', details: '' }])
  const updateAocItemById = (rowId: string, field: keyof AocItem, value: any) => {
    setAocItems(prev => prev.map(it => {
      if (it.id !== rowId) return it
      const v = field === 'title' ? sanitizeAocTitle(String(value || '')) : value
      return { ...it, [field]: v }
    }))
  }
  const removeAocRowById = (rowId: string) => setAocItems(prev => prev.filter(it => it.id !== rowId))
  const buildAocRosterHtml = (items: AocItem[]) => {
    const header = '<div><strong>Area of Concern (AOC) Roster:</strong></div>'
    const list = items
      .filter(it => (it.code || it.title || it.details || it.output))
      .map(it => {
        const codeText = (it.code || '').trim()
        const titleText = (it.title || '').trim()
        const head = [codeText, titleText].filter(Boolean).join(' – ')
        const bodySrc = (it.details || it.output || '')
        const bodyHtml = (bodySrc || '')
          .replace(/\n\n+/g, '</p><p>')
          .replace(/\n/g, '<br/>')
        return `<li><strong>${head}</strong>${bodySrc ? ` – ${bodyHtml}` : ''}</li>`
      })
      .join('')
    return `${header}<ul>${list}</ul>`
  }

  // Normalize AOC code strings like "AOC 3" => "AOC-3"
  const normalizeAocCode = (s: string) => (s || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^AOC(\-)?/, 'AOC-')

  // Remove any leading heading like "AOC-3 – Title:" from the generated body so Details stays details-only
  const sanitizeAocBody = (text: string, code?: string, title?: string) => {
    let t = (text || '').trim()
    // If a heading like "AOC 3 - Title" appears within the opening lines, strip it and any trailing newline
    t = t.replace(/^\s*(?:AOC\s*-?\s*\d+[A-Za-z]?\s*(?:[-–:]+\s*[^\n]*)?)\s*\n+/i, '')
    if (code) {
      const codeEsc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      t = t.replace(new RegExp(`^\s*(?:${codeEsc})\s*(?:[-–:]+\s*[^\n]*)?\s*\n+`, 'i'), '')
    }
    if (title) {
      const titleEsc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      t = t.replace(new RegExp(`^\s*(?:${titleEsc})\s*[:–-]?\s*\n+`, 'i'), '')
    }
    return t
  }

  // Parse structured output when the model follows the XML-like contract
  const extractTag = (text: string, tag: string) => {
    const re = new RegExp(`<${tag}>[\\s\\S]*?<\/${tag}>`, 'i')
    const m = text.match(re)
    if (!m) return ''
    return m[0]
      .replace(new RegExp(`^<${tag}>\\s*`, 'i'), '')
      .replace(new RegExp(`\\s*<\/${tag}>$`, 'i'), '')
      .trim()
  }
  const parseAocStructured = (text: string): { code?: string, title?: string, details?: string } => {
    const code = extractTag(text, 'AOC_CODE')
    const title = extractTag(text, 'TITLE')
    const details = extractTag(text, 'DETAILS')
    const result: { code?: string, title?: string, details?: string } = {}
    if (code) result.code = code
    if (title) result.title = title
    if (details) result.details = details
    return result
  }

  // Try to infer code/title near the start of the generated text
  const inferCodeTitleFromText = (text: string): { code?: string, title?: string } => {
    const segment = (text || '').slice(0, 400).replace(/\n/g, ' ')
    let m = segment.match(/\bAOC\s*-?\s*([0-9]+[A-Za-z]?)\b\s*(?:[-–:]\s*([^\.;:\n]{2,120}))?/i)
    if (m) {
      const num = m[1]
      const code = `AOC-${String(num).toUpperCase()}`
      const title = (m[2] || '').trim()
      return { code, title }
    }
    // Fallback: first line pattern
    const firstLine = (text || '').split(/\n/)[0] || ''
    const m2 = firstLine.match(/^\s*(AOC\s*-?\s*([0-9]+[A-Za-z]?))\s*(?:[-–:]+\s*(.+))?$/i)
    if (m2) {
      const code = m2[1].replace(/\s+/g, '').toUpperCase().replace('AOC', 'AOC-').replace(/AOC-\-?/, 'AOC-')
      const title = (m2[3] || '').trim()
      return { code, title }
    }
    return {}
  }
  const insertAocRoster = () => {
    const html = buildAocRosterHtml(aocItems)
    setSectionContent('aoc-roster', html)
  }

  // Clean all current titles in-place (useful for drafts with dot leaders)
  const cleanAllAocTitles = () => {
    setAocItems(prev => {
      const next = prev.map(it => ({ ...it, title: sanitizeAocTitle(it.title) }))
      aocRef.current = next
      return next
    })
  }

  // Discover AOCs from project context and create rows (no auto-run)
  const discoverAocs = async () => {
    if (!proposalId) return
    if (aocStreamingId !== null || aocDiscovering) return
    setAocDiscovering(true)
    try {
      const tId = toast.loading('Finding AOCs…')
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/aocs/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({
          contextMode,
          selectedCollections: contextMode === 'collections' ? selectedCollections : [],
          selectedDocuments: contextMode === 'documents' ? selectedDocuments : [],
        })
      })
      if (!res.ok) {
        toast.dismiss(tId)
        toast.error(`AOC discovery failed (HTTP ${res.status}). Make sure the backend is running on ${API_BASE} and updated.`)
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      const found = Array.isArray(data?.aocs) ? data.aocs as Array<{ code: string, title?: string }> : []
      if (found.length > 0) {
        setAocItems(prev => {
          const byNorm = new Map(prev.map(it => [normalizeAocCode(it.code), it]))
          const next: AocItem[] = []
          for (const f of found) {
            const norm = normalizeAocCode(f.code)
            const existing = byNorm.get(norm)
            const proposed = sanitizeAocTitle(f.title || '')
            const quality = isTitleQuality(proposed)
            if (existing) {
              const existingClean = sanitizeAocTitle(existing.title || '')
              const existingOK = isTitleQuality(existingClean)
              const title = quality ? proposed : (existingOK ? existingClean : '')
              next.push({ ...existing, code: norm, title, status: 'idle' })
            } else {
              next.push({ id: crypto.randomUUID(), code: norm, title: quality ? proposed : '', details: '', output: '', status: 'idle' })
            }
          }
          aocRef.current = next
          return next
        })
        toast.dismiss()
        toast.success(`Found ${found.length} AOC${found.length === 1 ? '' : 's'}`)
      } else {
        toast.dismiss()
        toast.message('No AOCs found', { description: 'Ensure your regulatory/draft docs mention AOC codes (e.g., AOC-3). Also confirm the backend was restarted.' })
      }
    } catch (e) {
      console.error('AOC discovery failed', e)
      toast.error('AOC discovery failed. See console for details.')
    } finally {
      setAocDiscovering(false)
    }
  }

  // Queue up all pending AOCs; effect above will process each
  const beginGenerateAllAocs = () => {
    if (aocBatchRunningRef.current) return
    aocBatchRunningRef.current = true
    const isDone = (it: AocItem) => it.status === 'done' || ((it.output || '').trim().length > 0)
    const snapshot = aocRef.current
    const queue = snapshot.filter(it => it && !isDone(it)).map(it => it.id)
    const uniqueQueue = Array.from(new Set(queue))
    if (uniqueQueue.length === 0) { aocBatchRunningRef.current = false; return }
    aocQueueRef.current = uniqueQueue
    console.debug('[AOC] Begin batch. Queue:', uniqueQueue)
    void runAocQueue()
  }

  // Discover AOCs first, then run Generate All
  const discoverAocsThenGenerateAll = async () => {
    try {
      await discoverAocs()
    } catch {}
    beginGenerateAllAocs()
  }

  const generateAocRowById = async (rowId: string) => {
    if (aocStreamingId !== null) return // prevent re-entrancy while another row is streaming
    if (!proposalId) return
    const idx = aocRef.current.findIndex(it => it.id === rowId)
    if (idx < 0) return
    const item = aocRef.current[idx]
    if (!item) return
    setAocStreamingId(rowId)
    // reset output but preserve any existing title; generation/fallback will overwrite if they produce one
    setAocItems(prev => {
      const next = prev.map((it, i) => i === idx ? { ...it, output: '', details: '', status: 'generating' as const } : it)
      aocRef.current = next
      return next
    })
    try {
      const controller = new AbortController()
      const sessionId = crypto.randomUUID()
      sessionRef.current = sessionId
      const codeNorm = normalizeAocCode(item.code || '')
      const secTitle = `AOC ${codeNorm || item.code || ''} ${item.title || ''}`.trim()
      const instructionsAOC = `${instructions ? instructions + '\n\n' : ''}Focus strictly on this single Area of Concern. Target AOC code: ${codeNorm}. Only include information for this code; ignore other AOC codes. If a source mentions multiple AOCs, filter to ${codeNorm} only.\nRow Identity: ${item.id}.\n\nOutput format (STRICT):\nReturn ONLY the following XML-like tags in this exact order and nothing else outside the tags:\n<AOC_CODE>{the AOC code, e.g., AOC-3}</AOC_CODE>\n<TITLE>{a concise 3-10 word title}</TITLE>\n<DETAILS>\n{the narrative body for this AOC, multiple paragraphs allowed}\n</DETAILS>\n\nAOC Details (context for drafting; may be empty):\n${item.details || ''}`
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({
          section_title: secTitle || 'Area of Concern',
          section_key: 'aoc-roster',
          section_instructions: instructionsAOC,
          metadata: {
            force_guided: true,
            contextMode,
            selectedCollections: contextMode === 'collections' ? selectedCollections : [],
            selectedDocuments: contextMode === 'documents' ? selectedDocuments : [],
            aoc: { code: item.code, title: item.title, row_id: item.id }
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
              setAocItems(prev => {
                const next = prev.map((it, i) => i === idx ? { ...it, details: (it.details || '') + delta, output: (it.output || '') + delta } : it)
                aocRef.current = next
                return next
              })
            }
            if (data.type === 'retrieval' || data.type === 'retrieval_step' || data.type === 'retrieval_summary') {
              setLiveRetrieval(prev => [...prev, data.type === 'retrieval' ? (data.data || data) : data])
            }
          } catch (e) {
            console.error('AOC row stream parse error', e)
          }
        }
      }
      // After streaming, compile section content from all rows for clear separation
      // Use functional update to ensure latest state and populate code/title + clean details
      const currentAfterStream = aocRef.current[idx] || aocItems[idx]
      const basis0 = currentAfterStream?.details || currentAfterStream?.output || ''
      const parsed0 = parseAocStructured(basis0)
      const inferred0 = inferCodeTitleFromText(basis0)
      const inferredFromDetails0 = inferTitleFromDetails(parsed0.details || basis0, currentAfterStream?.code)
      // Require an explicit <TITLE> for high confidence; otherwise run fallback
      const needTitleFallback = !(parsed0.title && sanitizeAocTitle(parsed0.title).length >= 3)

      setAocItems(prev => {
        const current = prev[idx]
        const basis = current?.details || current?.output || ''
        // Prefer structured tags if present; otherwise fall back to inference
        const parsed = parseAocStructured(basis)
        const inferred = inferCodeTitleFromText(basis)
        const newCode = (current?.code && current.code.trim().length > 0) ? current.code : (parsed.code || inferred.code || '')
        const fromDetails = inferTitleFromDetails(parsed.details || basis, newCode)
        // Prefer parsed or inferred; keep an existing quality title; lastly use details-derived
        const candidate = sanitizeAocTitle(parsed.title || inferred.title || fromDetails || '')
        const keepExisting = isTitleQuality(current?.title || '')
        const useCandidate = isTitleQuality(candidate)
        const newTitle = keepExisting ? current!.title : (useCandidate ? candidate : (current?.title || ''))
        const rawDetails = parsed.details && parsed.details.trim().length > 0 ? parsed.details : basis
        const cleaned = sanitizeAocBody(rawDetails, newCode, newTitle)
        const updated = prev.map((it, i) => i === idx ? { ...it, code: newCode, title: sanitizeAocTitle(newTitle), details: cleaned, output: basis, status: 'done' as const } : it)
        const html = buildAocRosterHtml(updated)
        setSectionContent('aoc-roster', html)
        aocRef.current = updated
        return updated
      })

      // Fallback: if titles were missing by heuristics OR after post-update the title is still missing/too short
      const postRow = aocRef.current[idx]
      const missingOrShort = !postRow?.title || postRow.title.trim().length < 3
      if (needTitleFallback || missingOrShort) {
        let post = aocRef.current[idx]
        try {
          const titleCtrl = new AbortController()
          const titlePrompt = `From these AOC details, produce a concise 3–8 word title. Return ONLY the following tag and nothing else:\n<TITLE>{title}</TITLE>\n\n<DETAILS>\n${post?.details || ''}\n</DETAILS>`
          const tr = await fetch(`${API_BASE}/proposals/${proposalId}/generate/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
            body: JSON.stringify({
              section_title: 'AOC Title',
              section_key: 'aoc-roster',
              section_instructions: titlePrompt,
              metadata: {
                force_guided: true,
                contextMode,
                selectedCollections: contextMode === 'collections' ? selectedCollections : [],
                selectedDocuments: contextMode === 'documents' ? selectedDocuments : [],
                aoc: { row_id: post?.id, code: post?.code }
              },
              search_type: 'hybrid'
            }),
            signal: titleCtrl.signal
          })
          if (tr.ok && tr.body) {
            const reader2 = tr.body.getReader()
            const decoder2 = new TextDecoder()
            let buf2 = ''
            let textAcc = ''
            while (true) {
              const { value: v2, done: d2 } = await reader2.read()
              if (d2) break
              buf2 += decoder2.decode(v2, { stream: true })
              const evts = buf2.split('\n\n')
              buf2 = evts.pop() || ''
              for (const ev of evts) {
                if (!ev.startsWith('data:')) continue
                const js = ev.slice(5).trim()
                if (!js) continue
                try {
                  const dj = JSON.parse(js)
                  if (dj.type === 'text' || dj.type === 'delta') {
                    textAcc += (dj.content || dj.delta || '')
                  }
                } catch {}
              }
            }
            // Parse accumulated deltas for TITLE tag; if absent, synthesize
            let safeTitle = (extractTag(textAcc, 'TITLE') || '').trim()
            if (!safeTitle) {
              const raw = (post?.details || '').trim()
              const firstSentence = (raw.split(/[\.\n]/)[0] || '').trim()
              safeTitle = firstSentence.split(/\s+/).slice(0, 8).join(' ')
              if (safeTitle) safeTitle = safeTitle.charAt(0).toUpperCase() + safeTitle.slice(1)
            }
            if (safeTitle && safeTitle.length > 0) {
              setAocItems(prev => {
                const updated = prev.map((it, i) => i === idx ? { ...it, title: sanitizeAocTitle(safeTitle) } : it)
                const html = buildAocRosterHtml(updated)
                setSectionContent('aoc-roster', html)
                aocRef.current = updated
                return updated
              })
            }
          }
        } catch (err) {
          console.warn('AOC title fallback failed', err)
        }
      }
    } catch (e) {
      console.error('Generate AOC row failed', e)
      setAocItems(prev => {
        const next = prev.map((it, i) => i === idx ? { ...it, status: 'error' as const } : it)
        aocRef.current = next
        return next
      })
    } finally {
      setAocStreamingId(null)
    }
  }

  const handleGenerate = async () => {
    if (!proposalId || !selectedSection) return
    // Special-case AOC: run sequential per-AOC generation instead of a single summary
    if (selectedSection.key === 'aoc-roster') {
      setIsStreaming(true)
      setLiveRetrieval([])
      try {
        await discoverAocsThenGenerateAll()
      } catch (e) {
        console.error('AOC Generate All failed', e)
      } finally {
        setIsStreaming(false)
      }
      return
    }

    setIsStreaming(true)
    setLiveText('')
    setLiveRetrieval([])

    try {
      const baseInstructions = buildSectionAgentInstructions(selectedSection.key)
      const mergedInstructions = [baseInstructions, instructions].filter(Boolean).join('\n\n').trim()
      const controller = new AbortController()
      const sessionId = crypto.randomUUID()
      sessionRef.current = sessionId
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({
          section_title: selectedSection.title,
          section_key: selectedSection.key,
          section_instructions: mergedInstructions || undefined,
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
      const data = await res.json()
      setLatestVersionId(data?.id || null)
      // Optionally show toast
    } catch (e) {
      console.error('Save version failed', e)
    }
  }

  // Feedback helpers (thumbs up/down per section)
  const ensureVersionAndSendFeedback = async (key: string, rating: 1 | -1) => {
    try {
      let versionId = latestVersionId
      if (!versionId) {
        // Save a version first to anchor feedback
        const resSave = await fetch(`${API_BASE}/proposals/${proposalId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
          body: JSON.stringify({ html: null, sections, citations: [] })
        })
        if (resSave.ok) {
          const d = await resSave.json()
          versionId = d?.id || null
          setLatestVersionId(versionId)
        }
      }
      if (!proposalId || !versionId) return
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/versions/${versionId}/sections/${encodeURIComponent(key)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
        body: JSON.stringify({ rating })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Optional: show a toast
    } catch (e) {
      console.error('Feedback submit failed', e)
    }
  }

  const FeedbackButtons: React.FC<{ section: Section }> = ({ section }) => {
    return (
      <div className="flex items-center gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={() => ensureVersionAndSendFeedback(section.key, 1)}>👍</Button>
        <Button size="sm" variant="outline" onClick={() => ensureVersionAndSendFeedback(section.key, -1)}>👎</Button>
      </div>
    )
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
    <div className="flex flex-col lg:flex-row lg:items-start gap-4 p-4 sm:p-6 lg:overflow-hidden">
      {/* Sidebar */}
      <div className="w-full lg:w-72 space-y-3 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:pr-2 nice-scroll min-h-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {sections.map(s => (
              <button
                key={s.key}
                onClick={() => setSelectedKey(s.key)}
                className={`w-full text-left px-2 py-2 rounded-md border text-sm ${selectedKey === s.key ? 'bg-accent border-accent text-accent-foreground' : 'hover:bg-muted'}`}
              >
                {s.title}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Example & Draft (moved up for faster access) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Example & Draft</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1">
              <div className="font-medium">Upload Example Proposal</div>
              <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return
                setUploadingExample(true); setExampleSummary(""); setExampleAnalysis(null)
                try {
                  const fd = new FormData(); fd.append('file', f)
                  const res = await fetch(`${API_BASE}/proposals/${proposalId}/example/upload`, { method: 'POST', body: fd, headers: { 'bypass-tunnel-reminder': 'true' } })
                  if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  const data = await res.json()
                  const secCount = (data.analysis?.sections || []).length
                  setExampleSummary(`Analyzed: ${secCount} sections; style captured.`)
                  setExampleAnalysis(data.analysis as ExampleAnalysis)
                } catch (err) {
                  setExampleSummary('Upload failed')
                  setExampleAnalysis(null)
                } finally {
                  setUploadingExample(false)
                }
              }}/>
              {uploadingExample && <div className="text-muted-foreground">Analyzing example…</div>}
              {exampleSummary && <div className="text-muted-foreground">{exampleSummary}</div>}
              {exampleAnalysis && (
                <div className="space-y-3 border rounded-md p-3 bg-muted/30">
                  {exampleAnalysis.letter_structure && (
                    <div className="space-y-1">
                      <div className="font-medium">Cover Letter Structure</div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {exampleAnalysis.letter_structure.recipient_lines && (
                          <div>
                            <div className="font-semibold text-foreground">Recipient</div>
                            <div className="whitespace-pre-line">{exampleAnalysis.letter_structure.recipient_lines.join('\n')}</div>
                          </div>
                        )}
                        {exampleAnalysis.letter_structure.re_line && (
                          <div><span className="font-semibold text-foreground">RE:</span> {exampleAnalysis.letter_structure.re_line.replace(/^RE:\s*/i, '')}</div>
                        )}
                        {exampleAnalysis.letter_structure.salutation && (
                          <div><span className="font-semibold text-foreground">Salutation:</span> {exampleAnalysis.letter_structure.salutation}</div>
                        )}
                        {exampleAnalysis.letter_structure.intro_preview && (
                          <div>
                            <div className="font-semibold text-foreground">Intro Preview</div>
                            <div>{exampleAnalysis.letter_structure.intro_preview}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {exampleAnalysis.section_outline && exampleAnalysis.section_outline.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-medium">Section Outline</div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {exampleAnalysis.section_outline.map((sec, idx) => (
                          <div key={`${sec.title}-${idx}`} className="border rounded-sm px-2 py-1 bg-background/50">
                            <div className="font-semibold text-foreground">{sec.title || `Section ${idx + 1}`}</div>
                            {sec.preview && <div className="line-clamp-3 whitespace-pre-line">{sec.preview}</div>}
                            <div className="text-[11px]">{sec.word_count ?? 0} words</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {exampleAnalysis.task_sections && exampleAnalysis.task_sections.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-medium">Task Sections</div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {exampleAnalysis.task_sections.map(task => (
                          <div key={task.task_id} className="border rounded-sm px-2 py-1 bg-background/50">
                            <div className="font-semibold text-foreground">Task {task.task_id}: {task.title}</div>
                            {task.preview && <div className="line-clamp-3 whitespace-pre-line">{task.preview}</div>}
                            <div className="text-[11px]">{task.word_count ?? 0} words</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
                  setUploadingDraft(false)
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

        {/* Regulatory Sources (scoped to this proposal) - collapsible */}
        <Card>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-base">Regulatory Sources</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setCollapseReg(v => !v)}>{collapseReg ? 'Show' : 'Hide'}</Button>
          </CardHeader>
          {!collapseReg && (
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
                    const res = await fetch(`${API_BASE}/proposals/${proposalId}/regulatory/upload?fast=1`, { method: 'POST', body: fd, headers: { 'bypass-tunnel-reminder': 'true' } })
                    if (!res.ok) throw new Error(`HTTP ${res.status}`)
                  }
                  await loadRegDocs()
                  e.currentTarget.value = ''
                } catch (err) {
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
          )}
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

        {/* Context Scoping (collapsible) */}
        <Card>
          <CardHeader className="pb-2 flex items-center justify-between">
            <CardTitle className="text-base">Context</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setCollapseContext(v => !v)}>{collapseContext ? 'Show' : 'Hide'}</Button>
          </CardHeader>
          {!collapseContext && (
          <CardContent className="space-y-3 text-sm">
            {/* Mode Switch */}
            <div className="flex gap-2">
              <Button size="sm" variant={contextMode === 'all' ? 'default' : 'outline'} onClick={() => setContextMode('all')}>All</Button>
              <Button size="sm" variant={contextMode === 'collections' ? 'default' : 'outline'} onClick={() => setContextMode('collections')}>Collections</Button>
              <Button size="sm" variant={contextMode === 'documents' ? 'default' : 'outline'} onClick={() => setContextMode('documents')}>Documents</Button>
            </div>

            {/* Collections list */}
            {contextMode === 'collections' && (
              <div className="space-y-2">
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
              <div className="space-y-2">
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
          )}
        </Card>
      </div>

      {/* Editor */}
      <div className="flex-1 space-y-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto min-h-0 nice-scroll">
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
              {sectionAgentInstructions && (
                <div className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/40 whitespace-pre-line">
                  {sectionAgentInstructions}
                </div>
              )}
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

            {/* Content editor with special editors for AOC and Pricing */}
            {selectedSection?.key === 'aoc-roster' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Areas of Concern (AOC)</div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={addAocRow} disabled={aocStreamingId !== null || aocDiscovering}>
                      <Plus className="w-4 h-4 mr-2"/>
                      Add AOC
                    </Button>
                    <Button onClick={insertAocRoster} disabled={aocStreamingId !== null || aocDiscovering}>
                      <FileText className="w-4 h-4 mr-2"/>
                      Insert Roster
                    </Button>
                    <Button variant="outline" onClick={discoverAocs} disabled={aocStreamingId !== null || aocDiscovering}>
                      {aocDiscovering ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                      {aocDiscovering ? 'Finding AOCs…' : 'Find AOCs'}
                    </Button>
                    <Button variant="outline" onClick={cleanAllAocTitles} disabled={aocStreamingId !== null || aocItems.length === 0}>
                      <Eraser className="w-4 h-4 mr-2"/>
                      Clean Titles
                    </Button>
                    <Button variant="outline" onClick={beginGenerateAllAocs} disabled={aocStreamingId !== null || aocDiscovering || aocItems.length === 0}>
                      {aocStreamingId !== null ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}
                      {aocStreamingId !== null ? `Generating… (${aocDoneCount}/${aocItems.length})` : `Generate All (${aocDoneCount}/${aocItems.length})`}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto border rounded-md">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left p-2 w-32">AOC Code</th>
                        <th className="text-left p-2 w-64">Title</th>
                        <th className="text-left p-2">Details</th>
                        <th className="text-left p-2 w-44">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aocItems.map((it) => (
                        <tr key={it.id} className="border-t align-top">
                          <td className="p-2"><Input placeholder="AOC-3" value={it.code} onChange={e => updateAocItemById(it.id, 'code', e.target.value)} /></td>
                          <td className="p-2"><Input placeholder="Mica & Wood Floor Drains" value={it.title} onChange={e => updateAocItemById(it.id, 'title', e.target.value)} /></td>
                          <td className="p-2">
                            <Textarea rows={5} placeholder="According to the Preliminary Assessment Report… Additional remediation is necessary because…" value={it.details} onChange={e => updateAocItemById(it.id, 'details', e.target.value)} />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => generateAocRowById(it.id)} disabled={aocStreamingId !== null}>
                                {aocStreamingId === it.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}
                                {aocStreamingId === it.id ? 'Generating…' : 'Generate'}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => removeAocRowById(it.id)} disabled={aocStreamingId !== null}>Remove</Button>
                            </div>
                            {it.status && it.status !== 'idle' && (
                              <div className="text-xs text-muted-foreground mt-1">Status: {it.status}</div>
                            )}
                            {it.output && it.output.trim().length > 0 && (
                              <div className="text-xs mt-2 p-2 rounded-md bg-muted max-h-24 overflow-auto">
                                <div className="line-clamp-3 whitespace-pre-wrap">{it.output}</div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Preview */}
                <div className="border rounded-md p-3 bg-card">
                  <div dangerouslySetInnerHTML={{ __html: selectedSection?.content || '<em>No AOC roster inserted yet.</em>' }} />
                </div>
              </div>
            ) : selectedSection?.key === 'pricing' ? (
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
                      <tr className="bg-muted">
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
                <div className="border rounded-md p-3 bg-card">
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
                <FeedbackButtons section={selectedSection} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Retrieval Timeline */}
      <div className="w-full lg:w-80 space-y-2 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto nice-scroll min-h-0">
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
