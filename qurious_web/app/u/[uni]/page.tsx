"use client"

import { useParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"
import { ChevronDown, ChevronRight, Search, X, Menu, ChevronLeft, Plus } from "lucide-react"

type Topic = {
  cluster_id: number
  label: string
  size: number
  top_terms?: string[]
  sample_titles?: string[]
  weak_count?: number
}

type Paper = {
  id: string
  title: string
  doi?: string | null
  cluster_id: number
  sim_to_centroid?: number
  quality?: "strong" | "weak"
}

type LimitationEntry = {
  status: "ok" | "parse_failed" | "no_doi" | "skipped_no_limits" | "llm_error"
  status_reason?: string
  source_url?: string
  resolved_via?: "doi_pdf" | "doi_html" | "oa_pdf" | "oa_html" | "no_doi"
  bullets: string[]
  quotes?: string[]
  confidence: number
}
type LimitationsMap = Record<string, LimitationEntry>

/** NEW: authors/contacts types */
type AuthorContact = { name: string; institution?: string; email?: string }
type ContactsMap = Record<string, { title?: string; authors: AuthorContact[] }>

function doiHref(doi?: string | null) {
  if (!doi) return undefined
  return doi.startsWith("http") ? doi : `https://doi.org/${doi}`
}

/** NEW: normalize any contacts payload shape into a map keyed by paper id */
function normalizeContacts(raw: any): ContactsMap {
  if (!raw) return {}
  // Case 1: already a map keyed by paper id
  if (!Array.isArray(raw) && typeof raw === "object") {
    // ensure authors array exists
    const out: ContactsMap = {}
    Object.entries(raw).forEach(([pid, v]: [string, any]) => {
      const authors: AuthorContact[] = Array.isArray(v?.authors)
        ? v.authors.map((a: any) => ({
            name: a?.name ?? a?.author ?? "",
            institution: a?.institution,
            email: a?.email,
          }))
        : []
      out[pid] = { title: v?.title, authors }
    })
    return out
  }

  // Case 2: array of rows { paper_id, title, author/name, email? }
  if (Array.isArray(raw)) {
    const out: ContactsMap = {}
    for (const row of raw) {
      const pid = row.paper_id || row.id || row.work_id
      const name = row.author || row.name
      if (!pid || !name) continue
      if (!out[pid]) out[pid] = { title: row.title, authors: [] }
      out[pid].authors.push({ name, institution: row.institution, email: row.email })
    }
    return out
  }

  return {}
}

export default function UniversityPage() {
  const params = useParams<{ uni: string }>()
  const uni = decodeURIComponent(Array.isArray(params.uni) ? params.uni[0] : params.uni || "")

  const [topics, setTopics] = useState<Topic[]>([])
  const [papers, setPapers] = useState<Paper[]>([])
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null)
  const [query, setQuery] = useState("")
  const [showWeak, setShowWeak] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; topic: Topic } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(new Set())
  const [clusterSearchQuery, setClusterSearchQuery] = useState("")
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [showMorePapers, setShowMorePapers] = useState(false)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [limitations, setLimitations] = useState<LimitationsMap | null>(null)
  const [showGapList, setShowGapList] = useState(false)

  /** NEW: contacts + which paper’s authors are shown */
  const [contacts, setContacts] = useState<ContactsMap | null>(null)
  const [selectedGapPaperId, setSelectedGapPaperId] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const rightPanelRef = useRef<HTMLDivElement | null>(null)

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      // Auto-close sidebar on mobile
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (!uni) return
    ;(async () => {
      const [tRes, pRes] = await Promise.all([fetch(`/data/${uni}_topics.json`), fetch(`/data/${uni}_papers.json`)])
      if (tRes.ok) setTopics(await tRes.json())
      if (pRes.ok) setPapers(await pRes.json())
      setSelectedCluster(null)
      setQuery("")
      setShowWeak(false)
      setSelectedGapPaperId(null)

      try {
        const r = await fetch(`/data/${uni}_limitations.json`, { cache: "no-store" })
        setLimitations(r.ok ? await r.json() : null)
      } catch {
        setLimitations(null)
      }

      /** NEW: fetch contacts (if present), normalize */
      try {
        const rc = await fetch(`/data/${uni}_contacts.json`, { cache: "no-store" })
        if (rc.ok) {
          const raw = await rc.json()
          setContacts(normalizeContacts(raw))
        } else {
          setContacts(null)
        }
      } catch {
        setContacts(null)
      }
    })()
  }, [uni])

  const visibleTopics = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return topics
    return topics.filter((t) => {
      const hay = `${t.label} ${(t.top_terms ?? []).join(" ")}`.toLowerCase()
      return hay.includes(q)
    })
  }, [topics, query])

  const matchedTopics = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return new Set<number>()
    return new Set(
      topics
        .filter((t) => {
          const hay = `${t.label} ${(t.top_terms ?? []).join(" ")}`.toLowerCase()
          return hay.includes(q)
        })
        .map((t) => t.cluster_id),
    )
  }, [topics, query])

  const papersByCluster = useMemo(() => {
    const grouped = new Map<number, Paper[]>()
    papers.forEach((paper) => {
      if (!grouped.has(paper.cluster_id)) {
        grouped.set(paper.cluster_id, [])
      }
      grouped.get(paper.cluster_id)!.push(paper)
    })

    grouped.forEach((papers) => {
      papers.sort((a, b) => (b.sim_to_centroid ?? 0) - (a.sim_to_centroid ?? 0))
    })

    return grouped
  }, [papers])

  const filteredPapersByCluster = useMemo(() => {
    if (!clusterSearchQuery.trim()) return papersByCluster

    const filtered = new Map<number, Paper[]>()
    const searchLower = clusterSearchQuery.toLowerCase()

    papersByCluster.forEach((papers, clusterId) => {
      const matchingPapers = papers.filter((paper) => paper.title.toLowerCase().includes(searchLower))
      if (matchingPapers.length > 0) {
        filtered.set(clusterId, matchingPapers)
      }
    })

    return filtered
  }, [papersByCluster, clusterSearchQuery])

  const selectedClusterPaperIds: string[] = useMemo(() => {
    if (selectedCluster === null) return []
    const list = papersByCluster.get(selectedCluster) || []
    return list.map((p) => p.id)
  }, [selectedCluster, papersByCluster])

  const titlesById: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = {}
    papers.forEach((p) => (m[p.id] = p.title))
    return m
  }, [papers])

  const gapPapers: Array<{ id: string; entry: LimitationEntry }> = useMemo(() => {
    if (!limitations || selectedClusterPaperIds.length === 0) return []
    const hits: Array<{ id: string; entry: LimitationEntry }> = []
    for (const id of selectedClusterPaperIds) {
      const e = limitations[id]
      if (e && e.status === "ok" && e.bullets && e.bullets.length > 0) hits.push({ id, entry: e })
    }
    return hits
  }, [limitations, selectedClusterPaperIds])

  useEffect(() => {
    if (!svgRef.current || visibleTopics.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const width = svgRef.current.clientWidth || 800
    const height = svgRef.current.clientHeight || 600

    const maxSize = d3.max(visibleTopics, (d) => d.size) || 1
    const sizeScale = d3
      .scaleSqrt()
      .domain([1, maxSize])
      .range([Math.min(width, height) * 0.04, Math.min(width, height) * 0.12])

    const colorScale = d3.scaleOrdinal([
      "#3b82f6",
      "#1e40af",
      "#2563eb",
      "#3730a3",
      "#4338ca",
      "#0891b2",
      "#0e7490",
      "#0f766e",
      "#115e59",
      "#1f2937",
      "#374151",
      "#4b5563",
    ])

    const defs = svg.append("defs")

    const pattern = defs
      .append("pattern")
      .attr("id", "grid")
      .attr("width", 40)
      .attr("height", 40)
      .attr("patternUnits", "userSpaceOnUse")

    pattern.append("circle").attr("cx", 20).attr("cy", 20).attr("r", 0.8).attr("fill", "#e2e8f0").attr("opacity", 0.3)

    svg.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", "#fefefe")
    svg.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", "url(#grid)")

    const zoomBehavior = d3
      .zoom()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        const { x, y, k } = event.transform
        setTransform({ x, y, k })
        mainGroup.attr("transform", event.transform)
      })

    svg.call(zoomBehavior)

    const mainGroup = svg.append("g").attr("class", "main-group")

    visibleTopics.forEach((topic, i) => {
      const baseColor = colorScale(topic.cluster_id.toString())
      const gradientId = `gradient-${topic.cluster_id}`
      const shadowId = `shadow-${topic.cluster_id}`

      const bubbleGradient = defs
        .append("radialGradient")
        .attr("id", gradientId)
        .attr("cx", "30%")
        .attr("cy", "30%")
        .attr("r", "70%")

      bubbleGradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d3.color(baseColor)?.brighter(0.6)?.toString() || baseColor)
        .attr("stop-opacity", 0.9)

      bubbleGradient.append("stop").attr("offset", "50%").attr("stop-color", baseColor).attr("stop-opacity", 0.8)

      bubbleGradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d3.color(baseColor)?.darker(0.3)?.toString() || baseColor)
        .attr("stop-opacity", 0.9)

      const filter = defs
        .append("filter")
        .attr("id", shadowId)
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%")

      filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 3).attr("result", "blur")
      filter.append("feOffset").attr("in", "blur").attr("dx", 1).attr("dy", 2).attr("result", "offsetBlur")

      const feMerge = filter.append("feMerge")
      feMerge.append("feMergeNode").attr("in", "offsetBlur")
      feMerge.append("feMergeNode").attr("in", "SourceGraphic")
    })

    const simulation = d3
      .forceSimulation(visibleTopics)
      .force("charge", d3.forceManyBody().strength(-800))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collision",
        d3.forceCollide((d) => sizeScale(d.size) + 20),
      )
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03))
      .stop()

    for (let i = 0; i < 300; ++i) simulation.tick()

    const nodeGroup = mainGroup.append("g").attr("class", "nodes")

    const circles = nodeGroup
      .selectAll("circle")
      .data(visibleTopics)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => sizeScale(d.size))
      .attr("fill", (d) => `url(#gradient-${d.cluster_id})`)
      .attr("stroke", (d) => {
        if (hoveredPaper && papersByCluster.get(d.cluster_id)?.some((p) => p.id === hoveredPaper)) {
          return "#f59e0b"
        }
        return matchedTopics.has(d.cluster_id) ? "#1f2937" : "rgba(0,0,0,0.1)"
      })
      .attr("stroke-width", (d) => {
        if (hoveredPaper && papersByCluster.get(d.cluster_id)?.some((p) => p.id === hoveredPaper)) {
          return 2
        }
        return matchedTopics.has(d.cluster_id) ? 1.5 : 0.5
      })
      .attr("opacity", (d) => (matchedTopics.size === 0 || matchedTopics.has(d.cluster_id) ? 0.9 : 0.4))
      .style("cursor", "grab")
      .style("filter", (d) => `url(#shadow-${d.cluster_id})`)
      .style("transition", "all 0.2s ease")

    circles.each(function (d, i) {
      const circle = d3.select(this)
      const baseX = d.x
      const baseY = d.y
      const floatRange = 15
      const duration = 2000 + i * 200

      function float() {
        circle
          .transition()
          .duration(duration + Math.random() * 1500)
          .ease(d3.easeSinInOut)
          .attr("cx", baseX + (Math.random() - 0.5) * floatRange)
          .attr("cy", baseY + (Math.random() - 0.5) * floatRange)
          .on("end", float)
      }

      setTimeout(() => float(), Math.random() * 1000)
    })

    circles
      .on("click", (_, d) => {
        setSelectedCluster(d.cluster_id)
        setRightPanelOpen(true)
        setShowMorePapers(false)
        setTooltip(null)
        setExpandedClusters(new Set([d.cluster_id]))
        setSelectedGapPaperId(null)
        if (rightPanelRef.current) {
          const clusterElement = rightPanelRef.current.querySelector(`[data-cluster-id="${d.cluster_id}"]`)
          if (clusterElement) {
            clusterElement.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        }
      })
      .on("mouseover", (event, d) => {
        const [x, y] = d3.pointer(event, document.body)
        const clusterPapers = papersByCluster.get(d.cluster_id) || []
        const weakCount = clusterPapers.filter((p) => p.quality === "weak").length
        const topicWithWeakCount = {
          ...d,
          weak_count: weakCount,
        }
        setTooltip({ x, y, topic: topicWithWeakCount })
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", sizeScale(d.size) * 1.15)
          .attr("opacity", 1)
          .style("filter", `url(#shadow-${d.cluster_id}) brightness(1.05)`)
          .attr("stroke-width", 2)
          .attr("stroke", "#1f2937")
      })
      .on("mousemove", (event) => {
        const [x, y] = d3.pointer(event, document.body)
        setTooltip((prev) => (prev ? { ...prev, x, y } : null))
      })
      .on("mouseout", (event, d) => {
        setTooltip(null)
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", sizeScale(d.size))
          .attr("opacity", (d) => (matchedTopics.size === 0 || matchedTopics.has(d.cluster_id) ? 0.9 : 0.4))
          .style("filter", `url(#shadow-${d.cluster_id})`)
          .attr("stroke-width", (d) => (matchedTopics.has(d.cluster_id) ? 1.5 : 0.5))
          .attr("stroke", (d) => (matchedTopics.has(d.cluster_id) ? "#1f2937" : "rgba(0,0,0,0.1)"))
      })

    circles.attr("opacity", (d) => (matchedTopics.size === 0 || matchedTopics.has(d.cluster_id) ? 0.9 : 0.4))

    const labels = nodeGroup
      .selectAll("text")
      .data(visibleTopics)
      .join("text")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#ffffff")
      .attr("font-size", (d) => Math.max(12, Math.min(16, sizeScale(d.size) / 3)))
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.6)")
      .text((d) => {
        const label = d.label || `Cluster ${d.cluster_id}`
        const maxLength = Math.floor(sizeScale(d.size) / 4)
        return label.length > maxLength ? label.substring(0, maxLength) + "…" : label
      })
      .attr("opacity", (d) => (matchedTopics.size === 0 || matchedTopics.has(d.cluster_id) ? 1 : 0.5))

    labels.each(function (d, i) {
      const label = d3.select(this)
      const baseX = d.x
      const baseY = d.y
      const floatRange = 15
      const duration = 2000 + i * 200

      function floatLabel() {
        label
          .transition()
          .duration(duration + Math.random() * 1500)
          .ease(d3.easeSinInOut)
          .attr("x", baseX + (Math.random() - 0.5) * floatRange)
          .attr("y", baseY + (Math.random() - 0.5) * floatRange)
          .on("end", floatLabel)
      }

      setTimeout(() => floatLabel(), Math.random() * 1000)
    })
  }, [visibleTopics, matchedTopics, hoveredPaper, papersByCluster])

  const toggleCluster = (clusterId: number) => {
    setExpandedClusters((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId)
      } else {
        newSet.add(clusterId)
      }
      return newSet
    })
  }

  const clearSearch = () => {
    setQuery("")
  }

  const clearClusterSearch = () => {
    setClusterSearchQuery("")
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex relative">
      {(sidebarOpen || rightPanelOpen) && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => {
            setSidebarOpen(false)
            setRightPanelOpen(false)
          }}
        />
      )}

      <div
        className={`${sidebarOpen ? "w-full sm:w-96 md:w-80 lg:w-96 xl:w-[28rem]" : "w-0 md:w-16"} ${
          isMobile ? "fixed inset-y-0 left-0 z-50" : "relative"
        } transition-all duration-300 bg-gray-50 border-r border-gray-200 flex flex-col shadow-lg overflow-hidden`}
      >
        <div className="p-3 md:p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h1
              className={`font-bold text-base sm:text-lg md:text-xl text-gray-900 ${sidebarOpen ? "block" : "hidden"} truncate`}
            >
              {uni.replaceAll("_", " ")}
            </h1>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 text-gray-600 hover:text-gray-900 flex-shrink-0"
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {sidebarOpen && (
            <>
              <div className="relative mb-3">
                <div className="relative bg-white rounded-lg border border-gray-300 shadow-sm">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search topics..."
                    className="w-full pl-8 pr-8 py-2.5 bg-transparent text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-lg"
                  />
                  {query && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {query && (
                <div className="text-xs text-gray-600 mb-3 px-2.5 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="font-semibold text-blue-600">{visibleTopics.length}</span> of{" "}
                  <span className="font-semibold">{topics.length}</span> topics matched
                </div>
              )}

              <div className="text-xs text-gray-500 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200 leading-relaxed">
                💡{" "}
                {isMobile
                  ? "Tap bubbles • Pinch to zoom • Tap to view papers"
                  : "Drag bubbles to move • Scroll to zoom • Click to view papers"}
              </div>

              {selectedCluster !== null && (
                <div className="mt-4 rounded-lg border border-gray-300 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                      <h3 className="text-sm font-semibold text-gray-900">Research Gaps & Limitations</h3>
                    </div>
                    <button
                      onClick={() => setShowGapList((v) => !v)}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors text-gray-700"
                    >
                      {showGapList ? "Hide" : "View"}
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-600">
                        Coverage: {gapPapers.length} of {selectedClusterPaperIds.length} papers
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {selectedClusterPaperIds.length
                          ? Math.round((gapPapers.length / selectedClusterPaperIds.length) * 100)
                          : 0}
                        %
                      </span>
                    </div>

                    <div className="relative h-2 w-full rounded bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded bg-gray-600 transition-all duration-500"
                        style={{
                          width: `${
                            selectedClusterPaperIds.length
                              ? Math.round((gapPapers.length / selectedClusterPaperIds.length) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {showGapList && (
                    <div className="space-y-3 max-h-48 sm:max-h-56 overflow-y-auto hide-scrollbar">
                      {gapPapers.map(({ id, entry }) => {
                        const isSelected = id === selectedGapPaperId
                        return (
                          <div
                            key={id}
                            role="button"
                            onClick={() => setSelectedGapPaperId(id)}
                            className={`rounded-lg border p-3 transition-colors ${
                              isSelected
                                ? "bg-gray-100 border-gray-300"
                                : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <h4 className="text-sm font-medium text-gray-900 leading-tight flex-1 group-hover:text-blue-600 transition-colors truncate">
                                {titlesById[id] ?? id}
                              </h4>
                              {entry.confidence > 0 && (
                                <div className="flex items-center gap-1 bg-gray-200 rounded-full px-2 py-1 flex-shrink-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                                  <span className="text-xs font-medium text-gray-700">
                                    {Math.round(entry.confidence * 100)}%
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2 mb-3">
                              {entry.bullets.map((bullet, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0"></div>
                                  <p className="text-xs text-gray-700 leading-relaxed">{bullet}</p>
                                </div>
                              ))}
                            </div>

                            {entry.source_url && (
                              <div className="flex items-center justify-between">
                                <a
                                  href={entry.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                  View Source
                                </a>
                                {entry.resolved_via && (
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                    {entry.resolved_via.replace("_", " ")}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {gapPapers.length === 0 && (
                        <div className="text-center py-6">
                          <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-600 font-medium">No research gaps extracted</p>
                          <p className="text-xs text-gray-500 mt-1">Limitations data not available for this cluster</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Authors / Contact panel */}
              {selectedCluster !== null && selectedGapPaperId && (
                <div className="mt-4 rounded-lg border border-gray-300 bg-white shadow-sm sticky top-4 z-10">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        <h3 className="text-sm font-semibold text-gray-900">Authors & Contact</h3>
                      </div>
                    </div>

                    {contacts && contacts[selectedGapPaperId] && contacts[selectedGapPaperId].authors.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
                        {contacts[selectedGapPaperId].authors.map((a, idx) => {
                          const hasEmail = !!a.email
                          const subject = `Regarding your paper: ${titlesById[selectedGapPaperId] ?? ""}`
                          const mailto = hasEmail
                            ? `mailto:${a.email}?subject=${encodeURIComponent(subject)}`
                            : undefined
                          const query = `${a.name} ${uni.replaceAll("_", " ")} email`
                          const findUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate">{a.name}</div>
                                {a.institution && <div className="text-xs text-gray-600 truncate">{a.institution}</div>}
                                {a.email && <div className="text-xs text-gray-500 truncate">{a.email}</div>}
                              </div>
                              {hasEmail ? (
                                <a
                                  href={mailto}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                                >
                                  Contact
                                </a>
                              ) : (
                                <a
                                  href={findUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold px-3 py-1.5 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors whitespace-nowrap"
                                >
                                  Find
                                </a>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">No author information available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-w-0">
        <div className="flex-1 p-2 sm:p-4 md:p-6">
          <div className="h-full bg-white rounded-xl md:rounded-2xl border border-gray-200 relative overflow-hidden shadow-sm">
            <svg ref={svgRef} width="100%" height="100%" className="rounded-xl md:rounded-2xl"></svg>

            {tooltip && (
              <div
                className="fixed z-50 bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-6 shadow-2xl max-w-xs sm:max-w-sm transition-all duration-300 pointer-events-none"
                style={{
                  left: Math.min(tooltip.x + 15, window.innerWidth - (isMobile ? 300 : 400)),
                  top: Math.max(tooltip.y - 15, 10),
                  transform:
                    tooltip.x > window.innerWidth - (isMobile ? 350 : 450) ? "translateX(-100%)" : "translateX(0)",
                }}
              >
                <h3 className="font-bold text-gray-900 mb-2 text-base sm:text-lg md:text-xl leading-tight">
                  {tooltip.topic.label || `Cluster ${tooltip.topic.cluster_id}`}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold text-xs">
                    {tooltip.topic.size} papers
                  </span>
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-semibold text-xs">
                    {tooltip.topic.weak_count || 0} weak
                  </span>
                </div>

                {tooltip.topic.top_terms && tooltip.topic.top_terms.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Key Terms</div>
                    <div className="flex flex-wrap gap-1.5">
                      {tooltip.topic.top_terms.slice(0, isMobile ? 4 : 6).map((term, i) => (
                        <span
                          key={i}
                          className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-medium border border-gray-200"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tooltip.topic.sample_titles && tooltip.topic.sample_titles.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Sample Papers</div>
                    <div className="space-y-1.5">
                      {tooltip.topic.sample_titles.slice(0, isMobile ? 1 : 2).map((title, i) => (
                        <div
                          key={i}
                          className="text-xs text-gray-700 leading-relaxed p-2 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          • {isMobile && title.length > 60 ? title.substring(0, 60) + "..." : title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {rightPanelOpen && (
          <div
            className={`${
              isMobile ? "fixed inset-y-0 right-0 w-full z-50" : "w-80 lg:w-96"
            } border-l border-gray-200 bg-white flex flex-col shadow-lg`}
          >
            <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="font-bold text-lg md:text-xl text-gray-900">Research Papers</h2>
                <button
                  onClick={() => setRightPanelOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-700"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative">
                <div className="relative bg-white rounded-xl border border-gray-300 shadow-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    value={clusterSearchQuery}
                    onChange={(e) => setClusterSearchQuery(e.target.value)}
                    placeholder="Search within papers..."
                    className="w-full pl-9 pr-9 py-2.5 bg-transparent text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent rounded-xl"
                  />
                  {clusterSearchQuery && (
                    <button
                      onClick={clearClusterSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div
              ref={rightPanelRef}
              className="flex-1 overflow-y-auto hide-scrollbar"
              style={{ maxHeight: isMobile ? "calc(100vh - 140px)" : "calc(100vh - 200px)" }}
            >
              {selectedCluster !== null &&
                filteredPapersByCluster.has(selectedCluster) &&
                (() => {
                  const clusterId = selectedCluster
                  const clusterPapers = filteredPapersByCluster.get(clusterId)!
                  const topic = topics.find((t) => t.cluster_id === clusterId)
                  const isExpanded = expandedClusters.has(clusterId)
                  const visiblePapers = showWeak ? clusterPapers : clusterPapers.filter((p) => p.quality !== "weak")
                  const weakCount = clusterPapers.filter((p) => p.quality === "weak").length
                  const displayedPapers = showMorePapers ? visiblePapers : visiblePapers.slice(0, isMobile ? 3 : 4)
                  const hasMorePapers = visiblePapers.length > (isMobile ? 3 : 4)

                  return (
                    <div key={clusterId} data-cluster-id={clusterId} className="border-b border-gray-100">
                      <button
                        onClick={() => toggleCluster(clusterId)}
                        className="w-full p-4 md:p-6 text-left hover:bg-gray-50 transition-all duration-200 flex items-center justify-between group"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-900 text-base md:text-lg mb-1 group-hover:text-blue-600 transition-colors truncate">
                            {topic?.label || `Cluster ${clusterId}`}
                          </h3>
                          <p className="text-sm text-gray-600">
                            <span className="font-semibold text-blue-600">{visiblePapers.length}</span> papers
                            {weakCount > 0 && !showWeak && (
                              <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                +{weakCount} weak
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-2">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="pb-4 md:pb-6">
                          {weakCount > 0 && (
                            <div className="px-4 md:px-6 mb-3 md:mb-4">
                              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-800 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={showWeak}
                                  onChange={(e) => setShowWeak(e.target.checked)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                Show weak papers ({weakCount})
                              </label>
                            </div>
                          )}

                          <div className="space-y-2 md:space-y-3 px-4 md:px-6">
                            {displayedPapers.map((paper) => (
                              <div
                                key={paper.id}
                                className="p-3 md:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                onMouseEnter={() => setHoveredPaper(paper.id)}
                                onMouseLeave={() => setHoveredPaper(null)}
                              >
                                <div className="flex items-start justify-between gap-2 md:gap-3 mb-2 md:mb-3">
                                  {doiHref(paper.doi) ? (
                                    <a
                                      href={doiHref(paper.doi)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-600 hover:text-blue-800 text-xs md:text-sm font-semibold leading-tight flex-1 transition-colors"
                                    >
                                      {paper.title}
                                    </a>
                                  ) : (
                                    <span className="text-gray-900 text-xs md:text-sm font-semibold leading-tight flex-1">
                                      {paper.title}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {paper.quality === "strong" ? (
                                      <span className="bg-green-100 text-green-800 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs font-bold">
                                        {isMobile ? "S" : "Strong"}
                                      </span>
                                    ) : (
                                      <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs font-bold">
                                        {isMobile ? "W" : "Weak"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {typeof paper.sim_to_centroid === "number" && (
                                  <div className="text-xs text-gray-500 bg-white px-2 md:px-3 py-1 rounded-lg inline-block border border-gray-200">
                                    Similarity:{" "}
                                    <span className="font-semibold text-blue-600">
                                      {paper.sim_to_centroid.toFixed(3)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}

                            {hasMorePapers && !showMorePapers && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  setShowMorePapers(true)
                                }}
                                className="w-full p-3 md:p-4 bg-blue-50 hover:bg-blue-100 border-2 border-dashed border-blue-200 hover:border-blue-300 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
                              >
                                <Plus size={16} />
                                See {visiblePapers.length - (isMobile ? 3 : 4)} more papers
                              </button>
                            )}

                            {showMorePapers && hasMorePapers && (
                              <button
                                onClick={() => setShowMorePapers(false)}
                                className="w-full p-2 md:p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all duration-200 text-gray-600 hover:text-gray-700 font-medium text-sm"
                              >
                                Show less
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
