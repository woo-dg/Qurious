"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useEffect } from "react"
import { Inter } from "next/font/google"
const inter = Inter({ subsets: ["latin"] })

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
      vx: (Math.random() - 0.5) * 0.03, // Slightly increased velocity range
      vy: (Math.random() - 0.5) * 0.03,
      id: i,
      size: 0.2 + Math.random() * 0.3, // Random node sizes between 0.2 and 0.5
    }))
    setNodes(initialNodes)

    // Animation loop
    const animate = () => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          // Occasionally change direction slightly for more organic movement
          const shouldChangeDirection = Math.random() < 0.005
          let newVx = node.vx
          let newVy = node.vy

          if (shouldChangeDirection) {
            newVx += (Math.random() - 0.5) * 0.01
            newVy += (Math.random() - 0.5) * 0.01
            // Keep velocities within reasonable bounds
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
    const maxDistance = 30 // Increased from 25
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
            opacity: opacity * 0.6, // Scale down for subtlety
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
            {/* Subtle glow effect */}
            <circle
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size * 1.2}
              fill="#1e40af"
              opacity="0.2"
              className="animate-pulse"
              style={{ animationDelay: `${node.id * 0.2}s`, animationDuration: "3s" }}
            />
            {/* Main node */}
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

function DemoVideoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">Qurious Demo</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close demo"
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
        <div className="p-6">
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M8 5V19L19 12L8 5Z" fill="#1e40af" stroke="#1e40af" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-gray-600">Demo video will be embedded here</p>
              <p className="text-sm text-gray-400 mt-2">Replace this placeholder with your actual video</p>
            </div>
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
      setTimeout(() => setIsJumping(false), 1500) // Increased duration for smoother effect
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

      <button
        onClick={() => setShowDemo(true)}
        className="fixed top-6 right-6 z-20 w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl border border-blue-500/20 backdrop-blur-sm"
        aria-label="Watch demo video"
        title="Watch demo video"
      >
        <span className="relative">
          *<span className="absolute inset-0 animate-ping text-blue-200 opacity-75">*</span>
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

      <DemoVideoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />
    </main>
  )
}
