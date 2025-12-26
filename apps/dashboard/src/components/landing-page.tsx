'use client';

import Link from 'next/link';
import Image from 'next/image';
import { PixelBackground } from './pixel-background';
import { AnimatedTerminal } from './animated-terminal';

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Pixel Background */}
      <PixelBackground />

      {/* Content overlay */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="flex items-center justify-between px-6 py-4">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="Agentiom"
              width={150}
              height={17}
              className="h-4 w-auto"
              priority
            />
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-white text-black font-bold uppercase tracking-wide hover:bg-gray-100 transition-colors"
          >
            <span className="font-mono text-base">&gt;_</span>
            Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </nav>

        {/* Hero Section */}
        <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">Build Agents,</span>{' '}
              <span className="text-gray-500">Not Infrastructure</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Create and{' '}
              <span className="bg-white text-black px-1 py-0.5">deploy</span>{' '}
              AI agents in one command. Open source. Zero lock-in.
            </p>

            {/* Terminal Commands */}
            <div className="mb-12 space-y-2">
              {/* First command - one liner */}
              <div className="inline-flex items-center gap-3 bg-[#1a1a1a] border border-gray-800 px-4 py-2 rounded font-mono text-sm">
                <span className="text-gray-400">$</span>
                <span className="text-gray-200">npx agentiom create my-agent</span>
                <button
                  onClick={() => navigator.clipboard.writeText('npx agentiom create my-agent')}
                  className="ml-4 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" />
                  </svg>
                </button>
              </div>

              {/* Terminal window */}
              <AnimatedTerminal />
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-3 bg-white hover:bg-gray-100 text-black font-bold px-6 py-3 transition-colors uppercase tracking-wide text-sm"
              >
                <span className="font-mono text-lg">&gt;_</span>
                Initialize Tools
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="https://github.com/agentiom/agentiom-starter"
                target="_blank"
                className="inline-flex items-center gap-2 bg-black border-2 border-white hover:bg-white hover:text-black text-white font-bold px-6 py-3 transition-colors uppercase tracking-wide text-sm"
              >
                Docs
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-500 animate-bounce">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </main>

        {/* Features Section */}
        <section className="relative z-10 bg-[#0a0a0a] text-white py-24 px-4 border-t border-gray-800">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                From Your Terminal To The Cloud.
                <br />
                <span className="text-gray-500">In Seconds.</span>
              </h2>

              {/* CLI Command */}
              <div className="inline-flex items-center gap-3 bg-[#1a1a1a] border border-gray-800 px-6 py-3 font-mono text-sm mt-8">
                <span className="text-white">▸</span>
                <span className="text-gray-300">npm install -g @agentiom/cli</span>
                <button
                  onClick={() => navigator.clipboard.writeText('npm install -g @agentiom/cli')}
                  className="ml-4 text-gray-500 hover:text-gray-300 transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Persistent Storage */}
              <div className="bg-[#1a1a1a] border border-gray-800 p-6 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Persistent Storage</h3>
                <p className="text-gray-400 text-sm">
                  Real filesystem that survives restarts. Store files, databases, vector stores—anything.
                </p>
              </div>

              {/* Wake on Trigger */}
              <div className="bg-[#1a1a1a] border border-gray-800 p-6 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Wake on Trigger</h3>
                <p className="text-gray-400 text-sm">
                  Agents sleep when idle, wake instantly on email, webhook, cron, or API call.
                </p>
              </div>

              {/* Email Interface */}
              <div className="bg-[#1a1a1a] border border-gray-800 p-6 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Email Interface</h3>
                <p className="text-gray-400 text-sm">
                  Every agent gets an inbox. Send an email → agent wakes and responds.
                </p>
              </div>

              {/* Cron Scheduling */}
              <div className="bg-[#1a1a1a] border border-gray-800 p-6 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Cron Scheduling</h3>
                <p className="text-gray-400 text-sm">
                  Run agents on a schedule. Daily reports, weekly checks, hourly syncs.
                </p>
              </div>

              {/* Browser Built-in */}
              <div className="bg-[#1a1a1a] border border-gray-800 p-6 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Browser Built-in</h3>
                <p className="text-gray-400 text-sm">
                  Agents can browse the web, fill forms, scrape data. Headless Chrome included.
                </p>
              </div>

              {/* Isolated Runtime */}
              <div className="bg-[#1a1a1a] border border-gray-800 p-6 hover:border-gray-700 transition-colors">
                <div className="w-12 h-12 bg-white/10 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">Isolated Runtime</h3>
                <p className="text-gray-400 text-sm">
                  Each agent runs in its own container with full Linux environment.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 bg-[#0a0a0a] border-t border-gray-800 py-8 px-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-gray-500 font-mono text-sm">[AGENTIOM]</div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="https://github.com/agentiom/agentiom-starter" className="hover:text-white transition-colors">Docs</Link>
              <Link href="#" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="#" className="hover:text-white transition-colors">Blog</Link>
              <Link href="https://github.com/agentiom/agentiom-starter" className="hover:text-white transition-colors">GitHub</Link>
              <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
