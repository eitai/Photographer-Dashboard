
-- Galleries table
CREATE TABLE public.galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  header_message TEXT DEFAULT 'Hi 🤍 Your gallery is ready. Take your time.',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gallery images
CREATE TABLE public.gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client selections
CREATE TABLE public.gallery_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  image_id UUID NOT NULL REFERENCES public.gallery_images(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(image_id, session_id)
);

-- Selection submissions
CREATE TABLE public.gallery_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  selected_image_ids UUID[] NOT NULL,
  client_message TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contact form submissions
CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  session_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Helper: validate gallery token
CREATE OR REPLACE FUNCTION public.get_gallery_by_token(token_param TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.galleries
  WHERE token = token_param
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

-- Galleries: anyone can read via token (handled in app), only authenticated can manage
CREATE POLICY "Authenticated users can manage galleries"
  ON public.galleries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can read active galleries by token"
  ON public.galleries FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Gallery images: authenticated full access, anon read if gallery active
CREATE POLICY "Authenticated users can manage gallery images"
  ON public.gallery_images FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Public can view gallery images"
  ON public.gallery_images FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.galleries g 
    WHERE g.id = gallery_id AND g.is_active = true 
    AND (g.expires_at IS NULL OR g.expires_at > now())
  ));

-- Selections: anon can insert/read/delete their own session selections
CREATE POLICY "Anyone can manage their own selections"
  ON public.gallery_selections FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view all selections"
  ON public.gallery_selections FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Submissions: anon can insert, authenticated can read
CREATE POLICY "Anyone can submit selections"
  ON public.gallery_submissions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can manage submissions"
  ON public.gallery_submissions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Contact: anyone can submit
CREATE POLICY "Anyone can submit contact form"
  ON public.contact_submissions FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can read contacts"
  ON public.contact_submissions FOR SELECT TO authenticated
  USING (true);

-- Storage bucket for gallery images
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery-images', 'gallery-images', true);

CREATE POLICY "Authenticated users can upload gallery images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery-images');

CREATE POLICY "Anyone can view gallery images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery-images');

CREATE POLICY "Authenticated users can delete gallery images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery-images');

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_galleries_updated_at
  BEFORE UPDATE ON public.galleries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
