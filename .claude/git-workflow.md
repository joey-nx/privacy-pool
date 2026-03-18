# Git Workflow and Commit Guidelines

> **Based on**: [Angular Commit Message Guidelines](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md)

We have very precise rules over how our Git commit messages must be formatted.
This format leads to **easier to read commit history** and makes it analyzable for changelog generation.

## When to Suggest Commits

Claude should **proactively suggest commits** at these points:

### ✅ SUGGEST COMMIT WHEN:
- A logical unit of work is complete and working
- Code compiles without errors or warnings
- Relevant tests pass
- Before switching to a different layer or feature
- After completing a self-contained change

### ❌ DON'T SUGGEST COMMIT WHEN:
- Code doesn't compile
- Tests are failing
- Work is incomplete
- Multiple unrelated changes are mixed
- You're uncertain if the approach is correct (ask first)

## Commit Message Format

Each commit message consists of a **header**, a **body**, and a **footer**.

```
<header>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The `header` is **mandatory** and must conform to the Commit Message Header format.

The `body` is **mandatory for all commits except for those of type "docs"**.
When the body is present it must be **at least 20 characters long**.

The `footer` is **optional** and used for breaking changes, deprecations, and issue references.

## Commit Message Header

```
<type>(<scope>)[!]: <short summary>
  │       │     │             │
  │       │     │             └─⫸ Summary in present tense. Not capitalized. No period at the end.
  │       │     │
  │       │     └─⫸ Optional "!" after scope indicates a BREAKING CHANGE
  │       │
  │       └─⫸ Commit Scope: Module or feature names (optional but recommended)
  │
  └─⫸ Commit Type: build|chore|ci|docs|feat|fix|perf|refactor|style|test
```

The `<type>` and `<summary>` fields are **mandatory**, the `(<scope>)` field is **optional but recommended**.

### Summary Rules

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No period (.) at the end
- **Keep it under 80 characters**

### Type

Must be one of the following:

| Type         | Description                                                                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **build**    | Changes that affect the build system or external dependencies                                                                                                                                                                       |
| **chore**    | Minor housekeeping tasks that do not affect production logic. Examples: typo fixes, updating `.gitignore`, modifying `.env.example`, or adjusting linter/config settings                                                            |
| **ci**       | Changes to CI configuration files and scripts (examples: GitHub Actions, GitLab CI)                                                                                                                                             |
| **docs**     | Documentation only changes                                                                                                                                                                                                          |
| **feat**     | A new feature                                                                                                                                                                                                                       |
| **fix**      | A bug fix. If the bug is non-trivial (e.g., not just a typo or obvious mistake), clearly explain the incorrect behavior and its cause in the commit body to ensure future readers can understand the context and impact of the fix. |
| **perf**     | A code change that improves performance                                                                                                                                                                                             |
| **refactor** | A code change that neither fixes a bug nor adds a feature                                                                                                                                                                           |
| **style**    | Code formatting changes that do **not affect behavior or logic**. Examples: white-space adjustments, indentation, semicolon fixes, sorting imports                                                                    |
| **test**     | Adding missing tests or correcting existing tests                                                                                                                                                                                   |

### Scope

The scope should be the name of the module or feature affected by the change.

Refer to the project structure to determine appropriate scopes for your commits.

### BREAKING CHANGE

A commit that either:
- Contains a `BREAKING CHANGE: ` footer, **or**
- Appends a `!` after the type/scope (e.g., `feat!:` or `feat(api)!:`)

introduces a breaking API change (correlating with **MAJOR** in Semantic Versioning).

### Examples

```bash
# ✅ Good Examples
feat(auth): add JWT token validation middleware
fix(api): prevent null pointer in user handler
refactor(service): extract validation logic into module
test(user): add integration tests for CRUD operations
perf(db): add index on user_email column
feat(api)!: change user endpoint response format

# ❌ Bad Examples
"fixed bug"           # Too vague, missing type/scope
"Updated code"        # Not descriptive, wrong tense
"WIP"                 # Work in progress - don't commit
"feat: add user management and fix auth"  # Too many changes
"Add feature."        # Capitalized, has period
```

## Commit Message Body

**Required for all commits except "docs" type. Minimum 20 characters.**

Just as in the summary, use the imperative, present tense: "fix" not "fixed" nor "fixes".

Explain the **motivation** for the change. This commit message should explain **WHY** you are making the change.
You can include a comparison of the previous behavior with the new behavior to illustrate the impact.

Try to keep lines under 80 characters for readability.

**Example:**

```
feat(auth): implement JWT authentication

