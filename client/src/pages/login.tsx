import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { saveAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AnimatePresence } from "framer-motion";
import { HeroBackground, FadeIn } from "@/components/ui/login-effects";
import { Loader2, Mail, Lock, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Modal states
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Reset flow states
  const [fpEmail, setFpEmail] = useState("");
  const [rpEmail, setRpEmail] = useState("");
  const [rpCode, setRpCode] = useState("");
  const [rpPassword, setRpPassword] = useState("");

  // Password strength validation
  const validatePassword = (password: string) => {
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Password must contain at least one special character";
    return null;
  };

  // Clear any test auth on login page load
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token === 'test-admin-123') {
      console.log('[LOGIN] Clearing test auth token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('current_user');
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      const result = await res.json();

      if (result.requiresPasswordReset) {
        throw new Error("PASSWORD_RESET_REQUIRED:" + JSON.stringify(result));
      }

      return result;
    },
    onSuccess: (data) => {
      saveAuth(data.token, data.user);
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });

      const userRole = (data.user?.role || "client").toLowerCase();
      if (userRole === "technician" || userRole === "senior_technician") {
        setLocation("/");
      } else if (userRole === "admin" || userRole === "super_admin" || userRole === "coordinator") {
        setLocation("/");
      } else if (userRole === "amc") {
        setLocation("/containers");
      } else {
        setLocation("/client-dashboard");
      }
    },
    onError: (error: Error) => {
      try {
        const errorParts = error.message.split(': ');
        if (errorParts.length >= 2) {
          const statusCode = errorParts[0];
          const jsonStr = errorParts.slice(1).join(': ');
          if (statusCode === '403') {
            const errorData = JSON.parse(jsonStr);
            if (errorData.requiresPasswordReset) {
              saveAuth(errorData.user.id, errorData.user);
              toast({
                title: "Security Update Required",
                description: "Please set a new password to continue.",
              });
              setLocation("/force-password-reset");
              return;
            }
          }
        }
      } catch (parseError) { }

      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      loginMutation.mutate({ email, password });
    }
  };

  const forgotMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send OTP');
      return result;
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        toast({ title: "OTP Sent", description: "Please check your email for the verification code." });
      } else {
        toast({
          title: "Development Mode",
          description: `Reset code: ${data.resetCode}`,
          variant: "default"
        });
      }
      setForgotOpen(false);
      setResetOpen(true);
      setRpEmail(fpEmail);
      setRpCode("");
      setRpPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Request Failed", description: error.message || "Could not send OTP", variant: "destructive" });
    }
  });

  const resetMutation = useMutation({
    mutationFn: async (data: { email: string; code: string; newPassword: string }) => {
      const passwordError = validatePassword(data.newPassword);
      if (passwordError) throw new Error(passwordError);
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Password Reset", description: "Your password has been updated successfully." });
      setResetOpen(false);
      setRpEmail("");
      setRpCode("");
      setRpPassword("");
    },
    onError: () => toast({ title: "Reset Failed", description: "Could not reset password. Please try again.", variant: "destructive" })
  });

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left Side - Hero/Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 text-white p-12 flex-col justify-between overflow-hidden">
        <HeroBackground />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <i className="fas fa-ship text-xl text-white"></i>
            </div>
            <span className="text-xl font-bold tracking-tight">Service Hub</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold tracking-tight mb-6 leading-tight">
            Enterprise Container Management System
          </h1>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">
            Streamline your logistics operations with our advanced service management platform.
            Track containers, manage service requests, and coordinate technicians in real-time.
          </p>

          <div className="flex gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Secure Access</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fas fa-bolt text-primary"></i>
              <span>Real-time Updates</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fas fa-headset text-primary"></i>
              <span>24/7 Support</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          © 2024 Service Hub Inc. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-6 shadow-lg shadow-primary/20">
              <i className="fas fa-ship text-xl text-white"></i>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Please enter your credentials to access your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FadeIn delay={0.1}>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-9 h-11 bg-background"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9 h-11 bg-background"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                >
                  Remember me for 30 days
                </label>
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <Button
                type="submit"
                className="w-full h-11 text-base font-medium shadow-lg shadow-primary/10"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </FadeIn>
          </form>

          <FadeIn delay={0.5}>
            <div className="bg-muted/30 border border-border rounded-lg p-4 flex gap-3 items-start">
              <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground block mb-0.5">Secure Authentication</span>
                All access is monitored and logged. Unauthorized access attempts will be reported to system administrators.
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {forgotOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-semibold mb-2">Reset Password</h3>
              <p className="text-sm text-muted-foreground mb-6">Enter your email address and we'll send you a verification code.</p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    placeholder="name@company.com"
                    value={fpEmail}
                    onChange={(e) => setFpEmail(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <Button variant="outline" onClick={() => { setForgotOpen(false); setFpEmail(""); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => forgotMutation.mutate({ email: fpEmail })}
                    disabled={forgotMutation.isPending}
                  >
                    {forgotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Code'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {resetOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-semibold mb-6">Set New Password</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={rpEmail} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    placeholder="123456"
                    value={rpCode}
                    onChange={(e) => setRpCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    placeholder="••••••••"
                    type="password"
                    value={rpPassword}
                    onChange={(e) => setRpPassword(e.target.value)}
                  />
                  {rpPassword && (
                    <div className="text-xs mt-1">
                      {validatePassword(rpPassword) ? (
                        <span className="text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {validatePassword(rpPassword)}
                        </span>
                      ) : (
                        <span className="text-green-600 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Password strength: Strong
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button variant="outline" onClick={() => { setResetOpen(false); setRpEmail(""); setRpCode(""); setRpPassword(""); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => resetMutation.mutate({ email: rpEmail, code: rpCode, newPassword: rpPassword })}
                    disabled={resetMutation.isPending}
                  >
                    {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset Password'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
