import type { UiMessages } from "./en.js";

export const fr: UiMessages = {
  common: {
    yes: "Oui",
    no: "Non",
    tryAgain: "Réessayer",
    cancel: "Annuler",
    poweredBy: "Propulsé par {logo}",
    quoted: "« {text} »",
  },
  status: {
    starting: "Démarrage",
    working: "En cours",
    readyToPay: "Prêt à payer",
    needsAnswer: "Attend votre réponse",
    needsSecureStep: "Étape sécurisée requise",
    storeQuestion: "Question de la boutique",
    needsYou: "Action requise",
    orderPlaced: "Commande passée",
    couldntBuy: "Achat impossible",
    couldntBuyBecause: "Achat impossible · {reason}",
    blocked: "Bloqué",
    notConfirmed: "Non confirmé",
    stopped: "Arrêté",
    canceled: "Annulé",
    done: "Terminé",
    cancelingWaiting: "Annulation · en attente de la boutique",
    approvedWaiting: "Approuvé · en attente de la boutique",
    sentWaiting: "Envoyé · en attente de la boutique",
  },
  blocked: {
    "merchant.access_blocked": "La boutique a bloqué l'accès",
    "merchant.checkout_error": "Erreur de paiement sur la boutique",
    "merchant.fulfillment_unavailable": "Pas de livraison à cette adresse",
    "merchant.human_verification_required":
      "La boutique exige une vérification humaine",
    "merchant.no_safe_path": "Aucun moyen sûr de payer",
    "merchant.payment_declined": "Paiement refusé",
    "policy.max_cost_exceeded": "Au-delà de votre limite",
    "product.item_unavailable": "Article indisponible",
    "product.requested_option_unavailable": "Option indisponible",
  },
  failures: {
    browser_session_lost: "La connexion à la boutique a été perdue.",
    browser_location_unsupported:
      "La boutique n'est pas accessible depuis notre emplacement.",
    cost_limit: "Le total aurait dépassé votre limite.",
    input_expired:
      "La demande de la boutique a expiré avant d'obtenir une réponse.",
    model_error: "L'agent d'achat a rencontré un problème.",
    runtime_error: "L'achat s'est arrêté avant la fin.",
    accounting_unavailable:
      "Crossmint n'a pas pu confirmer l'état du paiement.",
    cancelled: "L'achat a été annulé.",
    reconciliation_required:
      "Impossible de savoir si la boutique a passé cette commande. Ne la refaites pas tout de suite : vous pourriez être débité deux fois.",
    other: "L'achat s'est arrêté avant la fin.",
  },
  outcome: {
    receipt: "Commande confirmée par la boutique. Reçu enregistré.",
    noReceipt:
      "La boutique a confirmé la commande. Aucun reçu n'a été enregistré : cherchez la confirmation de la boutique dans vos e-mails.",
    total: "Total",
    order: "Commande {id}",
    deliveringTo: "Livraison à {label} · {place}",
  },
  progress: {
    stillWorking: "Toujours en cours…",
  },
  settled: {
    answered: "Répondu",
    approved: "Approuvé",
    sentSecurely: "Envoyé en toute sécurité",
    doneThen: "{done} · {outcome}",
    shownAbove: "Affiché plus haut",
    waitingBelow: "Vous attend plus bas",
    started: "Achat lancé · jusqu'à {amount}",
    showItHere: "Afficher ici",
  },
  form: {
    choosePlaceholder: "Choisir…",
    showMore: "Afficher plus",
    showLess: "Afficher moins",
    somethingElse: "Autre chose",
    somethingElsePlaceholder:
      "Dites à la boutique ce que vous voulez à la place",
    backToOptions: "Retour aux options",
    sentWaiting: "Envoyé. En attente de la boutique.",
    answerInChat: "Répondez dans le chat.",
    choose: "Choisir {name}",
    sending: "Envoi…",
    send: "Envoyer",
    sendSecurely: "Envoyer en sécurité",
    secretNote: "Va directement à la boutique. Je ne le vois jamais.",
    secretNoteAssistant:
      "Va directement à la boutique. Votre assistant ne le voit jamais.",
    expiresIn: "expire dans {time}",
    expiresAt: "valable jusqu'à {time}",
    expiringNow: "expire maintenant",
  },
  payment: {
    exactTo: "Montant exact pour {merchant}",
    upToTo: "Jusqu'à ce montant pour {merchant}",
    deliveryTo: "Livraison à {label} · {place}",
    approvedWaiting: "Approuvé. En attente de la boutique.",
    sending: "Envoi de votre approbation à la boutique…",
    securedNote:
      "Sécurisé par Crossmint. Rien n'est débité avant votre approbation.",
    setUpLimit: "Créer une limite de dépenses",
    lede: "Définissez combien votre assistant peut dépenser avec votre carte, pour cette commande et les suivantes. Révocable à tout moment.",
  },
  approval: {
    payWith: "Payer avec",
    chooseCard: "Choisir une carte",
    addCard: "Ajouter une carte",
    saveCard: "Enregistrer la carte",
    savingCard: "Enregistrement…",
    securityCode: "Code de sécurité",
    cvcFront: "Saisissez le code à 4 chiffres au recto de votre carte.",
    cvcBack: "Saisissez le code à 3 chiffres au verso de votre carte.",
    cvcNote:
      "Crossmint conserve ce code. La boutique et votre assistant ne le voient jamais.",
    useDifferentCard: "Utiliser une autre carte",
    cardsDidntLoad: "Vos cartes enregistrées ne se sont pas chargées.",
    orAddHere: "ou ajoutez-en une ici.",
    addHereOrMenta: "Ajoutez-en une ici, ou approuvez sur Menta.",
    approve: "Approuver {amount}",
    approving: "Approbation…",
    waitingCheck: "En attente de la vérification de votre carte…",
    confirming: "Confirmation avec votre carte…",
    approved: "Approuvé",
    expires: "Expire {date}",
    noRail:
      "Cette carte ne peut pas encore servir aux paiements d'agents. Essayez une autre carte.",
    visaRefused:
      "Visa n'a pas accepté cette boutique pour les paiements d'agents. Essayez une autre carte.",
    mastercardRefused:
      "Mastercard n'a pas accepté cette boutique pour les paiements d'agents. Essayez une autre carte.",
    expired:
      "Cette approbation a expiré. Demandez à votre assistant de réessayer.",
    create: "Impossible de lancer le paiement avec cette carte. Réessayez.",
    register:
      "Impossible de configurer cette carte pour les paiements d'agents. Réessayez.",
    check:
      "La vérification de la carte n'a pas abouti. Réessayez ou utilisez une autre carte.",
    slow: "Votre carte n'a pas encore confirmé. Réessayez dans un instant.",
    notRevoked:
      "Impossible d'annuler cette limite de dépenses. Révoquez-la dans Limites de dépenses sur Menta.",
  },
  secure: {
    signInTitle: "Connectez-vous à {store}",
    signInLine:
      "{store} vous demande de vous connecter pour poursuivre la commande.",
    newPasswordTitle: "Créez votre mot de passe {store}",
    codeTitle: "Saisissez le code envoyé par {store}",
    codeLine: "Consultez vos e-mails ou votre téléphone.",
    detailsTitle: "{store} a besoin de quelques informations privées",
    fillOnMenta: "Remplir sur Menta",
    fillOnMentaNote:
      "Saisissez-le en toute sécurité sur Menta. Il va directement à la boutique, et votre assistant ne le voit jamais.",
    loading: "Chargement du formulaire sécurisé de Crossmint…",
    notReady: "Le champ sécurisé n'est pas prêt.",
  },
  header: {
    more: "autres",
    moreLabel: "Afficher l'achat suivant ({count} de plus)",
    watchLive: "Regarder en direct",
    watching: "En direct",
    closeLiveView: "Fermer la vue en direct",
    cancelCheckout: "Annuler l'achat",
  },
  card: {
    noCheckout: "Aucun achat",
    waiting: "En attente de l'achat…",
    connecting: "Connexion à l'app…",
    onlyInHosts: "Cet affichage montre les achats dans ChatGPT ou Claude.",
    nothingToShow:
      "Aucun achat à afficher ici. Demandez où il en est dans le chat.",
    whichAddress: "À quelle adresse l'envoyer ? Répondez dans le chat.",
    whereTo: "Où l'envoyer ? Répondez dans le chat.",
    didntStart: "Pas démarré : {reason}",
    cantShow:
      "Menta n'a pas pu afficher cet achat ici. Demandez où il en est dans le chat.",
    cantRefresh: "Actualisation impossible pour le moment. Nouvelle tentative.",
    couldntSend: "Envoi impossible. Réessayez, ou répondez dans le chat.",
    answerFailed:
      "Cette réponse n'est pas passée. Voici l'état le plus récent.",
    somethingWrong: "Une erreur s'est produite. Réessayez.",
    pausedUpdates: "Mises à jour en pause.",
    checkAgain: "Vérifier à nouveau",
    backToChat: "Retour au chat",
    backInChat: "De retour dans le chat",
  },
};
