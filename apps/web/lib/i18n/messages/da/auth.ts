import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Log ind",
    heading: "Log ind på Menta",
    lede: "Ny her? Når du logger ind, oprettes din konto.",
    arrivals: {
      checkout: {
        kicker: "En checkout venter på dig",
        title: "Log ind for at fortsætte",
        lede: "Din assistent har sendt dig herhen for at klare ét trin. Du ser detaljerne, når du logger ind med den konto, der startede den.",
        footer:
          "Godkend kun betalinger på Menta. Skriv aldrig kortoplysninger i en chat.",
      },
      connect: {
        kicker: "En assistent vil oprette forbindelse",
        title: "Log ind for at forbinde",
        lede: "Log ind, og vælg så, om din assistent må handle med Menta.",
        ledeNamed: "Log ind, og vælg så, om {name} må handle med Menta.",
        footer:
          "Du godkender hver forbrugsgrænse her, aldrig i assistentens chat.",
      },
    },
    googleFailed: "Login med Google blev ikke gennemført. Prøv igen.",
    invalidEmail: "Indtast en gyldig e-mailadresse.",
    sendFailed: "Vi kunne ikke sende en kode. Prøv igen.",
    codeFailed: "Koden virkede ikke. Prøv igen, eller bed om en ny.",
    checkEmail: "Tjek din e-mail",
    codeSent: "Indtast koden, vi har sendt til {email}.",
    google: "Fortsæt med Google",
    continueEmail: "Fortsæt med e-mail",
    or: "eller",
    email: "E-mail",
    code: "Kode",
    emailPlaceholder: "Din e-mail",
    openInbox: "Åbn {provider}",
    sendCode: "Send kode",
    signIn: "Log ind",
    differentEmail: "Brug en anden e-mail",
    resend: "Send en ny kode",
    resendIn: "Send en ny kode om {seconds} s",
    codeResent: "Vi har sendt en ny kode til {email}.",
  },
  authorize: {
    title: "Giv adgang",
    can: [
      "Starte checkouts op til den grænse, du sætter",
      "Se status og kvitteringer",
      "Annullere en checkout, når du beder om det",
    ],
    cannot: [
      "Godkende betalinger",
      "Se kortnumre eller koder",
      "Ændre dine kort",
    ],
    offline: "Vi kunne ikke få kontakt til Menta. Tjek din forbindelse.",
    failed: "Noget gik galt. Prøv igen fra din assistent.",
    cantConnect: "Kan ikke forbinde lige nu",
    returning: "Går tilbage til din assistent…",
    checking: "Tjekker anmodningen…",
    thisAssistant: "Denne assistent",
    heading: "Må {name} bruge Menta?",
    signedInAs: "Logget ind som {email} · ",
    notYou: "Ikke dig?",
    itCan: "Den kan",
    itCant: "Den kan ikke",
    ungrantable:
      "Din konto kan ikke give adgang til {scopes}, så {name} virker måske ikke fuldt ud.",
    cancel: "Annuller",
    allow: "Tillad",
    returnsTo:
      "Du vender tilbage til {returnsTo}. Du kan til enhver tid afbryde forbindelsen under {connections}.",
    connections: "Forbindelser",
  },
  notFound: {
    title: "Siden blev ikke fundet",
    lede: "Siden findes ikke, eller den er flyttet.",
    home: "Gå til Menta",
  },
  codeEmail: {
    subject: "Din loginkode til Menta",
    heading: "Din loginkode",
    enter: "Indtast denne kode på Menta for at logge ind.",
    label: "Bekræftelseskode",
    expires: "Den udløber om {minutes} minutter.",
    share: "Del den ikke med nogen, heller ikke med din assistent.",
    ignore: "Prøvede du ikke at logge ind? Så kan du se bort fra denne e-mail.",
  },
} satisfies typeof en;
