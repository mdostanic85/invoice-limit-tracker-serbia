import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignIn />
    </AuthLayout>
  );
}
