import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Hjælp",
    description:
      "Sådan føjer du Menta til din assistent, sådan fungerer et køb, og her finder du dine kort, adresser og ordrer.",
  },
  title: "Hjælp til Menta",
  lede: "Menta er et plugin til ChatGPT, Claude, Grok Bot og andre assistenter. Fortæl din assistent, hvad du vil købe, så gennemfører Menta købet for dig i netbutikker over hele verden via Crossmint Agent Checkouts.",
  install: {
    title: "Føj Menta til din assistent",
    lede: "Vælg din assistent. Når den beder om det, logger du ind på Menta og giver adgang.",
    server: "Serverens URL",
    listed:
      "Når Menta står i {directory}, tilføjer du det derfra. Indtil da tilføjer du det selv:",
    chatgptDirectory: "ChatGPT's pluginkatalog",
    claudeDirectory: "Claudes katalog over connectors",
    grokBot:
      "Når Menta er i Grok Bots Marketplace, åbner du Marketplace, tilføjer Menta og logger ind.",
    signIn: "log ind på Menta og giv adgang.",
    otherApp: "Anden app",
    example:
      "Køb en 4-pak AA-batterier på Amazon til under 100 kr., leveret hjem.",
    apps: {
      chatgpt: [
        "Åbn {plugins} og vælg {add}. Kan du ikke finde det? Slå først udviklertilstand til under Indstillinger.",
        "Kald den Menta, indsæt URL'en og vælg {oauth}.",
        "Vælg {create}, og så {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Åbn {connectors} og vælg {add}.",
        "Kald den Menta, og indsæt URL'en præcis som den er, uden skråstreg til sidst.",
        "Behold det login, Claude finder, vælg {confirm}, og så {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Find det sted, hvor din app tilføjer MCP-servere eller connectors (ofte kaldet brugerdefinerede connectors eller integrationer).",
        "Tilføj en ekstern HTTP-server med URL'en ovenfor. Login sker via OAuth, så lad et eventuelt felt til API-nøgle stå tomt.",
        "Når du bliver spurgt: {signIn}",
      ],
    },
  },
  purchase: {
    title: "Sådan fungerer et køb",
    steps: [
      {
        title: "Sig, hvad du vil købe",
        text: "Fortæl din assistent, hvad du vil have og hvor, for eksempel: »{example}«",
      },
      {
        title: "Menta gennemfører købet",
        text: "Menta starter et køb i butikken og viser dig, hvordan det går.",
      },
      {
        title: "Svar butikken",
        text: "Hvis butikken har brug for noget fra dig, som en størrelse eller et leveringstidspunkt, spørger din assistent, og du svarer.",
      },
      {
        title: "Godkend en forbrugsgrænse",
        text: "Når butikken er klar til at trække betalingen, betaler Menta med en forbrugsgrænse, du har godkendt, hvis en af dem dækker beløbet. Hvis ingen gør, godkender du selv en i Crossmints sikre formular, i din assistent eller på en Menta-side. Der betales intet ud over dine grænser.",
      },
    ],
    never:
      "Din assistent kan aldrig godkende eller hæve en forbrugsgrænse. Kortnumre, bekræftelseskoder og adgangskoder går aldrig gennem chatten: Når der skal bruges en, skriver du den i Crossmints sikre formular.",
  },
  saved: {
    title: "Kort og adresser",
    cards:
      "Crossmint gemmer dine kort på din Menta-konto. Tilføj og administrer dem under {wallet}. Din assistent ser kun korttypen og de sidste 4 cifre.",
    addresses:
      "Dine leveringsadresser er gemt under {addresses}. Din assistent læser dem kun efter behov: navnet og byen for din standardadresse for at sige, hvor leveringer går hen, og resten, når du eller en butik beder om det.",
    signIn: "Begge sider kræver, at du logger ind på Menta.",
  },
  orders: {
    title: "Tjek eller annuller en ordre",
    text: "Spørg din assistent, hvordan et køb går, eller bed den annullere det. Alt, hvad Menta har købt til dig, fra enhver assistent, finder du under {transactions}.",
    store:
      "Ordrer står i dit navn hos butikken, så når ordren er afgivet, klarer du ændringer og returneringer med butikken.",
  },
  limits: {
    title: "Det kan Menta ikke",
    items: [
      "Nogle butikker blokerer automatiserede browsere, så der kan Menta ikke handle.",
      "Menta køber fysiske varer og afgiver ordrer i netbutikker, med levering eller klar til afhentning.",
      "Menta betaler kun med et kort, du har gemt, og kun inden for en forbrugsgrænse, du har godkendt.",
    ],
  },
  contact: {
    title: "Privatliv, vilkår og support",
    text: "Menta er lavet af Crossmint. Har du brug for hjælp, kan du skrive til {email} eller tagge {x} på X.",
  },
  legal: {
    terms: "Servicevilkår",
    privacy: "Privatlivspolitik",
    englishOnly: "Dette dokument findes kun på engelsk.",
    agree: "Ved at fortsætte accepterer du Mentas {terms} og {privacy}.",
    agreeTerms: "servicevilkår",
    agreePrivacy: "privatlivspolitik",
  },
} satisfies typeof en;
