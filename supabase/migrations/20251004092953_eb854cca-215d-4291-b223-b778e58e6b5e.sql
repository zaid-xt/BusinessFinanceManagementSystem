-- Insert sample departments
INSERT INTO public.departments (name, description, budget_limit) VALUES
  ('Human Resources', 'Employee management and recruitment', 500000),
  ('Information Technology', 'Technology infrastructure and support', 1000000),
  ('Finance', 'Financial planning and accounting', 750000),
  ('Marketing', 'Brand management and promotions', 600000),
  ('Operations', 'Business operations and logistics', 800000),
  ('Sales', 'Revenue generation and client relations', 900000),
  ('Research & Development', 'Product innovation and development', 1200000),
  ('Customer Service', 'Client support and satisfaction', 400000),
  ('Legal', 'Compliance and legal matters', 350000),
  ('Administration', 'General administrative support', 300000)
ON CONFLICT DO NOTHING;