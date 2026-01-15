# AI-Native Workflow: Git-Driven Context Management

Using Git effectively is one of the most powerful ways to maintain continuity when working with AI agents like Claude. This document explains how Git worktrees and commits serve as a "persistent memory" that survives context compaction or session resets.

## 1. The Core Problem: Context Decay

AI models have a limited "context window." As you chat, older parts of the conversation are eventually summarized or "compacted" (the "Ralph loop" or compact command). This leads to:

- **Loss of detail**: The AI forgets *why* a specific line of code was written.
- **Goal Drift**: The AI might lose track of the original architecture plan.

## 2. The Solution: Git as Permanent Context

Instead of relying on the chat history (Ephemeral Memory), we use the Git Repository (Persistent Memory).

### Git Worktrees: Feature Isolation

Worktrees allow you to have multiple branches "checked out" in different folders simultaneously.

- **Why it helps AI**: Each folder represents a clean, isolated state for a specific feature. When you ask me to work in `IdentityReport-frontend`, I don't see any of the "noise" from the backend or other experimental branches. I can't accidentally break something in another feature because it's literally in a different directory.

### Atomic Commits: "Snapshots of Thought"

When you (or I) commit changes frequently with descriptive messages, we are writing a log for the AI's future self.

- **How I use it**: If my context is cleared, I can run `git log -p` or `git show [latest_commit]`. This tells me EXACTLY what was done, what the previous state was, and why the change happened.
- **Pro Tip**: Use the commit message to explain the **RATIONALE**, not just the code.
  - *Bad*: `fix: updated button style`
  - *Good*: `style: updated Sidebar buttons to Zinc-900 to ensure contrast ratios meet WCAG AA standards`

## 3. Best Practices for This Repo

### A. The "Atomic" Loop

1. **Define Task**: Start with a clear goal.
2. **Execute Small Change**: Change 1-2 files.
3. **Commit Immediately**: `git commit -m "feat: add [x] component with [y] logic"`
4. **Push**: Sync with origin so any other agent can see the progress.

### B. Re-building Context

If you feel I'm getting "lost" or if the session is getting too long:

1. Run `git status` and `git log -n 5`. This "reminds" me of the current state.
2. Point me to a specific worktree: "Work in the frontend worktree and analyze the last 3 commits to see where we left off."

## 4. Why this avoids "Compaction" issues

When I can read the Git history, I don't need you to repeat the last 5 messages. I can deduce the state from the code and the commit messages. This effectively makes the "Context Window" as large as the entire Git history of your project.
