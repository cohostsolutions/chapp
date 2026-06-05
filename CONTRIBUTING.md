# Contributing to AlCor Nexus

Thanks for contributing! This guide will help you get started.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (check `.node-version`)
- Deno (for edge functions)
- Git

### Setup Local Development

```bash
# 1. Clone the repository
git clone <repository-url>
cd canvascapital

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase URL and keys

# 4. Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

## 📝 Development Workflow

### Creating a Feature Branch

```bash
# Update main branch first
git checkout main
git pull origin main

# Create feature branch with descriptive name
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
git checkout -b docs/documentation-update
```

### Making Changes

```bash
# Run code quality checks before committing
npm run lint              # Check code style
npm run type-check        # Check TypeScript types
npm run test              # Run tests (coming soon)
npm run build             # Test production build
```

### Commit Messages

Use descriptive commit messages:
```
✨ feat: Add AI conversation history
🐛 fix: Prevent cross-org data access
📝 docs: Update security documentation
♻️ refactor: Simplify auth flow
⚡ perf: Optimize database queries
🧪 test: Add tests for lead creation
```

### Pushing Changes

```bash
# Push to your feature branch
git push origin feature/your-feature-name

# Create Pull Request on GitHub
# - Write clear description
# - Link related issues
# - Request review from team members
```

## 🔍 Code Quality Standards

### TypeScript
- Use strict mode (enforced in tsconfig.json)
- Avoid `any` types
- Add explicit type annotations for function parameters
- Use interfaces for complex object shapes

```typescript
// ✅ Good
function processData(data: Record<string, unknown>): Promise<ProcessedData> {
  // ...
}

// ❌ Bad
function processData(data: any): any {
  // ...
}
```

### React Components
- Prefer functional components with hooks
- Use React.memo for expensive computations
- Extract reusable logic to custom hooks
- Keep components small and focused

```typescript
// ✅ Good
interface UserCardProps {
  userId: string;
  onSelect: (id: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ userId, onSelect }) => (
  <button onClick={() => onSelect(userId)}>User {userId}</button>
);

export default React.memo(UserCard);

// ❌ Bad
export default function UserCard(props: any) {
  // ...
}
```

### Edge Functions
- Use auth-guard utilities for authentication
- Validate all inputs with Zod
- Use shared utilities (sanitization, logging, errors)
- Add telemetry with organization context

```typescript
import { verifyAuth, enforceOrganizationAccess } from "../_shared/auth-guard.ts";
import { sanitizeConversationHistory } from "../_shared/sanitization.ts";
import { logAIError } from "../_shared/ai-errors.ts";

serve(async (req: Request) => {
  const authContext = await verifyAuth(authHeader, ...);
  if (!authContext) {
    return createAuthErrorResponse('Unauthorized', corsHeaders);
  }

  const authorizedOrgId = enforceOrganizationAccess(authContext, orgId);
  // ... rest of function
});
```

## 🧪 Testing

### Running Tests
```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

### Writing Tests
- Add unit tests for utilities and logic
- Add component tests for UI components
- Add edge function tests for API security
- Aim for 70%+ code coverage

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## 🔐 Security Guidelines

### Never commit:
- API keys or secrets
- Credentials in code
- `.env.local` files
- Private tokens

### Always:
- Use environment variables for secrets
- Validate user input with Zod
- Check authorization with auth-guard
- Sanitize data before using in AI prompts
- Log security events with organization context

### For Edge Functions:
- Verify JWT tokens
- Enforce organization access
- Validate file uploads (MIME type, size)
- Use persistent rate limiting
- Sanitize extracted text for PII

See [SECURITY.md](./SECURITY.md) for detailed security guidelines.

## 📊 Performance Tips

- Use React Query for data fetching
- Implement lazy loading for images
- Use Code splitting for large components
- Cache frequently accessed data
- Monitor performance with devtools

See [PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md) for optimization details.

## 🐛 Debugging

### Browser DevTools
```javascript
// In browser console
// Check React Query cache
localStorage.getItem('_REACT_QUERY_CACHE')

// Check performance metrics
performance.getEntriesByType('navigation')
```

### Edge Function Debugging
```bash
# View live logs
supabase functions list
supabase functions serve ai-chat

# Test locally
curl -X POST http://localhost:54321/functions/v1/ai-chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

### Supabase Studio
- View and query database
- Monitor edge function logs
- Manage authentication
- Check storage buckets
- Review realtime subscriptions

URL: `https://app.supabase.com/project/sfqzmjbggrwczvrewqsb`

## 📚 Documentation

### Update when:
- Adding new features
- Changing behavior
- Fixing bugs (if doc-worthy)
- Improving processes

### Where to document:
- Code comments for complex logic
- `SECURITY.md` for security decisions
- `PERFORMANCE_GUIDE.md` for optimization
- `DEPLOYMENT.md` for deployment steps
- Component docstrings for props

## 🎯 Common Tasks

### Adding a new API endpoint
1. Create edge function in `supabase/functions/`
2. Add auth validation with `auth-guard.ts`
3. Add input validation with Zod
4. Add error handling with `ai-errors.ts`
5. Document endpoint in `API.md`
6. Add tests for auth and logic

### Adding a new component
1. Create `.tsx` file in appropriate directory
2. Use TypeScript interfaces for props
3. Add propTypes or JSDoc comments
4. Export memoized component if needed
5. Add test file (`.test.tsx`)
6. Import and use in feature

### Adding a database table
1. Create migration in `supabase/migrations/`
2. Add RLS policies in migration
3. Update TypeScript types
4. Document in data schema
5. Create index if needed

## 💬 Getting Help

- Ask in team Slack/Discord
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [SECURITY.md](./SECURITY.md) for auth issues
- Check existing issues on GitHub

## 📋 PR Checklist

Before submitting PR:
- [ ] Code follows style guide
- [ ] No console.error/log statements
- [ ] TypeScript types are correct
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No secrets committed
- [ ] Tested locally
- [ ] Branch is up to date with main

## 🚀 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment procedures.

## 📞 Questions?

Create a discussion or ask in #dev channel in Slack/Discord.

---

**Happy coding!** 🎉
