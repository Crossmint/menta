import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "Connexion",
    heading: "Se connecter à Menta",
    lede: "Nouveau ici ? La connexion crée votre compte.",
    arrivals: {
      checkout: {
        kicker: "Un achat a besoin de vous",
        title: "Connectez-vous pour continuer",
        lede: "Votre assistant vous a envoyé ici pour une étape. Vous verrez les détails après vous être connecté avec le compte qui a lancé l'achat.",
        footer:
          "N'approuvez des paiements que sur Menta. Ne saisissez jamais vos données de carte dans un chat.",
      },
      connect: {
        kicker: "Un assistant veut se connecter",
        title: "Connectez-vous pour l'autoriser",
        lede: "Connectez-vous, puis choisissez si votre assistant peut faire des achats avec Menta.",
        ledeNamed:
          "Connectez-vous, puis choisissez si {name} peut faire des achats avec Menta.",
        footer:
          "Vous autorisez chaque limite de dépenses ici, jamais dans le chat de l'assistant.",
      },
    },
    googleFailed:
      "La connexion avec Google n'a pas abouti. Veuillez réessayer.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
    sendFailed: "Impossible d'envoyer un code. Veuillez réessayer.",
    codeFailed:
      "Ce code n'a pas fonctionné. Réessayez ou demandez-en un nouveau.",
    checkEmail: "Consultez vos e-mails",
    codeSent: "Saisissez le code envoyé à {email}.",
    google: "Continuer avec Google",
    continueEmail: "Continuer avec l'e-mail",
    or: "ou",
    email: "E-mail",
    code: "Code",
    emailPlaceholder: "Votre e-mail",
    openInbox: "Ouvrir {provider}",
    sendCode: "Envoyer le code",
    signIn: "Se connecter",
    differentEmail: "Utiliser une autre adresse",
    resend: "Envoyer un nouveau code",
    resendIn: "Nouveau code dans {seconds} s",
    codeResent: "Nous avons envoyé un nouveau code à {email}.",
    password: "Mot de passe",
    passwordFailed: "Ce mot de passe n'a pas fonctionné. Réessayez.",
  },
  authorize: {
    title: "Autoriser l'accès",
    can: [
      "Lancer des achats jusqu'à la limite que vous fixez",
      "Voir le statut et les reçus",
      "Annuler un achat à votre demande",
    ],
    cannot: [
      "Approuver des paiements",
      "Voir les numéros de carte ou les codes",
      "Modifier vos cartes",
    ],
    offline: "Impossible de joindre Menta. Vérifiez votre connexion.",
    failed: "Un problème est survenu. Réessayez depuis votre assistant.",
    cantConnect: "Connexion impossible pour le moment",
    returning: "Retour à votre assistant…",
    checking: "Vérification de la demande…",
    thisAssistant: "Cet assistant",
    heading: "Autoriser {name} à utiliser Menta ?",
    signedInAs: "Connecté en tant que {email} · ",
    notYou: "Ce n'est pas vous ?",
    itCan: "Il peut",
    itCant: "Il ne peut pas",
    ungrantable:
      "Votre compte ne peut pas accorder {scopes} : {name} risque de ne pas fonctionner entièrement.",
    cancel: "Annuler",
    allow: "Autoriser",
    returnsTo:
      "Vous retournerez sur {returnsTo}. Vous pouvez le déconnecter à tout moment dans {connections}.",
    connections: "Connexions",
  },
  notFound: {
    title: "Page introuvable",
    lede: "Cette page n'existe pas ou a été déplacée.",
    home: "Aller sur Menta",
  },
  codeEmail: {
    subject: "Votre code de connexion Menta",
    heading: "Votre code de connexion",
    enter: "Saisissez ce code sur Menta pour vous connecter.",
    label: "Code de vérification",
    expires: "Il expire dans {minutes} minutes.",
    share: "Ne le partagez avec personne, pas même avec votre assistant.",
    ignore:
      "Vous n'avez pas essayé de vous connecter ? Vous pouvez ignorer cet e-mail.",
  },
} satisfies typeof en;
