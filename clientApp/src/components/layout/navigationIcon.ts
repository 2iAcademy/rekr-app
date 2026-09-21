import { Briefcase, Heart, Layers, type LucideIcon, UserRound } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  '/candidat/offres': Layers,
  '/matches': Heart,
  '/recruteur/offres': Briefcase,
  '/profil': UserRound,
};

/**
 * The glyph of a navigation entry, looked up by destination so the items stay
 * plain data. An unknown destination falls back to the offers glyph rather than
 * rendering an empty slot in the tab bar.
 */
export const navigationIcon = (to: string): LucideIcon => ICONS[to] ?? Layers;
