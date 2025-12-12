import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface TechnicianInfo {
  id: string;
  name: string;
  employeeCode: string;
  email: string;
}

export default function SetupPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [passwords, setPasswords] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [technicianInfo, setTechnicianInfo] = useState<TechnicianInfo | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
  
  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setError('No token provided');
      setVerifying(false);
    }
  }, [token]);

  useEffect(() => {
    // Calculate password strength
    const password = passwords.password;
    if (password.length === 0) {
      setPasswordStrength('weak');
    } else if (password.length < 8) {
      setPasswordStrength('weak');
    } else if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordStrength('medium');
    } else {
      setPasswordStrength('strong');
    }
  }, [passwords.password]);
  
  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/technician/verify-setup-token/${token}`);
      const data = await response.json();
      
      if (data.success) {
        setTechnicianInfo(data.technician);
      } else {
        setError(data.message || 'Invalid or expired link. Please contact your administrator.');
      }
    } catch (error) {
      setError('Failed to verify link. Please try again.');
    } finally {
      setVerifying(false);
    }
  };
  
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.password !== passwords.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (passwords.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/technician/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: passwords.password
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Password created successfully!');
        
        // Store auth token and technician data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.technician));
        
        // Redirect to document submission
        setTimeout(() => {
          navigate('/technician/submit-documents');
        }, 1000);
      } else {
        setError(data.message || 'Failed to create password');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
    }
  };

  const getStrengthText = () => {
    switch (passwordStrength) {
      case 'weak': return 'Weak';
      case 'medium': return 'Medium';
      case 'strong': return 'Strong';
    }
  };
  
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2">Verifying link...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-10 w-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Create Your Password
          </CardTitle>
          {technicianInfo && (
            <div className="mt-2 text-sm text-gray-600">
              <p>Welcome, <strong>{technicianInfo.name}</strong></p>
              <p className="text-xs mt-1">{technicianInfo.employeeCode}</p>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <label className="text-sm font-medium">New Password *</label>
                <Input
                  type="password"
                  placeholder="Enter password (min 8 characters)"
                  value={passwords.password}
                  onChange={(e) => setPasswords({ ...passwords, password: e.target.value })}
                  required
                  minLength={8}
                  className="mt-1"
                />
                {passwords.password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600">Password strength:</span>
                      <span className={`font-medium ${
                        passwordStrength === 'weak' ? 'text-red-600' :
                        passwordStrength === 'medium' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {getStrengthText()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${getStrengthColor()}`}
                        style={{ 
                          width: passwordStrength === 'weak' ? '33%' : 
                                 passwordStrength === 'medium' ? '66%' : '100%' 
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use 12+ characters with uppercase, numbers for strong password
                    </p>
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium">Confirm Password *</label>
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  required
                  className="mt-1"
                />
                {passwords.confirmPassword && (
                  <div className="flex items-center gap-2 mt-1">
                    {passwords.password === passwords.confirmPassword ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-green-600">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-xs text-red-600">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || passwords.password.length < 8 || passwords.password !== passwords.confirmPassword}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Password & Continue'
                )}
              </Button>

              <div className="text-xs text-center text-gray-500 mt-4">
                <p>By creating your password, you agree to our Terms of Service</p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
