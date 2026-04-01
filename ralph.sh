#!/bin/bash
# ralph.sh - Run Ralph, the autonomous coding agent
#
# Usage:
#   Single iteration:    ./ralph.sh
#   Run until complete:  while ./ralph.sh; do sleep 2; done
#
# Ralph reads CLAUDE.md, picks the highest-priority incomplete story from prd.json,
# implements it, runs quality checks, commits, and updates the PRD.

set -e

echo "Starting Ralph iteration..."

claude \
  --dangerously-skip-permissions \
  --allowedTools "Agent,Bash,Edit,Glob,Grep,Read,TodoWrite,WebFetch,WebSearch,Write" \
  -p "You are Ralph, an autonomous coding agent. Read CLAUDE.md in the current directory and follow all instructions exactly. Complete one full iteration."

echo "Ralph iteration complete."
