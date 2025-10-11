import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, TrendingUp, TrendingDown, DollarSign, Users, FileText, Wallet } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))'];

const ReportsPage = () => {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 2)));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [reportType, setReportType] = useState<string>('overview');

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch transactions with filters
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['report-transactions', dateFrom, dateTo, selectedDepartment, selectedCategory],
    queryFn: async () => {
      let query = supabase
        .from('financial_transactions')
        .select('*')
        .gte('transaction_date', format(dateFrom, 'yyyy-MM-dd'))
        .lte('transaction_date', format(dateTo, 'yyyy-MM-dd'));

      if (selectedDepartment !== 'all') {
        query = query.eq('department_id', selectedDepartment);
      }
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory as any);
      }

      const { data, error } = await query.order('transaction_date');
      if (error) throw error;
      return data;
    },
  });

  // Fetch payroll records
  const { data: payrollRecords } = useQuery({
    queryKey: ['report-payroll', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*, employees(*)')
        .gte('pay_period_start', format(dateFrom, 'yyyy-MM-dd'))
        .lte('pay_period_end', format(dateTo, 'yyyy-MM-dd'));
      if (error) throw error;
      return data;
    },
  });

  // Fetch invoices
  const { data: invoices } = useQuery({
    queryKey: ['report-invoices', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .gte('issue_date', format(dateFrom, 'yyyy-MM-dd'))
        .lte('issue_date', format(dateTo, 'yyyy-MM-dd'));
      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const income = transactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const expenses = transactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const profitLoss = income - expenses;
  const totalPayroll = payrollRecords?.reduce((sum, p) => sum + Number(p.net_salary), 0) || 0;
  const totalTaxDeductions = payrollRecords?.reduce((sum, p) => sum + Number(p.tax_deductions), 0) || 0;
  const totalInvoiced = invoices?.reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;
  const paidInvoices = invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;

  // Group transactions by category
  const expensesByCategory = transactions
    ?.filter(t => t.type === 'expense')
    .reduce((acc: any, t) => {
      const cat = t.category || 'uncategorized';
      acc[cat] = (acc[cat] || 0) + Number(t.amount);
      return acc;
    }, {});

  const categoryChartData = expensesByCategory
    ? Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }))
    : [];

  // Monthly trend data
  const monthlyData = transactions?.reduce((acc: any, t) => {
    const month = format(new Date(t.transaction_date), 'MMM yyyy');
    if (!acc[month]) {
      acc[month] = { month, income: 0, expenses: 0 };
    }
    if (t.type === 'income') {
      acc[month].income += Number(t.amount);
    } else {
      acc[month].expenses += Number(t.amount);
    }
    return acc;
  }, {});

  const trendChartData = monthlyData ? Object.values(monthlyData) : [];

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Financial Report', 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Period: ${format(dateFrom, 'MMM dd, yyyy')} - ${format(dateTo, 'MMM dd, yyyy')}`, 14, 30);
    
    doc.setFontSize(14);
    doc.text('Summary', 14, 45);
    
    doc.setFontSize(11);
    doc.text(`Total Income: R ${income.toLocaleString()}`, 14, 55);
    doc.text(`Total Expenses: R ${expenses.toLocaleString()}`, 14, 62);
    doc.text(`Profit/Loss: R ${profitLoss.toLocaleString()}`, 14, 69);
    doc.text(`Total Payroll: R ${totalPayroll.toLocaleString()}`, 14, 76);
    doc.text(`Total Tax Deductions: R ${totalTaxDeductions.toLocaleString()}`, 14, 83);
    doc.text(`Total Invoiced: R ${totalInvoiced.toLocaleString()}`, 14, 90);
    doc.text(`Paid Invoices: R ${paidInvoices.toLocaleString()}`, 14, 97);
    
    doc.save(`financial-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({
      title: 'Report Exported',
      description: 'PDF report has been downloaded successfully.',
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financial Reports</h1>
          <p className="text-muted-foreground">Generate and view comprehensive financial reports</p>
        </div>
        <Button onClick={handleExportPDF} className="gap-2">
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Customize your report parameters</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Type</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expenses">Expenses</SelectItem>
                <SelectItem value="profitloss">Profit & Loss</SelectItem>
                <SelectItem value="cashflow">Cash Flow</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
                <SelectItem value="tax">Tax Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">From Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateFrom, 'MMM dd, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover">
                <Calendar mode="single" selected={dateFrom} onSelect={(date) => date && setDateFrom(date)} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">To Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateTo, 'MMM dd, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover">
                <Calendar mode="single" selected={dateTo} onSelect={(date) => date && setDateTo(date)} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Department</label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
                <SelectItem value="utilities">Utilities</SelectItem>
                <SelectItem value="office_supplies">Office Supplies</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="software">Software</SelectItem>
                <SelectItem value="rent">Rent</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R {income.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Revenue generated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R {expenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Profit/Loss</CardTitle>
            <DollarSign className={cn("h-4 w-4", profitLoss >= 0 ? "text-green-500" : "text-destructive")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", profitLoss >= 0 ? "text-green-500" : "text-destructive")}>
              R {profitLoss.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Net income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Payroll</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">R {totalPayroll.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Employee salaries</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses Trend</CardTitle>
            <CardDescription>Monthly comparison</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="hsl(142 76% 36%)" strokeWidth={2} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>Distribution breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Reports */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Invoice Summary</CardTitle>
              <CardDescription>Billing overview</CardDescription>
            </div>
            <FileText className="h-8 w-8 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Invoiced:</span>
              <span className="font-medium">R {totalInvoiced.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Paid:</span>
              <span className="font-medium text-green-500">R {paidInvoices.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Outstanding:</span>
              <span className="font-medium text-destructive">R {(totalInvoiced - paidInvoices).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Payroll Summary</CardTitle>
              <CardDescription>Employee compensation</CardDescription>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Gross Payroll:</span>
              <span className="font-medium">R {(payrollRecords?.reduce((sum, p) => sum + Number(p.gross_salary), 0) || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Net Payroll:</span>
              <span className="font-medium">R {totalPayroll.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Employees Paid:</span>
              <span className="font-medium">{payrollRecords?.length || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Tax Summary</CardTitle>
              <CardDescription>Tax deductions</CardDescription>
            </div>
            <Wallet className="h-8 w-8 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Tax Deducted:</span>
              <span className="font-medium">R {totalTaxDeductions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">From Payroll:</span>
              <span className="font-medium">R {totalTaxDeductions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Tax Rate:</span>
              <span className="font-medium">
                {payrollRecords && payrollRecords.length > 0
                  ? ((totalTaxDeductions / (payrollRecords.reduce((sum, p) => sum + Number(p.gross_salary), 0)) * 100).toFixed(1))
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
