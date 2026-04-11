import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  hasSupabaseEnvConfig,
  isSupabaseTableMarkedMissing,
  markSupabaseTableMissing,
  supabase,
} from "../lib/supabase";

const AuthContext = createContext();
const IS_DEV = import.meta.env.DEV;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const canSyncUserProfilesRef = useRef(
    !isSupabaseTableMarkedMissing("user_profiles"),
  );
  const isSyncingUserProfileRef = useRef(false);

  const isMissingSupabaseTableError = useCallback(
    (supabaseError, tableName) => {
      const message = supabaseError?.message?.toLowerCase() || "";
      return (
        supabaseError?.code === "PGRST205" &&
        message.includes(`public.${tableName}`)
      );
    },
    [],
  );

  const syncUserProfile = useCallback(
    async (authUser) => {
      try {
        if (!authUser?.id) return;
        if (!hasSupabaseEnvConfig) return;
        if (!canSyncUserProfilesRef.current) return;
        if (isSyncingUserProfileRef.current) return;
        isSyncingUserProfileRef.current = true;

        const profilePayload = {
          id: authUser.id,
          email: authUser.email,
          full_name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            null,
          avatar_url: authUser.user_metadata?.avatar_url || null,
          last_sign_in_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase
          .from("user_profiles")
          .upsert(profilePayload, { onConflict: "id" });

        if (profileError) {
          if (isMissingSupabaseTableError(profileError, "user_profiles")) {
            canSyncUserProfilesRef.current = false;
            markSupabaseTableMissing("user_profiles");
            if (IS_DEV) {
              console.warn(
                "Skipping user profile sync for this session: Supabase table public.user_profiles is missing.",
              );
            }
            return;
          }
          if (IS_DEV) {
            console.error("Error syncing user profile:", profileError.message);
          }
        }
      } catch (syncError) {
        if (IS_DEV) {
          console.error("Unexpected profile sync error:", syncError);
        }
      } finally {
        isSyncingUserProfileRef.current = false;
      }
    },
    [isMissingSupabaseTableError],
  );

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (err) {
        if (IS_DEV) {
          console.error("Error getting session:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (
        session?.user &&
        [
          "INITIAL_SESSION",
          "SIGNED_IN",
          "TOKEN_REFRESHED",
          "USER_UPDATED",
        ].includes(event)
      ) {
        syncUserProfile(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncUserProfile]);

  // Sign up with email and password
  const signUp = async (email, password, metadata = {}) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signUpError) throw signUpError;

      if (data?.user) {
        await syncUserProfile(data.user);
      }

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) throw signInError;

      if (data?.user) {
        await syncUserProfile(data.user);
      }

      return { success: true, data };
    } catch (err) {
      const errorMessage = err.message
        ?.toLowerCase()
        .includes("email not confirmed")
        ? "Please verify your email first. Check your inbox and spam folder, then try signing in again."
        : err.message;

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const resendSignupVerification = async (email) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (resendError) throw resendError;

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with Google OAuth
  const signInWithGoogle = async (nextPath = "/homepage") => {
    try {
      setError(null);
      setLoading(true);

      const safeNextPath =
        typeof nextPath === "string" && nextPath.startsWith("/")
          ? nextPath
          : "/homepage";
      sessionStorage.setItem("auth_next_path", safeNextPath);
      const redirectTo = `${window.location.origin}/login`;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) throw oauthError;

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setError(null);
      setLoading(true);

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) throw signOutError;

      setUser(null);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (resetError) throw resetError;

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (updates) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: updateError } = await supabase.auth.updateUser({
        data: updates,
      });

      if (updateError) throw updateError;

      setUser(data.user);
      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Update user email
  const updateEmail = async (newEmail) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (updateError) throw updateError;

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Update user password
  const updatePassword = async (newPassword) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      return { success: true, data };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Upload avatar
  const uploadAvatar = async (file) => {
    try {
      setError(null);
      setLoading(true);

      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Update user metadata with avatar URL
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) throw updateError;

      return { success: true, url: publicUrl };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Clear error
  const clearError = () => setError(null);

  const value = {
    user,
    loading,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    resendSignupVerification,
    signOut,
    resetPassword,
    updateProfile,
    updateEmail,
    updatePassword,
    uploadAvatar,
    clearError,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
