import {
  Camera,
  Heart,
  Baby,
  Diamond,
  Building2,
  Mountain,
  Users,
  Star,
  Aperture,
  Clock,
  Smile,
  Award,
} from 'lucide-react';

export const THEMES = ['soft', 'bw'] as const;

export const THEME_META: Record<string, { bg: string; primary: string; fg: string }> = {
  soft: { bg: '#faf8f4', primary: '#e7b8b5', fg: '#3c3a38' },
  bw: { bg: '#ffffff', primary: '#000000', fg: '#000000' },
};

export const SERVICE_ICONS = [
  { name: 'camera', Icon: Camera },
  { name: 'heart', Icon: Heart },
  { name: 'baby', Icon: Baby },
  { name: 'diamond', Icon: Diamond },
  { name: 'building-2', Icon: Building2 },
  { name: 'mountain', Icon: Mountain },
  { name: 'users', Icon: Users },
  { name: 'star', Icon: Star },
  { name: 'aperture', Icon: Aperture },
  { name: 'clock', Icon: Clock },
  { name: 'smile', Icon: Smile },
  { name: 'award', Icon: Award },
];

export const SESSION_TYPE_OPTIONS = ['family', 'maternity', 'newborn', 'branding', 'landscape', 'other'] as const;

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const fieldClass = 'w-full border border-beige rounded-lg px-3 py-2 text-sm text-charcoal focus:outline-none focus:border-blush bg-ivory';
