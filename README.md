# dotfiles

my shell, editor, and tmux config. nothing fancy.

```
git clone https://github.com/m1ra-v0ss/dotfiles.git ~/.dotfiles
cd ~/.dotfiles
./install.sh
```

`install.sh` backs up whatever is currently in `$HOME` and links the configs.
it is plain shell. read it first — you should always read it first.

## what's here

- `.zshrc` / `.bash_aliases` — prompt, history settings, a few aliases
- `.vimrc` — the editor config i've been carrying since 2018
- `.tmux/` — status line and the bindings my hands know
- `.gitconfig` — defaults (signing is set up separately)
- `bin/` — small utilities (`mk`, `serve`, `today`)
- `tests/` — tiny shellcheck suite for `install.sh` (currently failing on
  macOS runners, see #3 — help welcome)

## notes

config is a diary. every bad default in here was a real Tuesday.

> not a user. a maintainer.
