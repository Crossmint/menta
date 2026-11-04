import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Anmelden",
    heading: "Bei Menta anmelden",
    lede: "Neu hier? Mit der Anmeldung erstellst du dein Konto.",
    arrivals: {
      checkout: {
        kicker: "Ein Checkout braucht dich",
        title: "Melde dich an, um fortzufahren",
        lede: "Dein Assistent hat dich für einen Schritt hierher geschickt. Die Details siehst du, sobald du dich mit dem Konto anmeldest, das ihn gestartet hat.",
        footer:
          "Gib Zahlungen nur auf Menta frei. Gib Kartendaten nie in einen Chat ein.",
      },
      connect: {
        kicker: "Ein Assistent möchte sich verbinden",
        title: "Melde dich an, um zu verbinden",
        lede: "Melde dich an und entscheide dann, ob dein Assistent mit Menta einkaufen darf.",
        ledeNamed:
          "Melde dich an und entscheide dann, ob {name} mit Menta einkaufen darf.",
        footer:
          "Jedes Ausgabenlimit gibst du hier frei, nie im Chat des Assistenten.",
      },
    },
    googleFailed:
      "Die Anmeldung mit Google wurde nicht abgeschlossen. Bitte versuch es noch einmal.",
    invalidEmail: "Gib eine gültige E-Mail-Adresse ein.",
    sendFailed: "Wir konnten keinen Code senden. Bitte versuch es noch einmal.",
    codeFailed:
      "Dieser Code hat nicht funktioniert. Versuch es noch einmal oder fordere einen neuen an.",
    checkEmail: "Schau in deine E-Mails",
    codeSent: "Gib den Code ein, den wir an {email} gesendet haben.",
    google: "Weiter mit Google",
    continueEmail: "Weiter mit E-Mail",
    or: "oder",
    email: "E-Mail",
    code: "Code",
    emailPlaceholder: "Deine E-Mail",
    openInbox: "{provider} öffnen",
    sendCode: "Code senden",
    signIn: "Anmelden",
    differentEmail: "Andere E-Mail verwenden",
    resend: "Neuen Code senden",
    resendIn: "Neuen Code senden in {seconds} s",
    codeResent: "Wir haben einen neuen Code an {email} gesendet.",
  },
  authorize: {
    title: "Zugriff erlauben",
    can: [
      "Checkouts bis zu deinem Limit starten",
      "Status und Belege sehen",
      "Einen Checkout abbrechen, wenn du darum bittest",
    ],
    cannot: [
      "Zahlungen freigeben",
      "Kartennummern oder Codes sehen",
      "Deine Karten ändern",
    ],
    offline: "Menta ist nicht erreichbar. Prüfe deine Verbindung.",
    failed:
      "Etwas ist schiefgelaufen. Versuch es noch einmal aus deinem Assistenten.",
    cantConnect: "Verbindung gerade nicht möglich",
    returning: "Zurück zu deinem Assistenten…",
    checking: "Anfrage wird geprüft…",
    thisAssistant: "Dieser Assistent",
    heading: "{name} erlauben, Menta zu nutzen?",
    signedInAs: "Angemeldet als {email} · ",
    notYou: "Nicht du?",
    itCan: "Er kann",
    itCant: "Er kann nicht",
    ungrantable:
      "Dein Konto kann {scopes} nicht erteilen, daher funktioniert {name} eventuell nicht vollständig.",
    cancel: "Abbrechen",
    allow: "Erlauben",
    returnsTo:
      "Du kehrst zu {returnsTo} zurück. Du kannst die Verbindung jederzeit unter {connections} trennen.",
    connections: "Verbindungen",
  },
  notFound: {
    title: "Seite nicht gefunden",
    lede: "Diese Seite gibt es nicht oder sie wurde verschoben.",
    home: "Zu Menta",
  },
  codeEmail: {
    subject: "Dein Anmeldecode für Menta",
    heading: "Dein Anmeldecode",
    enter: "Gib diesen Code auf Menta ein, um dich anzumelden.",
    label: "Bestätigungscode",
    expires: "Er läuft in {minutes} Minuten ab.",
    share: "Teile ihn mit niemandem, auch nicht mit deinem Assistenten.",
    ignore:
      "Du wolltest dich nicht anmelden? Dann kannst du diese E-Mail ignorieren.",
  },
} satisfies typeof en;
