import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SignUp() {
  const [, setLocation] = useLocation();

  // Redirect to login immediately - signup is disabled
  useEffect(() => {
    setLocation("/login");
  }, [setLocation]);
    onError: (error: Error) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    }
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/resend-email", { email });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Code resent", description: "Please check your inbox" });
    }
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Please enter a valid phone number";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Full name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      signupMutation.mutate(formData);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length === 6) {
      verifyMutation.mutate({ email: formData.email, code: otp.trim() });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        {/* Sign Up Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
              <i className="fas fa-user-plus text-2xl text-white"></i>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Create Account</h1>
            <p className="text-muted-foreground text-sm">Join ContainerGenie today</p>
          </div>

        {step === "form" && (
        <>
        {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-phone mr-2 text-primary"></i>Phone Number
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 123-4567"
                className={`w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.phoneNumber ? "border-destructive" : "border-border"
                }`}
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                data-testid="input-phone"
              />
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-destructive">{errors.phoneNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-user mr-2 text-primary"></i>Full Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                className={`w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.name ? "border-destructive" : "border-border"
                }`}
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                data-testid="input-name"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-envelope mr-2 text-primary"></i>Email Address
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                className={`w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.email ? "border-destructive" : "border-border"
                }`}
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                data-testid="input-email"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-lock mr-2 text-primary"></i>Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className={`w-full px-4 py-3 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                  errors.password ? "border-destructive" : "border-border"
                }`}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                data-testid="input-password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-briefcase mr-2 text-primary"></i>Role
              </label>
              <select
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                value={formData.role}
                onChange={(e) => handleInputChange("role", e.target.value)}
                data-testid="select-role"
              >
                <option value="client">Client</option>
                <option value="technician">Technician</option>
                <option value="admin">Admin</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose your role in the system
              </p>
            </div>

            <button
              type="submit"
              disabled={signupMutation.isPending}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              data-testid="button-submit"
            >
              {signupMutation.isPending ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fas fa-user-plus mr-2"></i>
              )}
              Create Account
            </button>
          </form>
        </>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerify} className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Verify your email</h2>
              <p className="text-sm text-muted-foreground">We sent a 6-digit code to <strong>{formData.email}</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <i className="fas fa-key mr-2 text-primary"></i>Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground text-center text-xl font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                data-testid="input-otp"
              />
              <div className="mt-2 text-sm">
                <button type="button" className="text-primary hover:underline" onClick={() => resendMutation.mutate(formData.email)}>Resend code</button>
              </div>
            </div>
            <button
              type="submit"
              disabled={verifyMutation.isPending}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              data-testid="button-verify"
            >
              {verifyMutation.isPending ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-check mr-2"></i>}
              Verify Email
            </button>
          </form>
        )}

        {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => setLocation("/login")}
                className="text-primary hover:underline font-medium"
              >
                Sign In
              </button>
            </p>
          </div>

          {/* Terms & Privacy */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-start gap-3">
              <i className="fas fa-info-circle text-primary mt-0.5"></i>
              <div>
                <p className="text-xs text-muted-foreground">
                  By creating an account, you agree to our{" "}
                  <button className="text-primary hover:underline">Terms of Service</button>{" "}
                  and{" "}
                  <button className="text-primary hover:underline">Privacy Policy</button>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

