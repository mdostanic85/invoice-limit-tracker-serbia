import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function SignUpPage() {
  return (
    <AuthLayout title="Invoice Limit Tracker Serbia — Create Account">
      <SignUp />
    </AuthLayout>
  );
}
