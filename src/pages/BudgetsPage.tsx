import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Pencil, Trash2, Plus, FolderPlus, Wrench, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const budgetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Amount must be a positive number"),
  period_start: z.string().min(1, "Start date is required"),
  period_end: z.string().min(1, "End date is required"),
  type: z.enum(["department", "project"]),
  department_id: z.string().optional(),
  project_id: z.string().optional(),
}).refine(data => {
  if (data.type === "department" && !data.department_id) return false;
  if (data.type === "project" && !data.project_id) return false;
  return true;
}, {
  message: "Please select a department or project",
  path: ["department_id"],
});

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

const serviceSchema = z.object({
  service_name: z.string().min(1, "Service name is required").max(100),
  description: z.string().max(500).optional(),
  estimated_cost: z.string().min(1, "Estimated cost is required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Cost must be a positive number"),
  status: z.enum(["planned", "in_progress", "completed"]),
});

type BudgetFormData = z.infer<typeof budgetSchema>;
type ProjectFormData = z.infer<typeof projectSchema>;
type ServiceFormData = z.infer<typeof serviceSchema>;

interface Budget {
  id: string;
  name: string;
  amount: number;
  period_start: string;
  period_end: string;
  department_id: string | null;
  project_id: string | null;
  actual_expenses?: number;
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectServices, setProjectServices] = useState<any[]>([]);

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      name: "",
      amount: "",
      period_start: new Date().toISOString().split('T')[0],
      period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
      type: "department",
    },
  });

  const projectForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      start_date: "",
      end_date: "",
    },
  });

  const serviceForm = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      service_name: "",
      description: "",
      estimated_cost: "",
      status: "planned",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsRes, departmentsRes, projectsRes] = await Promise.all([
        supabase.from('budgets').select('*').order('period_start', { ascending: false }),
        supabase.from('departments').select('id, name'),
        supabase.from('projects').select('*'),
      ]);

      if (budgetsRes.error) throw budgetsRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      // Fetch actual expenses for each budget
      const budgetsWithExpenses = await Promise.all(
        (budgetsRes.data || []).map(async (budget) => {
          const { data: transactions } = await supabase
            .from('financial_transactions')
            .select('amount')
            .eq('type', 'expense')
            .gte('transaction_date', budget.period_start)
            .lte('transaction_date', budget.period_end)
            .or(`department_id.eq.${budget.department_id},project_id.eq.${budget.project_id}`);

          const actual_expenses = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
          return { ...budget, actual_expenses };
        })
      );

      setBudgets(budgetsWithExpenses);
      setDepartments(departmentsRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch budgets",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: BudgetFormData) => {
    if (!user) return;

    try {
      const budgetData = {
        name: data.name,
        amount: Number(data.amount),
        period_start: data.period_start,
        period_end: data.period_end,
        department_id: data.type === "department" ? data.department_id : null,
        project_id: data.type === "project" ? data.project_id : null,
        created_by: user.id,
      };

      if (editingBudget) {
        const { error } = await supabase
          .from('budgets')
          .update(budgetData)
          .eq('id', editingBudget.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Budget updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert(budgetData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Budget created successfully",
        });
      }

      form.reset();
      setEditingBudget(null);
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Error",
        description: "Failed to save budget",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    form.reset({
      name: budget.name,
      amount: budget.amount.toString(),
      period_start: budget.period_start,
      period_end: budget.period_end,
      type: budget.department_id ? "department" : "project",
      department_id: budget.department_id || undefined,
      project_id: budget.project_id || undefined,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!budgetToDelete) return;

    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Budget deleted successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: "Error",
        description: "Failed to delete budget",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setBudgetToDelete(null);
    }
  };

  const onProjectSubmit = async (data: ProjectFormData) => {
    try {
      const projectData = {
        name: data.name,
        description: data.description || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
      };

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', editingProject.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Project updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(projectData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Project created successfully",
        });
      }

      projectForm.reset();
      setEditingProject(null);
      setProjectDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: "Error",
        description: "Failed to save project",
        variant: "destructive",
      });
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    projectForm.reset({
      name: project.name,
      description: project.description || "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
    });
    setProjectDialogOpen(true);
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project deleted successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    }
  };

  const fetchProjectServices = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('project_services')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjectServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleAddService = (projectId: string) => {
    setSelectedProjectId(projectId);
    serviceForm.reset();
    setServiceDialogOpen(true);
    fetchProjectServices(projectId);
  };

  const onServiceSubmit = async (data: ServiceFormData) => {
    if (!user || !selectedProjectId) return;

    try {
      const { error } = await supabase
        .from('project_services')
        .insert({
          project_id: selectedProjectId,
          service_name: data.service_name,
          description: data.description || null,
          estimated_cost: Number(data.estimated_cost),
          status: data.status,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service added successfully",
      });

      serviceForm.reset();
      fetchProjectServices(selectedProjectId);
      fetchData();
    } catch (error) {
      console.error('Error adding service:', error);
      toast({
        title: "Error",
        description: "Failed to add service",
        variant: "destructive",
      });
    }
  };

  const handleCreateTransaction = async (service: any) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('financial_transactions')
        .insert({
          user_id: user.id,
          description: `${service.service_name} - ${service.description || 'Project service'}`,
          amount: service.estimated_cost,
          type: 'expense',
          transaction_date: new Date().toISOString().split('T')[0],
          project_id: service.project_id,
          category: 'operational' as any,
        });

      if (error) throw error;

      // Update service actual cost
      await supabase
        .from('project_services')
        .update({ actual_cost: service.estimated_cost })
        .eq('id', service.id);

      toast({
        title: "Success",
        description: "Transaction created successfully",
      });

      fetchProjectServices(service.project_id);
      fetchData();
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      });
    }
  };

  const handleDeleteService = async (serviceId: string, projectId: string) => {
    try {
      const { error } = await supabase
        .from('project_services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Service deleted successfully",
      });

      fetchProjectServices(projectId);
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({
        title: "Error",
        description: "Failed to delete service",
        variant: "destructive",
      });
    }
  };

  const budgetType = form.watch("type");

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-orange-600";
    return "text-green-600";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-muted-foreground">Create and manage budgets for departments and projects</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => {
                setEditingProject(null);
                projectForm.reset();
              }}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
              <DialogHeader>
                <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
                <DialogDescription>
                  Add project details including name, description, and timeline
                </DialogDescription>
              </DialogHeader>
              <Form {...projectForm}>
                <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
                  <FormField
                    control={projectForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Website Redesign" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={projectForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Project description and objectives" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={projectForm.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={projectForm.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingProject ? "Update" : "Create"} Project
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingBudget(null);
                form.reset();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Budget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-background">
              <DialogHeader>
                <DialogTitle>{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
                <DialogDescription>
                  Set budget limits for departments or projects
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Q1 Marketing Budget" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Budget Amount</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="10000.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Budget Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background">
                              <SelectItem value="department">Department</SelectItem>
                              <SelectItem value="project">Project</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="period_start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="period_end"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {budgetType === "department" && (
                    <FormField
                      control={form.control}
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
                            <SelectContent className="bg-background">
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
                  )}

                  {budgetType === "project" && (
                    <FormField
                      control={form.control}
                      name="project_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select project" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background">
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingBudget ? "Update" : "Create"} Budget
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="budgets" className="w-full">
        <TabsList>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>

        <TabsContent value="budgets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Budgets</CardTitle>
              <CardDescription>Track budget utilization across departments and projects</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading budgets...</div>
              ) : budgets.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No budgets created yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Budget Name</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Spent</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Utilization</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgets.map((budget) => {
                        const spent = budget.actual_expenses || 0;
                        const remaining = Number(budget.amount) - spent;
                        const utilization = (spent / Number(budget.amount)) * 100;

                        return (
                          <TableRow key={budget.id}>
                            <TableCell className="font-medium">{budget.name}</TableCell>
                            <TableCell>
                              {format(new Date(budget.period_start), 'MMM dd')} - {format(new Date(budget.period_end), 'MMM dd, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {budget.department_id ? "Department" : "Project"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">R {Number(budget.amount).toLocaleString()}</TableCell>
                            <TableCell className="text-right text-red-600">R {spent.toLocaleString()}</TableCell>
                            <TableCell className={`text-right ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              R {remaining.toLocaleString()}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${getUtilizationColor(utilization)}`}>
                              {utilization.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(budget)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setBudgetToDelete(budget.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Manage your projects and their details</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No projects created yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium">{project.name}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {project.description || "-"}
                          </TableCell>
                          <TableCell>
                            {project.start_date ? format(new Date(project.start_date), 'MMM dd, yyyy') : "-"}
                          </TableCell>
                          <TableCell>
                            {project.end_date ? format(new Date(project.end_date), 'MMM dd, yyyy') : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddService(project.id)}
                              >
                                <Wrench className="h-4 w-4 mr-1" />
                                Services
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditProject(project)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteProject(project.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this budget. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
          <DialogHeader>
            <DialogTitle>Project Services</DialogTitle>
            <DialogDescription>
              Add and manage services for this project. Create transactions to track expenses.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <Form {...serviceForm}>
              <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4 border rounded-lg p-4">
                <h3 className="font-semibold">Add New Service</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={serviceForm.control}
                    name="service_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Web Development" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={serviceForm.control}
                    name="estimated_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Cost</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="5000.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={serviceForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Service description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={serviceForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background">
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit">Add Service</Button>
              </form>
            </Form>

            <div>
              <h3 className="font-semibold mb-4">Existing Services</h3>
              {projectServices.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No services added yet</p>
              ) : (
                <div className="space-y-3">
                  {projectServices.map((service) => (
                    <div key={service.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{service.service_name}</h4>
                            <Badge variant={
                              service.status === 'completed' ? 'default' :
                              service.status === 'in_progress' ? 'secondary' : 'outline'
                            }>
                              {service.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-sm">
                            <span>Estimated: <strong>R {Number(service.estimated_cost).toLocaleString()}</strong></span>
                            <span>Actual: <strong>R {Number(service.actual_cost || 0).toLocaleString()}</strong></span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {service.actual_cost === 0 && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleCreateTransaction(service)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Create Transaction
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteService(service.id, service.project_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
