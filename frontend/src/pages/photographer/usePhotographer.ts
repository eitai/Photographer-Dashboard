import { createContext, useContext } from 'react';

export interface PhotographerSocial {
  phone: string;
  instagramHandle: string;
  facebookUrl: string;
  contactEmail: string;
}

interface Photographer {
  id: string;
  name: string;
  studioName: string | null;
  username: string;
}

export interface PhotographerContextValue {
  photographer: Photographer;
  username: string;
  social: PhotographerSocial;
  theme: string;
}

export const PhotographerContext = createContext<PhotographerContextValue | null>(null);

export const usePhotographer = () => {
  const ctx = useContext(PhotographerContext);
  if (!ctx) throw new Error('usePhotographer must be used inside PhotographerLayout');
  return ctx;
};
