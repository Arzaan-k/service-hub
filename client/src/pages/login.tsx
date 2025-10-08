import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { saveAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; verificationCode: string }) => {
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
    if (phoneNumber && verificationCode.length === 6) {
      loginMutation.mutate({ phoneNumber, verificationCode });
    }
  };

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

          {/* Phone Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-phone mr-2 text-primary"></i>Phone Number
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                data-testid="input-phone"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                <i className="fas fa-info-circle mr-1"></i>
                Enter registered phone number for WhatsApp verification
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-key mr-2 text-primary"></i>Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground text-center text-xl font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                data-testid="input-verification-code"
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
    </div>
  );
}
