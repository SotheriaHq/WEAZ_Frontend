import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-toastify";
import { Eye, EyeOff, User, Building, Scissors } from "lucide-react";
import AnimatedBackground from "../lib/Animation";
import { isAxiosError } from "axios";
import { unwrapApiResponse } from "../types/auth";
import type {
  AuthUserDto,
  AuthProfileResponse,
  AuthTokensResponse,
} from "../types/auth";
import { useDispatch } from "react-redux";
import { setUser } from "../features/userSlice";
import { useNavigate } from "react-router-dom";
import { apiClient, persistAccessToken, dropStoredAccessToken } from "../api/httpClient";
import { env } from "../config/env";
import TextField from "../components/forms/TextField";

const PURPLE = "#9333EA";
const NAME_REGEX = /^[a-zA-Z\s-]+$/;

const signupSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, { message: "First name is required" })
      .regex(NAME_REGEX, {
        message: "First name can only contain letters, spaces, or hyphens",
      }),
    lastName: z
      .string()
      .trim()
      .min(1, { message: "Last name is required" })
      .regex(NAME_REGEX, {
        message: "Last name can only contain letters, spaces, or hyphens",
      }),
    email: z
      .string()
      .trim()
      .min(1, { message: "Email is required" })
      .email({ message: "Please provide a valid email address" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" })
      .refine((value) => !/\s/.test(value), {
        message: "Password cannot contain spaces",
      }),
    confirmPassword: z
      .string()
      .min(1, { message: "Please confirm your password" }),
    type: z.enum(["REGULAR", "BRAND"]),
    brandFullName: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    agreeToTerms: z.boolean().refine((val) => val === true, {
      message: "You must agree to the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      if (data.type === "BRAND") {
        return typeof data.brandFullName === "string" && data.brandFullName.length > 0;
      }
      return true;
    },
    {
      message: "Brand name is required for brand signup",
      path: ["brandFullName"],
    }
  );

type SignupFormValues = z.infer<typeof signupSchema>;

const SignUpPage: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [userType, setUserType] = React.useState<"REGULAR" | "BRAND">(
    "REGULAR"
  );
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [stylePreferences, setStylePreferences] = React.useState<string[]>([]);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Robustly protect signup page from authenticated users
  React.useEffect(() => {
    const tokenKeys = [env.tokenStorageKey, "accessToken", "access_token", "token"];
    const hasToken = tokenKeys.some((key) => !!localStorage.getItem(key));
    let hasUser = false;
    try {
      const user = localStorage.getItem(env.userStorageKey);
      if (user && typeof user === "string") {
        const parsed = JSON.parse(user);
        if (parsed && (parsed.id || parsed._id)) {
          hasUser = true;
        }
      }
    } catch (e) {
      // ignore localStorage parse errors
      void e;
    }
    if (hasToken || hasUser) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    setError,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      type: "REGULAR",
      agreeToTerms: false,
    },
  });

  React.useEffect(() => {
    setValue("type", userType);
  }, [userType, setValue]);

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        type: data.type,
      };

      if (data.type === "BRAND" && data.brandFullName)
        payload.brandFullName = data.brandFullName;

      await apiClient.post("/auth/signup", payload);
      dropStoredAccessToken();
      const loginRes = await apiClient.post("/auth/login", {
        email: data.email,
        password: data.password,
      });
      const loginPayload = unwrapApiResponse<AuthTokensResponse | AuthUserDto>(
        loginRes.data
      );
      let accessToken: string | undefined;
      if (loginPayload && typeof loginPayload === "object") {
        const lp = loginPayload as unknown as Record<string, unknown>;
        if ("accessToken" in lp && typeof lp.accessToken === "string")
          accessToken = lp.accessToken;
      }
      if (!accessToken) throw new Error("No access token received after login");
      // Use the configured token key and clear legacy keys
      persistAccessToken(accessToken);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("access_token");

      const profileRes = await apiClient.get("/auth/profile");

      const profilePayload = unwrapApiResponse<
        AuthProfileResponse | AuthUserDto
      >(profileRes.data);
      let user: AuthUserDto;
      if ("user" in profilePayload) {
        user = (profilePayload as AuthProfileResponse).user;
      } else {
        user = profilePayload as AuthUserDto;
      }
      if (!user || !user.id) throw new Error("Invalid profile response");

      dispatch(setUser(user));
      toast.success("Account created successfully!");
      setIsRedirecting(true);
      reset();

      const redirectPath = user.type === "BRAND" ? "/profile" : "/";

      // Replace history so user cannot go back to signup via back button
      setTimeout(() => 
        navigate(redirectPath, 
        { replace: true, 
        state: { fromSignup: true } 
      }), 1200);
      
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response) {
        const data = error.response.data as Record<string, unknown> | string | undefined;
        const fallbackMessage = "Registration failed. Please review your details and try again.";

        if (data && typeof data === "object") {
          const responseMessage =
            typeof data.message === "string" ? data.message : fallbackMessage;
          const responseErrors = Array.isArray((data as { errors?: unknown }).errors)
            ? ((data as { errors: Array<Record<string, unknown>> }).errors)
            : [];

          let displayedMessage = "";

          responseErrors.forEach((fieldErrorRaw) => {
            const fieldError = fieldErrorRaw as {
              property?: string;
              messages?: unknown;
              constraints?: unknown;
            };
            const fieldName = fieldError.property as keyof SignupFormValues | undefined;
            const messages =
              (Array.isArray(fieldError.messages) && fieldError.messages) ||
              (Array.isArray(fieldError.constraints) && fieldError.constraints) ||
              [];

            const message = messages.length > 0 ? String(messages[0]) : responseMessage;

            if (fieldName) {
              setError(fieldName, { type: "server", message });
            }

            if (!displayedMessage && message) {
              displayedMessage = message;
            }
          });

          toast.error(displayedMessage || responseMessage);
          return;
        }

        if (typeof data === "string") {
          toast.error(data);
          return;
        }

        toast.error(fallbackMessage);
        return;
      }

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStylePreference = (style: string) => {
    setStylePreferences((prev: string[]) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  };

  const LoadingScreen = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl font-bold text-white mb-4 animate-pulse">
          voguely
        </div>
        <div className="w-20 h-1 bg-white/30 rounded-full mx-auto mb-4">
          <div className="h-full bg-white rounded-full animate-pulse"></div>
        </div>
        <p className="text-white/80 text-lg">Creating your account...</p>
      </div>
    </div>
  );

  if (isRedirecting) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-purple-800 relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background */}
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center">
              <Scissors className="w-8 h-8 text-purple-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">voguely</h1>
          <p className="text-white/80">Discover Nigerian Fashion Excellence</p>
        </div>
        <div className="space-y-6">
          {/* User Type Selection */}
          <div>
            <p className="text-white font-medium mb-4">Join as:</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserType("REGULAR")}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg transition-all font-bold ${
                  userType === "REGULAR"
                    ? `bg-[${PURPLE}] text-white shadow-lg`
                    : "bg-white/20 text-white border border-white/30"
                }`}
              >
                <User className="w-5 h-5 mr-2 text-[${PURPLE}]" />
                Fashion Lover
              </button>
              <button
                type="button"
                onClick={() => setUserType("BRAND")}
                className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg transition-all font-bold ${
                  userType === "BRAND"
                    ? "bg-purple-600 text-white shadow-lg"
                    : "bg-white/20 text-white border border-white/30"
                }`}
              >
                <Building className="w-5 h-5 mr-2 text-[${PURPLE}]" />
                Brand/Designer
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <TextField
                {...register("firstName")}
                placeholder="First Name"
                className="w-full"
                variant="glass"
              />
              {errors.firstName && (
                <p className="text-red-300 text-sm mt-1">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <TextField
                {...register("lastName")}
                placeholder="Last Name"
                className="w-full"
                variant="glass"
              />
              {errors.lastName && (
                <p className="text-red-300 text-sm mt-1">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <TextField
              {...register("email")}
              type="email"
              placeholder="Email Address"
              className="w-full"
              variant="glass"
            />
            {errors.email && (
              <p className="text-red-300 text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* phoneNumber removed - not required by backend */}

          <div className="relative">
            <TextField
              {...register("password")}
              type={showPassword ? "text" : "password"}
              placeholder="Create Password"
              className="w-full"
              variant="glass"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-white/60" />
              ) : (
                <Eye className="h-5 w-5 text-white/60" />
              )}
            </button>
            {errors.password && (
              <p className="text-red-300 text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="relative">
            <TextField
              {...register("confirmPassword")}
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              className="w-full"
              variant="glass"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-white/60" />
              ) : (
                <Eye className="h-5 w-5 text-white/60" />
              )}
            </button>
            {errors.confirmPassword && (
              <p className="text-red-300 text-sm mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Brand-specific fields */}
          {userType === "BRAND" && (
            <div className="space-y-4 animate-slideDown">
              <div>
                <TextField
                  {...register("brandFullName")}
                  placeholder="Brand Full Name"
                  className="w-full"
                  variant="glass"
                  autoComplete="organization"
                />
                {errors.brandFullName && (
                  <p className="text-red-300 text-sm mt-1">
                    {errors.brandFullName.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Style Preferences (for regular users) */}
          {userType === "REGULAR" && (
            <div className="animate-slideDown">
              <p className="text-white font-medium mb-3">
                Style Preferences (Optional):
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "#Ankara",
                  "#Luxury",
                  "#Casual",
                  "#Formal",
                  "#Streetwear",
                ].map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => handleStylePreference(style)}
                    className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${
                      stylePreferences.includes(style)
                        ? `bg-[${PURPLE}] text-white`
                        : `bg-white/20 text-[${PURPLE}] border border-white/30`
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Terms and Conditions */}
          <div className="flex items-start space-x-3">
            <input
              id="agreeToTerms"
              type="checkbox"
              {...register("agreeToTerms")}
              className="mt-1 h-4 w-4 text-purple-600 border-none rounded bg-white/20 outline-none"
            />
            <label htmlFor="agreeToTerms" className="text-sm text-white/80">
              I agree to voguely's{" "}
              <a href="#" className="text-white underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-white underline">
                Privacy Policy
              </a>
            </label>
          </div>
          {errors.agreeToTerms && (
            <p className="text-red-300 text-sm">
              {errors.agreeToTerms.message}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="w-full bg-white text-purple-600 font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600 mr-2"></div>
                Creating Account...
              </>
            ) : (
              <>
                Create My Account
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </>
            )}
          </button>

          {/* Social Login */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/30"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-white/60">
                or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className="flex items-center justify-center py-3 px-4 bg-white/20 border border-white/30 rounded-lg hover:bg-white/30 transition-colors text-white"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              G
            </button>
            <button
              type="button"
              className="flex items-center justify-center py-3 px-4 bg-white/20 border border-white/30 rounded-lg hover:bg-white/30 transition-colors text-white"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              f
            </button>
          </div>

          {/* Sign In Link */}
          <p className="text-center text-white/80 text-sm">
            Already have an account?{" "}
            <a
              href="/login"
              className={`text-[${PURPLE}] font-semibold hover:underline`}
            >
              Sign In
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
