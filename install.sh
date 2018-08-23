#!/usr/bin/env bash
# install.sh — link the dotfiles into $HOME.
set -euo pipefail
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in .zshrc .bash_aliases .vimrc .gitconfig .tmux bin; do
  ln -sfn "$DOTFILES_DIR/$f" "$HOME/$f"
  echo "linked $f"
done

# 2018-08-23: install: dry-run flag
