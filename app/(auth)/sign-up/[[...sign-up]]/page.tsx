import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <AuthLayout
      eyebrow="Novi nalog"
      title="Napravite svoj radni prostor"
      description="Kreirajte nalog, podesite godišnji limit i držite fakture na jednom mestu."
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
      />
    </AuthLayout>
  );
}
