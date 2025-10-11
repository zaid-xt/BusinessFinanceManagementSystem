import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, DollarSign, Calculator } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const employeeSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  position: z.string().optional(),
  department_id: z.string().optional(),
  hire_date: z.string().min(1, 'Hire date is required'),
  base_salary: z.string().min(1, 'Base salary is required'),
  hourly_rate: z.string().optional(),
  bank_account: z.string().optional(),
  tax_id: z.string().optional(),
});

const payrollSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  pay_period_start: z.string().min(1, 'Start date is required'),
  pay_period_end: z.string().min(1, 'End date is required'),
  hours_worked: z.string().min(1, 'Hours worked is required'),
  overtime_hours: z.string().optional(),
  allowances: z.string().optional(),
  deductions: z.string().optional(),
});

type Employee = {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  position: string | null;
  department_id: string | null;
  hire_date: string;
  base_salary: number;
  hourly_rate: number | null;
  is_active: boolean;
  bank_account: string | null;
  tax_id: string | null;
};

type PayrollRecord = {
  id: string;
  employee_id: string;
  pay_period_start: string;
  pay_period_end: string;
  hours_worked: number;
  overtime_hours: number;
  gross_salary: number;
  tax_deductions: number;
  deductions: number;
  allowances: number;
  net_salary: number;
  employees?: {
    id: string;
    employee_id: string;
    first_name: string;
    last_name: string;
    email: string;
    position: string | null;
  };
};

type Department = {
  id: string;
  name: string;
};

type TaxRule = {
  id: string;
  name: string;
  rate: number;
  threshold_min: number;
  threshold_max: number | null;
  is_active: boolean;
};

