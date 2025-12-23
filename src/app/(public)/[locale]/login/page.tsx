import { LoginCard } from "@/components/login-card";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f5efe4,_#f2e7d7_45%,_#ebe1cf_100%)] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(153,118,78,0.08),rgba(255,255,255,0))]" />
      <LoginCard />
    </div>
  );
}
