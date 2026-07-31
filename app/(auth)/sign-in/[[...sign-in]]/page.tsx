import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <AuthLayout
      eyebrow="Bezbedan pristup"
      title="Dobro došli nazad"
      description="Prijavite se da pregledate fakture, godišnji limit i prognozu."
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </AuthLayout>
  );
}
