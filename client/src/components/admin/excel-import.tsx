import React, { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Download
} from 'lucide-react';

interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
  containersCreated: number;
}

interface PreviewData {
  columns: string[];
  preview: Record<string, any>[];
  totalRows: number;
}

export default function ExcelImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [options, setOptions] = useState({
    createMissingContainers: true,
    updateExisting: true,
    defaultPriority: 'normal',
    defaultStatus: 'completed',
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/import/service-history/preview', {
        method: 'POST',
        headers: { 'x-user-id': token || '' },
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to preview file');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setImportResult(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Preview Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('createMissingContainers', String(options.createMissingContainers));
      formData.append('updateExisting', String(options.updateExisting));
      formData.append('defaultPriority', options.defaultPriority);
      formData.append('defaultStatus', options.defaultStatus);
      
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/import/service-history', {
        method: 'POST',
        headers: { 'x-user-id': token || '' },
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to import file');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      toast({
        title: 'Import Complete',
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData(null);
      setImportResult(null);
      previewMutation.mutate(file);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  const resetImport = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Service History from Excel
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx, .xls) containing service history data. 
            The file should have columns like: Container Code, Service Date, Service Type, Issue Description, etc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".xlsx,.xls"
            className="hidden"
          />
          
          <div className="flex items-center gap-4">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="gap-2"
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {selectedFile ? 'Change File' : 'Select Excel File'}
            </Button>
            
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>{selectedFile.name}</span>
                <span className="text-muted-foreground">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>

          {/* Import Options */}
          {previewData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="createContainers"
                  checked={options.createMissingContainers}
                  onCheckedChange={(checked) => 
                    setOptions(o => ({ ...o, createMissingContainers: !!checked }))
                  }
                />
                <Label htmlFor="createContainers" className="text-sm">
                  Create missing containers
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="updateExisting"
                  checked={options.updateExisting}
                  onCheckedChange={(checked) => 
                    setOptions(o => ({ ...o, updateExisting: !!checked }))
                  }
                />
                <Label htmlFor="updateExisting" className="text-sm">
                  Update existing records
                </Label>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Default Priority</Label>
                <Select
                  value={options.defaultPriority}
                  onValueChange={(v) => setOptions(o => ({ ...o, defaultPriority: v }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Default Status</Label>
                <Select
                  value={options.defaultStatus}
                  onValueChange={(v) => setOptions(o => ({ ...o, defaultStatus: v }))}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previewData && !importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Preview ({previewData.totalRows} rows)</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetImport}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  className="gap-2"
                >
                  {importMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {importMutation.isPending ? 'Importing...' : 'Import All'}
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Showing first {previewData.preview.length} of {previewData.totalRows} rows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewData.columns.slice(0, 6).map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                        {col}
                      </TableHead>
                    ))}
                    {previewData.columns.length > 6 && (
                      <TableHead>+{previewData.columns.length - 6} more</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.preview.map((row, i) => (
                    <TableRow key={i}>
                      {previewData.columns.slice(0, 6).map((col) => (
                        <TableCell key={col} className="max-w-[200px] truncate">
                          {String(row[col] || '')}
                        </TableCell>
                      ))}
                      {previewData.columns.length > 6 && (
                        <TableCell className="text-muted-foreground">...</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{importResult.totalRows}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                <div className="text-sm text-muted-foreground">Imported</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{importResult.containersCreated}</div>
                <div className="text-sm text-muted-foreground">Containers Created</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Errors ({importResult.errors.length})
                </h4>
                <div className="max-h-48 overflow-y-auto bg-red-50 rounded-lg p-3">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-sm text-red-700">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetImport} variant="outline" className="mt-4">
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
