import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Download, Search, Loader2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';

interface TrainingMaterial {
  id: string;
  title: string;
  description?: string;
  category?: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
  isViewed: boolean;
}

const CATEGORIES = [
  'Safety Training',
  'Technical Skills',
  'Equipment Operation',
  'Process Guidelines',
  'Company Policy',
  'Customer Service',
  'General'
];

export default function Training() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMaterials();
    fetchUnreadCount();
  }, []);
  
  const fetchMaterials = async () => {
    try {
      const response = await apiRequest('GET', '/api/training/my-materials');
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
  
  const fetchUnreadCount = async () => {
    try {
      const response = await apiRequest('GET', '/api/training/unread-count');
      const data = await response.json();
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };
  
  const handleView = async (material: TrainingMaterial) => {
    try {
      // Mark as viewed first
      await apiRequest('POST', `/api/training/materials/${material.id}/view`);
      
      setMaterials(materials.map(m => 
        m.id === material.id ? { ...m, isViewed: true } : m
      ));
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Fetch file with authentication and open as blob
      const fileResponse = await apiRequest('GET', `/api/training/materials/${material.id}/file`);
      const blob = await fileResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Error viewing material:', error);
      toast({
        title: "Error",
        description: "Failed to open training material",
        variant: "destructive",
      });
    }
  };
  
  const handleDownload = async (material: TrainingMaterial) => {
    try {
      // Fetch file with authentication
      const fileResponse = await apiRequest('GET', `/api/training/materials/${material.id}/file?download=true`);
      const blob = await fileResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = material.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Error downloading material:', error);
      toast({
        title: "Error",
        description: "Failed to download training material",
        variant: "destructive",
      });
    }
  };
  
  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         material.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  const getFileTypeIcon = (fileType: string) => {
    const icons: Record<string, string> = {
      image: '🖼️',
      video: '🎥',
      document: '📄',
      pdf: '📕'
    };
    return icons[fileType] || '📎';
  };
  
  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header title="Training Materials" />
          <main className="flex-1 overflow-y-auto flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </main>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Training Materials" />
        <main className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
      <Card className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8" />
                <h1 className="text-2xl font-bold">Training Materials</h1>
              </div>
              <p className="text-blue-100 mt-1">
                Access your assigned training content
              </p>
            </div>
            {unreadCount > 0 && (
              <div className="bg-white text-blue-600 rounded-full px-6 py-3">
                <div className="text-3xl font-bold">{unreadCount}</div>
                <div className="text-sm">New Materials</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search training materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select 
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        {filteredMaterials.map((material) => (
          <Card key={material.id} className={!material.isViewed ? 'border-blue-500 border-2' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="text-4xl">
                    {getFileTypeIcon(material.fileType)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{material.title}</h3>
                      {!material.isViewed && (
                        <Badge variant="destructive">NEW</Badge>
                      )}
                    </div>
                    
                    {material.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {material.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-3 mt-3">
                      {material.category && (
                        <Badge variant="outline">{material.category}</Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        Uploaded: {new Date(material.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(material.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleView(material)}
                    variant={material.isViewed ? "outline" : "default"}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {material.isViewed ? 'View Again' : 'View'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleDownload(material)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredMaterials.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No training materials found</p>
              {searchQuery && (
                <p className="text-sm mt-2">Try adjusting your search or filters</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
          </div>
        </main>
      </div>
    </div>
  );
}
