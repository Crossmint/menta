import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Logga in",
    heading: "Logga in på Menta",
    lede: "Ny här? När du loggar in skapas ditt konto.",
    arrivals: {
      checkout: {
        kicker: "Ett köp behöver dig",
        title: "Logga in för att fortsätta",
        lede: "Din assistent skickade hit dig för ett enda steg. Du ser detaljerna när du har loggat in med kontot som startade köpet.",
        footer:
          "Godkänn bara betalningar i Menta. Skriv aldrig kortuppgifter i en chatt.",
      },
      connect: {
        kicker: "En assistent vill ansluta",
        title: "Logga in för att ansluta",
        lede: "Logga in och välj sedan om din assistent får handla med Menta.",
        ledeNamed: "Logga in och välj sedan om {name} får handla med Menta.",
        footer:
          "Du godkänner varje utgiftsgräns här, aldrig i assistentens chatt.",
      },
    },
    googleFailed: "Inloggningen med Google blev inte klar. Försök igen.",
    invalidEmail: "Ange en giltig e-postadress.",
    sendFailed: "Vi kunde inte skicka någon kod. Försök igen.",
    codeFailed: "Koden fungerade inte. Försök igen eller begär en ny.",
    checkEmail: "Kolla din e-post",
    codeSent: "Ange koden vi skickade till {email}.",
    google: "Fortsätt med Google",
    continueEmail: "Fortsätt med e-post",
    or: "eller",
    email: "E-post",
    code: "Kod",
    emailPlaceholder: "Din e-postadress",
    openInbox: "Öppna {provider}",
    sendCode: "Skicka kod",
    signIn: "Logga in",
    differentEmail: "Använd en annan e-postadress",
    resend: "Skicka en ny kod",
    resendIn: "Skicka en ny kod om {seconds} s",
    codeResent: "Vi har skickat en ny kod till {email}.",
  },
  authorize: {
    title: "Ge åtkomst",
    can: [
      "Starta köp upp till gränsen du anger",
      "Se status och kvitton",
      "Avbryta ett köp när du ber om det",
    ],
    cannot: [
      "Godkänna betalningar",
      "Se kortnummer eller koder",
      "Ändra dina kort",
    ],
    offline: "Vi nådde inte Menta. Kontrollera din anslutning.",
    failed: "Något gick fel. Försök igen från din assistent.",
    cantConnect: "Det går inte att ansluta just nu",
    returning: "Går tillbaka till din assistent…",
    checking: "Kontrollerar begäran…",
    thisAssistant: "Den här assistenten",
    heading: "Ska {name} få använda Menta?",
    signedInAs: "Inloggad som {email} · ",
    notYou: "Inte du?",
    itCan: "Den kan",
    itCant: "Den kan inte",
    ungrantable:
      "Ditt konto kan inte bevilja {scopes}, så {name} fungerar kanske inte fullt ut.",
    cancel: "Avbryt",
    allow: "Tillåt",
    returnsTo:
      "Du skickas tillbaka till {returnsTo}. Du kan koppla från när som helst under {connections}.",
    connections: "Anslutningar",
  },
  notFound: {
    title: "Sidan hittades inte",
    lede: "Sidan finns inte eller har flyttats.",
    home: "Gå till Menta",
  },
  codeEmail: {
    subject: "Din inloggningskod till Menta",
    heading: "Din inloggningskod",
    enter: "Ange den här koden i Menta för att logga in.",
    label: "Verifieringskod",
    expires: "Den går ut om {minutes} minuter.",
    share: "Dela den inte med någon, inte ens med din assistent.",
    ignore: "Försökte du inte logga in? Då kan du ignorera det här mejlet.",
  },
} satisfies typeof en;
