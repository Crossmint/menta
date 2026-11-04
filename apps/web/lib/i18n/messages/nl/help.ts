import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Help",
    description:
      "Zo voeg je Menta toe aan je assistent, zo werkt een aankoop, en hier vind je je kaarten, adressen en bestellingen.",
  },
  title: "Hulp bij Menta",
  lede: "Menta is een plugin voor ChatGPT, Claude, Grok Bot en andere assistenten. Vertel je assistent wat je wilt kopen, en Menta rekent voor je af bij webwinkels wereldwijd, via Crossmint Agent Checkouts.",
  install: {
    title: "Voeg Menta toe aan je assistent",
    lede: "Kies je assistent. Log in bij Menta en geef toegang wanneer daarom wordt gevraagd.",
    server: "Server-URL",
    listed:
      "Zodra Menta in {directory} staat, voeg je het daar toe. Tot die tijd voeg je het zelf toe:",
    chatgptDirectory: "de plugindirectory van ChatGPT",
    claudeDirectory: "de connectordirectory van Claude",
    grokBot:
      "Zodra Menta in de Marketplace van Grok Bot staat, open je de Marketplace, voeg je Menta toe en log je in.",
    signIn: "log in bij Menta en geef toegang.",
    otherApp: "Andere app",
    example:
      "Koop een 4-pack AA-batterijen op Amazon, onder € 15, thuisbezorgd.",
    apps: {
      chatgpt: [
        "Open {plugins} en kies {add}. Staat het er niet? Zet eerst de ontwikkelaarsmodus aan in Instellingen.",
        "Noem hem Menta, plak de URL en kies {oauth}.",
        "Kies {create}. Daarna: {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Open {connectors} en kies {add}.",
        "Noem hem Menta en plak de URL precies zo, zonder slash aan het eind.",
        "Houd de inlogmethode die Claude herkent en kies {confirm}. Daarna: {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Zoek waar je app MCP-servers of connectors toevoegt (vaak aangepaste connectors of integraties genoemd).",
        "Voeg een externe HTTP-server toe met de URL hierboven. Inloggen gaat via OAuth, dus laat een veld voor een API-sleutel leeg.",
        "Als daarom gevraagd wordt: {signIn}",
      ],
    },
  },
  purchase: {
    title: "Zo werkt een aankoop",
    steps: [
      {
        title: "Zeg wat je wilt kopen",
        text: "Vertel je assistent wat je wilt en waar, bijvoorbeeld: ‘{example}’",
      },
      {
        title: "Menta rekent af",
        text: "Menta start het afrekenen bij de winkel en laat je zien hoe het gaat.",
      },
      {
        title: "Beantwoord de winkel",
        text: "Als de winkel iets van je nodig heeft, zoals een maat of een levertijd, vraagt je assistent erom en antwoord jij.",
      },
      {
        title: "Keur een bestedingslimiet goed",
        text: "Als de winkel klaar is om af te schrijven, betaalt Menta met een bestedingslimiet die je hebt goedgekeurd, als er een is die het bedrag dekt. Is die er niet, dan keur je er zelf een goed in het beveiligde formulier van Crossmint, in je assistent of op een Menta-pagina. Er wordt niets betaald buiten je limieten.",
      },
    ],
    never:
      "Je assistent kan nooit een bestedingslimiet goedkeuren of verhogen. Kaartnummers, verificatiecodes en wachtwoorden gaan nooit via de chat: als er een nodig is, typ je die in het beveiligde formulier van Crossmint.",
  },
  saved: {
    title: "Kaarten en adressen",
    cards:
      "Crossmint bewaart je kaarten in je Menta-account. Voeg ze toe en beheer ze in {wallet}. Je assistent ziet alleen het merk en de laatste 4 cijfers van een kaart.",
    addresses:
      "Je bezorgadressen staan in {addresses}. Je assistent leest ze alleen als dat nodig is: de naam en plaats van je standaardadres om te zeggen waar bezorgingen heen gaan, en de rest als jij of een winkel erom vraagt.",
    signIn: "Voor beide pagina's log je in bij Menta.",
  },
  orders: {
    title: "Een bestelling bekijken of annuleren",
    text: "Vraag je assistent hoe het afrekenen gaat, of vraag hem het te annuleren. Alles wat Menta voor je heeft gekocht, via elke assistent, staat in {transactions}.",
    store:
      "Bestellingen staan bij de winkel op jouw naam, dus na het plaatsen regel je wijzigingen en retouren met de winkel.",
  },
  limits: {
    title: "Wat Menta niet kan",
    items: [
      "Sommige winkels blokkeren geautomatiseerde browsers, dus daar kan Menta niet afrekenen.",
      "Menta koopt fysieke producten en plaatst bestellingen bij webwinkels, bezorgd of klaar om op te halen.",
      "Menta betaalt alleen met een kaart die je hebt bewaard, en alleen binnen een bestedingslimiet die je hebt goedgekeurd.",
    ],
  },
  contact: {
    title: "Privacy, voorwaarden en support",
    text: "Menta is gemaakt door Crossmint. Hulp nodig? Mail naar {email} of tag {x} op X.",
  },
  legal: {
    terms: "Servicevoorwaarden",
    privacy: "Privacybeleid",
    englishOnly: "Dit document is alleen in het Engels beschikbaar.",
    agree:
      "Door verder te gaan, ga je akkoord met de {terms} en het {privacy} van Menta.",
    agreeTerms: "servicevoorwaarden",
    agreePrivacy: "privacybeleid",
  },
} satisfies typeof en;
