# Contributing to Agentiom

First off, thank you for considering contributing to Agentiom! It's people like you that make Agentiom such a great tool.

## Build in Public Philosophy

Agentiom is built in public. This means:

- **All code is open source** — MIT licensed, no hidden proprietary bits
- **Roadmap is public** — See what we're building and why
- **Discussions are open** — Join our Discord and GitHub Discussions
- **Progress is shared** — Follow along on Twitter/X

We believe transparency builds trust and creates better software.

## Ways to Contribute

### 🐛 Report Bugs

Found a bug? [Open an issue](https://github.com/agentiom/agentiom/issues/new?template=bug_report.md) with:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)

### 💡 Suggest Features

Have an idea? [Start a discussion](https://github.com/agentiom/agentiom/discussions/new?category=ideas) or [open an issue](https://github.com/agentiom/agentiom/issues/new?template=feature_request.md).

### 📖 Improve Documentation

Documentation can always be better. Feel free to:

- Fix typos
- Add examples
- Clarify confusing sections
- Translate to other languages

### 🔧 Submit Code

Ready to code? Here's how:

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- [Docker](https://docker.com)
- Git

### Getting Started

1. **Fork the repository**

   Click the "Fork" button on GitHub.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/agentiom.git
   cd agentiom
   ```

3. **Install dependencies**

   ```bash
   bun install
   ```

4. **Set up environment**

   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your credentials
   ```

5. **Start development**

   ```bash
   bun dev
   ```

### Project Structure

```
agentiom/
├── apps/
│   ├── api/          # Control plane API (Hono)
│   ├── app/          # Dashboard (Next.js)
│   ├── web/          # Marketing site
│   └── cli/          # CLI tool
├── packages/
│   ├── providers/    # Infrastructure abstraction (IMPORTANT!)
│   ├── db/           # Database schema
│   ├── shared/       # Shared types & utils
│   └── ui/           # UI components
└── tooling/          # Shared configs
```

### Key Concepts

#### Provider Abstraction

The `packages/providers` package is critical. It abstracts infrastructure so we can:

- Start with Fly.io
- Migrate to other providers later
- Support multiple providers

**Always use provider interfaces, never call Fly.io directly in application code.**

```typescript
// ✅ Good
const machine = await providers.compute.createMachine(config);

// ❌ Bad
const machine = await flyClient.createMachine(config);
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bug-fix
```

Branch naming:

- `feature/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation
- `refactor/` — Code refactoring
- `test/` — Adding tests

### 2. Make Changes

- Follow the code style (Biome handles this)
- Write tests for new functionality
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run all tests
bun test

# Run linting
bun lint

# Type check
bun typecheck

# Format code
bun format
```

### 4. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(api): add agent deployment endpoint"
git commit -m "fix(cli): handle missing config file"
git commit -m "docs: update installation guide"
```

Types:

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `refactor` — Code refactoring
- `test` — Adding tests
- `chore` — Maintenance

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Then [create a Pull Request](https://github.com/agentiom/agentiom/compare) on GitHub.

### PR Guidelines

- Fill out the PR template
- Link related issues
- Include screenshots for UI changes
- Ensure CI passes
- Request review from maintainers

## Code Style

We use [Biome](https://biomejs.dev) for linting and formatting. Run:

```bash
bun format
bun lint:fix
```

### TypeScript Guidelines

- Use `type` for object shapes, `interface` for contracts
- Prefer `const` assertions
- Always handle errors explicitly
- Use Zod for runtime validation

### React Guidelines

- Server Components by default
- `'use client'` only when needed
- Use Shadcn/ui components
- Colocate components with routes

## Testing

### Running Tests

```bash
# All tests
bun test

# Specific package
bun test --filter=@agentiom/providers

# Watch mode
bun test:watch
```

### Writing Tests

```typescript
import { describe, test, expect, mock } from 'bun:test';

describe('AgentService', () => {
  test('creates agent with correct config', async () => {
    // Arrange
    const mockProvider = { createMachine: mock(() => Promise.resolve({})) };

    // Act
    const result = await service.create(userId, data);

    // Assert
    expect(result.name).toBe('my-agent');
  });
});
```

## Getting Help

- **Discord**: [discord.gg/agentiom](https://discord.gg/agentiom)
- **GitHub Discussions**: [Discussions](https://github.com/agentiom/agentiom/discussions)
- **Twitter/X**: [@agentiom](https://twitter.com/agentiom)

## Recognition

Contributors are recognized in:

- README.md contributors section
- Release notes
- Our Discord #contributors channel

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