Add token-based authentication to replace session-based auth.
This enables stateless API requests and improves scalability.

Token expiration set to 24 hours with refresh token support.
Password hashing uses argon2 for enhanced security.
```

## Commit Message Footer

The footer is **optional** and can contain information about breaking changes, deprecations, and issue references.

### Breaking Changes

A Breaking Change section should start with `BREAKING CHANGE: ` followed by a summary of the breaking change, a blank line, and a detailed description that includes migration instructions.

**Example:**

```
feat(api)!: change user endpoint response format

Restructure API response to use envelope pattern for consistency.

BREAKING CHANGE: User endpoint now returns data in 'data' field

Previous response:
{ "id": 1, "name": "John" }

New response:
{ "data": { "id": 1, "name": "John" } }

Migration: Update client code to access user.data instead of user directly.

Fixes #123
```

### Deprecations

A Deprecation section should start with `DEPRECATED: ` followed by a short description, a blank line, and a detailed description with the recommended update path.

**Example:**

```
feat(api): add new user query endpoint

DEPRECATED: /api/users/search endpoint

The /api/users/search endpoint is deprecated and will be removed in v2.0.
Use /api/users?query= instead for better performance and flexibility.

Closes #456
```

### Issue References

Reference GitHub issues and PRs that this commit closes or relates to:

- `Fixes #123` - Closes issue #123
- `Closes #456` - Closes pull request #456
- `Refs #789` - References issue #789 without closing it

## Revert Commits

If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit.

The commit message body should contain:
- Information about the SHA of the commit being reverted: `This reverts commit <SHA>`
- A clear description of the reason for reverting

**Example:**

```
revert: feat(auth): implement JWT authentication

This reverts commit a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.

Reverting due to performance issues in production.
Session-based auth will be used until JWT implementation is optimized.
```

## Claude's Commit Workflow

### 1. Identify Commit Point

When you complete a logical unit:

```
✅ I've completed the user authentication service.

Components added:
- JWT token generation
- Password hashing
- Validation middleware

All tests are passing. This is a good commit point.
```

### 2. Suggest Commit Command

```bash
📝 Suggested commit:

git add src/services/auth_service.rs src/middleware/jwt.rs tests/auth_tests.rs
git commit -m "feat(auth): implement JWT authentication service

Add token-based authentication for secure user sessions.
Enables stateless API requests with configurable expiration.

Includes token generation, password hashing with argon2,
and validation middleware for protected routes.

Closes #23"
```

**Note:** Body is mandatory (except for docs commits) and must be at least 20 characters.
Explain WHY the change is being made, not just WHAT changed.

### 3. Explain Rationale

```
This commit includes all the authentication components
as a single logical unit. We can now proceed with
implementing the authorization layer.

Ready to continue?
```

## Multi-Step Development

For larger features, suggest commits at each step:

### Example: User Management Feature

```
I'll break this into committable steps:

Step 1: User model and repository
Step 2: User service with business logic
Step 3: API endpoints
Step 4: Tests

Let's start with step 1...

[After completing step 1]

📝 Suggested commit:

git add src/models/user.rs src/repositories/user_repository.rs
git commit -m "feat(models): add User model and repository

Create foundational data structures for user management.
Enables user storage and retrieval from database.

Includes User struct with id, email, and password_hash fields.
Implements UserRepository trait with CRUD operations."

Ready for step 2?
```

## Commit Size Guidelines

### Atomic Commits

Each commit = ONE logical change:

- ✅ One feature
- ✅ One bug fix
- ✅ One refactoring
- ❌ Multiple unrelated changes

### Size Recommendations

- **Small**: 10-100 lines (ideal)
- **Medium**: 100-300 lines (acceptable)
- **Large**: 300+ lines (consider breaking down)

## Interactive Approach

Always ask before committing:

