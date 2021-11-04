# zsh — carry-over since 2018. half of this i don't remember writing.

export EDITOR=vim
export HISTFILE=~/.zsh_history
export HISTSIZE=50000
export SAVEHIST=50000
setopt HIST_IGNORE_DUPS SHARE_HISTORY EXTENDED_HISTORY

# prompt: two segments, nothing clever
PROMPT='%F{blue}%~%f %# '

# completion
autoload -Uz compinit
compinit -C

alias ll='ls -lah'
alias ..='cd ..'
alias serve='python3 -m http.server'
alias today='date +%F'

# local overrides, never tracked
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local
