import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword, loading } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [isRecoveryValid, setIsRecoveryValid] = useState(false);

  const hash = useMemo(() => window.location.hash, []);

  useEffect(() => {
    let isMounted = true;

    const validateRecoverySession = async () => {
      try {
        setFormError("");

        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (type === "recovery" && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          setIsRecoveryValid(true);
        } else {
          setFormError(
            "This reset link is invalid or expired. Please request a new one from the login page.",
          );
          setIsRecoveryValid(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setFormError(err.message || "Unable to validate reset link.");
        setIsRecoveryValid(false);
      } finally {
        if (isMounted) setCheckingRecovery(false);
      }
    };

    validateRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [hash]);

  const validateForm = () => {
    if (!newPassword) {
      setFormError("New password is required");
      return false;
    }
    if (newPassword.length < 6) {
      setFormError("Password must be at least 6 characters");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !isRecoveryValid) return;

    setFormError("");
    setSuccessMessage("");

    if (!validateForm()) return;

    const result = await updatePassword(newPassword);
    if (!result.success) {
      setFormError(result.error || "Failed to update password.");
      return;
    }

    setSuccessMessage("Password updated successfully. Redirecting to login...");
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    }, 1800);
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 18px",
    marginBottom: "15px",
    borderRadius: "25px",
    border: "none",
    background: "rgba(0,0,0,0.4)",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div
        className="landing-container"
        style={{ minHeight: "460px", maxWidth: "450px" }}
      >
        <div style={{ padding: "40px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: "700",
                color: "#fff",
                marginBottom: "10px",
              }}
            >
              Reset Password
            </h1>
            <p style={{ color: "#ccc", fontSize: "14px" }}>
              Enter your new password to complete account recovery.
            </p>
          </div>

          {formError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "20px",
                color: "#fca5a5",
                fontSize: "14px",
              }}
            >
              {formError}
            </div>
          )}

          {successMessage && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.2)",
                border: "1px solid rgba(34, 197, 94, 0.5)",
                borderRadius: "10px",
                padding: "12px",
                marginBottom: "20px",
                color: "#86efac",
                fontSize: "14px",
              }}
            >
              {successMessage}
            </div>
          )}

          {checkingRecovery ? (
            <p
              style={{
                color: "#ddd",
                textAlign: "center",
                marginBottom: "20px",
              }}
            >
              Validating reset link...
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                placeholder="New Password"
                style={inputStyle}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading || !isRecoveryValid}
              />

              <input
                type="password"
                placeholder="Confirm New Password"
                style={inputStyle}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading || !isRecoveryValid}
              />

              <button
                type="submit"
                className="btn-start"
                style={{
                  width: "100%",
                  textAlign: "center",
                  marginLeft: 0,
                  opacity: loading || !isRecoveryValid ? 0.7 : 1,
                  cursor:
                    loading || !isRecoveryValid ? "not-allowed" : "pointer",
                }}
                disabled={loading || !isRecoveryValid}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <Link
              to="/login"
              style={{
                color: "#aaa",
                fontSize: "13px",
                textDecoration: "underline",
              }}
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
