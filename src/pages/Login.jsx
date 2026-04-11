import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasSupabaseEnvConfig } from "../lib/supabase";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const nextFromQuery = new URLSearchParams(location.search).get("next");
  const getAuthNextPath = () => {
    try {
      return sessionStorage.getItem("auth_next_path");
    } catch {
      return null;
    }
  };
  const clearAuthNextPath = () => {
    try {
      sessionStorage.removeItem("auth_next_path");
    } catch {
      return;
    }
  };
  const nextFromSession = getAuthNextPath();
  const redirectPath =
    location.state?.from?.pathname ||
    (nextFromSession?.startsWith("/") ? nextFromSession : null) ||
    (nextFromQuery?.startsWith("/") ? nextFromQuery : "/homepage");
  const {
    signIn,
    signUp,
    signInWithGoogle,
    resendSignupVerification,
    resetPassword,
    loading,
    error,
    clearError,
    isAuthenticated,
  } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      clearAuthNextPath();
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  // Clear errors when switching modes
  useEffect(() => {
    setFormError("");
    setSuccessMessage("");
    setPassword("");
    setConfirmPassword("");
    clearError();
  }, [isLogin, isForgotPassword, clearError]);

  // Show auth context errors
  useEffect(() => {
    if (error) {
      setFormError(error);
    }
  }, [error]);

  const validateForm = () => {
    if (!email.trim()) {
      setFormError("Email is required");
      return false;
    }
    if (!email.includes("@")) {
      setFormError("Please enter a valid email");
      return false;
    }
    if (!isForgotPassword) {
      if (!password) {
        setFormError("Password is required");
        return false;
      }
      if (!isLogin && password.length < 6) {
        setFormError("Password must be at least 6 characters");
        return false;
      }
      if (!isLogin && password !== confirmPassword) {
        setFormError("Passwords do not match");
        return false;
      }
      if (!isLogin && !fullName.trim()) {
        setFormError("Full name is required");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setFormError("");
    setSuccessMessage("");

    if (!validateForm()) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (isForgotPassword) {
      const result = await resetPassword(normalizedEmail);
      if (result.success) {
        setSuccessMessage("Password reset email sent! Check your inbox.");
        setTimeout(() => {
          setIsForgotPassword(false);
          setSuccessMessage("");
        }, 3000);
      }
      return;
    }

    if (isLogin) {
      const result = await signIn(normalizedEmail, password);
      if (result.success) {
        navigate(redirectPath, { replace: true });
      }
    } else {
      const result = await signUp(normalizedEmail, password, {
        full_name: fullName.trim(),
      });
      if (result.success) {
        setSuccessMessage(
          "Account created successfully! Please check your email to verify your account.",
        );
        setTimeout(() => {
          setIsLogin(true);
          setSuccessMessage("");
        }, 3000);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    const result = await signInWithGoogle(redirectPath);
    if (!result.success) {
      setFormError(result.error || "Google sign in failed. Please try again.");
    }
  };

  const handleResendVerification = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setFormError("Enter your signup email first to resend verification.");
      return;
    }

    const result = await resendSignupVerification(normalizedEmail);
    if (result.success) {
      setSuccessMessage(
        "Verification email sent. Please check your inbox and spam folder.",
      );
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 18px",
    marginBottom: "15px",
    borderRadius: "12px",
    border: "1.5px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  };

  const inputFocusStyle = {
    ...inputStyle,
    background: "rgba(255,255,255,0.12)",
    border: "1.5px solid rgba(203, 51, 145, 0.6)",
    boxShadow:
      "0 4px 25px rgba(203, 51, 145, 0.3), inset 0 0 10px rgba(203, 51, 145, 0.1)",
  };

  const getTitle = () => {
    if (isForgotPassword) return "Reset Password";
    return isLogin ? "Sign in to TuneWave" : "Create Account";
  };

  const getSubtitle = () => {
    if (isForgotPassword) return "Enter your email to reset your password";
    return isLogin
      ? "Enter your credentials to continue"
      : "Sign up to start your musical journey";
  };

  return (
    <div className="tw-login-bg-aurora min-h-screen flex items-center justify-center p-4">
      <div
        className="landing-container"
        style={{
          minHeight: "auto",
          maxWidth: "450px",
          background:
            "linear-gradient(135deg, rgba(30, 10, 50, 0.8) 0%, rgba(50, 15, 80, 0.7) 100%)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(203, 51, 145, 0.25)",
          boxShadow:
            "0 20px 70px rgba(203, 51, 145, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
          borderRadius: "24px",
        }}
      >
        <div style={{ padding: "45px 35px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "35px" }}>
            <h1
              style={{
                fontSize: "2.5rem",
                fontWeight: "800",
                color: "#fff",
                marginBottom: "12px",
                background: "linear-gradient(135deg, #cb3391 0%, #6366f1 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {getTitle()}
            </h1>
            <p
              style={{ color: "#b0a8c0", fontSize: "14px", fontWeight: "500" }}
            >
              {getSubtitle()}
            </p>
          </div>

          {/* Error Message */}
          {formError && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)",
                border: "1.5px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "12px",
                padding: "13px 16px",
                marginBottom: "20px",
                color: "#fca5a5",
                fontSize: "14px",
                fontWeight: "500",
                backdropFilter: "blur(10px)",
              }}
            >
              <span style={{ marginRight: "8px" }}>⚠️</span>
              {formError}
            </div>
          )}

          {formError.toLowerCase().includes("verify your email") && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 16px",
                marginBottom: "18px",
                borderRadius: "12px",
                border: "1.5px solid rgba(59, 130, 246, 0.4)",
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)",
                color: "#93c5fd",
                fontSize: "14px",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
                transition: "all 0.3s ease",
              }}
            >
              📧 Resend verification email
            </button>
          )}

          {/* Supabase Config Warning */}
          {!hasSupabaseEnvConfig && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)",
                border: "1.5px solid rgba(251, 191, 36, 0.4)",
                borderRadius: "12px",
                padding: "13px 16px",
                marginBottom: "20px",
                color: "#fde68a",
                fontSize: "14px",
                fontWeight: "500",
                backdropFilter: "blur(10px)",
              }}
            >
              ⚡ Supabase auth config is missing in environment variables. Add
              VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for reliable login.
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div
              style={{
                background:
                  "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)",
                border: "1.5px solid rgba(34, 197, 94, 0.4)",
                borderRadius: "12px",
                padding: "13px 16px",
                marginBottom: "20px",
                color: "#86efac",
                fontSize: "14px",
                fontWeight: "500",
                backdropFilter: "blur(10px)",
              }}
            >
              <span style={{ marginRight: "8px" }}>✓</span>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Full Name - Only for Sign Up */}
            {!isLogin && !isForgotPassword && (
              <input
                type="text"
                placeholder="Full Name"
                style={inputStyle}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={(e) =>
                  (e.target.style.cssText = Object.entries(inputFocusStyle)
                    .map(
                      ([k, v]) =>
                        `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                    )
                    .join(";"))
                }
                onBlur={(e) =>
                  (e.target.style.cssText = Object.entries(inputStyle)
                    .map(
                      ([k, v]) =>
                        `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                    )
                    .join(";"))
                }
                disabled={loading}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              style={inputStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={(e) =>
                (e.target.style.cssText = Object.entries(inputFocusStyle)
                  .map(
                    ([k, v]) =>
                      `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                  )
                  .join(";"))
              }
              onBlur={(e) =>
                (e.target.style.cssText = Object.entries(inputStyle)
                  .map(
                    ([k, v]) =>
                      `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                  )
                  .join(";"))
              }
              autoComplete="email"
              disabled={loading}
            />

            {/* Password - Not for Forgot Password */}
            {!isForgotPassword && (
              <input
                type="password"
                placeholder="Password"
                style={inputStyle}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) =>
                  (e.target.style.cssText = Object.entries(inputFocusStyle)
                    .map(
                      ([k, v]) =>
                        `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                    )
                    .join(";"))
                }
                onBlur={(e) =>
                  (e.target.style.cssText = Object.entries(inputStyle)
                    .map(
                      ([k, v]) =>
                        `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                    )
                    .join(";"))
                }
                autoComplete={isLogin ? "current-password" : "new-password"}
                disabled={loading}
              />
            )}

            {/* Confirm Password - Only for Sign Up */}
            {!isLogin && !isForgotPassword && (
              <input
                type="password"
                placeholder="Confirm Password"
                style={inputStyle}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={(e) =>
                  (e.target.style.cssText = Object.entries(inputFocusStyle)
                    .map(
                      ([k, v]) =>
                        `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                    )
                    .join(";"))
                }
                onBlur={(e) =>
                  (e.target.style.cssText = Object.entries(inputStyle)
                    .map(
                      ([k, v]) =>
                        `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`,
                    )
                    .join(";"))
                }
                autoComplete="new-password"
                disabled={loading}
              />
            )}

            <button
              type="submit"
              className="btn-start"
              style={{
                width: "100%",
                textAlign: "center",
                marginLeft: 0,
                marginTop: "10px",
                padding: "14px 20px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #cb3391 0%, #6366f1 100%)",
                color: "#fff",
                fontWeight: "700",
                fontSize: "15px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.8 : 1,
                boxShadow: "0 8px 25px rgba(203, 51, 145, 0.4)",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.boxShadow =
                    "0 12px 35px rgba(203, 51, 145, 0.6)";
                  e.target.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.boxShadow =
                    "0 8px 25px rgba(203, 51, 145, 0.4)";
                  e.target.style.transform = "translateY(0)";
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <svg
                    className="animate-spin"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {isForgotPassword
                    ? "Sending..."
                    : isLogin
                      ? "Logging in..."
                      : "Creating account..."}
                </span>
              ) : isForgotPassword ? (
                "↗️ Send Reset Link"
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Google Sign In - Only for Login/Sign Up, not Forgot Password */}
          {!isForgotPassword && (
            <>
              <div
                style={{
                  textAlign: "center",
                  margin: "25px 0 20px",
                  color: "#a0a0a0",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                OR CONTINUE WITH
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: "12px",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  marginBottom: "20px",
                  opacity: loading ? 0.6 : 1,
                  transition: "all 0.3s ease",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.background = "rgba(255,255,255,0.12)";
                    e.target.style.border = "1.5px solid rgba(255,255,255,0.3)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.background = "rgba(255,255,255,0.08)";
                    e.target.style.border = "1.5px solid rgba(255,255,255,0.2)";
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
            </>
          )}

          {/* Toggle between Login/Sign Up */}
          {!isForgotPassword && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <p
                style={{
                  color: "#9b90aa",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  style={{
                    color: "#cb3391",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: "700",
                    transition: "color 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.target.style.color = "#6366f1")}
                  onMouseLeave={(e) => (e.target.style.color = "#cb3391")}
                >
                  {isLogin ? "Sign Up" : "Login"}
                </button>
              </p>
            </div>
          )}

          {/* Forgot Password Link */}
          {isLogin && !isForgotPassword && (
            <div style={{ textAlign: "center", marginTop: "15px" }}>
              <button
                type="button"
                onClick={() => setIsForgotPassword(true)}
                style={{
                  color: "#9b90aa",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  textDecoration: "underline",
                  fontWeight: "500",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#b0a8c0")}
                onMouseLeave={(e) => (e.target.style.color = "#9b90aa")}
              >
                🔐 Forgot Password?
              </button>
            </div>
          )}

          {/* Back to Login Link */}
          {isForgotPassword && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                style={{
                  color: "#9b90aa",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  textDecoration: "underline",
                  fontWeight: "500",
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => (e.target.style.color = "#b0a8c0")}
                onMouseLeave={(e) => (e.target.style.color = "#9b90aa")}
              >
                ← Back to Login
              </button>
            </div>
          )}

          {/* Skip Login */}
          <div
            style={{
              textAlign: "center",
              marginTop: "20px",
              paddingTop: "20px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <Link
              to="/homepage"
              style={{
                color: "#7b7489",
                fontSize: "13px",
                textDecoration: "underline",
                fontWeight: "500",
                transition: "color 0.2s ease",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#9b90aa")}
              onMouseLeave={(e) => (e.target.style.color = "#7b7489")}
            >
              Skip and explore the app →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
