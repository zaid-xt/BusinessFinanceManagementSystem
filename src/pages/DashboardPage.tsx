import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, TrendingUp, TrendingDown, Users, FileText, Target } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  monthlyBudget: number;
  employeeCount: number;
  pendingInvoices: number;
  activeBudgets: number;
}

const DashboardPage = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalIncome: 0,
    totalExpenses: 0,
    monthlyBudget: 0,
    employeeCount: 0,
    pendingInvoices: 0,
    activeBudgets: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch all financial transactions for total income/expenses
        const { data: allTransactions } = await supabase
          .from('financial_transactions')
          .select('*')
          .order('transaction_date', { ascending: false });

        const income = allTransactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const expenses = allTransactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        
        // Set recent transactions (last 5)
        setRecentTransactions(allTransactions?.slice(0, 5) || []);

        // Fetch other stats based on user role
        let employeeCount = 0;
        let pendingInvoices = 0;
        let activeBudgets = 0;
        let monthlyBudget = 0;

        if (userRole === 'admin' || userRole === 'finance_staff') {
          const currentMonth = new Date().toISOString().slice(0, 7);
          const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10);
          
          const { data: employees } = await supabase
            .from('employees')
            .select('id')
            .eq('is_active', true);
          
          const { data: invoices } = await supabase
            .from('invoices')
            .select('*')
            .in('status', ['draft', 'sent', 'overdue']);
          
          const { data: allInvoices } = await supabase
            .from('invoices')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
          
          const { data: budgets } = await supabase
            .from('budgets')
            .select('amount')
            .gte('period_start', `${currentMonth}-01`)
            .lt('period_end', nextMonth);

          employeeCount = employees?.length || 0;
          pendingInvoices = invoices?.length || 0;
          activeBudgets = budgets?.length || 0;
          monthlyBudget = budgets?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
          setRecentInvoices(allInvoices || []);
        }

        setStats({
          totalIncome: income,
          totalExpenses: expenses,
          monthlyBudget,
          employeeCount,
          pendingInvoices,
          activeBudgets,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    // Set up real-time subscription for transaction and invoice updates
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_transactions'
        },
        () => {
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userRole]);

  const netProfit = stats.totalIncome - stats.totalExpenses;
  const budgetUtilization = stats.monthlyBudget > 0 ? (stats.totalExpenses / stats.monthlyBudget) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your financial overview.</p>
        </div>
        <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>
          {userRole?.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R {stats.totalIncome.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R {stats.totalExpenses.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R {netProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        {(userRole === 'admin' || userRole === 'finance_staff') && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.employeeCount}</div>
                <p className="text-xs text-muted-foreground">Total employees</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
                <FileText className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingInvoices}</div>
                <p className="text-xs text-muted-foreground">Requires attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
                <Target className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {budgetUtilization.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Rs {stats.totalExpenses.toLocaleString()} of Rs {stats.monthlyBudget.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest financial transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No transactions yet
              </div>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.transaction_date), 'MMM dd, yyyy')}
                        {transaction.category && ` • ${transaction.category.replace('_', ' ')}`}
                      </p>
                    </div>
                    <div className={`text-sm font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}Rs {Number(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div 
                onClick={() => navigate('/transactions')}
                className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
              >
                <div className="text-sm font-medium">Add Transaction</div>
                <div className="text-xs text-muted-foreground">Record income or expense</div>
              </div>
              <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <div className="text-sm font-medium">Create Budget</div>
                <div className="text-xs text-muted-foreground">Set spending limits</div>
              </div>
              {(userRole === 'admin' || userRole === 'finance_staff') && (
                <>
                  <div 
                    onClick={() => navigate('/invoices')}
                    className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="text-sm font-medium">Generate Invoice</div>
                    <div className="text-xs text-muted-foreground">Create new invoice</div>
                  </div>
                  <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                    <div className="text-sm font-medium">Run Payroll</div>
                    <div className="text-xs text-muted-foreground">Process employee payments</div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {(userRole === 'admin' || userRole === 'finance_staff') && recentInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Latest invoices created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{invoice.invoice_number}</p>
                      <Badge variant={
                        invoice.status === 'paid' ? 'default' : 
                        invoice.status === 'overdue' ? 'destructive' : 
                        'secondary'
                      }>
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {invoice.client_name} • Due {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-sm font-semibold">
                    Rs {Number(invoice.total_amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;