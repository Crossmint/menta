import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Logg inn",
    heading: "Logg inn på Menta",
    lede: "Ny her? Når du logger inn, opprettes kontoen din.",
    arrivals: {
      checkout: {
        kicker: "Et kjøp trenger deg",
        title: "Logg inn for å fortsette",
        lede: "Assistenten din sendte deg hit for ett steg. Du ser detaljene når du logger inn med kontoen som startet kjøpet.",
        footer:
          "Godkjenn betalinger bare i Menta. Skriv aldri inn kortopplysninger i en chat.",
      },
      connect: {
        kicker: "En assistent vil koble seg til",
        title: "Logg inn for å koble til",
        lede: "Logg inn, og velg så om assistenten din får handle med Menta.",
        ledeNamed: "Logg inn, og velg så om {name} får handle med Menta.",
        footer:
          "Du godkjenner hver utgiftsgrense her, aldri i assistentens chat.",
      },
    },
    googleFailed: "Innloggingen med Google ble ikke fullført. Prøv igjen.",
    invalidEmail: "Skriv inn en gyldig e-postadresse.",
    sendFailed: "Vi kunne ikke sende en kode. Prøv igjen.",
    codeFailed: "Den koden virket ikke. Prøv igjen eller be om en ny.",
    checkEmail: "Sjekk e-posten din",
    codeSent: "Skriv inn koden vi sendte til {email}.",
    google: "Fortsett med Google",
    continueEmail: "Fortsett med e-post",
    or: "eller",
    email: "E-post",
    code: "Kode",
    emailPlaceholder: "E-postadressen din",
    openInbox: "Åpne {provider}",
    sendCode: "Send kode",
    signIn: "Logg inn",
    differentEmail: "Bruk en annen e-postadresse",
    resend: "Send en ny kode",
    resendIn: "Send en ny kode om {seconds} s",
    codeResent: "Vi har sendt en ny kode til {email}.",
    password: "Passord",
    passwordFailed: "Det passordet fungerte ikke. Prøv igjen.",
  },
  authorize: {
    title: "Gi tilgang",
    can: [
      "Starte kjøp opp til grensen du setter",
      "Se status og kvitteringer",
      "Avbryte et kjøp når du ber om det",
    ],
    cannot: [
      "Godkjenne betalinger",
      "Se kortnumre eller koder",
      "Endre kortene dine",
    ],
    offline: "Vi fikk ikke kontakt med Menta. Sjekk tilkoblingen din.",
    failed: "Noe gikk galt. Prøv igjen fra assistenten din.",
    cantConnect: "Kan ikke koble til akkurat nå",
    returning: "Sender deg tilbake til assistenten…",
    checking: "Sjekker forespørselen…",
    thisAssistant: "Denne assistenten",
    heading: "La {name} bruke Menta?",
    signedInAs: "Logget inn som {email} · ",
    notYou: "Ikke deg?",
    itCan: "Den kan",
    itCant: "Den kan ikke",
    ungrantable:
      "Kontoen din kan ikke gi {scopes}, så {name} fungerer kanskje ikke fullt ut.",
    cancel: "Avbryt",
    allow: "Tillat",
    returnsTo:
      "Du sendes tilbake til {returnsTo}. Du kan koble den fra når som helst under {connections}.",
    connections: "Tilkoblinger",
  },
  notFound: {
    title: "Fant ikke siden",
    lede: "Denne siden finnes ikke eller er flyttet.",
    home: "Gå til Menta",
  },
  codeEmail: {
    subject: "Innloggingskoden din for Menta",
    heading: "Innloggingskoden din",
    enter: "Skriv inn denne koden i Menta for å logge inn.",
    label: "Bekreftelseskode",
    expires: "Den utløper om {minutes} minutter.",
    share: "Ikke del den med noen, heller ikke med assistenten din.",
    ignore: "Prøvde du ikke å logge inn? Da kan du se bort fra denne e-posten.",
  },
} satisfies typeof en;
