import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Download, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TrainingMaterial {
  id: string;
  title: string;
  description?: string;
  category?: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  forClient: boolean;
  forTechnician: boolean;
  createdAt: string;
  viewCount: number;
}

export function AdminTrainingList({ refreshTrigger }: { refreshTrigger?: number }) {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMaterials();
  }, [refreshTrigger]);
  
  const fetchMaterials = async () => {
    try {
      const response = await apiRequest('GET', '/api/training/materials');
      const data = await response.json();
      setMaterials(data.materials || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({
        title: "Error",
        description: "Failed to fetch training materials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }
    
    try {
      const response = await apiRequest('DELETE', `/api/training/materials/${id}`);
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Material deleted successfully",
        });
        fetchMaterials();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete material",
        variant: "destructive",
      });
    }
  };
  
  const handleDownload = (id: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `/api/training/materials/${id}/file?download=true`;
    link.download = fileName;
    link.click();
  };
  
  const getFileTypeIcon = (fileType: string) => {
    const icons: Record<string, string> = {
      image: '🖼️',
      video: '🎥',
      document: '📄',
      pdf: '📕'
    };
    return icons[fileType] || '📎';
  };
  
  const getRoleBadges = (material: TrainingMaterial) => {
    const badges = [];
    if (material.forClient) {
      badges.push(<Badge key="client" variant="secondary">👥 Clients</Badge>);
    }
    if (material.forTechnician) {
      badges.push(<Badge key="tech" variant="secondary">🔧 Technicians</Badge>);
    }
    return badges;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (materials.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          <p>No training materials uploaded yet</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {materials.map((material) => (
        <Card key={material.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="text-4xl">
                  {getFileTypeIcon(material.fileType)}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{material.title}</h3>
                  {material.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {material.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {material.category && (
                      <Badge variant="outline">{material.category}</Badge>
                    )}
                    
                    {getRoleBadges(material)}
                    
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Eye className="h-4 w-4" />
                      <span>{material.viewCount || 0} views</span>
                    </div>
                    
                    <span className="text-xs text-gray-500">
                      {new Date(material.createdAt).toLocaleDateString()}
                    </span>
                    
                    <span className="text-xs text-gray-500">
                      {(material.fileSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDownload(material.id, material.fileName)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleDelete(material.id, material.title)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
