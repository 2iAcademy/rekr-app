import {
  Briefcase,
  Building2,
  Car,
  Factory,
  FileText,
  GraduationCap,
  Hammer,
  HardHat,
  Landmark,
  Laptop,
  Megaphone,
  Scale,
  Shield,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Trees,
  Truck,
  UsersRound,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * One icon per trade, so the list is scanned rather than read: twenty labels of
 * similar length and colour give the eye nothing to land on, and the candidate
 * ends up reading all of them to find theirs.
 *
 * Keyed on the label rather than on the id: the ids come from the insertion
 * order of a migration and would silently shift the whole mapping if a row were
 * ever inserted before another. A label this map does not know falls back to a
 * neutral icon instead of breaking the row.
 */
const ICONS: Record<string, LucideIcon> = {
  Administratif: FileText,
  Artisanat: Hammer,
  Automobile: Car,
  Banque: Landmark,
  Bâtiment: HardHat,
  Commerce: ShoppingBag,
  Communication: Megaphone,
  Énergie: Zap,
  'Espaces verts': Trees,
  Formation: GraduationCap,
  Immobilier: Building2,
  Industrie: Factory,
  Informatique: Laptop,
  Juridique: Scale,
  Logistique: Truck,
  Propreté: Sparkles,
  Restauration: UtensilsCrossed,
  'Ressources humaines': UsersRound,
  Santé: Stethoscope,
  Sécurité: Shield,
};

export const jobFamilyIcon = (label: string): LucideIcon => ICONS[label] ?? Briefcase;
