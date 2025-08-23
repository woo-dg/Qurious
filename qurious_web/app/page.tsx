"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useEffect } from "react"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700"] })

// --- existing data ---
const UNI_FILES = [
  "University_of_Toronto",
  "McMaster_University",
  "University_of_Waterloo",
  "Queens_University",
  "University_of_Guelph",
]

function normalize(s: string) {
  return s.toLowerCase().replace(/[\s.\-'']+/g, "")
}

const ALIASES: Record<string, string> = {
  [normalize("uoft")]: "University_of_Toronto",
  [normalize("u of t")]: "University_of_Toronto",
  [normalize("university of toronto")]: "University_of_Toronto",

  [normalize("mcmaster")]: "McMaster_University",
  [normalize("mc master")]: "McMaster_University",
  [normalize("mcmaster university")]: "McMaster_University",

  [normalize("waterloo")]: "University_of_Waterloo",
  [normalize("university of waterloo")]: "University_of_Waterloo",

  [normalize("queens")]: "Queens_University",
  [normalize("queen's")]: "Queens_University",
  [normalize("queens university")]: "Queens_University",

  [normalize("guelph")]: "University_of_Guelph",
  [normalize("university of guelph")]: "University_of_Guelph",
}
// -------------------------------------------------------------

function NetworkBackground() {
  const [nodes, setNodes] = useState<Array<{ x: number; y: number; vx: number; vy: number; id: number; size: number }>>(
    [],
  )

  useEffect(() => {
    const initialNodes = Array.from({ length: 25 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.03,
      vy: (Math.random() - 0.5) * 0.03,
      id: i,
      size: 0.2 + Math.random() * 0.3,
    }))
    setNodes(initialNodes)

    const animate = () => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const shouldChangeDirection = Math.random() < 0.005
          let newVx = node.vx
          let newVy = node.vy

          if (shouldChangeDirection) {
            newVx += (Math.random() - 0.5) * 0.01
            newVy += (Math.random() - 0.5) * 0.01
            newVx = Math.max(-0.05, Math.min(0.05, newVx))
            newVy = Math.max(-0.05, Math.min(0.05, newVy))
          }

          return {
            ...node,
            x: (node.x + newVx + 100) % 100,
            y: (node.y + newVy + 100) % 100,
            vx: newVx,
            vy: newVy,
          }
        }),
      )
    }

    const interval = setInterval(animate, 100)
    return () => clearInterval(interval)
  }, [])

  const connections = useMemo(() => {
    const maxDistance = 30
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; opacity: number }> = []

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < maxDistance) {
          const opacity = 1 - distance / maxDistance
          lines.push({
            x1: nodes[i].x,
            y1: nodes[i].y,
            x2: nodes[j].x,
            y2: nodes[j].y,
            opacity: opacity * 0.6,
          })
        }
      }
    }
    return lines
  }, [nodes])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="w-full h-full opacity-[0.10]" viewBox="0 0 100 100" preserveAspectRatio="none">
        {connections.map((line, i) => (
          <line
            key={i}
            x1={`${line.x1}%`}
            y1={`${line.y1}%`}
            x2={`${line.x2}%`}
            y2={`${line.y2}%`}
            stroke="#1e40af"
            strokeWidth="0.08"
            opacity={line.opacity}
            className="animate-pulse"
            style={{ animationDelay: `${i * 0}s`, animationDuration: "4s" }}
          />
        ))}

        {nodes.map((node) => (
          <g key={node.id}>
            <circle
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size * 1.2}
              fill="#1e40af"
              opacity="0.2"
              className="animate-pulse"
              style={{ animationDelay: `${node.id * 0.2}s`, animationDuration: "3s" }}
            />
            <circle
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size * 0.6}
              fill="#1e40af"
              className="animate-pulse"
              style={{ animationDelay: `${node.id * 0.2}s`, animationDuration: "3s" }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

/** HELP MODAL — same props; visual + concise */
function DemoVideoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  const VisualSearch = () => (
    <svg viewBox="0 0 320 120" className="w-full h-28">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#93c5fd" />
          <stop offset="1" stopColor="#c7d2fe" />
        </linearGradient>
      </defs>
      <rect x="20" y="34" rx="16" ry="16" width="280" height="52" fill="url(#sg)" opacity="0.25" />
      <rect x="28" y="42" rx="14" ry="14" width="264" height="36" fill="#fff" stroke="#cbd5e1" />
      <circle cx="54" cy="60" r="10" fill="#2563eb" opacity="0.85" />
      <rect x="74" y="52" width="140" height="16" rx="8" fill="#94a3b8" opacity="0.5" />
      <circle cx="274" cy="60" r="10" fill="#64748b" />
    </svg>
  )

  const VisualBubbles = () => (
    <svg viewBox="0 0 320 180" className="w-full h-40">
      <defs>
        <radialGradient id="b1" cx="35%" cy="30%">
          <stop offset="0" stopColor="#93c5fd" />
          <stop offset="1" stopColor="#2563eb" />
        </radialGradient>
        <radialGradient id="b2" cx="40%" cy="35%">
          <stop offset="0" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#7c3aed" />
        </radialGradient>
        <radialGradient id="b3" cx="40%" cy="35%">
          <stop offset="0" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#06b6d4" />
        </radialGradient>
      </defs>
      <g opacity="0.2" fill="none" stroke="#94a3b8">
        <rect x="8" y="8" width="304" height="164" rx="14" />
      </g>
      <circle cx="80" cy="70" r="32" fill="url(#b1)" opacity="0.95" />
      <circle cx="150" cy="105" r="22" fill="url(#b2)" opacity="0.95" />
      <circle cx="205" cy="70" r="46" fill="url(#b3)" opacity="0.95" />
      <circle cx="255" cy="115" r="26" fill="url(#b2)" opacity="0.85" />
      <circle cx="120" cy="45" r="18" fill="url(#b3)" opacity="0.8" />
      <circle cx="50" cy="115" r="20" fill="url(#b1)" opacity="0.8" />
    </svg>
  )

  const VisualPapers = () => (
    <svg viewBox="0 0 520 180" className="w-full h-40">
      <rect x="10" y="10" width="220" height="160" rx="12" fill="#f8fafc" stroke="#e5e7eb" />
      <circle cx="120" cy="70" r="38" fill="#2563eb" opacity="0.9" />
      <circle cx="70" cy="110" r="18" fill="#7c3aed" opacity="0.85" />
      <circle cx="175" cy="115" r="22" fill="#06b6d4" opacity="0.9" />
      <rect x="250" y="10" width="260" height="160" rx="12" fill="#ffffff" stroke="#e5e7eb" />
      <g>
        <rect x="265" y="25" width="220" height="16" rx="8" fill="#c7d2fe" />
        <rect x="265" y="48" width="170" height="10" rx="5" fill="#e5e7eb" />
      </g>
      <g>
        <rect x="265" y="78" width="220" height="16" rx="8" fill="#bae6fd" />
        <rect x="265" y="101" width="140" height="10" rx="5" fill="#e5e7eb" />
      </g>
      <g>
        <rect x="265" y="131" width="220" height="16" rx="8" fill="#fde68a" />
        <rect x="265" y="154" width="190" height="10" rx="5" fill="#e5e7eb" />
      </g>
    </svg>
  )

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10" />
          <div className="relative flex items-center justify-between px-6 py-5 border-b">
            <h3 className={`${plusJakarta.className} text-2xl font-semibold text-gray-900`}>How Qurious Works</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close instructions"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-72px)]">
          {/* One-liner */}
          <div className="mb-5 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4">
            <p className={`${plusJakarta.className} text-gray-800`}>
              Qurious clusters a university’s papers by{" "}
              <span className="font-semibold">title+abstract embeddings</span> and{" "}
              <span className="font-semibold">cosine similarity</span> so you can spot themes fast, scan gaps, and reach
              the right authors.
            </p>
          </div>

          {/* Visual storyboard */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-blue-700 font-semibold mb-2 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-700">1</span>
                Search
              </div>
              <VisualSearch />
              <p className="text-sm text-gray-600 mt-2">Type your university and press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Enter</kbd>.</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-indigo-700 font-semibold mb-2 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">2</span>
                Explore clusters
              </div>
              <VisualBubbles />
              <div className="mt-2 text-sm text-gray-600">Each bubble is a topic; size ≈ #papers. Zoom & drag.</div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wider text-emerald-700 font-semibold mb-2 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">3</span>
                Open papers
              </div>
              <VisualPapers />
              <div className="mt-2 text-sm text-gray-600">Click a bubble to see papers, gaps, and authors.</div>
            </div>
          </div>

          {/* Tiny legend cards */}
          <div className="mt-5 grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900 mb-1">Gaps & Limitations</div>
              <p className="text-sm text-gray-600">Quick bullets summarizing what could be improved or explored next.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900 mb-1">Similarity</div>
              <p className="text-sm text-gray-600">Score shows closeness to the cluster centroid in embedding space.</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900 mb-1">Authors & Contact</div>
              <p className="text-sm text-gray-600">See contributors and email links (when available) to reach out.</p>
            </div>
          </div>

          {/* Tips chips */}
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              Drag thin borders to resize panels (desktop)
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
              Hover a gap to highlight the paper on the right
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Scroll to zoom, drag to pan the map
            </span>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [isLoaded, setIsLoaded] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [isJumping, setIsJumping] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const jumpInterval = setInterval(() => {
      setIsJumping(true)
      setTimeout(() => setIsJumping(false), 1500)
    }, 5000)

    return () => clearInterval(jumpInterval)
  }, [])

  const guess = useMemo(() => {
    const key = normalize(text)
    if (!key) return ""
    if (ALIASES[key]) return ALIASES[key]
    const hit =
      UNI_FILES.find((u) => normalize(u).startsWith(key)) || UNI_FILES.find((u) => normalize(u).includes(key))
    return hit || ""
  }, [text])

  // NEW: live dropdown suggestions (aliases included -> canonical names)
  const suggestions = useMemo(() => {
    const key = normalize(text)
    if (!key) return []
    const set = new Set<string>()
    // canonical names
    UNI_FILES.forEach((u) => {
      if (normalize(u).includes(key)) set.add(u)
    })
    // alias keys
    Object.entries(ALIASES).forEach(([alias, canonical]) => {
      if (alias.includes(key)) set.add(canonical)
    })
    return Array.from(set).slice(0, 8)
  }, [text])

  function goTo(canonical: string) {
    if (!canonical) return
    router.push(`/u/${encodeURIComponent(canonical)}`)
  }

  function go() {
    if (!guess) return
    goTo(guess)
  }

  return (
    <main
      className={`${inter.className} min-h-screen relative flex flex-col items-center justify-center px-6 overflow-hidden`}
    >
      <div className="absolute inset-0 bg-white">
        <NetworkBackground />
      </div>

      {/* HELP BUTTON (top-right) */}
      <button
        onClick={() => setShowDemo(true)}
        className="fixed top-10 right-6 z-20 w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl border border-blue-500/20 backdrop-blur-sm"
        aria-label="Open instructions"
        title="How to use Qurious"
      >
        <span className="relative">
          ?
          <span className="absolute inset-0 rounded-full bg-white/10 blur-[6px]" />
        </span>
      </button>

      <div
        className={`relative z-10 flex flex-col items-center transition-all duration-1000 ease-out ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <h1 className="select-none text-6xl sm:text-7xl font-extrabold mb-3 tracking-tight relative">
          <span className="relative inline-block">
            {/* Animated background glow */}
            <span className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 blur-xl animate-pulse"></span>

            <span className="relative text-black">
              {/* Subtle text shadow for depth */}
              <span className="absolute inset-0 text-blue-600/30 blur-sm">
                {"Qurious".split("").map((letter, i) => (
                  <span
                    key={i}
                    className={`inline-block transition-all duration-500 ease-out ${
                      isJumping ? "transform -translate-y-3 scale-110" : ""
                    }`}
                    style={{
                      transitionDelay: isJumping ? `${i * 80}ms` : `${(5 - i) * 80}ms`,
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </span>
              <span className="relative">
                {"Qurious".split("").map((letter, i) => (
                  <span
                    key={i}
                    className={`inline-block transition-all duration-500 ease-out ${
                      isJumping ? "transform -translate-y-3 scale-110" : ""
                    }`}
                    style={{
                      transitionDelay: isJumping ? `${i * 80}ms` : `${(5 - i) * 80}ms`,
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </span>
            </span>

            {/* Floating particles around the text */}
            <div className="absolute -inset-4 pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-blue-400 rounded-full animate-ping"
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${10 + (i % 2) * 80}%`,
                    animationDelay: `${i * 0.5}s`,
                    animationDuration: "3s",
                  }}
                />
              ))}
            </div>
          </span>
        </h1>

        <p className="mb-10 text-gray-600 text-center max-w-md">
          Discover, connect, and explore the latest research from top universities.
        </p>
      </div>

      <div
        className={`relative z-10 w-full max-w-xl transition-all duration-1000 ease-out delay-300 ${
          isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
        }`}
      >
        {text && (
          <div className="mb-2 text-sm text-gray-500 text-center">
            {guess ? (
              <>
                Did you mean:{" "}
                {/* NEW: clickable suggestion */}
                <button
                  type="button"
                  onClick={() => goTo(guess)}
                  className="font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2"
                  title={`Open ${guess.replaceAll("_", " ")}`}
                >
                  {guess.replaceAll("_", " ")}
                </button>
                ?
              </>
            ) : (
              <>No match found</>
            )}
          </div>
        )}

        <div className="relative group">
          <div className="absolute inset-0 bg-blue-600/10 rounded-full blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
          <div className="relative flex items-center rounded-full bg-white border-2 border-gray-200 shadow-lg px-4 py-3 group-focus-within:border-blue-600/20 group-focus-within:shadow-blue-600/5 transition-all duration-300">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                // small delay so clicks on items still register
                setTimeout(() => setShowDropdown(false), 120)
              }}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="Enter your university name…"
              className="w-full text-base outline-none bg-transparent placeholder:text-gray-400 text-black"
              autoFocus
            />
            <button
              onClick={go}
              disabled={!guess}
              className="ml-2 grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:text-blue-600 disabled:opacity-40 transition-colors duration-200"
              aria-label="Search"
              title={guess ? `Open ${guess.replaceAll("_", " ")}` : "Enter a university"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 10-.71.71l.27.28v.79L20 21.5 21.5 20zM10 15.5A5.5 5.5 0 1115.5 10 5.5 5.5 0 0110 15.5"
                />
              </svg>
            </button>
          </div>

          {/* NEW: live dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-20">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // avoid input blur before click
                  onClick={() => goTo(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 focus:bg-blue-50 transition-colors text-sm"
                  title={`Open ${s.replaceAll("_", " ")}`}
                >
                  {s.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* “quick tour” pill under the search bar */}
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowDemo(true)}
            className="group inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:border-blue-300 shadow-sm hover:shadow transition-all"
            aria-label="Open quick tour"
            title="Quick tour"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[11px] leading-none">?</span>
            Quick tour
            <span className="translate-x-0 transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </div>
      </div>

      <footer className="absolute bottom-4 text-xs text-gray-400 z-10">© {new Date().getFullYear()} Qurious</footer>

      {/* State + usage unchanged */}
      <DemoVideoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />
    </main>
  )
}
