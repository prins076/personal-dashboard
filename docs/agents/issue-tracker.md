# Issue tracker: GitHub Issues

Issues for this repo live on GitHub at `prins076/personal-dashboard`. Use the `gh` CLI to interact with them.

## Common commands

```bash
# List open issues
gh issue list

# View a specific issue
gh issue view <number>

# Create a new issue
gh issue create --title "title" --body "body" --label "needs-triage"

# Add/remove a label
gh issue edit <number> --add-label "ready-for-agent"
gh issue edit <number> --remove-label "needs-triage"

# Close an issue
gh issue close <number>
```

## When a skill says "publish to the issue tracker"

Run `gh issue create` with an appropriate title, body, and `needs-triage` label.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number>`. The user will normally pass the issue number directly.
