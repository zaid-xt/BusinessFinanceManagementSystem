import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Settings, Upload, X } from "lucide-react";

const settingsSchema = z.object({
  company_name: z.string().min(1, "Company name is required").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  registration_number: z.string().max(100).optional(),
  tax_number: z.string().max(100).optional(),
  terms_and_conditions: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      company_name: "",
      email: "",
      phone: "",
      address: "",
      registration_number: "",
      tax_number: "",
      terms_and_conditions: "",
    },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettingsId(data.id);
        setLogoUrl(data.logo_url);
        form.reset({
          company_name: data.company_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          registration_number: data.registration_number || "",
          tax_number: data.tax_number || "",
          terms_and_conditions: data.terms_and_conditions || "",
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch company settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return logoUrl;

    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('company-logos')
            .remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: "Failed to upload logo",
        variant: "destructive",
      });
      return null;
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    if (!user) return;
    setIsSaving(true);

    try {
      const uploadedLogoUrl = await uploadLogo();

      const settingsData = {
        company_name: data.company_name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        registration_number: data.registration_number || null,
        tax_number: data.tax_number || null,
        terms_and_conditions: data.terms_and_conditions || null,
        logo_url: uploadedLogoUrl,
      };

      let error;
      if (settingsId) {
        // Update existing settings
        const result = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', settingsId);
        error = result.error;
      } else {
        // Insert new settings
        const result = await supabase
          .from('company_settings')
          .insert(settingsData)
          .select()
          .single();
        error = result.error;
        if (result.data) {
          setSettingsId(result.data.id);
        }
      }

      if (error) throw error;

      setLogoUrl(uploadedLogoUrl);
      setLogoFile(null);
      setLogoPreview(null);

      toast({
        title: "Success",
        description: "Company settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save company settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground">Manage your company information for invoices and quotations</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>This information will appear on all invoices and quotations</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-start gap-4">
                  {(logoPreview || logoUrl) && (
                    <div className="relative">
                      <img
                        src={logoPreview || logoUrl || ""}
                        alt="Company logo"
                        className="h-24 w-24 object-contain border rounded"
                      />
                      {logoPreview && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={removeLogo}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Recommended: Square image, PNG or JPG, max 2MB
                    </p>
                  </div>
                </div>
              </div>

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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="info@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 234 567 8900" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="registration_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Number</FormLabel>
                      <FormControl>
                        <Input placeholder="REG123456" {...field} />
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
                      <FormLabel>Tax Number / VAT</FormLabel>
                      <FormControl>
                        <Input placeholder="TAX123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="123 Business St, City, State, ZIP, Country" 
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="terms_and_conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms & Conditions</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter your standard terms and conditions for invoices and quotations..." 
                        rows={6}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      These terms will be included at the bottom of all invoices and quotations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