const PayrollPage = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  const employeeForm = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employee_id: '',
      first_name: '',
      last_name: '',
      email: '',
      position: '',
      department_id: '',
      hire_date: '',
      base_salary: '',
      hourly_rate: '',
      bank_account: '',
      tax_id: '',
    },
  });

  const payrollForm = useForm<z.infer<typeof payrollSchema>>({
    resolver: zodResolver(payrollSchema),
    defaultValues: {
      employee_id: '',
      pay_period_start: '',
      pay_period_end: '',
      hours_worked: '',
      overtime_hours: '0',
      allowances: '0',
      deductions: '0',
    },
  });

  useEffect(() => {
    fetchEmployees();
    fetchPayrollRecords();
    fetchDepartments();
    fetchTaxRules();
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching employees', description: error.message, variant: 'destructive' });
      return;
    }
    setEmployees(data || []);
  };

  const fetchPayrollRecords = async () => {
    const { data, error } = await supabase
      .from('payroll_records')
      .select(`
        *,
        employees:employee_id (
          id,
          employee_id,
          first_name,
          last_name,
          email,
          position
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error fetching payroll records', description: error.message, variant: 'destructive' });
      return;
    }
    setPayrollRecords(data || []);
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (error) {
      toast({ title: 'Error fetching departments', description: error.message, variant: 'destructive' });
      return;
    }
    setDepartments(data || []);
  };

  const fetchTaxRules = async () => {
    const { data, error } = await supabase
      .from('tax_rules')
      .select('*')
      .eq('is_active', true)
      .order('threshold_min');

    if (error) {
      toast({ title: 'Error fetching tax rules', description: error.message, variant: 'destructive' });
      return;
    }
    setTaxRules(data || []);
  };

  const calculateTax = (grossSalary: number): number => {
    let totalTax = 0;
    
    for (const rule of taxRules) {
      const min = rule.threshold_min || 0;
      const max = rule.threshold_max || Infinity;
      
      if (grossSalary > min) {
        const taxableAmount = Math.min(grossSalary, max) - min;
        totalTax += taxableAmount * (rule.rate / 100);
      }
    }
    
    return totalTax;
  };

  const onEmployeeSubmit = async (values: z.infer<typeof employeeSchema>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const employeeData = {
      employee_id: values.employee_id,
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      position: values.position || null,
      department_id: values.department_id || null,
      hire_date: values.hire_date,
      base_salary: parseFloat(values.base_salary),
      hourly_rate: values.hourly_rate ? parseFloat(values.hourly_rate) : null,
      bank_account: values.bank_account || null,
      tax_id: values.tax_id || null,
    };

    if (editingEmployee) {
      const { error } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', editingEmployee.id);

      if (error) {
        toast({ title: 'Error updating employee', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Employee updated successfully' });
    } else {
      const { error } = await supabase
        .from('employees')
        .insert([employeeData]);

      if (error) {
        toast({ title: 'Error creating employee', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Success', description: 'Employee created successfully' });
    }

    employeeForm.reset();
    setEditingEmployee(null);
    setEmployeeDialogOpen(false);
    fetchEmployees();
  };

  const onPayrollSubmit = async (values: z.infer<typeof payrollSchema>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const employee = employees.find(e => e.id === values.employee_id);
    if (!employee) return;

    const hoursWorked = parseFloat(values.hours_worked);
    const overtimeHours = parseFloat(values.overtime_hours || '0');
    const allowances = parseFloat(values.allowances || '0');
    const deductions = parseFloat(values.deductions || '0');

    // Calculate gross salary
    let grossSalary = 0;
    if (employee.hourly_rate) {
      // Hourly employee
      const regularPay = hoursWorked * employee.hourly_rate;
      const overtimePay = overtimeHours * employee.hourly_rate * 1.5; // 1.5x for overtime
      grossSalary = regularPay + overtimePay;
    } else {
      // Salaried employee (monthly salary)
      grossSalary = employee.base_salary;
    }

    grossSalary += allowances;

    // Calculate tax
    const taxDeductions = calculateTax(grossSalary);

    // Calculate net salary
    const netSalary = grossSalary - taxDeductions - deductions;

    const payrollData = {
      employee_id: values.employee_id,
      pay_period_start: values.pay_period_start,
      pay_period_end: values.pay_period_end,
      hours_worked: hoursWorked,
      overtime_hours: overtimeHours,
      gross_salary: grossSalary,
      tax_deductions: taxDeductions,
      deductions: deductions,
      allowances: allowances,
      net_salary: netSalary,
      created_by: user.id,
    };

    const { error } = await supabase
      .from('payroll_records')
      .insert([payrollData]);

    if (error) {
      toast({ title: 'Error generating payroll', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'Payroll generated successfully' });
    payrollForm.reset();
    setPayrollDialogOpen(false);
    fetchPayrollRecords();
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    employeeForm.reset({
      employee_id: employee.employee_id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      position: employee.position || '',
      department_id: employee.department_id || '',
      hire_date: employee.hire_date,
      base_salary: employee.base_salary.toString(),
      hourly_rate: employee.hourly_rate?.toString() || '',
      bank_account: employee.bank_account || '',
      tax_id: employee.tax_id || '',
    });
    setEmployeeDialogOpen(true);
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error deleting employee', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: 'Employee deleted successfully' });
    fetchEmployees();
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payroll Management</h1>
          <p className="text-muted-foreground">Manage employees and generate payroll</p>
        </div>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Records</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Employee Records</h2>
            <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingEmployee(null); employeeForm.reset(); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
                  <DialogDescription>
                    {editingEmployee ? 'Update employee information' : 'Create a new employee record'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...employeeForm}>
                  <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={employeeForm.control}
                        name="employee_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Employee ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="EMP001" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="employee@company.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="first_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="John" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="last_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Doe" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Position</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Software Engineer" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="department_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {departments.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="hire_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hire Date</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="base_salary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Salary (Monthly)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="5000" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="hourly_rate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hourly Rate (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="25.50" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="tax_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="123-45-6789" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={employeeForm.control}
                        name="bank_account"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Account</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="1234567890" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setEmployeeDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingEmployee ? 'Update' : 'Create'} Employee
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Hourly Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.employee_id}</TableCell>
                      <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.position || '-'}</TableCell>
                      <TableCell>R {employee.base_salary.toLocaleString()}</TableCell>
                      <TableCell>{employee.hourly_rate ? `R ${employee.hourly_rate}/hr` : '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {employee.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteEmployee(employee.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Payroll Records</h2>
            <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Calculator className="mr-2 h-4 w-4" />
                  Generate Payroll
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Generate Payroll</DialogTitle>
                  <DialogDescription>
                    Create a new payroll record with automatic calculations
                  </DialogDescription>
                </DialogHeader>
                <Form {...payrollForm}>
                  <form onSubmit={payrollForm.handleSubmit(onPayrollSubmit)} className="space-y-4">
                    <FormField
                      control={payrollForm.control}
                      name="employee_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employees.filter(e => e.is_active).map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>
                                  {emp.first_name} {emp.last_name} ({emp.employee_id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={payrollForm.control}
                        name="pay_period_start"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pay Period Start</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={payrollForm.control}
                        name="pay_period_end"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pay Period End</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={payrollForm.control}
                        name="hours_worked"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hours Worked</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.5" placeholder="160" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={payrollForm.control}
                        name="overtime_hours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Overtime Hours</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.5" placeholder="0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={payrollForm.control}
                        name="allowances"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Allowances</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={payrollForm.control}
                        name="deductions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Deductions</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        💡 Taxes will be calculated automatically based on active tax rules. Gross salary is computed from base salary or hourly rate × hours worked (with 1.5x overtime multiplier).
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPayrollDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Generate Payroll
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Payroll (This Month)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R {payrollRecords
                    .filter(p => new Date(p.pay_period_start).getMonth() === new Date().getMonth())
                    .reduce((sum, p) => sum + p.net_salary, 0)
                    .toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.filter(e => e.is_active).length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tax Deductions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R {payrollRecords
                    .filter(p => new Date(p.pay_period_start).getMonth() === new Date().getMonth())
                    .reduce((sum, p) => sum + p.tax_deductions, 0)
                    .toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Gross Salary</TableHead>
                    <TableHead>Tax Deductions</TableHead>
                    <TableHead>Other Deductions</TableHead>
                    <TableHead>Allowances</TableHead>
                    <TableHead>Net Salary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.employees 
                          ? `${record.employees.first_name} ${record.employees.last_name}`
                          : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {new Date(record.pay_period_start).toLocaleDateString()} - {new Date(record.pay_period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {record.hours_worked}
                        {record.overtime_hours > 0 && ` (+${record.overtime_hours} OT)`}
                      </TableCell>
                      <TableCell>R {record.gross_salary.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">-R {record.tax_deductions.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">-R {record.deductions.toLocaleString()}</TableCell>
                      <TableCell className="text-green-600">+R {record.allowances.toLocaleString()}</TableCell>
                      <TableCell className="font-bold">R {record.net_salary.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PayrollPage;
