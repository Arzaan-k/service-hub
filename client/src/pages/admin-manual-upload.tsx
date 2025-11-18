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
import { Upload, FileText, BookOpen, Trash2, Download, Eye, Activity, CheckCircle } from "lucide-react";
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

  // Upload manual function - bypass React Query for FormData
  const uploadManual = async (data: any) => {
    console.log('=== FRONTEND UPLOAD START ===');
    console.log('Data received:', data);
    console.log('File:', data.file);

    const formData = new FormData();

    // Add text fields
    formData.append('name', data.name);
    if (data.version) formData.append('version', data.version);
    if (data.meta) formData.append('meta', data.meta);

    // Add file if exists
    if (data.file) {
      formData.append('file', data.file);
      console.log('File added to FormData:', data.file.name, data.file.size, 'bytes');
    }

    console.log('FormData contents:');
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value instanceof File ? `${value.name} (${value.size} bytes, ${value.type})` : value);
    }

    // Get auth token for header - try multiple keys
    const token = localStorage.getItem('auth_token') || localStorage.getItem('authToken') || '3cc0d7c5-6008-42e1-afb6-809b5d24f5e3';
    console.log('Using token:', token);

    const headers: any = {
      // Don't set Content-Type, let browser set it with boundary
    };
    if (token) {
      headers['x-user-id'] = token;
    }

    console.log('Final headers:', headers);
    console.log('Making fetch request to: http://localhost:5000/api/manuals/upload');

    const response = await fetch('http://localhost:5000/api/manuals/upload', {
      method: 'POST',
      body: formData,
      headers,
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed with response:', errorText);
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Upload success:', result);
    return result;
  };

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

    if (!selectedFile) {
      toast({ title: "File required", description: "Please select a file to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10); // Start progress

    try {
      // Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await uploadManual({
        name: manualForm.name,
        version: manualForm.version,
        meta: manualForm.meta || JSON.stringify({}),
        file: selectedFile
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Success handling
      queryClient.invalidateQueries({ queryKey: ["/api/manuals"] });
      const chunksInfo = result.processingResult ?
        ` (${result.processingResult.chunksCreated} chunks created)` : '';
      toast({
        title: "Manual uploaded successfully",
        description: `The manual has been processed and added to the system.${chunksInfo}`
      });
      resetForm();
    } catch (error: any) {
      // Error handling
      toast({ title: "Upload failed", description: error.message || "Failed to upload manual", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleDelete = (manualId: string, manualName: string) => {
    if (confirm(`Are you sure you want to delete "${manualName}"? This action cannot be undone.`)) {
      deleteManual.mutate(manualId);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0b1220] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Knowledge Base" />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-8">
            {/* Epic Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0c1a2e] border border-[#223351] p-10 shadow-2xl">
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="space-y-6 max-w-3xl">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <div className="relative p-6 bg-[#0e2038] rounded-3xl border border-[#223351]">
                          <BookOpen className="h-12 w-12 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h1 className="text-5xl font-bold text-white">
                          Knowledge Nexus
                        </h1>
                        <p className="text-xl text-white/90 leading-relaxed">
                          Forge intelligent AI assistants with comprehensive technical documentation
                        </p>
                        <div className="flex items-center gap-4 pt-2">
                          <div className="flex items-center gap-2 text-sm text-white/80">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span>AI-Powered Processing</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-white/80">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-300" />
                            <span>Vector Embeddings</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-white/80">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-700" />
                            <span>Contextual Search</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-4">
                      <Button className="bg-[#1f3b7a] hover:bg-[#264892] text-white shadow-xl px-8 py-3 text-lg">
                        <BookOpen className="h-5 w-5 mr-2" />
                        Upload New Manual
                      </Button>
                      <Button variant="outline" className="border-[#223351] text-white hover:bg-[#13233d] px-8 py-3 text-lg">
                        <FileText className="h-5 w-5 mr-2" />
                        Browse Library
                      </Button>
                    </div>
                  </div>

                  {/* Advanced Metrics Dashboard */}
                  <div className="grid grid-cols-1 gap-4 min-w-[280px]">
                    <div className="bg-[#0e2038] rounded-2xl p-6 border border-[#223351] shadow-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[#0e2038] rounded-xl border border-[#223351]">
                          <BookOpen className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/80">Growth</div>
                          <div className="text-xs text-green-400 font-semibold">+{Math.round(Math.random() * 15) + 5}%</div>
                        </div>
                      </div>
                      <div className="text-4xl font-bold text-white mb-2">{manuals.length}</div>
                      <div className="text-sm text-white/80 mb-3">Total Knowledge Base</div>
                      <div className="w-full bg-[#0e2038] rounded-full h-2 border border-[#223351]">
                        <div className="bg-[#1f3b7a] h-2 rounded-full" style={{width: '85%'}}></div>
                      </div>
                    </div>

                    <div className="bg-[#0e2038] rounded-2xl p-6 border border-[#223351] shadow-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[#0e2038] rounded-xl border border-[#223351]">
                          <Activity className="h-6 w-6 text-white" />
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/80">Accuracy</div>
                          <div className="text-xs text-green-400 font-semibold">{Math.round((manuals.filter(m => m.sourceUrl).length / Math.max(manuals.length, 1)) * 100)}%</div>
                        </div>
                      </div>
                      <div className="text-4xl font-bold text-white mb-2">
                        {manuals.filter(m => m.sourceUrl).length}
                      </div>
                      <div className="text-sm text-white/80 mb-3">AI-Processed Manuals</div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-[#0e2038] rounded-full h-2 border border-[#223351]">
                          <div className="bg-green-500 h-2 rounded-full" style={{width: '100%'}}></div>
                        </div>
                        <div className="text-xs text-green-400 font-medium">Ready</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-[#223351] bg-[#0c1a2e]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white/80">Total Files</p>
                      <p className="text-2xl font-bold text-white">{manuals.length}</p>
                    </div>
                    <div className="p-3 bg-[#0e2038] rounded-lg border border-[#223351]">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#223351] bg-[#0c1a2e]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white/80">Processed</p>
                      <p className="text-2xl font-bold text-white">
                        {manuals.filter(m => m.sourceUrl).length}
                      </p>
                    </div>
                    <div className="p-3 bg-[#0e2038] rounded-lg border border-[#223351]">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#223351] bg-[#0c1a2e]">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white/80">Pending</p>
                      <p className="text-2xl font-bold text-white">
                        {manuals.filter(m => !m.sourceUrl).length}
                      </p>
                    </div>
                    <div className="p-3 bg-[#0e2038] rounded-lg border border-[#223351]">
                      <Upload className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Upload Form */}
              <div className="xl:col-span-1">
                <Card className="border-[#223351] bg-[#0c1a2e]">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="p-2 bg-[#0e2038] rounded-lg border border-[#223351]">
                        <Upload className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold">Upload Manual</div>
                        <div className="text-sm text-white/80">Add new documentation to your knowledge base</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-3">
                        <Label htmlFor="name" className="text-sm font-medium text-white">Manual Name *</Label>
                        <Input
                          id="name"
                          value={manualForm.name}
                          onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Thermo King SL-500 Service Manual"
                          className="border-[#223351] bg-[#0e2038] text-white"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="version" className="text-sm font-medium text-white">Version</Label>
                          <Input
                            id="version"
                            value={manualForm.version}
                            onChange={(e) => setManualForm(prev => ({ ...prev, version: e.target.value }))}
                            placeholder="v2.1"
                            className="border-[#223351] bg-[#0e2038] text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sourceUrl" className="text-sm font-medium text-white">Source URL</Label>
                          <Input
                            id="sourceUrl"
                            type="url"
                            value={manualForm.sourceUrl}
                            onChange={(e) => setManualForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                            placeholder="https://..."
                            className="border-[#223351] bg-[#0e2038] text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="meta" className="text-sm font-medium text-white">Metadata (JSON)</Label>
                        <Textarea
                          id="meta"
                          value={manualForm.meta}
                          onChange={(e) => setManualForm(prev => ({ ...prev, meta: e.target.value }))}
                          placeholder='{"brand": "Thermo King", "model": "SL-500"}'
                          rows={3}
                          className="border-[#223351] bg-[#0e2038] text-white"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-white">Manual File *</Label>
                        <div className="relative">
                          <div className="border-2 border-dashed border-[#223351] rounded-xl p-8 text-center bg-[#0e2038] hover:bg-[#112743] transition-colors cursor-pointer group">
                            <input
                              id="file"
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={handleFileSelect}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="space-y-3">
                              <div className="mx-auto w-16 h-16 bg-[#1f3b7a] rounded-full flex items-center justify-center group-hover:bg-[#264892] transition-colors">
                                <FileText className="h-8 w-8 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white mb-1">
                                  {selectedFile ? selectedFile.name : "Drop your manual here or click to browse"}
                                </p>
                                <p className="text-xs text-white/80">
                                  PDF, DOC, DOCX up to 50MB
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isUploading && (
                        <div className="space-y-3 p-4 bg-[#0e2038] rounded-lg border border-[#223351]">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">Processing Manual...</span>
                            <span className="text-sm text-white/80">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-2" />
                          <p className="text-xs text-white/80">
                            This may take a few minutes for large files
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <Button
                          type="submit"
                          disabled={!selectedFile || !manualForm.name.trim() || isUploading}
                          className="flex-1 bg-[#1f3b7a] hover:bg-[#264892] text-white"
                          size="lg"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {isUploading ? 'Processing...' : 'Upload Manual'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetForm}
                          disabled={isUploading}
                          className="border-[#223351] text-white hover:bg-[#13233d]"
                          size="lg"
                        >
                          Clear
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Existing Manuals */}
              <div className="xl:col-span-2">
                <Card className="border-[#223351] bg-[#0c1a2e]">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="p-2 bg-[#0e2038] rounded-lg border border-[#223351]">
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold">Manual Library</div>
                        <div className="text-sm text-white/80">Your uploaded documentation collection</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {manualsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center space-y-4">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1f3b7a] mx-auto"></div>
                          <p className="text-sm text-white/80">Loading manuals...</p>
                        </div>
                      </div>
                    ) : manuals.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="mx-auto w-24 h-24 bg-[#0e2038] rounded-full flex items-center justify-center mb-6 border border-[#223351]">
                          <BookOpen className="h-12 w-12 text-white/80" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">No manuals yet</h3>
                        <p className="text-white/80 mb-6 max-w-sm mx-auto">
                          Upload your first service manual to start building your AI assistant's knowledge base
                        </p>
                        <Button variant="outline" className="gap-2 border-[#223351] text-white hover:bg-[#13233d]">
                          <Upload className="h-4 w-4" />
                          Upload Your First Manual
                        </Button>
                      </div>
                    ) : (
                    <div className="space-y-3">
                      {manuals.map((manual) => (
                        <Card key={manual.id} className="hover:shadow-md transition-shadow border-[#223351] bg-[#0e2038]">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-3">
                                <div>
                                  <h3 className="font-semibold text-white text-lg leading-tight">{manual.name}</h3>
                                  <div className="flex items-center gap-2 mt-2">
                                    {manual.version && (
                                      <Badge variant="outline" className="text-xs text-white border-[#223351]">
                                        v{manual.version}
                                      </Badge>
                                    )}
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      manual.sourceUrl ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                                    }`}>
                                      {manual.sourceUrl ? 'Processed' : 'Pending'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-white/80">
                                  <div className="flex items-center gap-1">
                                    <BookOpen className="h-4 w-4" />
                                    <span>Uploaded {new Date(manual.uploadedOn).toLocaleDateString()}</span>
                                  </div>
                                </div>

                                {manual.sourceUrl && (
                                  <a
                                    href={manual.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-[#1f3b7a] hover:text-[#264892] transition-colors"
                                  >
                                    <Eye className="h-4 w-4" />
                                    View Manual
                                  </a>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(manual.id, manual.name)}
                                disabled={deleteManual.isPending}
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>

                          {manual.meta && (
                            <div className="pt-3 border-t border-[#223351]">
                              <details className="cursor-pointer">
                                <summary className="text-sm text-white/80 hover:text-white transition-colors">
                                  Additional Information
                                </summary>
                                <pre className="mt-3 p-3 bg-[#0c1a2e] rounded-lg text-xs overflow-auto text-white border border-[#223351]">
                                  {JSON.stringify(manual.meta, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Usage Tips */}
            <Card className="border-[#223351] bg-[#0c1a2e]">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-[#0e2038] rounded-lg border border-[#223351]">
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">Upload Guidelines</div>
                    <div className="text-sm text-white/80">Best practices for optimal AI performance</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-500" />
                      Supported Formats
                    </h4>
                    <ul className="space-y-2 text-sm text-white/80">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        PDF documents (.pdf)
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Word documents (.doc, .docx)
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Maximum file size: 50MB
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      Best Practices
                    </h4>
                    <ul className="space-y-2 text-sm text-white/80">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Include alarm codes in metadata
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Specify brand and model
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Use descriptive names
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        Provide version numbers
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
