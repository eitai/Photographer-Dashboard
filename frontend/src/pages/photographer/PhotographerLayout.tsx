import { createContext, useContext, useEffect, useState } from 'react';
import { useParams, Outlet, Navigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import api, { getImageUrl } from '@/lib/api';

interface Photographer {
  id: string;
  name: string;
  studioName: string | null;
  username: string;
}

export interface PhotographerSocial {
  phone: string;
  instagramHandle: string;
  facebookUrl: string;
  contactEmail: string;
}

interface PhotographerContextValue {
  photographer: Photographer;
  username: string;
  social: PhotographerSocial;
  theme: string;
}

const PhotographerContext = createContext<PhotographerContextValue | null>(null);

export const usePhotographer = () => {
  const ctx = useContext(PhotographerContext);
  if (!ctx) throw new Error('usePhotographer must be used inside PhotographerLayout');
  return ctx;
};

const EMPTY_SOCIAL: PhotographerSocial = { phone: '', instagramHandle: '', facebookUrl: '', contactEmail: '' };

export const PhotographerLayout = () => {
  const { id } = useParams<{ id: string }>();
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [social, setSocial] = useState<PhotographerSocial>(EMPTY_SOCIAL);
  const [theme, setTheme] = useState('soft');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/p/${id}`)
      .then((r) => setPhotographer(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    api
      .get(`/p/${id}/settings`)
      .then((r) => {
        setSocial({
          phone: r.data.phone || '',
          instagramHandle: r.data.instagramHandle || '',
          facebookUrl: r.data.facebookUrl || '',
          contactEmail: r.data.contactEmail || '',
        });
        setTheme(r.data.theme || 'soft');
        setLogoUrl(r.data.logoImagePath ? getImageUrl(r.data.logoImagePath) : '');
      })
      .catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-beige border-t-blush rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !photographer) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div data-theme={theme} style={{ backgroundColor: 'var(--background)', minHeight: '100vh' }}>
      <PhotographerContext.Provider value={{ photographer, username: id!, social, theme }}>
        <Navbar
          photographerName={photographer.studioName || photographer.name}
          logoUrl={logoUrl}
          username={id!}
          social={social}
        />
        <Outlet />
        <Footer social={social} studioName={photographer.studioName || photographer.name} />
        <WhatsAppButton phone={social.phone} />
      </PhotographerContext.Provider>
    </div>
  );
};
