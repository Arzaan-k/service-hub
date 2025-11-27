import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { saveAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ForcePasswordReset() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userData, setUserData] = useState<{ id: string; email: string; name: string } | null>(null);

  // Password strength validation
  const validatePassword = (password: string) => {
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Password must contain at least one special character";
    return null;
  };

  const validateConfirmPassword = (password: string, confirm: string) => {
    if (password !== confirm) return "Passwords do not match";
    return null;
  };

  // Check if user is already logged in and redirected here
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const currentUser = localStorage.getItem('current_user');

    if (token && currentUser) {
      try {
        const user = JSON.parse(currentUser);
        if (user.requiresPasswordReset) {
          setUserData({ id: user.id, email: user.email, name: user.name });
        } else {
          // User doesn't need password reset, redirect to dashboard
          setLocation("/");
        }
      } catch (error) {
        // Invalid stored data, redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        setLocation("/login");
      }
    } else {
      // No auth data, redirect to login
      setLocation("/login");
    }
  }, [setLocation]);

  const resetMutation = useMutation({
    mutationFn: async (data: { newPassword: string }) => {
      if (!userData) throw new Error("No user data available");

      // Validate password strength
      const passwordError = validatePassword(data.newPassword);
      if (passwordError) throw new Error(passwordError);

      const confirmError = validateConfirmPassword(data.newPassword, confirmPassword);
      if (confirmError) throw new Error(confirmError);

      const res = await apiRequest("POST", "/api/auth/force-password-reset", {
        userId: userData.id,
        newPassword: data.newPassword
      });
      return await res.json();
    },
    onSuccess: (data) => {
      // Clear the requiresPasswordReset flag in local storage
      const currentUser = localStorage.getItem('current_user');
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser);
          user.requiresPasswordReset = false;
          localStorage.setItem('current_user', JSON.stringify(user));
        } catch (error) {
          // Ignore parse error
        }
      }

      saveAuth(data.token, data.user);
      toast({
        title: "Success",
        description: "Password updated successfully. Welcome to your account!",
      });
      setLocation("/");
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
    if (password && confirmPassword) {
      resetMutation.mutate({ newPassword: password });
    }
  };

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-center mt-4 text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const passwordError = password ? validatePassword(password) : null;
  const confirmError = confirmPassword ? validateConfirmPassword(password, confirmPassword) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Welcome, {userData.name}!</CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            Please set a new password to continue
          </p>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>
              For security, please create a strong password that you haven't used before.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                className={passwordError ? "border-destructive" : ""}
              />
              {passwordError && (
                <p className="text-sm text-destructive mt-1">{passwordError}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className={confirmError ? "border-destructive" : ""}
              />
              {confirmError && (
                <p className="text-sm text-destructive mt-1">{confirmError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={resetMutation.isPending || !password || !confirmPassword || !!passwordError || !!confirmError}
            >
              {resetMutation.isPending ? "Setting Password..." : "Set Password & Continue"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Password must be at least 8 characters with uppercase, lowercase, number, and special character.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


