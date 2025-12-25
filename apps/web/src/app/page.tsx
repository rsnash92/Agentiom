import Link from 'next/link';
import {
  Nav,
  PixelBackground,
  CommandLine,
  Terminal,
  AgentCard,
  NetworkViz,
  FeatureCard,
  Footer,
  ArrowRightIcon,
  BoxIcon,
  ActivityIcon,
  MailIcon,
  ClockIcon,
  LayoutIcon,
  ShieldIcon,
} from '@/components';

const agents = [
  { name: 'Researcher', initial: 'R', description: 'Deep web research assistant', status: 'running' as const, url: 'researcher.agentiom.dev', color: 'blue' as const },
  { name: 'Analyst', initial: 'A', description: 'Data analysis expert', status: 'running' as const, url: 'analyst.agentiom.dev', color: 'orange' as const },
  { name: 'Scout', initial: 'S', description: 'Market monitoring agent', status: 'running' as const, url: 'scout.agentiom.dev', color: 'green' as const },
  { name: 'Writer', initial: 'W', description: 'Content creation assistant', status: 'sleeping' as const, url: 'writer.agentiom.dev', color: 'purple' as const },
  { name: 'Coder', initial: 'C', description: 'Code review & generation', status: 'running' as const, url: 'coder.agentiom.dev', color: 'cyan' as const },
  { name: 'Monitor', initial: 'M', description: 'Infrastructure watchdog', status: 'running' as const, url: 'monitor.agentiom.dev', color: 'pink' as const },
];

const features = [
  { icon: <BoxIcon />, title: 'Persistent Storage', description: 'Real filesystem that survives restarts. Store files, databases, vector stores—anything.' },
  { icon: <ActivityIcon />, title: 'Wake on Trigger', description: 'Agents sleep when idle, wake instantly on email, webhook, cron, or API call.' },
  { icon: <MailIcon />, title: 'Email Interface', description: 'Every agent gets an inbox. Send an email → agent wakes and responds.' },
  { icon: <ClockIcon />, title: 'Cron Scheduling', description: 'Run agents on a schedule. Daily reports, weekly checks, hourly syncs.' },
  { icon: <LayoutIcon />, title: 'Browser Built-in', description: 'Agents can browse the web, fill forms, scrape data. Headless Chrome included.' },
  { icon: <ShieldIcon />, title: 'Isolated Runtime', description: 'Each agent runs in its own container with full Linux environment.' },
];

export default function Home() {
  return (
    <>
      <PixelBackground />
      <Nav />

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center pt-24 pb-20 px-5 relative z-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-center mb-5 tracking-tighter leading-tight">
          <span className="text-gray-900">Deploy Agents,</span>
          <span className="text-gray-400"> Not Servers</span>
        </h1>

        <p className="text-base md:text-lg text-gray-500 text-center mb-12">
          Create and{' '}
          <span className="bg-primary text-white px-2 py-0.5 font-medium">
            deploy
          </span>{' '}
          stateful AI agents in one command. Persistent storage. Zero cold starts.
        </p>

        <div className="w-full max-w-[700px] mb-12">
          <CommandLine command="npx agentiom init my-agent" />
          <Terminal
            lines={[
              { prompt: true, text: 'npx agentiom deploy' },
              { status: true, text: 'Deploying...' },
            ]}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/signup"
            className="bg-primary hover:bg-primary-dark text-white px-8 py-3.5 text-[15px] font-semibold inline-flex items-center gap-2 justify-center transition-colors"
          >
            Start Building
            <ArrowRightIcon />
          </Link>
          <Link
            href="/docs"
            className="bg-transparent hover:bg-gray-100 text-gray-900 px-8 py-3.5 text-[15px] font-semibold border-[1.5px] border-gray-300 hover:border-gray-900 inline-flex items-center justify-center transition-all"
          >
            Docs
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-5 md:px-10 relative z-10">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 mb-4">
          <span className="w-2 h-2 bg-primary" />
          Build Stateful Agents
        </div>

        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Persistent memory, storage and triggers
        </h2>

        <p className="text-base text-gray-500 max-w-xl leading-relaxed mb-12">
          Fully autonomous agents with real filesystems, scheduled wake-ups, and
          email interfaces. Your agents remember everything and run forever.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl">
          {/* Agent Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => (
              <AgentCard key={agent.name} {...agent} />
            ))}
          </div>

          {/* Network Visualization */}
          <NetworkViz />
        </div>
      </section>

      {/* CLI Section */}
      <section className="py-24 px-5 text-center relative z-10">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-12 leading-snug">
          From Your Terminal To The Cloud.
          <br />
          In Seconds.
        </h2>

        <div className="max-w-xl mx-auto">
          <CommandLine command="npm install -g @agentiom/cli" />
        </div>
      </section>

      {/* Features List */}
      <section className="py-16 pb-24 px-5 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
