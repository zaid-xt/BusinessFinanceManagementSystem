-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true);

-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  email text,
  phone text,
  address text,
  registration_number text,
  tax_number text,
  logo_url text,
  terms_and_conditions text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view company settings
CREATE POLICY "All authenticated users can view company settings"
  ON public.company_settings
  FOR SELECT
  USING (true);

-- Only admins can manage company settings
CREATE POLICY "Admins can manage company settings"
  ON public.company_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for company logos
CREATE POLICY "Company logos are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "Admins can upload company logos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update company logos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete company logos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'company-logos' AND has_role(auth.uid(), 'admin'::app_role));