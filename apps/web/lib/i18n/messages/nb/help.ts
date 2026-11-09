import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Hjelp",
    description:
      "Slik legger du til Menta i assistenten din, slik fungerer et kjøp, og her finner du kortene, adressene og bestillingene dine.",
  },
  title: "Hjelp for Menta",
  lede: "Menta er et plugin for ChatGPT, Claude, Grok Bot og andre assistenter. Si til assistenten hva du vil kjøpe, så fullfører Menta kjøpet for deg i nettbutikker over hele verden, via Crossmint Agent Checkouts.",
  install: {
    title: "Legg til Menta i assistenten din",
    lede: "Velg assistenten din. Når den ber om det, logger du inn på Menta og gir tilgang.",
    server: "Serverens URL",
    listed:
      "Når Menta er oppført i {directory}, legger du det til derfra. Inntil da legger du det til selv:",
    chatgptDirectory: "ChatGPTs plugin-katalog",
    claudeDirectory: "Claudes katalog over koblinger",
    grokBot:
      "Når Menta er i Grok Bots Marketplace, åpner du Marketplace, legger til Menta og logger inn.",
    signIn: "logg inn på Menta og gi tilgang.",
    otherApp: "Annen app",
    example:
      "Kjøp en 4-pakning AA-batterier på Amazon, under 150 kr, levert hjem.",
    apps: {
      chatgpt: [
        "Åpne {plugins} og velg {add}. Ser du det ikke? Slå på utviklermodus i Innstillinger først.",
        "Kall den Menta, lim inn URL-en og velg {oauth}.",
        "Velg {create}, og så {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Åpne {connectors} og velg {add}.",
        "Kall den Menta og lim inn URL-en nøyaktig, uten skråstrek på slutten.",
        "Behold innloggingen Claude finner, velg {confirm}, og så {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Finn stedet der appen din legger til MCP-servere eller tilkoblinger (ofte kalt egendefinerte connectors eller integrasjoner).",
        "Legg til en ekstern HTTP-server med URL-en over. Innloggingen går via OAuth, så la eventuelle felt for API-nøkkel stå tomme.",
        "Når du blir spurt, {signIn}",
      ],
    },
  },
  purchase: {
    title: "Slik fungerer et kjøp",
    steps: [
      {
        title: "Si hva du vil kjøpe",
        text: "Fortell assistenten hva du vil ha og hvor, for eksempel: «{example}»",
      },
      {
        title: "Menta fullfører kjøpet",
        text: "Menta starter et kjøp i butikken og viser deg hvordan det går.",
      },
      {
        title: "Svar butikken",
        text: "Hvis butikken trenger noe fra deg, som en størrelse eller et leveringstidspunkt, spør assistenten, og du svarer.",
      },
      {
        title: "Godkjenn en utgiftsgrense",
        text: "Når butikken er klar til å belaste, betaler Menta med en utgiftsgrense du har godkjent, hvis en av dem dekker beløpet. Hvis ingen gjør det, godkjenner du en selv i Crossmints sikre skjema, i assistenten din eller på en Menta-side. Ingenting betales utover grensene dine.",
      },
    ],
    never:
      "Assistenten din kan aldri godkjenne eller heve en utgiftsgrense. Kortnumre, bekreftelseskoder og passord går aldri gjennom chatten: Når noe slikt trengs, skriver du det inn i Crossmints sikre skjema.",
  },
  saved: {
    title: "Kort og adresser",
    cards:
      "Crossmint lagrer kortene dine på Menta-kontoen din. Legg dem til og administrer dem under {wallet}. Assistenten ser bare korttypen og de siste 4 sifrene.",
    addresses:
      "Leveringsadressene dine er lagret under {addresses}. Assistenten leser dem bare ved behov: navnet og stedet for standardadressen din for å si hvor leveranser går, og resten når du eller en butikk ber om det.",
    signIn: "Begge sidene krever at du logger inn på Menta.",
  },
  orders: {
    title: "Sjekke eller avbryte en bestilling",
    text: "Spør assistenten hvordan et kjøp går, eller be den avbryte det. Alt Menta har kjøpt for deg, fra hvilken som helst assistent, finner du under {transactions}.",
    store:
      "Bestillinger står i ditt navn hos butikken, så etter at bestillingen er lagt inn, ordner du endringer og returer med butikken.",
  },
  limits: {
    title: "Dette kan ikke Menta gjøre",
    items: [
      "Noen butikker blokkerer automatiserte nettlesere, så der kan ikke Menta handle.",
      "Menta kjøper fysiske varer og legger inn bestillinger i nettbutikker, med levering eller klar for henting.",
      "Menta betaler bare med et kort du har lagret, og bare innenfor en utgiftsgrense du har godkjent.",
    ],
  },
  contact: {
    title: "Personvern, vilkår og kundestøtte",
    text: "Menta er laget av Crossmint. Trenger du hjelp, kan du sende e-post til {email} eller tagge {x} på X.",
  },
  legal: {
    terms: "Bruksvilkår",
    privacy: "Personvernerklæring",
    englishOnly: "Dette dokumentet finnes bare på engelsk.",
    agree: "Ved å fortsette godtar du Mentas {terms} og {privacy}.",
    agreeTerms: "bruksvilkår",
    agreePrivacy: "personvernerklæring",
  },
} satisfies typeof en;
