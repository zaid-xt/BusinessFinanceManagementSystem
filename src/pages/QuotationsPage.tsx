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

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, "Quantity must be positive"),
  rate: z.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, "Rate must be positive"),
});

const quotationSchema = z.object({
  client_name: z.string().min(1, "Client name is required").max(200),
  client_email: z.string().email("Invalid email").optional().or(z.literal("")),
  client_address: z.string().max(500).optional(),
  client_phone: z.string().max(50).optional(),
  company_name: z.string().min(1, "Company name is required").max(200),
  company_address: z.string().max(500).optional(),
  company_email: z.string().email("Invalid email").optional().or(z.literal("")),
  company_phone: z.string().max(50).optional(),
  tax_number: z.string().max(100).optional(),
  tax_amount: z.string().refine(val => val === "" || (!isNaN(Number(val)) && Number(val) >= 0), "Tax must be non-negative").optional(),
  issue_date: z.string().min(1, "Issue date is required"),
  valid_until: z.string().min(1, "Valid until date is required"),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]),
  terms: z.string().optional(),
  notes: z.string().optional(),
});

type LineItem = z.infer<typeof lineItemSchema>;
type QuotationFormData = z.infer<typeof quotationSchema>;

export default function QuotationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nextQuotationNumber, setNextQuotationNumber] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [newItem, setNewItem] = useState({ description: "", quantity: "1", rate: "0" });

  const form = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      client_name: "",
      client_email: "",
      client_address: "",
      client_phone: "",
      company_name: "",
      company_address: "",
      company_email: "",
      company_phone: "",
      tax_number: "",
      tax_amount: "0",
      issue_date: new Date().toISOString().split('T')[0],
      valid_until: "",
      status: "draft",
      terms: "",
      notes: "",
    },
  });

  useEffect(() => {
    fetchQuotations();
    generateNextQuotationNumber();
  }, []);

  const fetchQuotations = async () => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuotations(data || []);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      toast({
        title: "Error",
        description: "Failed to fetch quotations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateNextQuotationNumber = async () => {
    try {
      const { data } = await supabase
        .from('quotations')
        .select('quotation_number')
        .order('created_at', { ascending: false })
        .limit(1);

      const currentYear = new Date().getFullYear();
      let nextNumber = 1;

      if (data && data.length > 0) {
        const lastQuotationNumber = data[0].quotation_number;
        const match = lastQuotationNumber.match(/Q(\d{4})-(\d+)/);
        if (match && match[1] === currentYear.toString()) {
          nextNumber = parseInt(match[2]) + 1;
        }
      }

      setNextQuotationNumber(`Q${currentYear}-${String(nextNumber).padStart(3, '0')}`);
    } catch (error) {
      console.error('Error generating quotation number:', error);
    }
  };

  const taxAmount = form.watch("tax_amount");
  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.rate)), 0);
  const calculatedTotal = (subtotal + Number(taxAmount || 0)).toFixed(2);

  const addLineItem = () => {
    try {
      lineItemSchema.parse(newItem);
      setLineItems([...lineItems, newItem]);
      setNewItem({ description: "", quantity: "1", rate: "0" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Please fill in all line item fields correctly",
        variant: "destructive",
      });
    }
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: QuotationFormData) => {
    if (!user) return;

    if (lineItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    try {
      const totalAmount = subtotal + Number(data.tax_amount || 0);

      const { error } = await supabase
        .from('quotations')
        .insert({
          quotation_number: nextQuotationNumber,
          client_name: data.client_name,
          client_email: data.client_email || null,
          client_address: data.client_address || null,
          client_phone: data.client_phone || null,
          company_name: data.company_name,
          company_address: data.company_address || null,
          company_email: data.company_email || null,
          company_phone: data.company_phone || null,
          tax_number: data.tax_number || null,
          description: JSON.stringify(lineItems),
          amount: subtotal,
          tax_amount: Number(data.tax_amount || 0),
          total_amount: totalAmount,
          issue_date: data.issue_date,
          valid_until: data.valid_until,
          status: data.status,
          terms: data.terms || null,
          notes: data.notes || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Quotation ${nextQuotationNumber} created successfully`,
      });

      form.reset();
      setLineItems([]);
      
      fetchQuotations();
      generateNextQuotationNumber();
    } catch (error) {
      console.error('Error creating quotation:', error);
      toast({
        title: "Error",
        description: "Failed to create quotation",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'sent': return 'secondary';
      case 'rejected': return 'destructive';
      case 'expired': return 'destructive';
      case 'draft': return 'outline';
      default: return 'outline';
    }
  };

  const downloadQuotationPDF = (quotation: any) => {
    const doc = new jsPDF();
    const lineItems = quotation.description ? JSON.parse(quotation.description) : [];
    
    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text("Quotation", 20, 20);
    
    // Quotation number and date (right side)
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Quote No # ${quotation.quotation_number}`, 140, 20);
    doc.text(`Date: ${format(new Date(quotation.issue_date), 'dd MMM yyyy')}`, 140, 27);
    
    // Two column layout - Billed By and Billed To
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("Billed By", 20, 40);
    doc.text("Billed To", 110, 40);
    
    // Billed By details (left column)
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    let leftY = 47;
    doc.text(quotation.company_name || "Your Company Name", 20, leftY);
    leftY += 5;
    if (quotation.company_address) {
      const companyAddressLines = doc.splitTextToSize(quotation.company_address, 80);
      doc.text(companyAddressLines, 20, leftY);
      leftY += companyAddressLines.length * 5;
    }
    if (quotation.tax_number) {
      doc.text(`Tax Number: ${quotation.tax_number}`, 20, leftY);
      leftY += 5;
    }
    if (quotation.company_email) {
      doc.text(`Email: ${quotation.company_email}`, 20, leftY);
      leftY += 5;
    }
    if (quotation.company_phone) {
      doc.text(`Phone: ${quotation.company_phone}`, 20, leftY);
    }
    
    // Billed To details (right column)
    let rightY = 47;
    doc.text(quotation.client_name, 110, rightY);
    rightY += 5;
    if (quotation.client_address) {
      const clientAddressLines = doc.splitTextToSize(quotation.client_address, 80);
      doc.text(clientAddressLines, 110, rightY);
      rightY += clientAddressLines.length * 5;
    }
    if (quotation.client_email) {
      doc.text(`Email: ${quotation.client_email}`, 110, rightY);
      rightY += 5;
    }
    if (quotation.client_phone) {
      doc.text(`Phone: ${quotation.client_phone}`, 110, rightY);
    }
    
    // Line items table
    const tableStartY = Math.max(leftY, rightY) + 15;
    
    // Table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, tableStartY, 170, 8, 'F');
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text("Item", 22, tableStartY + 5);
    doc.text("Description", 35, tableStartY + 5);
    doc.text("Qty", 140, tableStartY + 5);
    doc.text("Rate", 155, tableStartY + 5);
    doc.text("Amount", 175, tableStartY + 5);
    
    // Table rows
    doc.setFont(undefined, 'normal');
    let currentY = tableStartY + 13;
    lineItems.forEach((item: LineItem, index: number) => {
      const amount = Number(item.quantity) * Number(item.rate);
      doc.text(`${index + 1}.`, 22, currentY);
      const descLines = doc.splitTextToSize(item.description, 100);
      doc.text(descLines, 35, currentY);
      doc.text(item.quantity, 140, currentY);
      doc.text(`ZAR ${Number(item.rate).toFixed(2)}`, 155, currentY);
      doc.text(`ZAR ${amount.toFixed(2)}`, 175, currentY);
      currentY += Math.max(descLines.length * 5, 7);
    });
    
    // Subtotal and Total
    currentY += 5;
    doc.setFont(undefined, 'bold');
    doc.text("Subtotal", 140, currentY);
    doc.text(`ZAR ${Number(quotation.amount).toFixed(2)}`, 175, currentY);
    
    if (quotation.tax_amount > 0) {
      currentY += 7;
      doc.text("Tax", 140, currentY);
      doc.text(`ZAR ${Number(quotation.tax_amount).toFixed(2)}`, 175, currentY);
    }
    
    currentY += 7;
    doc.setFontSize(11);
    doc.text("TOTAL", 140, currentY);
    doc.text(`ZAR ${Number(quotation.total_amount).toFixed(2)}`, 175, currentY);
    
    // Quote Validity
    currentY += 15;
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("Quote Validity", 20, currentY);
    currentY += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    const validityText = `This quote is valid until ${format(new Date(quotation.valid_until), 'dd MMM yyyy')}.`;
    doc.text(validityText, 20, currentY);
    
    // Terms and Notes
    if (quotation.terms) {
      currentY += 12;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text("Terms & Conditions", 20, currentY);
      currentY += 7;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      const termsLines = doc.splitTextToSize(quotation.terms, 170);
      doc.text(termsLines, 20, currentY);
      currentY += termsLines.length * 5;
    }
    
    if (quotation.notes) {
      currentY += 10;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text("Notes", 20, currentY);
      currentY += 7;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      const notesLines = doc.splitTextToSize(quotation.notes, 170);
      doc.text(notesLines, 20, currentY);
    }
    
    // Save
    doc.save(`${quotation.quotation_number}.pdf`);
    
    toast({
      title: "Success",
      description: "Quotation downloaded successfully",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Quotations</h1>
          <p className="text-muted-foreground">Generate and manage client quotations</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Quotation</CardTitle>
          <CardDescription>Quotation #{nextQuotationNumber}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Company Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Company Ltd" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="info@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 234 567 8900" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tax_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Number</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="company_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="123 Business St, City, Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Client Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Client Information</h3>
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

                  <FormField
                    control={form.control}
                    name="client_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 234 567 8900" {...field} />
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
                        <Textarea placeholder="456 Client Ave, City, Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Line Items Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Line Items</h3>
                
                {lineItems.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-24">Quantity</TableHead>
                          <TableHead className="w-32">Rate</TableHead>
                          <TableHead className="w-32 text-right">Amount</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>ZAR {Number(item.rate).toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              ZAR {(Number(item.quantity) * Number(item.rate)).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(index)}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-6">
                    <Label>Description *</Label>
                    <Input
                      placeholder="Website Design & Development"
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Rate *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newItem.rate}
                      onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="button" onClick={addLineItem} className="w-full">
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>

              {/* Totals Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-semibold">ZAR {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span className="font-semibold">ZAR {Number(taxAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>ZAR {calculatedTotal}</span>
                  </div>
                </div>
              </div>

              {/* Dates and Status */}
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
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until *</FormLabel>
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
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Terms and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms & Conditions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="This quote is valid for 6 months..." 
                          rows={4}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional notes or comments..." 
                          rows={4}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit">Create Quotation</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotation History</CardTitle>
          <CardDescription>View and manage all quotations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading quotations...</div>
          ) : quotations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No quotations created yet</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{quotation.client_name}</p>
                          {quotation.client_email && (
                            <p className="text-xs text-muted-foreground">{quotation.client_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(quotation.issue_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(new Date(quotation.valid_until), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(quotation.status)}>
                          {quotation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ZAR {Number(quotation.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadQuotationPDF(quotation)}
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
