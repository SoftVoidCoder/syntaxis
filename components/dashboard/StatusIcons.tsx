import React from 'react';

// Заглушки-иконки для статусов. 
// Позже их можно заменить на реальные <img> картинки, которые нарисует дизайнер.

export const ShirtIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z" />
  </svg>
);

export const TieIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Shirt collar lines */}
    <path d="M6 7l6 4 6-4" />
    <path d="M6 7l-2 3" />
    <path d="M18 7l2 3" />
    
    {/* Tie Knot */}
    <polygon points="10.5,7 13.5,7 12.5,11 11.5,11" fill="currentColor" />
    
    {/* Tie Body */}
    <polygon points="11.5,11 12.5,11 14,19 12,22 10,19" fill="currentColor" />
  </svg>
);

export const SuitIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Head */}
    <circle cx="12" cy="6" r="3" />
    
    {/* Shoulders / Body */}
    <path d="M5.5 22v-2.5c0-2.5 2-4.5 4.5-4.5h4c2.5 0 4.5 2 4.5 4.5v2.5" />
    
    {/* V-neck Lapels */}
    <path d="M9.5 15l2.5 6 2.5-6" />
    
    {/* Shirt Collar */}
    <path d="M9.5 15l2.5 2 2.5-2" />
    
    {/* Tie Knot */}
    <polygon points="11,15 13,15 12.5,16.5 11.5,16.5" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    
    {/* Tie Blade */}
    <polygon points="11.5,16.5 12.5,16.5 13,21.5 12,22 11,21.5" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
  </svg>
);
