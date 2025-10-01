import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Download } from "lucide-react";
import jsPDF from "jspdf";

const invoiceSchema = z.object({
  client_name: z.string().min(1, "Client name is required").max(200),
  client_email: z.string().email("Invalid email").optional().or(z.literal("")),
  client_address: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Amount must be positive"),
  tax_amount: z.string().refine(val => val === "" || (!isNaN(Number(val)) && Number(val) >= 0), "Tax must be non-negative").optional(),
  issue_date: z.string().min(1, "Issue date is required"),
  due_date: z.string().min(1, "Due date is required"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export default function InvoicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState("");

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      client_name: "",
      client_email: "",
      client_address: "",
      description: "",
      amount: "",
      tax_amount: "0",
      issue_date: new Date().toISOString().split('T')[0],
      due_date: "",
      status: "draft",
    },
  });

  useEffect(() => {
    fetchInvoices();
    generateNextInvoiceNumber();
  }, []);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateNextInvoiceNumber = async () => {
    try {
      const { data } = await supabase
        .from('invoices')
        .select('invoice_number')
        .order('created_at', { ascending: false })
        .limit(1);

      const currentYear = new Date().getFullYear();
      let nextNumber = 1;

      if (data && data.length > 0) {
        const lastInvoiceNumber = data[0].invoice_number;
        const match = lastInvoiceNumber.match(/INV-(\d{4})-(\d+)/);
        if (match && match[1] === currentYear.toString()) {
          nextNumber = parseInt(match[2]) + 1;
        }
      }

      setNextInvoiceNumber(`INV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
    } catch (error) {
      console.error('Error generating invoice number:', error);
    }
  };

  const amount = form.watch("amount");
  const taxAmount = form.watch("tax_amount");
  const calculatedTotal = (Number(amount || 0) + Number(taxAmount || 0)).toFixed(2);

  const onSubmit = async (data: InvoiceFormData) => {
    if (!user) return;

    try {
      const totalAmount = Number(data.amount) + Number(data.tax_amount || 0);

      const { error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: nextInvoiceNumber,
          client_name: data.client_name,
          client_email: data.client_email || null,
          client_address: data.client_address || null,
          description: data.description || null,
          amount: Number(data.amount),
          tax_amount: Number(data.tax_amount || 0),
          total_amount: totalAmount,
          issue_date: data.issue_date,
          due_date: data.due_date,
          status: data.status,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invoice ${nextInvoiceNumber} created successfully`,
      });

      form.reset({
        client_name: "",
        client_email: "",
        client_address: "",
        description: "",
        amount: "",
        tax_amount: "0",
        issue_date: new Date().toISOString().split('T')[0],
        due_date: "",
        status: "draft",
      });
      
      fetchInvoices();
      generateNextInvoiceNumber();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'sent': return 'secondary';
      case 'overdue': return 'destructive';
      case 'draft': return 'outline';
      case 'cancelled': return 'secondary';
      default: return 'outline';
    }
  };

  const downloadInvoicePDF = (invoice: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(24);
    doc.text("INVOICE", 20, 20);
    
    // Invoice details
    doc.setFontSize(12);
    doc.text(invoice.invoice_number, 20, 35);
    doc.setFontSize(10);
    doc.text(`Issue Date: ${format(new Date(invoice.issue_date), 'MMM dd, yyyy')}`, 20, 42);
    doc.text(`Due Date: ${format(new Date(invoice.due_date), 'MMM dd, yyyy')}`, 20, 49);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 56);
    
    // Client information
    doc.setFontSize(12);
    doc.text("Bill To:", 20, 70);
    doc.setFontSize(10);
    doc.text(invoice.client_name, 20, 77);
    if (invoice.client_email) {
      doc.text(invoice.client_email, 20, 84);
    }
    if (invoice.client_address) {
      const addressLines = doc.splitTextToSize(invoice.client_address, 80);
      doc.text(addressLines, 20, invoice.client_email ? 91 : 84);
    }
    
    // Description
    if (invoice.description) {
      doc.setFontSize(12);
      doc.text("Description:", 20, 110);
      doc.setFontSize(10);
      const descLines = doc.splitTextToSize(invoice.description, 170);
      doc.text(descLines, 20, 117);
    }
    
    // Amount breakdown
    const startY = invoice.description ? 140 : 120;
    doc.setFontSize(10);
    doc.text("Amount:", 120, startY);
    doc.text(`$${Number(invoice.amount).toFixed(2)}`, 170, startY, { align: 'right' });
    
    doc.text("Tax:", 120, startY + 7);
    doc.text(`$${Number(invoice.tax_amount || 0).toFixed(2)}`, 170, startY + 7, { align: 'right' });
    
    // Total
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Total:", 120, startY + 17);
    doc.text(`$${Number(invoice.total_amount).toFixed(2)}`, 170, startY + 17, { align: 'right' });
    
    // Save
    doc.save(`${invoice.invoice_number}.pdf`);
    
    toast({
      title: "Success",
      description: "Invoice downloaded successfully",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Generate and manage client invoices</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Invoice</CardTitle>
          <CardDescription>Invoice #{nextInvoiceNumber}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corporation" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="client@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="client_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="123 Main St, City, Country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Services or products provided..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tax_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <div className="h-10 flex items-center px-3 border rounded-md bg-muted font-semibold">
                    ${calculatedTotal}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="issue_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit">Create Invoice</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>View and manage all invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No invoices created yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.client_name}</p>
                          {invoice.client_email && (
                            <p className="text-xs text-muted-foreground">{invoice.client_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(invoice.issue_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(new Date(invoice.due_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${Number(invoice.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadInvoicePDF(invoice)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