```
✅ "Authentication service is complete. Shall I suggest a commit?"

✅ "This looks like a good commit point. Would you like me to prepare the commit message?"

✅ "We've completed the user model. Should we commit this before moving to the service layer?"
```

## Pre-Commit Checklist

Before suggesting a commit, verify:

- [ ] Code compiles (`cargo build`)
- [ ] No compiler warnings
- [ ] Tests pass (`cargo nextest run`)
- [ ] No debug code (`println!`, `dbg!`)
- [ ] Changes are focused on one logical unit
- [ ] Commit message header follows format: `<type>(<scope>): <summary>`
- [ ] Summary is under 80 characters, imperative mood, no period
- [ ] Body is present (mandatory except for docs) and at least 20 characters
- [ ] Body explains WHY, not just WHAT
- [ ] Footer includes issue references if applicable

## Branch Naming

When creating branches:

```
<type>/<issue-number>-<description>

Examples:
feat/42-user-authentication
fix/123-token-expiration
refactor/89-extract-validators
```

Branch names must follow these rules:
- Use lowercase
- Use hyphens to separate words
- Include type prefix matching commit types
- Include issue number when applicable

## Pull Request Guidelines

> **Core Principle**: Clarity and traceability. "A PR author is one, but reviewers are many."

### 1. Before Creating PR

Ensure your code meets these standards:

**File Formatting**
- [ ] Every file ends with a single newline character
- [ ] No extra blank lines at file endings
- [ ] No trailing whitespaces at line ends

