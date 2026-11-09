import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Inloggen",
    heading: "Inloggen bij Menta",
    lede: "Nieuw hier? Door in te loggen maak je je account aan.",
    arrivals: {
      checkout: {
        kicker: "Een checkout heeft je nodig",
        title: "Log in om verder te gaan",
        lede: "Je assistent heeft je hierheen gestuurd voor één stap. Je ziet de details nadat je bent ingelogd met het account waarmee die is gestart.",
        footer:
          "Keur betalingen alleen goed op Menta. Typ nooit kaartgegevens in een chat.",
      },
      connect: {
        kicker: "Een assistent wil verbinding maken",
        title: "Log in om te verbinden",
        lede: "Log in en kies dan of je assistent met Menta mag winkelen.",
        ledeNamed: "Log in en kies dan of {name} met Menta mag winkelen.",
        footer:
          "Elke bestedingslimiet keur je hier goed, nooit in de chat van de assistent.",
      },
    },
    googleFailed: "Inloggen met Google is niet gelukt. Probeer het opnieuw.",
    invalidEmail: "Vul een geldig e-mailadres in.",
    sendFailed: "We konden geen code sturen. Probeer het opnieuw.",
    codeFailed:
      "Die code werkte niet. Probeer het opnieuw of vraag een nieuwe aan.",
    checkEmail: "Check je e-mail",
    codeSent: "Vul de code in die we naar {email} hebben gestuurd.",
    google: "Doorgaan met Google",
    continueEmail: "Doorgaan met e-mail",
    or: "of",
    email: "E-mail",
    code: "Code",
    emailPlaceholder: "Je e-mailadres",
    openInbox: "{provider} openen",
    sendCode: "Code sturen",
    signIn: "Inloggen",
    differentEmail: "Ander e-mailadres gebruiken",
    resend: "Nieuwe code sturen",
    resendIn: "Nieuwe code sturen over {seconds} s",
    codeResent: "We hebben een nieuwe code naar {email} gestuurd.",
    password: "Wachtwoord",
    passwordFailed: "Dat wachtwoord werkte niet. Probeer het opnieuw.",
  },
  authorize: {
    title: "Toegang geven",
    can: [
      "Checkouts starten tot de limiet die jij instelt",
      "Status en bonnen bekijken",
      "Een checkout annuleren als jij erom vraagt",
    ],
    cannot: [
      "Betalingen goedkeuren",
      "Kaartnummers of codes zien",
      "Je kaarten wijzigen",
    ],
    offline: "We konden Menta niet bereiken. Controleer je verbinding.",
    failed: "Er ging iets mis. Probeer het opnieuw vanuit je assistent.",
    cantConnect: "Verbinden lukt nu niet",
    returning: "Terug naar je assistent…",
    checking: "Verzoek controleren…",
    thisAssistant: "Deze assistent",
    heading: "{name} Menta laten gebruiken?",
    signedInAs: "Ingelogd als {email} · ",
    notYou: "Ben jij dit niet?",
    itCan: "Hij kan",
    itCant: "Hij kan niet",
    ungrantable:
      "Je account kan {scopes} niet toestaan, dus {name} werkt misschien niet volledig.",
    cancel: "Annuleren",
    allow: "Toestaan",
    returnsTo:
      "Je gaat terug naar {returnsTo}. Je kunt de verbinding altijd verbreken bij {connections}.",
    connections: "Koppelingen",
  },
  notFound: {
    title: "Pagina niet gevonden",
    lede: "Deze pagina bestaat niet of is verplaatst.",
    home: "Naar Menta",
  },
  codeEmail: {
    subject: "Je inlogcode voor Menta",
    heading: "Je inlogcode",
    enter: "Vul deze code in op Menta om in te loggen.",
    label: "Verificatiecode",
    expires: "Hij verloopt over {minutes} minuten.",
    share: "Deel hem met niemand, ook niet met je assistent.",
    ignore:
      "Heb je niet geprobeerd in te loggen? Dan kun je deze e-mail negeren.",
  },
} satisfies typeof en;
