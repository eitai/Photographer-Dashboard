# Koral Light Studio — Claude Instructions

## Default Orchestration

For any task involving feature development, architectural decisions, prioritization, or multi-agent coordination, route through the `product-orchestrator` agent first. It will break down the work and delegate to specialist subagents:

| Agent | Role |
|---|---|
| `react-frontend-engineer` | React/TypeScript UI, components, hooks |
| `backend-api-guardian` | Express API, MongoDB, auth, security |
| `devops-infrastructure-engineer` | Docker, CI/CD, environment config |
| `product-design-architect` | UI/UX design, design system, Tailwind tokens |
| `fullstack-ts-reviewer` | Code review, quality, performance |

## When to use the product-orchestrator
- Starting any new feature
- Unsure what to work on next
- A task spans more than one layer (frontend + backend, design + code)
- Resolving conflicting technical decisions

## When to go direct to a specialist
- Small, clearly scoped tasks (e.g. "fix this bug in component X")
- You explicitly name the agent you want

## Project Stack
- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui (`src/`)
- **Backend**: Express.js + MongoDB at `../koral-api/`
- **Auth**: JWT, admin model with `adminId` on all content
- **i18n**: Hebrew + English via `src/lib/i18n.tsx`
- **Design tokens**: Blush `#E7B8B5`, Ivory `#FAF8F4`
