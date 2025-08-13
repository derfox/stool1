import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Stethoscope } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import { useAuth } from "../helpers/useAuth";
import styles from "./login.module.css";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const { authState } = useAuth();
  const navigate = useNavigate();

  // Per user instruction, not redirecting if already logged in via useEffect.
  // The forms themselves handle navigation on successful auth action.
  if (authState.type === "loading") {
    // Render a simple loading state to avoid flicker if auth state is being checked.
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Login or Register | Stool Tracker</title>
        <meta
          name="description"
          content="Log in to your Stool Tracker account or create a new one to start logging your daily entries."
        />
      </Helmet>
      <div className={styles.pageContainer}>
        <div className={styles.authCard}>
          <div className={styles.header}>
            <Stethoscope className={styles.logoIcon} />
            <h1 className={styles.title}>
              {mode === "login" ? "Welcome Back" : "Create Account"}
            </h1>
            <p className={styles.subtitle}>
              {mode === "login"
                ? "Log in to continue your health journey."
                : "Start tracking your wellness today."}
            </p>
          </div>

          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as AuthMode)}
            className={styles.tabs}
          >
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="login" className={styles.tabTrigger}>
                <LogIn size={16} />
                <span>Login</span>
              </TabsTrigger>
              <TabsTrigger value="register" className={styles.tabTrigger}>
                <UserPlus size={16} />
                <span>Register</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login" className={styles.tabContent}>
              <PasswordLoginForm />
            </TabsContent>
            <TabsContent value="register" className={styles.tabContent}>
              <PasswordRegisterForm />
            </TabsContent>
          </Tabs>

          <div className={styles.testCredentials}>
            <h3 className={styles.testCredentialsTitle}>For Development</h3>
            <p>
              Use <strong>test@example.com</strong> /{" "}
              <strong>Password123</strong> to log in.
            </p>
          </div>

          <p className={styles.footerText}>
            By continuing, you agree to our{" "}
            <Link to="/terms" className={styles.footerLink}>
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}