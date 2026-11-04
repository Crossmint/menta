import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Kirjaudu sisään",
    heading: "Kirjaudu Mentaan",
    lede: "Uusi täällä? Kirjautuminen luo tilisi.",
    arrivals: {
      checkout: {
        kicker: "Ostos odottaa sinua",
        title: "Jatka kirjautumalla",
        lede: "Avustajasi lähetti sinut tänne yhtä vaihetta varten. Näet tiedot, kun kirjaudut tilillä, jolla ostos aloitettiin.",
        footer:
          "Hyväksy maksut vain Mentassa. Älä koskaan kirjoita kortin tietoja chattiin.",
      },
      connect: {
        kicker: "Avustaja haluaa yhteyden",
        title: "Kirjaudu ja yhdistä",
        lede: "Kirjaudu ja päätä sitten, saako avustajasi ostaa Mentan kautta.",
        ledeNamed:
          "Kirjaudu ja päätä sitten, saako {name} ostaa Mentan kautta.",
        footer:
          "Hyväksyt jokaisen kulurajan täällä, et koskaan avustajan chatissa.",
      },
    },
    googleFailed: "Google-kirjautuminen ei onnistunut. Yritä uudelleen.",
    invalidEmail: "Anna kelvollinen sähköpostiosoite.",
    sendFailed: "Koodin lähettäminen ei onnistunut. Yritä uudelleen.",
    codeFailed: "Koodi ei kelvannut. Yritä uudelleen tai pyydä uusi koodi.",
    checkEmail: "Tarkista sähköpostisi",
    codeSent: "Anna koodi, jonka lähetimme osoitteeseen {email}.",
    google: "Jatka Googlella",
    continueEmail: "Jatka sähköpostilla",
    or: "tai",
    email: "Sähköposti",
    code: "Koodi",
    emailPlaceholder: "Sähköpostisi",
    openInbox: "Avaa {provider}",
    sendCode: "Lähetä koodi",
    signIn: "Kirjaudu sisään",
    differentEmail: "Käytä toista sähköpostia",
    resend: "Lähetä uusi koodi",
    resendIn: "Lähetä uusi koodi ({seconds} s)",
    codeResent: "Lähetimme uuden koodin osoitteeseen {email}.",
  },
  authorize: {
    title: "Anna käyttöoikeus",
    can: [
      "Aloittaa ostoksia antamaasi rajaan asti",
      "Nähdä tilan ja kuitit",
      "Perua ostoksen, kun pyydät",
    ],
    cannot: [
      "Hyväksyä maksuja",
      "Nähdä korttinumeroita tai koodeja",
      "Muuttaa korttejasi",
    ],
    offline: "Mentaan ei saatu yhteyttä. Tarkista verkkoyhteytesi.",
    failed: "Jokin meni pieleen. Yritä uudelleen avustajasi kautta.",
    cantConnect: "Yhdistäminen ei onnistu juuri nyt",
    returning: "Palataan avustajaasi…",
    checking: "Tarkistetaan pyyntöä…",
    thisAssistant: "Tämä avustaja",
    heading: "Saako {name} käyttää Mentaa?",
    signedInAs: "Kirjautuneena {email} · ",
    notYou: "Väärä tili?",
    itCan: "Se voi",
    itCant: "Se ei voi",
    ungrantable:
      "Tilisi ei voi myöntää oikeuksia {scopes}, joten {name} ei ehkä toimi täysin.",
    cancel: "Peruuta",
    allow: "Salli",
    returnsTo:
      "Palaat sivulle {returnsTo}. Voit katkaista yhteyden milloin tahansa kohdassa {connections}.",
    connections: "Yhteydet",
  },
  notFound: {
    title: "Sivua ei löytynyt",
    lede: "Sivua ei ole olemassa, tai se on siirretty.",
    home: "Siirry Mentaan",
  },
  codeEmail: {
    subject: "Menta-kirjautumiskoodisi",
    heading: "Kirjautumiskoodisi",
    enter: "Kirjaudu antamalla tämä koodi Mentassa.",
    label: "Vahvistuskoodi",
    expires: "Se vanhenee {minutes} minuutin kuluttua.",
    share: "Älä jaa sitä kenellekään, et edes avustajallesi.",
    ignore: "Etkö yrittänyt kirjautua? Voit jättää tämän viestin huomiotta.",
  },
} satisfies typeof en;
