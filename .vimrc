" vimrc — the config i've been carrying since 2018
set nocompatible
syntax on
filetype plugin indent on

set number
set ruler
set tabstop=2
set shiftwidth=2
set expandtab
set smartindent
set incsearch
set hlsearch
set ignorecase
set smartcase
set backspace=indent,eol,start
set laststatus=2
set ttimeoutlen=50

" restore cursor position
autocmd BufReadPost * if line("'\"") > 0 && line("'\"") <= line("$") | exe "normal! g'\"" | endif

" sane splits
nnoremap <C-J> <C-W><C-J>
nnoremap <C-K> <C-W><C-K>
nnoremap <C-L> <C-W><C-L>
nnoremap <C-H> <C-W><C-H>

" backups go to tmp, not the repo
set backupdir=/tmp//
set directory=/tmp//
