import { srRS } from "@clerk/localizations";

/** Clerk's Serbian catalog with Latin-script overrides used by this app. */
export const clerkSrLatin = {
  ...srRS,
  formFieldInputPlaceholder__emailAddress: "Unesite e-mail adresu",
  formFieldInputPlaceholder__emailAddress_username:
    "Unesite e-mail adresu ili korisničko ime",
  formFieldInputPlaceholder__password: "Unesite lozinku",
  formFieldInputPlaceholder__signUpPassword: "Napravite lozinku",
  formFieldInputPlaceholder__firstName: "Unesite ime",
  formFieldInputPlaceholder__lastName: "Unesite prezime",
  formFieldInputPlaceholder__phoneNumber: "Unesite broj telefona",
  formFieldInputPlaceholder__username: "Unesite korisničko ime",
  formFieldInputPlaceholder__backupCode: "Unesite rezervni kod",
  signIn: {
    ...srRS.signIn,
    emailLinkMfa: {
      ...srRS.signIn?.emailLinkMfa,
      formSubtitle:
        "Koristite vezu za verifikaciju poslatu na vašu e-mail adresu",
      resendButton: "Niste primili vezu? Pošalji ponovo",
      subtitle: "da nastavite na LimitRadar",
      title: "Proverite svoju e-mail adresu",
    },
  },
  unstable__errors: {
    ...srRS.unstable__errors,
    form_email_address_blocked:
      "Privremene e-mail adrese nisu podržane. Koristite svoju redovnu e-mail adresu.",
    form_password_or_identifier_incorrect:
      "Lozinka ili e-mail adresa nisu tačni. Pokušajte ponovo ili koristite drugi metod.",
    form_username_needs_non_number_char:
      "Korisničko ime mora sadržati najmanje jedan znak koji nije broj.",
  },
  userButton: {
    ...srRS.userButton,
    label__accountActions: "Akcije naloga",
    label__activeSessions: "Aktivne sesije",
    label__userButtonPopover: "Meni naloga",
  },
};
