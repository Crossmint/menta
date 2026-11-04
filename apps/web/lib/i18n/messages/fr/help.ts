import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "Aide",
    description:
      "Comment ajouter Menta à votre assistant, comment se passe un achat et où trouver vos cartes, adresses et commandes.",
  },
  title: "Aide Menta",
  lede: "Menta est un plugin pour ChatGPT, Claude, Grok Bot et d'autres assistants. Dites à votre assistant quoi acheter, et Menta passe la commande pour vous sur des boutiques en ligne du monde entier, grâce à Crossmint Agent Checkouts.",
  install: {
    title: "Ajoutez Menta à votre assistant",
    lede: "Choisissez votre assistant. Quand il vous le demande, connectez-vous à Menta et autorisez l'accès.",
    server: "URL du serveur",
    listed:
      "Dès que Menta sera disponible dans {directory}, ajoutez-le depuis là. En attendant, ajoutez-le vous-même :",
    chatgptDirectory: "l'annuaire de plugins de ChatGPT",
    claudeDirectory: "l'annuaire de connecteurs de Claude",
    grokBot:
      "Dès que Menta sera dans le Marketplace de Grok Bot, ouvrez le Marketplace, ajoutez Menta et connectez-vous.",
    signIn: "connectez-vous à Menta et autorisez l'accès.",
    otherApp: "Autre app",
    example:
      "Achète un lot de 4 piles AA sur Amazon, moins de 15 €, livré à la maison.",
    apps: {
      chatgpt: [
        "Ouvrez {plugins} et choisissez {add}. Introuvable ? Activez d'abord le mode développeur dans les réglages.",
        "Nommez-le Menta, collez l'URL et choisissez {oauth}.",
        "Choisissez {create}, puis {signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "Ouvrez {connectors} et choisissez {add}.",
        "Nommez-le Menta et collez l'URL telle quelle, sans barre oblique finale.",
        "Gardez la connexion détectée par Claude, choisissez {confirm}, puis {signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "Trouvez où votre app ajoute des serveurs MCP ou des connecteurs (souvent appelés connecteurs personnalisés ou intégrations).",
        "Ajoutez un serveur HTTP distant avec l'URL ci-dessus. La connexion passe par OAuth : laissez vide tout champ de clé API.",
        "Quand on vous le demande, {signIn}",
      ],
    },
  },
  purchase: {
    title: "Comment se passe un achat",
    steps: [
      {
        title: "Dites quoi acheter",
        text: "Dites à votre assistant ce que vous voulez et où, par exemple : « {example} »",
      },
      {
        title: "Menta passe commande",
        text: "Menta lance la commande sur la boutique et vous montre où elle en est.",
      },
      {
        title: "Répondez à la boutique",
        text: "Si la boutique a besoin d'une information, comme une taille ou un créneau de livraison, votre assistant vous la demande et vous répondez.",
      },
      {
        title: "Autorisez une limite de dépenses",
        text: "Quand la boutique est prête à débiter, Menta paie avec une limite de dépenses que vous avez autorisée, si l'une d'elles couvre le montant. Sinon, vous en autorisez une vous-même dans le formulaire sécurisé de Crossmint, dans votre assistant ou sur une page Menta. Rien n'est payé au-delà de vos limites.",
      },
    ],
    never:
      "Votre assistant ne peut jamais autoriser ni relever une limite de dépenses. Les numéros de carte, codes de vérification et mots de passe ne passent jamais par le chat : quand il en faut un, vous le saisissez dans le formulaire sécurisé de Crossmint.",
  },
  saved: {
    title: "Cartes et adresses",
    cards:
      "Vos cartes sont enregistrées sur votre compte Menta par Crossmint. Ajoutez-les et gérez-les dans {wallet}. Votre assistant ne voit que la marque de la carte et ses 4 derniers chiffres.",
    addresses:
      "Vos adresses de livraison sont enregistrées dans {addresses}. Votre assistant ne les consulte qu'en cas de besoin : le nom et la ville de votre adresse par défaut pour dire où arrivent les livraisons, et le reste quand vous ou une boutique le demandez.",
    signIn: "Ces deux pages vous demandent de vous connecter à Menta.",
  },
  orders: {
    title: "Suivre ou annuler une commande",
    text: "Demandez à votre assistant où en est une commande, ou demandez-lui de l'annuler. Tout ce que Menta a acheté pour vous, depuis n'importe quel assistant, se trouve dans {transactions}.",
    store:
      "Les commandes sont à votre nom auprès de la boutique : une fois la commande passée, les modifications et les retours se font avec la boutique.",
  },
  limits: {
    title: "Ce que Menta ne peut pas faire",
    items: [
      "Certaines boutiques bloquent les navigateurs automatisés : Menta ne peut pas y passer commande.",
      "Menta achète des produits physiques et passe des commandes sur des boutiques en ligne, livrées chez vous ou à retirer.",
      "Menta ne paie qu'avec une carte que vous avez enregistrée, et seulement dans la limite de dépenses que vous avez autorisée.",
    ],
  },
  contact: {
    title: "Confidentialité, conditions et assistance",
    text: "Menta est conçu par Crossmint. Pour obtenir de l'aide, écrivez à {email} ou mentionnez {x} sur X.",
  },
  legal: {
    terms: "Conditions d'utilisation",
    privacy: "Politique de confidentialité",
    englishOnly: "Ce document n'est disponible qu'en anglais.",
    agree: "En continuant, vous acceptez les {terms} et la {privacy} de Menta.",
    agreeTerms: "conditions d'utilisation",
    agreePrivacy: "politique de confidentialité",
  },
} satisfies typeof en;
