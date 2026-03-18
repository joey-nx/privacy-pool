# Frontend Development Guide

> Based on [crossd-frontend](https://github.com/to-nexus/crossd-frontend) conventions

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Next.js | 16+ | App Router, React Server Components |
| React | 19+ | UI framework |
| TypeScript | 5+ | Type safety |
| Tailwind CSS | v4 | Styling (PostCSS plugin) |
| pnpm | 10+ | Package manager |

### UI & State

| Library | Purpose |
|---------|---------|
| Radix UI | Headless components (accordion, popover, select, tabs, tooltip) |
| TanStack React Query | Server state management |
| Zod | Schema validation |
| clsx + tailwind-merge | className composition |
| class-variance-authority | Component variant system |
| Motion (framer-motion) | Animation |

### Blockchain

| Library | Purpose |
|---------|---------|
| wagmi | React hooks for Ethereum |
| viem | Lightweight Ethereum client |
| @latent/sdk | ZK proving + privacy pool interaction |

## Architecture — Feature-Sliced Design (FSD)

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx
│   └── [feature]/page.tsx
│
├── packages/
│   ├── shared/             # Layer 0: Common, reusable
│   │   ├── api/            # API endpoints (auto-generated)
│   │   ├── repository/     # DTO ↔ Entity conversion
│   │   ├── queries/        # React Query hooks
│   │   ├── dto/            # API types (snake_case)
│   │   ├── entity/         # Business types (camelCase)
│   │   ├── hooks/          # Generic hooks (useModal, useToast)
│   │   ├── utils/          # Axios, formatter, constants
│   │   ├── components/     # Reusable UI (Button, Modal, Table)
│   │   └── environments/   # Environment variables
│   │
│   ├── features/           # Layer 1: Domain-specific logic
│   │   ├── common/
│   │   │   └── hooks/contracts/  # wagmi contract hooks
│   │   ├── deposit/
│   │   ├── withdraw/
│   │   └── layout/
│   │
│   ├── views/              # Layer 2: Page-level composition
│   │   ├── Deposit.tsx
│   │   ├── Withdraw.tsx
│   │   └── History.tsx
│   │
│   └── providers/          # React Context providers
│       ├── app-provider.tsx
│       ├── query-provider.tsx
│       ├── wallet-provider.tsx
│       └── theme-provider.tsx
│
├── abi/                    # Contract ABI JSON files
├── generated/              # Auto-generated types
└── styles/                 # Tailwind design system
    ├── globals.css
    └── design-tokens/
        ├── theme.css
        ├── keyframes.css
        ├── base.css
        ├── component.css
        └── utilities.css
```

### FSD Dependency Rule (단방향만 허용)

```
shared → features → views → app(pages)
```

| Layer | Can Import |
|-------|-----------|
| `shared` | nothing (independent) |
| `features` | shared only |
| `views` | features, shared |
| `app` | views, features, shared |

**ESLint `import/no-restricted-paths`로 강제.**

## Naming Conventions

### Files & Directories

| Target | Convention | Example |
|--------|-----------|---------|
| Files | kebab-case | `deposit-form.tsx` |
| React Components | PascalCase | `DepositForm` |
| Hooks | use + camelCase file | `use-deposit-state.ts` |

### Code

| Target | Convention | Example |
|--------|-----------|---------|
| Variables/Functions | camelCase | `getUserBalance` |
| Hooks | use + camelCase | `useDepositState` |
| Constants | UPPER_SNAKE_CASE | `MAX_DEPOSIT_AMOUNT` |
| Types/Interfaces | PascalCase | `DepositFormState` |
| Enums | PascalCase | `TransactionStatus` |
| Enum members | UPPER_SNAKE_CASE | `PENDING`, `CONFIRMED` |

### DTO vs Entity

| Layer | Case | Example |
|-------|------|---------|
| DTO (API) | snake_case | `{ tx_hash, block_number }` |
| Entity (Frontend) | camelCase | `{ txHash, blockNumber }` |

Repository layer에서 변환 (`toEntity()`, `toDto()`).

## TypeScript Paths

```json
{
  "~shared/*": "./src/packages/shared/*",
  "~features/*": "./src/packages/features/*",
  "~views/*": "./src/packages/views/*",
  "~providers/*": "./src/packages/providers/*",
  "~abi/*": "./src/abi/*",
  "~generated/*": "./src/generated/*"
}
```

## Component Patterns

### Component Structure

```tsx
// ✅ Good — props interface + named export
interface DepositFormProps {
  tokenAddress: string;
  onSuccess?: (result: DepositResult) => void;
}

export function DepositForm({ tokenAddress, onSuccess }: DepositFormProps) {
  return (/* ... */);
}
```

### Variant System (CVA)

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("rounded-lg font-medium transition-colors", {
  variants: {
    variant: {
      primary: "bg-primary text-white hover:bg-primary/90",
      outline: "border border-gray-300 hover:bg-gray-50",
    },
    size: {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

### React Query Pattern

```tsx
// shared/queries/use-balance-query.ts
export function useBalanceQuery(address: string | undefined) {
  return useQuery({
    queryKey: ["balance", address],
    queryFn: () => balanceRepository.getBalance(address!),
    enabled: !!address,
    staleTime: 30_000,
  });
}
```

### Contract Hook Pattern (wagmi)

```tsx
// features/common/hooks/contracts/use-privacy-pool.ts
export function useDeposit() {
  const { writeContractAsync } = useWriteContract();

  return useMutation({
    mutationFn: async (params: DepositParams) => {
      const hash = await writeContractAsync({
        address: POOL_ADDRESS,
        abi: poolAbi,
        functionName: "deposit",
        args: [params.commitment, params.amount, params.encryptedNote],
      });
      return hash;
    },
  });
}
```

## Design System (Tailwind CSS v4)

### Token Structure

```css
/* styles/design-tokens/theme.css */
@theme {
  --color-primary: oklch(0.65 0.24 265);
  --color-surface: oklch(0.98 0 0);
  --color-text: oklch(0.15 0 0);

  --spacing-safe-top: env(safe-area-inset-top);
  --spacing-safe-bottom: env(safe-area-inset-bottom);

  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

### Dark Mode

```css
/* base.css */
@layer base {
  html { color-scheme: light; }
  html.dark { color-scheme: dark; }
}
```

Component에서: `className="bg-white dark:bg-gray-900"`

## Smart Contract Integration

### ABI → Hook → Feature 패턴

```
src/abi/privacy-pool.json          (ABI 원본)
      ↓
features/common/hooks/contracts/   (wagmi hooks)
      ↓
features/deposit/hooks/            (비즈니스 로직)
      ↓
views/Deposit.tsx                  (UI 조합)
```

### @latent/sdk Integration

```tsx
// providers/latent-provider.tsx
import { LatentClient } from "@latent/sdk";

const LatentContext = createContext<LatentClient | null>(null);

export function LatentProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<LatentClient | null>(null);

  useEffect(() => {
    const client = new LatentClient({
      sequencerUrl: process.env.NEXT_PUBLIC_SEQUENCER_URL!,
      poolAddress: process.env.NEXT_PUBLIC_POOL_ADDRESS!,
      tokenAddress: process.env.NEXT_PUBLIC_TOKEN_ADDRESS!,
    });
    client.init().then(() => { clientRef.current = client; });
    return () => { client.dispose(); };
  }, []);

  return <LatentContext.Provider value={clientRef.current}>{children}</LatentContext.Provider>;
}

export function useLatent() {
  const client = useContext(LatentContext);
  if (!client) throw new Error("useLatent must be used within LatentProvider");
  return client;
}
```

## Development Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Dev server + asset watchers |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint (FSD rule enforcement) |
| `pnpm type-check` | TypeScript strict check |

## Pre-Commit Checklist

- [ ] `pnpm type-check` — no TypeScript errors
- [ ] `pnpm lint` — no ESLint errors
- [ ] FSD dependency rule respected (no upward imports)
- [ ] No hardcoded strings (use environment variables)
- [ ] Dark mode tested
- [ ] Mobile responsive verified
- [ ] No `console.log` in production paths
- [ ] Sensitive data (private keys) never in client-side code

---

**Related**: [Coding Style](coding-style.md) | [Testing Strategy](testing.md) | [Git Workflow](git-workflow.md)
