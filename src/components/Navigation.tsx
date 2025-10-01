import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  CreditCard,
  Target,
  Users,
  FileText,
  BarChart3,
  LogOut,
  Settings,
} from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  const { signOut, userRole } = useAuth();

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'finance_staff', 'regular_staff'],
    },
    {
      name: 'Transactions',
      href: '/transactions',
      icon: CreditCard,
      roles: ['admin', 'finance_staff', 'regular_staff'],
    },
    {
      name: 'Budgets',
      href: '/budgets',
      icon: Target,
      roles: ['admin', 'finance_staff', 'regular_staff'],
    },
    {
      name: 'Invoices',
      href: '/invoices',
      icon: FileText,
      roles: ['admin', 'finance_staff'],
    },
    {
      name: 'Payroll',
      href: '/payroll',
      icon: Users,
      roles: ['admin', 'finance_staff'],
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: BarChart3,
      roles: ['admin', 'finance_staff'],
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      roles: ['admin'],
    },
  ];

  const filteredItems = navigationItems.filter(item =>
    item.roles.includes(userRole || 'regular_staff')
  );

  return (
    <nav className="w-64 bg-card border-r border-border h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground">Finance Manager</h1>
      </div>
      
      <div className="flex-1 px-4">
        <ul className="space-y-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      
      <div className="p-4 border-t border-border">
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full justify-start gap-3"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </nav>
  );
};

export default Navigation;