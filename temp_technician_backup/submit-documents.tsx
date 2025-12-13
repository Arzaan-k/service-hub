import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

const REQUIRED_DOCUMENTS = [
  { id: 'aadhar', label: 'Aadhar Card', required: true, icon: '🪪' },
  { id: 'health_report', label: 'Health Report', required: true, icon: '🏥' },
  { id: 'cbc_report', label: 'CBC Report', required: true, icon: '🩺' },
  { id: 'insurance_report', label: 'Insurance Report', required: true, icon: '🛡️' }
];

interface UploadedFile {
  filename: string;
  url: string;
  uploadedAt: Date;
}

export default function SubmitDocumentsPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile>>({});
  const [submitting, setSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      setLocation('/login');
    }
  }, [setLocation]);

  const handleFileSelect = async (docId: string, file: File) => {
    if (!file) return;
    
    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docId);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/technician/upload-document', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` 
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUploadedFiles(prev => ({
          ...prev,
          [docId]: {
            filename: file.name,
            url: data.url,
            uploadedAt: new Date()
          }
        }));
        
        const docLabel = REQUIRED_DOCUMENTS.find(d => d.id === docId)?.label;
        toast.success(`${docLabel} uploaded successfully`);
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (error) {
      toast.error('Upload error. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const handleSubmit = async () => {
    const requiredDocs = REQUIRED_DOCUMENTS.filter(d => d.required);
    const missingDocs = requiredDocs.filter(d => !uploadedFiles[d.id]);
    
    if (missingDocs.length > 0) {
      toast.error('Please upload all required documents');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/technician/submit-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ documents: uploadedFiles })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Documents submitted successfully!');
        
        // Update local storage
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        userData.documentsSubmitted = true;
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Navigate to dashboard
        setTimeout(() => {
          setLocation('/technician/dashboard');
        }, 1500);
      } else {
        toast.error(data.message || 'Submission failed');
      }
    } catch (error) {
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Allow skipping but show warning
    if (confirm('You can upload documents later from your profile. Continue to dashboard?')) {
      setLocation('/technician/dashboard');
    }
  };
  
  const requiredCount = REQUIRED_DOCUMENTS.filter(d => d.required).length;
  const uploadedCount = Object.keys(uploadedFiles).filter(key => 
    REQUIRED_DOCUMENTS.find(d => d.id === key)?.required
  ).length;
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Document Submission</h1>
                <p className="text-blue-100 mt-1">
                  Please upload all 4 required documents to complete your profile
                </p>
              </div>
              <div className="text-center bg-white/20 rounded-lg p-4">
                <div className="text-3xl font-bold">{uploadedCount}/{requiredCount}</div>
                <div className="text-sm text-blue-100">Uploaded</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Document Upload Cards */}
      <div className="max-w-4xl mx-auto space-y-4">
        {REQUIRED_DOCUMENTS.map(doc => (
          <DocumentUploadCard
            key={doc.id}
            document={doc}
            uploadedFile={uploadedFiles[doc.id]}
            onFileSelect={(file) => handleFileSelect(doc.id, file)}
            uploading={uploading}
          />
        ))}
      </div>
      
      {/* Submit Button */}
      <div className="max-w-4xl mx-auto mt-6">
        <Card>
          <CardContent className="pt-6">
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>Note:</strong> You can access the dashboard now and upload documents later from your profile.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={uploadedCount < requiredCount || uploading || submitting}
                className="flex-1"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : uploadedCount < requiredCount ? (
                  `Upload ${requiredCount - uploadedCount} more document(s)`
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Submit Documents & Continue
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleSkip}
                variant="outline"
                size="lg"
                disabled={uploading || submitting}
              >
                Skip for Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface DocumentUploadCardProps {
  document: typeof REQUIRED_DOCUMENTS[0];
  uploadedFile?: UploadedFile;
  onFileSelect: (file: File) => void;
  uploading: boolean;
}

function DocumentUploadCard({ document, uploadedFile, onFileSelect, uploading }: DocumentUploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  return (
    <Card className={uploadedFile ? 'border-green-500 border-2 bg-green-50/50' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{document.icon}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{document.label}</h3>
                  {document.required && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                  {uploadedFile && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </div>
                
                {uploadedFile ? (
                  <div className="mt-2 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {uploadedFile.filename}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Uploaded: {new Date(uploadedFile.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-1">
                    Upload JPG, PNG or PDF (max 5MB)
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onFileSelect(file);
                  // Reset input so same file can be selected again
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              variant={uploadedFile ? "outline" : "default"}
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : uploadedFile ? (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Re-upload
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
