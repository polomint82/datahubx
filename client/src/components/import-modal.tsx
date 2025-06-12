import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { S3ImportRequest } from "@shared/schema";

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportModal({ open, onOpenChange }: ImportModalProps) {
  const [formData, setFormData] = useState<S3ImportRequest>({
    bucket: "",
    key: "",
    name: "",
    hasHeader: true,
    autoDetectTypes: true,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (data: S3ImportRequest) => {
      const response = await apiRequest("POST", "/api/import/s3", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Import Started",
        description: "Your dataset is being imported. You can check the progress in Job History.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
      setFormData({
        bucket: "",
        key: "",
        name: "",
        hasHeader: true,
        autoDetectTypes: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import dataset",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bucket || !formData.key || !formData.name) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import CSV from S3</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="s3-bucket">S3 Bucket</Label>
            <Input
              id="s3-bucket"
              type="text"
              placeholder="my-data-bucket"
              value={formData.bucket}
              onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="s3-key">File Path</Label>
            <Input
              id="s3-key"
              type="text"
              placeholder="data/customer-data.csv"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="dataset-name">Dataset Name</Label>
            <Input
              id="dataset-name"
              type="text"
              placeholder="Customer Data Q4"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Import Options</Label>
            <div className="mt-2 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-header"
                  checked={formData.hasHeader}
                  onCheckedChange={(checked) => setFormData({ ...formData, hasHeader: !!checked })}
                />
                <Label htmlFor="has-header" className="text-sm">
                  First row contains headers
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auto-detect-types"
                  checked={formData.autoDetectTypes}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoDetectTypes: !!checked })}
                />
                <Label htmlFor="auto-detect-types" className="text-sm">
                  Auto-detect data types
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={importMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importMutation.isPending ? "Importing..." : "Import Dataset"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
