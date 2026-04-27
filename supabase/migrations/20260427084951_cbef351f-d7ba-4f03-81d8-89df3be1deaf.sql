-- Driver applications table
CREATE TABLE public.driver_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT NOT NULL,
  driving_years INTEGER NOT NULL DEFAULT 0,
  vehicle_type TEXT NOT NULL,
  pet_experience TEXT[] NOT NULL DEFAULT '{}',
  id_card_front_url TEXT,
  id_card_back_url TEXT,
  driver_license_url TEXT,
  vehicle_license_url TEXT,
  handheld_id_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own driver applications"
ON public.driver_applications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Users view own driver applications"
ON public.driver_applications FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update driver applications"
ON public.driver_applications FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_driver_applications_updated_at
BEFORE UPDATE ON public.driver_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for driver documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-documents', 'driver-documents', false);

CREATE POLICY "Users upload own driver docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own driver docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users update own driver docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);