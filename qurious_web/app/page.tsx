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
    // Generate initial nodes
    const initialNodes = Array.from({ length: 25 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.03,
      vy: (Math.random() - 0.5) * 0.03,
      id: i,
      size: 0.2 + Math.random() * 0.3,
    }))
    setNodes(initialNodes)

    // Animation loop
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

  // Calculate connections between nearby nodes
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

/** HELP MODAL — now a well-designed “How Qurious Works” guide. (Same prop signature; no external logic changes.) */
function DemoVideoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
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
          {/* Hero summary */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5">
            <p className={`${plusJakarta.className} text-gray-800 leading-relaxed`}>
              Qurious groups papers from a university into <span className="font-semibold">topic clusters</span> using
              text embeddings of each paper’s <span className="font-semibold">title + abstract</span> and{" "}
              <span className="font-semibold">cosine similarity</span>. This gives you a bird’s-eye view of the research
              landscape so you can jump straight to the work you care about.
            </p>
          </div>

          {/* Steps grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Card 1 */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg p-2 bg-blue-50 text-blue-700">
                  {/* search icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1014 15.5l.27.28v.79L20 21.5 21.5 20zM10 15.5A5.5 5.5 0 1115.5 10 5.5 5.5 0 0110 15.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className={`${plusJakarta.className} font-semibold text-gray-900`}>1) Find your university</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Type the name in the search bar and press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Enter</kbd>.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg p-2 bg-indigo-50 text-indigo-700">
                  {/* bubbles icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="7" cy="7" r="4" />
                    <circle cx="16" cy="10" r="3" opacity="0.7" />
                    <circle cx="12" cy="17" r="3" opacity="0.5" />
                  </svg>
                </div>
                <div>
                  <h4 className={`${plusJakarta.className} font-semibold text-gray-900`}>2) Explore topic clusters</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Each bubble is a cluster of papers that are close in the embedding space (high cosine similarity).
                    Bubble size ≈ number of papers. Hover for a snapshot, scroll to zoom, drag to pan.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg p-2 bg-purple-50 text-purple-700">
                  {/* click icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h4 className={`${plusJakarta.className} font-semibold text-gray-900`}>3) Open a cluster</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Click any bubble to see its papers in the right panel. Use the in-panel search to narrow results.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg p-2 bg-emerald-50 text-emerald-700">
                  {/* gaps icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M4 12h7M13 12h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </div>
                <div>
                  <h4 className={`${plusJakarta.className} font-semibold text-gray-900`}>4) See gaps & limitations</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    We analyze each paper to extract potential <span className="font-medium">limitations</span> and{" "}
                    <span className="font-medium">open gaps</span>—a quick way to spot where you could contribute or
                    follow up.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 5 */}
            <div className="rounded-xl border border-gray-200 p-5 bg-white md:col-span-2">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-lg p-2 bg-rose-50 text-rose-700">
                  {/* contact icon */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 6h16v12H4zM4 6l8 6 8-6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className={`${plusJakarta.className} font-semibold text-gray-900`}>5) Contact authors</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    When viewing limitations for a paper, the <span className="font-medium">Authors &amp; Contact</span>{" "}
                    card shows contributors and—when available—email links so you can reach out quickly.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tips box */}
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 p-4 text-sm">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                On desktop you can resize side panels by dragging their thin borders; on mobile the panels slide over
                the map.
              </li>
              <li>
                In the left panel, hovering a gap briefly highlights the related paper on the right to help you match
                context.
              </li>
              <li>Paper “Similarity” indicates closeness to the cluster centroid in the embedding space.</li>
            </ul>
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
    const hit = UNI_FILES.find((u) => normalize(u).startsWith(key)) || UNI_FILES.find((u) => normalize(u).includes(key))
    return hit || ""
  }, [text])

  function go() {
    if (!guess) return
    router.push(`/u/${encodeURIComponent(guess)}`)
  }

  return (
    <main
      className={`${inter.className} min-h-screen relative flex flex-col items-center justify-center px-6 overflow-hidden`}
    >
      <div className="absolute inset-0 bg-white">
        <NetworkBackground />
      </div>

      {/* HELP BUTTON: slightly lower, bigger, '?' icon */}
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
                Did you mean: <span className="font-medium text-blue-600">{guess.replaceAll("_", " ")}</span>?
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
              onChange={(e) => setText(e.target.value)}
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
        </div>
      </div>

      <footer className="absolute bottom-4 text-xs text-gray-400 z-10">© {new Date().getFullYear()} Qurious</footer>

      {/* State + usage unchanged */}
      <DemoVideoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />
    </main>
  )
}
