import React, { useState } from 'react';
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, BookOpen, Trash2, Download, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Manual {
  id: string;
  name: string;
  sourceUrl?: string;
  uploadedBy: string;
  uploadedOn: string;
  version?: string;
  meta?: any;
  createdAt: string;
  updatedAt: string;
}

export default function AdminManualUpload() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Manual upload form state
  const [manualForm, setManualForm] = useState({
    name: '',
    version: '',
    sourceUrl: '',
    meta: ''
  });

  // Get existing manuals
  const { data: manuals = [], isLoading: manualsLoading } = useQuery<Manual[]>({
    queryKey: ["/api/manuals"],
    queryFn: async () => (await apiRequest("GET", "/api/manuals")).json(),
  });

  // Upload manual mutation
  const uploadManual = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/manuals/upload", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manuals"] });
      toast({ title: "Manual uploaded successfully", description: "The manual has been processed and added to the system." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message || "Failed to upload manual", variant: "destructive" });
    }
  });

  // Delete manual mutation
  const deleteManual = useMutation({
    mutationFn: async (manualId: string) => {
      return await apiRequest("DELETE", `/api/manuals/${manualId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manuals"] });
      toast({ title: "Manual deleted", description: "The manual has been removed from the system." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error.message || "Failed to delete manual", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setManualForm({ name: '', version: '', sourceUrl: '', meta: '' });
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        toast({ title: "Invalid file type", description: "Please select a PDF or Word document", variant: "destructive" });
        return;
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select a file smaller than 50MB", variant: "destructive" });
        return;
      }

      setSelectedFile(file);
      // Auto-fill name if empty
      if (!manualForm.name) {
        setManualForm(prev => ({ ...prev, name: file.name.replace(/\.[^/.]+$/, "") }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualForm.name.trim()) {
      toast({ title: "Name required", description: "Please enter a name for the manual", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await uploadManual.mutateAsync({
        name: manualForm.name,
        version: manualForm.version,
        sourceUrl: manualForm.sourceUrl || (selectedFile ? `uploaded_${Date.now()}_${selectedFile.name}` : undefined),
        meta: manualForm.meta || {}
      });
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (manualId: string, manualName: string) => {
    if (confirm(`Are you sure you want to delete "${manualName}"? This action cannot be undone.`)) {
      deleteManual.mutate(manualId);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Manual Management" />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Service Manual Management</h1>
                <p className="text-gray-600 mt-1">
                  Upload and manage service manuals for the AI diagnostic assistant
                </p>
              </div>
              <Badge variant="secondary" className="text-sm">
                {manuals.length} manuals
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload New Manual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Manual Name *</Label>
                      <Input
                        id="name"
                        value={manualForm.name}
                        onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Thermo King SL-500 Service Manual"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="version">Version</Label>
                      <Input
                        id="version"
                        value={manualForm.version}
                        onChange={(e) => setManualForm(prev => ({ ...prev, version: e.target.value }))}
                        placeholder="e.g., v2.1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sourceUrl">Source URL (Optional)</Label>
                      <Input
                        id="sourceUrl"
                        type="url"
                        value={manualForm.sourceUrl}
                        onChange={(e) => setManualForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                        placeholder="https://example.com/manual.pdf"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="meta">Additional Metadata (JSON)</Label>
                      <Textarea
                        id="meta"
                        value={manualForm.meta}
                        onChange={(e) => setManualForm(prev => ({ ...prev, meta: e.target.value }))}
                        placeholder='{"brand": "Thermo King", "model": "SL-500", "alarms": ["17", "23"]}'
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="file">Manual File (Optional)</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input
                          id="file"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <label htmlFor="file" className="cursor-pointer">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-sm text-gray-600 mb-2">
                            {selectedFile ? selectedFile.name : "Click to select a PDF or Word document"}
                          </p>
                          <p className="text-xs text-gray-500">
                            File upload will be available in the next phase
                          </p>
                        </label>
                      </div>
                    </div>

                    {isUploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Uploading...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={!selectedFile || !manualForm.name.trim() || isUploading}
                        className="flex-1"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Manual
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        disabled={isUploading}
                      >
                        Clear
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Existing Manuals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Uploaded Manuals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {manualsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : manuals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm">No manuals uploaded yet</p>
                      <p className="text-xs">Upload your first service manual to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {manuals.map((manual) => (
                        <div key={manual.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{manual.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                {manual.version && (
                                  <Badge variant="outline" className="text-xs">
                                    {manual.version}
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500">
                                  Uploaded {new Date(manual.uploadedOn).toLocaleDateString()}
                                </span>
                              </div>
                              {manual.sourceUrl && (
                                <a
                                  href={manual.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  View Source
                                </a>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(manual.id, manual.name)}
                              disabled={deleteManual.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {manual.meta && (
                            <div className="text-xs text-gray-600">
                              <details className="cursor-pointer">
                                <summary className="hover:text-gray-800">Additional Information</summary>
                                <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                                  {JSON.stringify(manual.meta, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Usage Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Manual Upload Guidelines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Supported Formats</h4>
                    <ul className="space-y-1">
                      <li>• PDF documents (.pdf)</li>
                      <li>• Word documents (.doc, .docx)</li>
                      <li>• Maximum file size: 50MB</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Best Practices</h4>
                    <ul className="space-y-1">
                      <li>• Include alarm codes in metadata</li>
                      <li>• Specify brand and model</li>
                      <li>• Use descriptive names</li>
                      <li>• Provide version numbers</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
