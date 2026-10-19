import React from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  title: string;
  coverUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
}

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  coverUrl,
  size = 'md',
  className = '',
}) => {
  // Deterministic color palette generation based on title hash
  const getThemeIndex = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 5;
  };

  const themeIndex = getThemeIndex(title);

  const themes = [
    {
      bg: 'from-emerald-950 via-teal-950 to-slate-950',
      accent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      shape1: 'bg-amber-600/60',
      shape2: 'bg-teal-500/40',
      badge: 'border-emerald-400/40 text-emerald-300',
    },
    {
      bg: 'from-indigo-950 via-slate-950 to-blue-950',
      accent: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      shape1: 'bg-indigo-500/60',
      shape2: 'bg-rose-500/40',
      badge: 'border-indigo-400/40 text-indigo-300',
    },
    {
      bg: 'from-amber-950 via-orange-950 to-stone-950',
      accent: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      shape1: 'bg-orange-600/70',
      shape2: 'bg-amber-400/50',
      badge: 'border-amber-400/40 text-amber-300',
    },
    {
      bg: 'from-rose-950 via-pink-950 to-slate-950',
      accent: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      shape1: 'bg-rose-600/60',
      shape2: 'bg-violet-500/40',
      badge: 'border-rose-400/40 text-rose-300',
    },
    {
      bg: 'from-slate-900 via-neutral-900 to-black',
      accent: 'bg-slate-700/30 text-slate-300 border-slate-600/40',
      shape1: 'bg-blue-600/60',
      shape2: 'bg-emerald-500/50',
      badge: 'border-slate-400/40 text-slate-300',
    },
  ];

  const currentTheme = themes[themeIndex];

  // Size mapping
  const sizeClasses = {
    sm: 'w-20 h-28 text-[9px] rounded-lg',
    md: 'w-28 sm:w-32 h-40 sm:h-44 text-xs rounded-xl',
    lg: 'w-36 sm:w-44 h-52 sm:h-64 text-sm rounded-2xl',
    hero: 'w-48 sm:w-56 h-68 sm:h-80 text-base rounded-2xl',
  };

  const cleanTitle = title.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');

  return (
    <div
      className={`relative overflow-hidden aspect-[2/3] shadow-2xl flex-shrink-0 transition-transform duration-300 group-hover:scale-[1.03] select-none ${sizeClasses[size]} ${className}`}
    >
      {/* 3D Book Spine Shadow overlay (Left edge) */}
      <div className="absolute inset-y-0 left-0 w-3.5 bg-gradient-to-r from-black/50 via-white/10 to-transparent z-20 pointer-events-none rounded-l-[inherit]" />

      {/* Book Cover Content */}
      {coverUrl ? (
        <div className="w-full h-full relative">
          <img
            src={coverUrl}
            alt={cleanTitle}
            className="w-full h-full object-cover object-top"
          />
          {/* Subtle gloss gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-white/10 pointer-events-none" />
        </div>
      ) : (
        /* Geometric Bauhaus / Paul Rand Inspired Cover Art */
        <div
          className={`w-full h-full bg-gradient-to-br ${currentTheme.bg} p-3.5 flex flex-col justify-between relative overflow-hidden`}
        >
          {/* Geometric decorative elements */}
          <div
            className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${currentTheme.shape1} blur-lg opacity-60`}
          />
          <div
            className={`absolute bottom-4 -left-6 w-20 h-20 rounded-2xl rotate-12 ${currentTheme.shape2} blur-md opacity-50`}
          />

          {/* Top minimal badge */}
          <div className="relative z-10 flex items-center justify-between">
            <span
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider font-bold border ${currentTheme.badge} bg-black/40 backdrop-blur-sm`}
            >
              PDF Book
            </span>
            <BookOpen className="w-3.5 h-3.5 text-white/50" />
          </div>

          {/* Center Title Display */}
          <div className="relative z-10 my-auto py-2">
            <h4 className="font-serif font-bold text-white leading-snug line-clamp-4 break-words drop-shadow-md">
              {cleanTitle}
            </h4>
          </div>

          {/* Bottom subtle bar */}
          <div className="relative z-10 pt-2 border-t border-white/15 flex items-center justify-between text-[8px] text-white/60 font-sans font-medium">
            <span className="uppercase tracking-widest truncate max-w-[80px]">Audiobook</span>
            <span>Edição HD</span>
          </div>
        </div>
      )}

      {/* Book border finish */}
      <div className="absolute inset-0 border border-white/15 rounded-[inherit] pointer-events-none z-20" />
    </div>
  );
};
