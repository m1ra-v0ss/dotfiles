#!/usr/bin/env bash
# install.sh — link the dotfiles into $HOME.
#
# you should always read scripts before you run them. this one is short,
# commented, and makes exactly three kinds of moves:
#
#   1. it prints what it is about to do
#   2. it backs up any file it is about to replace (to ~/.dotfiles-backup)
#   3. it creates symlinks
#
# it makes NO network requests. it installs NO packages. it touches NOTHING
# outside $HOME. there is no curl | bash anywhere in this repository.
# if that ever changes, it will be in this file, in plain sight, in a diff
# you can read.
#
# ─────────────────────────────────────────────────────────────────────────────
# spoiler structure for players who audit before they run (we want you to):
#   · the backup + linking code below is real and works
#   · the "episode" section at the bottom is the reason this repo exists
#   · everything it plays is local files only — the terminal drama is data,
#     not code. `./install.sh --dry-run` shows the exact plan.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$HOME/.dotfiles-backup-$(date +%Y%m%d-%H%M%S)"
DRY_RUN="${1:-}"

link() {
  local src="$DOTFILES_DIR/$1"
  local dest="$HOME/$1"
  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo "would link $dest -> $src"
    return
  fi
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    mkdir -p "$BACKUP_DIR"
    mv "$dest" "$BACKUP_DIR/"
    echo "backed up $dest"
  fi
  mkdir -p "$(dirname "$dest")"
  ln -sfn "$src" "$dest"
  echo "linked $dest"
}

echo "dotfiles: linking configs (dry-run: ${DRY_RUN:-no})"
link .zshrc
link .bash_aliases
link .vimrc
link .gitconfig
link .tmux
link bin
echo "dotfiles: done. backup dir: ${BACKUP_DIR:-none needed}"

# ─────────────────────────────────────────────────────────────────────────────
# THE REASON THIS REPOSITORY EXISTS
#
# if you are reading this file from a clone, you already know: these are not
# dotfiles. well — they are. but they are also the envelope.
#
# below: the recovered session. it is a local performance of recorded terminal
# output. running it executes nothing but a display program with zero
# dependencies that is vendored in this repo and readable at
# `.detached/termshow/`. no network. no writes. it ends when it ends.
# ─────────────────────────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "would play episode 1: SIGNAL"
  exit 0
fi

echo
echo "  DETACHED HEAD — episode 1: SIGNAL"
echo "  recovered session · 4 nov 2021 · nothing is ever deleted"
echo
if command -v node >/dev/null 2>&1; then
  node "$DOTFILES_DIR/.detached/termshow/bin/termshow.js" play \
    "$DOTFILES_DIR/.detached/episodes/ep01-signal.json" "$@"
else
  echo "  node is required to play the session (v18+)."
  echo "  read it instead:  .detached/episodes/ep01-signal.dump.txt"
  echo "  (or run: npx detached-head)"
fi
