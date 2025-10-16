import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { saveAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [rpEmail, setRpEmail] = useState("");
  const [rpCode, setRpCode] = useState("");
  const [rpPassword, setRpPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return await res.json();
    },
    onSuccess: (data) => {
      saveAuth(data.token, data.user);
      toast({
        title: "Success",
        description: "Logged in successfully",
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
    if (email && password) {
      loginMutation.mutate({ email, password });
    }
  };

  const forgotMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "OTP sent", description: "Check your email for the verification code" });
      setForgotOpen(false);
      setResetOpen(true);
      setRpEmail(fpEmail);
      setRpCode(""); // Clear OTP field
      setRpPassword(""); // Clear password field
    },
    onError: () => toast({ title: "Failed", description: "Could not send OTP", variant: "destructive" })
  });

  const resetMutation = useMutation({
    mutationFn: async (data: { email: string; code: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Password reset", description: "You can login with your new password" });
      setResetOpen(false);
      setRpEmail("");
      setRpCode("");
      setRpPassword("");
    },
    onError: () => toast({ title: "Failed", description: "Could not reset password", variant: "destructive" })
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
              <i className="fas fa-ship text-2xl text-white"></i>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Container Service Management</h1>
            <p className="text-muted-foreground text-sm">Secure phone-based authentication</p>
          </div>

            {/* Email + Password Login */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-envelope mr-2 text-primary"></i>Email
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-lock mr-2 text-primary"></i>Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              data-testid="button-submit"
            >
              {loginMutation.isPending ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fas fa-sign-in-alt mr-2"></i>
              )}
              Sign In
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                onClick={() => setLocation("/signup")}
                className="text-primary hover:underline font-medium"
              >
                Create Account
              </button>
              <span className="mx-2">•</span>
              <button onClick={()=>setForgotOpen(true)} className="text-primary hover:underline font-medium">Forgot password?</button>
            </p>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <i className="fas fa-shield-alt text-success mt-0.5"></i>
              <div>
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Secure Authentication:</strong> All users are verified via phone
                  number. WhatsApp messages validated against database before processing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {forgotOpen && (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center p-6 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold mb-6 text-gray-900 text-center">Forgot Password</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <Input placeholder="john@example.com" value={fpEmail} onChange={(e)=>setFpEmail(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700" onClick={()=>{setForgotOpen(false); setFpEmail("");}}>Cancel</button>
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium" onClick={()=>forgotMutation.mutate({ email: fpEmail })} disabled={forgotMutation.isPending}>{forgotMutation.isPending ? 'Sending...' : 'Send OTP'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {resetOpen && (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center p-6 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold mb-6 text-gray-900 text-center">Reset Password</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <Input placeholder="john@example.com" value={rpEmail} onChange={(e)=>setRpEmail(e.target.value)} disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">OTP Code</label>
                <Input placeholder="123456" value={rpCode} onChange={(e)=>setRpCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">New Password</label>
                <Input placeholder="••••••••" type="password" value={rpPassword} onChange={(e)=>setRpPassword(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700" onClick={()=>{setResetOpen(false); setRpEmail(""); setRpCode(""); setRpPassword("");}}>Cancel</button>
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium" onClick={()=>resetMutation.mutate({ email: rpEmail, code: rpCode, newPassword: rpPassword })} disabled={resetMutation.isPending}>{resetMutation.isPending ? 'Resetting...' : 'Reset Password'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
