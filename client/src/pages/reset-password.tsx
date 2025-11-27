import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Get token from URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');

  // Validate token on page load
  const { data: tokenData, isLoading: isValidating, error: validationError } = useQuery({
    queryKey: ['validate-reset-token', token],
    queryFn: async () => {
      if (!token) throw new Error('No token provided');

      const res = await fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (!data.valid) {
        throw new Error(data.error || 'Invalid token');
      }

      return data;
    },
    retry: false,
    enabled: !!token,
  });

  // Password strength validation
  const validatePassword = (password: string) => {
    const errors = [];
    if (password.length < 8) errors.push("At least 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("One uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("One lowercase letter");
    if (!/[0-9]/.test(password)) errors.push("One number");
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push("One special character");
    return errors;
  };

  const passwordErrors = password ? validatePassword(password) : [];
  const confirmError = confirmPassword && password !== confirmPassword ? "Passwords do not match" : null;
  const isPasswordValid = password && passwordErrors.length === 0;
  const isConfirmValid = confirmPassword && !confirmError;

  // Reset password mutation
  const resetMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password-with-token", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: data.message || "Password updated successfully. You can now log in.",
      });
      // Redirect to login page
      setTimeout(() => setLocation("/login"), 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: "Error",
        description: "No reset token found",
        variant: "destructive",
      });
      return;
    }

    if (passwordErrors.length > 0) {
      toast({
        title: "Invalid Password",
        description: "Please meet all password requirements",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    resetMutation.mutate({ token, newPassword: password });
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Validating reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - invalid/expired token
  if (validationError || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Invalid Reset Link</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                {validationError?.message || "This password reset link is invalid, expired, or has already been used."}
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>Common reasons:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>The link has expired (links expire after 1 hour)</li>
                <li>The link has already been used</li>
                <li>The link is incomplete or corrupted</li>
              </ul>
            </div>

            <div className="pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Please contact your administrator to request a new password reset link.
              </p>
              <Button
                className="w-full"
                onClick={() => setLocation("/login")}
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state - show password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>
            Welcome, {tokenData.name}! Create a strong password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertDescription className="text-sm">
              <div className="flex items-start gap-2">
                <div className="text-blue-600">ℹ️</div>
                <div>
                  <p className="font-medium mb-1">Your Login ID: {tokenData.email}</p>
                  <p className="text-muted-foreground">Use this email and your new password to log in.</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className={passwordErrors.length > 0 && password ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password requirements */}
              <div className="mt-2 space-y-1">
                {["At least 8 characters", "One uppercase letter", "One lowercase letter", "One number", "One special character"].map((req, index) => {
                  const isMet = password && !validatePassword(password).includes(req);
                  return (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      {isMet ? (
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      ) : (
                        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground" />
                      )}
                      <span className={isMet ? "text-green-600" : "text-muted-foreground"}>
                        {req}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className={confirmError ? "border-destructive" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmError && (
                <p className="text-sm text-destructive mt-1">{confirmError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={resetMutation.isPending || !isPasswordValid || !isConfirmValid}
            >
              {resetMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Setting Password...
                </>
              ) : (
                "Set Password & Continue"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              After setting your password, you'll be redirected to the login page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
