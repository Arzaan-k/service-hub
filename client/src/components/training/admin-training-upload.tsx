import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Image, Video, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const CATEGORIES = [
  'Safety Training',
  'Technical Skills',
  'Equipment Operation',
  'Process Guidelines',
  'Company Policy',
  'Customer Service',
  'General'
];

export function AdminTrainingUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    forClient: false,
    forTechnician: false
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "File size must be less than 50MB",
        variant: "destructive",
      });
      return;
    }
    
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/jpg', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4', 'video/webm', 'video/ogg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Invalid file type. Allowed: Images, PDFs, Documents, Videos",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
  };
  
  const handleUpload = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.forClient && !formData.forTechnician) {
      toast({
        title: "Error",
        description: "Please select at least one target role",
        variant: "destructive",
      });
      return;
    }
    
    setUploading(true);
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('title', formData.title);
      uploadFormData.append('description', formData.description);
      uploadFormData.append('category', formData.category);
      uploadFormData.append('forClient', String(formData.forClient));
      uploadFormData.append('forTechnician', String(formData.forTechnician));
      
      const response = await apiRequest('POST', '/api/training/upload', uploadFormData);
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Training material uploaded successfully!",
        });
        
        setFormData({
          title: '',
          description: '',
          category: '',
          forClient: false,
          forTechnician: false
        });
        setSelectedFile(null);
        
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        toast({
          title: "Error",
          description: data.message || "Upload failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };
  
  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="h-8 w-8" />;
    
    if (selectedFile.type.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-600" />;
    } else if (selectedFile.type.startsWith('video/')) {
      return <Video className="h-8 w-8 text-purple-600" />;
    } else {
      return <FileText className="h-8 w-8 text-green-600" />;
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>📤 Upload Training Material</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <Label>Title *</Label>
          <Input
            placeholder="e.g., Safety Equipment Usage Guide"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>
        
        <div>
          <Label>Description</Label>
          <Textarea
            placeholder="Brief description of the training material..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
        
        <div>
          <Label>Category</Label>
          <Select 
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Upload File *</Label>
          <div className="mt-2">
            {selectedFile ? (
              <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getFileIcon()}
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors block">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,.pdf,.doc,.docx"
                />
                <div className="text-center">
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Images, Videos, PDFs, Documents (Max 50MB)
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>
        
        <div>
          <Label className="mb-3 block">Assign To *</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="client"
                checked={formData.forClient}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, forClient: checked as boolean })
                }
              />
              <label htmlFor="client" className="text-sm font-medium cursor-pointer">
                👥 Clients
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="technician"
                checked={formData.forTechnician}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, forTechnician: checked as boolean })
                }
              />
              <label htmlFor="technician" className="text-sm font-medium cursor-pointer">
                🔧 Technicians
              </label>
            </div>
          </div>
        </div>
        
        <Button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full"
          size="lg"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Training Material
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