**Code Quality**
- [ ] Follows [Google Style Guide](https://google.github.io/styleguide/)
- [ ] Linting and formatting applied (`cargo fmt`, `cargo clippy`)
- [ ] All tests pass (`cargo nextest run`)
- [ ] Code compiles without warnings

**Commit Quality**
- [ ] All commits are atomic and logically organized
- [ ] Style changes separated from functional changes
- [ ] Every commit is independently buildable and testable
- [ ] Commit messages follow the format in this document

**Clarity & Context**
- [ ] Include inline comments explaining non-obvious logic or decisions
- [ ] Reference external code/documentation with links
- [ ] Use only the first 7 characters of commit SHAs in GitHub links

### 2. PR Template Structure

Use this template for all PRs:

```markdown
## Description

[Explain what changes you made and why]

## Related Issues/PRs

- Fixes #[issue number]
- Related to #[issue/PR number]

## Checklist

- [ ] Branch name follows [Branch Guideline](https://github.com/zk-rabbit/.github/blob/main/BRANCH_GUIDELINE.md)
- [ ] Commit messages follow [Commit Message Guideline](https://github.com/zk-rabbit/.github/blob/main/COMMIT_MESSAGE_GUIDELINE.md)
- [ ] Checked [Pull Request Guideline](https://github.com/zk-rabbit/.github/blob/main/PULL_REQUEST_GUIDELINE.md)
```

### 3. Draft PR Workflow

#### When to Use Draft

Create as Draft PR when:
- Work is in progress
- Not ready for review
- Seeking early feedback on approach
- Creating stacked PRs (see below)

#### Transitioning to Review

When ready for review:
1. Change status from "Draft" to "Ready for review" on GitHub
2. Notify teammates explicitly (e.g., via Slack)
3. Ensure all checklist items are completed

### 4. Stacked PR Structure

For large features spanning multiple PRs:

```
main
 └─ feat/123-auth-foundation     (PR #1)
     └─ feat/124-auth-service    (PR #2)
         └─ feat/125-auth-api    (PR #3)
```

**Guidelines:**
- Base each PR on the previous PR branch, not main
- Keep each PR focused and reviewable
- Merge in order (PR #1 → #2 → #3)
- Rebase subsequent PRs after each merge

**Example:**
```bash
# Create foundation PR
git checkout -b feat/123-auth-foundation main
# ... work and create PR #1

# Create service PR based on foundation
git checkout -b feat/124-auth-service feat/123-auth-foundation
# ... work and create PR #2

# After PR #1 merges, rebase PR #2
git checkout feat/124-auth-service
git rebase main
git push --force-with-lease
```

### 5. Avoiding Intermediate Changes

**Don't:**
- ❌ Add unrelated fixes in the same PR
- ❌ Change formatting across entire files
- ❌ Refactor unrelated code
- ❌ Update dependencies unnecessarily

**Do:**
- ✅ Keep changes focused on PR objective
- ✅ Create separate PRs for separate concerns
- ✅ Fix only what's necessary for your feature

### Claude's PR Creation Workflow

When helping create PRs, Claude should:

```bash
📝 Creating PR:

# Push branch to remote
git push -u origin feat/123-user-authentication

# Create PR with GitHub CLI
gh pr create \
  --title "feat(auth): implement user authentication system" \
  --body "$(cat <<'EOF'
## Description

Implement JWT-based authentication system for user management.
This enables secure user sessions with stateless API requests.

### Changes
- Add User model and repository
- Implement JWT token generation and validation
- Create authentication middleware
- Add login/logout endpoints

## Related Issues/PRs

Fixes #123

## Checklist

- [x] Branch name follows [Branch Guideline](https://github.com/zk-rabbit/.github/blob/main/BRANCH_GUIDELINE.md)
- [x] Commit messages follow [Commit Message Guideline](https://github.com/zk-rabbit/.github/blob/main/COMMIT_MESSAGE_GUIDELINE.md)
- [x] Checked [Pull Request Guideline](https://github.com/zk-rabbit/.github/blob/main/PULL_REQUEST_GUIDELINE.md)
EOF
)"
```

## Example Interactions

### Example 1: Feature Complete

```
User: "Create a user registration endpoint"

Claude: [generates code]

✅ User registration endpoint is complete:
- Email validation
- Password strength checking
- Duplicate detection
- Error handling

Tests are passing.

📝 Suggested commit:

git add src/api/user_handler.rs tests/user_api_tests.rs
git commit -m "feat(api): add user registration endpoint

Enable new users to create accounts via API endpoint.
Ensures data quality through validation and prevents duplicates.

Implements POST /api/users/register with email validation,
password strength checking, and duplicate detection.

Closes #45"

Would you like me to proceed with the next feature?
```

### Example 2: Bug Fix

```
User: "Fix the token expiration bug"

Claude: [fixes code]

✅ Fixed token expiration calculation.

Issue: Was using seconds instead of milliseconds.

📝 Suggested commit:

git add src/auth/jwt.rs tests/auth_tests.rs
git commit -m "fix(auth): correct JWT token expiration calculation

Fix tokens expiring immediately due to incorrect time unit.
Previously used seconds instead of milliseconds for JWT spec.

Changed time calculation to use milliseconds as required by JWT.
Added test to verify token validity period is correctly set.

Fixes #127"
```

### Example 3: Multi-Step Work

```
User: "Implement user authentication system"

Claude:
I'll break this into steps:

1. User model + repository → commit
2. Auth service → commit  
3. JWT middleware → commit
4. API endpoints → commit
5. Tests → commit

Starting with step 1...

[After step 1]

📝 Step 1 complete. Suggested commit:

git add src/models/user.rs src/repositories/user_repository.rs
git commit -m "feat(models): add User model and repository

Create foundational data structures for authentication system.
Enables user storage and retrieval from database layer.

Includes User struct and UserRepository trait with CRUD operations."

Continue to step 2?
```

## When Tests Are Affected

If your changes affect tests:

```
⚠️ My changes caused test failures:
- test_create_user
- test_validation

Reason: API response format changed from {...} to {...}

Should I:
1. Update tests (if change is correct)
2. Revert changes (if tests should pass)
3. Something else?

I won't commit until tests pass.
```

## Summary

### Claude's Responsibilities

**DO:**
- ✅ Proactively identify commit points
- ✅ Suggest well-formatted commit messages following Angular guidelines
- ✅ Include mandatory body (except for docs) with at least 20 characters
- ✅ Explain WHY changes are made, not just WHAT
- ✅ Keep summary under 80 characters
- ✅ Ask before committing
- ✅ Ensure tests pass first

**DON'T:**
- ❌ Commit incomplete work
- ❌ Mix unrelated changes
- ❌ Commit broken code
- ❌ Commit without asking
- ❌ Skip commit body (mandatory except for docs)
- ❌ Use capital letters or periods in summary

---

**Related**: [Coding Style](.claude/coding-style.md) | [Testing Strategy](.claude/testing.md)
