-- Create project_services table to track services added to projects
CREATE TABLE public.project_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT,
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "All authenticated users can view project services"
ON public.project_services
FOR SELECT
USING (true);

CREATE POLICY "Finance staff and admins can manage project services"
ON public.project_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'finance_staff'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_services_updated_at
BEFORE UPDATE ON public.project_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();