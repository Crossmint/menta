import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "Paiement",
    shareTitle: "Connectez-vous en toute sécurité",
    description:
      "Saisissez ici les mots de passe et codes de la boutique, pas dans le chat. Votre assistant ne les voit jamais.",
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
  cancel: {
    ask: "Annuler cet achat",
  },
  done: {
    approved: "Approuvé",
    sent: "Envoyé",
    goBack: "Retournez sur {host} et dites que c'est fait.",
    goBackAssistant: "Retournez sur votre assistant et dites que c'est fait.",
    yourAssistant: "Votre assistant",
    placing: "L'achat est en train de passer votre commande.",
    sayDone:
      "{step} De retour sur {host}, dites que c'est fait pour connaître le résultat.",
    placingResult:
      "L'achat est en train de passer votre commande. {host} reçoit le résultat dès que la boutique la confirme.",
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
  dashboard: "Accéder à votre tableau de bord",
  missing: {
    title: "Achat introuvable",
    signedInAs: "Vous êtes connecté en tant que {email}. ",
    body: "Le lien est peut-être ancien, ou l'achat appartient à un autre compte. {switch}.",
    switch: "Changer de compte",
  },
  ended: {
    seeOrder: "Voir votre commande",
    placed: "Commande passée",
    doneNote: "Vous n'avez rien d'autre à faire.",
  },
  expired: {
    request: "Cette demande a expiré",
    approval: "Cette autorisation a expiré",
  },
  cancelled: {
    title: "Achat annulé",
    body: "Rien n'a été débité.",
    closeTab:
      "Vous pouvez maintenant fermer cet onglet et retourner sur {host}.",
    closeTabAny:
      "Vous pouvez maintenant fermer cet onglet et retourner à votre assistant.",
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
    needsInfo:
      "{menta} a besoin de quelques informations pour terminer la tâche sur {store}.",
    question: "Une petite question de {store}",
    section: "Saisie sécurisée pour la boutique",
    secretNote:
      "Cela part directement vers {store}. Votre assistant ne le voit jamais et ne le conserve pas.",
    secretNoteNamed:
      "Cela part directement vers {store}. {host} ne le voit jamais et ne le conserve pas.",
  },
  limit: {
    allow: "Autorisez {host} à utiliser votre carte selon vos conditions.",
    allowAny:
      "Autorisez votre assistant à utiliser votre carte selon vos conditions.",
    cardNote:
      "Votre carte reste chez Crossmint. Votre assistant ne la voit jamais.",
    cardNoteNamed:
      "Votre carte reste chez Crossmint. {host} ne la voit jamais.",
    title: "Configurez une limite de dépenses",
    setUp: "Configurer la limite de dépenses",
    lede: "Définissez combien votre assistant peut dépenser avec votre carte, pour cette commande et les suivantes. Révocable à tout moment.",
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
    cancel: "Annuler",
    cancelled: "Aucune limite de dépenses autorisée",
    cancelledLede:
      "Rien n'a été autorisé ni payé. Vous pouvez fermer cet onglet.",
  },
} satisfies typeof en;
