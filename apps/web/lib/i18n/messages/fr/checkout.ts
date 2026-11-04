import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Paiement",
    shareTitle: "Approuvez votre achat · {brand}",
    description:
      "Connectez-vous à Menta pour terminer cette étape. Seul vous pouvez autoriser une limite de dépenses ; votre assistant ne voit jamais votre carte.",
  },
  titles: {
    payment: "Approuver le paiement",
    store: "La boutique a besoin de vous",
    working: "Achat en direct",
    done: "Commande passée",
    stopped: "Achat arrêté",
    expired: "Demande expirée",
    cancelled: "Achat annulé",
    approved: "Approuvé",
    sent: "Envoyé",
    missing: "Achat introuvable",
  },
  returnTo: "Retour à {host}",
  returnToSentence: "Retournez sur {host}.",
  from: "Depuis {host}",
  cancel: {
    confirm: "Annuler l'achat ? Rien n'a été débité.",
    keep: "Garder",
    cancel: "Annuler l'achat",
    ask: "Annuler cet achat",
  },
  done: {
    approved: "Approuvé",
    sent: "Envoyé",
    yourAssistant: "Votre assistant",
    placing: "L'achat est en train de passer votre commande.",
    continuing: "L'achat se poursuit avec votre réponse.",
    sayDone:
      "{step} De retour sur {host}, dites que c'est fait pour connaître le résultat.",
    placingResult:
      "L'achat est en train de passer votre commande. {host} reçoit le résultat dès que la boutique la confirme.",
    continuingResult:
      "L'achat se poursuit avec votre réponse. {host} reçoit le résultat dès que la boutique confirme la commande.",
    paidUpTo: "Payé jusqu'à",
    item: "Article",
    store: "Boutique",
  },
  watching: {
    title: "Achat en direct",
    upTo: "Jusqu'à {amount}",
    noLiveView:
      "La vue en direct apparaît dès que le navigateur de l'achat s'ouvre.",
    watchOnly: "Vous pouvez regarder, mais pas cliquer à l'intérieur.",
  },
  loading: "Chargement de l'achat",
  unavailable: {
    title: "Cet achat ne s'est pas chargé",
    body: "Vérifiez votre connexion.",
    retry: "Réessayer",
  },
  missing: {
    title: "Achat introuvable",
    signedInAs: "Vous êtes connecté en tant que {email}. ",
    body: "Le lien est peut-être ancien, ou l'achat appartient à un autre compte. {switch} ou {home}.",
    switch: "Changer de compte",
    home: "accéder à votre tableau de bord",
  },
  ended: {
    placed: "Commande passée",
    finished: "Achat terminé",
    unconfirmed: "Pas encore confirmé",
    stopped: "Cet achat s'est arrêté",
    doneNote: "Vous n'avez rien d'autre à faire.",
    unconfirmedNote:
      "Attendez l'e-mail de la boutique avant de l'acheter à nouveau.",
    stoppedNote: "Rien n'a été débité. Demandez à {host} de réessayer.",
    yourAssistant: "votre assistant",
  },
  expired: {
    request: "Cette demande a expiré",
    approval: "Cette autorisation a expiré",
    body: "Demandez à votre assistant de réessayer ; il en lancera une nouvelle.",
  },
  cancelled: {
    title: "Achat annulé",
    body: "Rien n'a été débité.",
  },
  payment: {
    needsYou: "{store} a besoin de vous",
    title: "Approuvez le paiement",
    over: "Dépasse votre limite de {limit} de {over}",
    within: "Dans votre limite de {limit}",
    limit: "Votre limite : {limit}",
    section: "Approbation sécurisée du paiement",
  },
  store: {
    private: "Vous seul pouvez saisir ceci",
    question: "Une petite question de {store}",
    section: "Saisie sécurisée pour la boutique",
    secretNote:
      "Cela part directement vers {store}. Votre assistant ne le voit jamais et ne le conserve pas.",
    secretNoteNamed:
      "Cela part directement vers {store}. {host} ne le voit jamais et ne le conserve pas.",
  },
  limit: {
    cardNote:
      "Votre carte reste chez Crossmint. Votre assistant ne la voit jamais.",
    cardNoteNamed:
      "Votre carte reste chez Crossmint. {host} ne la voit jamais.",
    title: "Configurez une limite de dépenses",
    setUp: "Configurer la limite de dépenses",
    lede: "Définissez combien votre assistant peut dépenser avec votre carte, pour cette commande et les suivantes. Révocable à tout moment.",
    ledeNamed:
      "Définissez combien {host} peut dépenser avec votre carte, pour cette commande et les suivantes. Révocable à tout moment.",
    amount: "Montant",
    name: "Objet",
    anyStore: "Toute boutique",
    worksFor: "Valable pour",
    storeTitle: "Limiter à une boutique",
    website: "Site web",
    save: "Enregistrer",
    onlyAt: "Uniquement chez {store}",
    expires: "Expire dans",
    card: "Carte",
    approved: "Limite de dépenses autorisée",
    approvedLede: "{name} : {amount}, jusqu'au {date}.",
    paying: "Paiement de {store} avec elle en cours.",
    invalidAmount: "Saisissez un montant, comme 50.",
    invalidName: "Indiquez son objet, comme Courses.",
    missing: "Cette demande n'est plus disponible",
    missingLede:
      "Elle a expiré ou a été faite pour un autre compte. Demandez-en une nouvelle à votre assistant.",
    yourLimits: "Voir vos limites de dépenses",
    cancel: "Annuler",
    cancelled: "Aucune limite de dépenses autorisée",
    cancelledLede:
      "Rien n'a été autorisé ni payé. Vous pouvez fermer cet onglet.",
  },
} satisfies typeof en;
