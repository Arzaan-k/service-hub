import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminTrainingUpload } from '@/components/training/admin-training-upload';
import { AdminTrainingList } from '@/components/training/admin-training-list';
import { BookOpen } from 'lucide-react';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';

export default function AdminTraining() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Training Management</h1>
          <p className="text-gray-600">Upload and manage training materials for clients and technicians</p>
        </div>
      </div>
      
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upload">Upload Material</TabsTrigger>
          <TabsTrigger value="list">View All Materials</TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="mt-6">
          <AdminTrainingUpload onUploadSuccess={handleUploadSuccess} />
        </TabsContent>
        
        <TabsContent value="list" className="mt-6">
          <AdminTrainingList refreshTrigger={refreshTrigger} />
        </TabsContent>
      </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
