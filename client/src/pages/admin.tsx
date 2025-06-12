import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Cloud, Key, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const awsConfigSchema = z.object({
  accessKeyId: z.string().min(1, "Access Key ID is required"),
  secretAccessKey: z.string().min(1, "Secret Access Key is required"),
  region: z.string().min(1, "Region is required"),
  defaultBucket: z.string().optional(),
});

type AWSConfig = z.infer<typeof awsConfigSchema>;

// AWS Regions list
const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "af-south-1", label: "Africa (Cape Town)" },
  { value: "ap-east-1", label: "Asia Pacific (Hong Kong)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul)" },
  { value: "ap-northeast-3", label: "Asia Pacific (Osaka)" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ca-central-1", label: "Canada (Central)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "eu-north-1", label: "Europe (Stockholm)" },
  { value: "eu-south-1", label: "Europe (Milan)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-west-3", label: "Europe (Paris)" },
  { value: "me-south-1", label: "Middle East (Bahrain)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
];

interface Bucket {
  name: string;
  creationDate: string;
}

export default function Admin() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
  const [availableBuckets, setAvailableBuckets] = useState<Bucket[]>([]);

  // Load current AWS configuration
  const { data: awsConfig, isLoading: configLoading } = useQuery({
    queryKey: ['/api/aws/credentials'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/aws/credentials');
      return await response.json();
    },
  });

  const form = useForm<AWSConfig>({
    resolver: zodResolver(awsConfigSchema),
    defaultValues: {
      accessKeyId: "",
      secretAccessKey: "",
      region: "us-east-1",
      defaultBucket: "none",
    },
  });

  // Update form when config loads
  useEffect(() => {
    if (awsConfig) {
      form.reset({
        accessKeyId: "",
        secretAccessKey: "",
        region: awsConfig.region || "us-east-1",
        defaultBucket: awsConfig.defaultBucket || "none",
      });
    }
  }, [awsConfig, form]);

  // Save credentials mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: async (data: AWSConfig) => {
      const response = await apiRequest('POST', '/api/aws/credentials', data);
      return await response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Configuration saved",
        description: `AWS credentials stored securely. Found ${result.bucketsCount} bucket(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/aws/credentials'] });
      queryClient.invalidateQueries({ queryKey: ['/api/s3/buckets'] });
    },
    onError: (error: any) => {
      toast({
        title: "Configuration failed",
        description: error.message || "Failed to save AWS configuration.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: AWSConfig) => {
    const submitData = {
      ...data,
      defaultBucket: data.defaultBucket === "none" ? "" : data.defaultBucket
    };
    saveCredentialsMutation.mutate(submitData);
  };

  // Load available buckets using stored credentials
  const { data: buckets = [], isLoading: bucketsLoading } = useQuery({
    queryKey: ['/api/s3/buckets'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/s3/buckets');
      return await response.json();
    },
    enabled: awsConfig?.isConfigured,
  });

  // Update available buckets when they load
  useEffect(() => {
    setAvailableBuckets(buckets);
  }, [buckets]);

  const testConnection = async () => {
    const config = form.getValues();
    if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
      toast({
        title: "Missing credentials",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    
    saveCredentialsMutation.mutate(config);
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Admin</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-none space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Cloud className="h-5 w-5" />
                <span>AWS Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure your AWS credentials to enable S3 access and data imports.
                Credentials are stored locally in your browser.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="accessKeyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access Key ID</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password"
                              placeholder="AKIAIOSFODNN7EXAMPLE"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="secretAccessKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secret Access Key</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password"
                              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="region"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Region</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a region" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {AWS_REGIONS.map((region) => (
                                <SelectItem key={region.value} value={region.value}>
                                  {region.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultBucket"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Bucket (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a default bucket" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No default bucket</SelectItem>
                              {availableBuckets.map((bucket) => (
                                <SelectItem key={bucket.name} value={bucket.name}>
                                  {bucket.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {awsConfig?.isConfigured && (
                        <span className="text-green-600 dark:text-green-400">
                          ✓ Credentials configured
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testConnection}
                        disabled={saveCredentialsMutation.isPending}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Test Connection
                      </Button>
                      <Button type="submit" disabled={saveCredentialsMutation.isPending}>
                        {saveCredentialsMutation.isPending ? "Saving..." : "Save Configuration"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Display available buckets if configured */}
          {awsConfig?.isConfigured && (
            <Card>
              <CardHeader>
                <CardTitle>Available S3 Buckets</CardTitle>
                <CardDescription>
                  Buckets accessible with your current AWS credentials
                </CardDescription>
              </CardHeader>
              <CardContent>
                {bucketsLoading ? (
                  <div className="text-center py-4">Loading buckets...</div>
                ) : buckets.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No buckets found with the current credentials
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {buckets.map((bucket: Bucket) => (
                      <div 
                        key={bucket.name}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{bucket.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Created: {new Date(bucket.creationDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>Security Information</span>
              </CardTitle>
              <CardDescription>
                Important security considerations for your AWS credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                  Security Best Practices
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• Use IAM users with minimal required permissions</li>
                  <li>• Regularly rotate your access keys</li>
                  <li>• Never share your credentials with others</li>
                  <li>• Consider using temporary credentials when possible</li>
                </ul>
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Required Permissions
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Your AWS user needs the following permissions: s3:ListBucket, s3:GetObject, s3:GetObjectMetadata
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}