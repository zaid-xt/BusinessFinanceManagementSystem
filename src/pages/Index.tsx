import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Building2, Shield, TrendingUp, Users, FileText, Target } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const features = [
    {
      icon: Shield,
      title: 'Secure Authentication',
      description: 'Role-based access control with secure login and session management.',
    },
    {
      icon: TrendingUp,
      title: 'Financial Tracking',
      description: 'Record and categorize income and expenses with detailed reporting.',
    },
    {
      icon: Target,
      title: 'Budget Management',
      description: 'Create budgets, track spending, and get alerts for overspending.',
    },
    {
      icon: Users,
      title: 'Payroll System',
      description: 'Automated payroll calculation with tax deductions and payslips.',
    },
    {
      icon: FileText,
      title: 'Invoice Management',
      description: 'Generate, track, and manage invoices with automated workflows.',
    },
    {
      icon: Building2,
      title: 'Compliance & Reports',
      description: 'Tax calculations, compliance tracking, and comprehensive reporting.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Business Finance Management System
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Comprehensive financial management solution for businesses. Track expenses, manage payroll, 
            generate reports, and ensure compliance with powerful tools designed for finance teams.
          </p>
          <div className="space-x-4">
            <Link to="/auth">
              <Button size="lg" className="px-8 py-3">
                Get Started
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="lg" className="px-8 py-3">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-8 w-8 text-primary" />
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to streamline your business finances?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of businesses that trust our platform for their financial management needs.
          </p>
          <Link to="/auth">
            <Button size="lg" className="px-12 py-4 text-lg">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
