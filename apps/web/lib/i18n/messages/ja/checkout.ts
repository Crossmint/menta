import type en from "../en/checkout";

/** The secure checkout page, where people approve what an assistant started. */
export default {
  preview: {
    title: "購入手続き",
    shareTitle: "安全にログイン",
    description:
      "ストアのパスワードやコードは、チャットではなくここに入力してください。アシスタントがそれを見ることはありません。",
  },
  titles: {
    payment: "支払いを承認",
    store: "お店から対応のお願い",
    working: "購入手続き中",
    done: "注文完了",
    stopped: "購入手続きが停止しました",
    expired: "リクエストの期限切れ",
    cancelled: "購入手続きをキャンセルしました",
    approved: "承認しました",
    sent: "送信しました",
    missing: "購入手続きが見つかりません",
  },
  returnTo: "{host}に戻る",
  returnToSentence: "{host}に戻ってください。",
  cancel: {
    ask: "この購入手続きをキャンセル",
  },
  done: {
    approved: "承認しました",
    sent: "送信しました",
    goBack: "{host}に戻って、終わったと伝えてください。",
    goBackAssistant: "アシスタントに戻って、終わったと伝えてください。",
    yourAssistant: "アシスタント",
    placing: "ただいま注文を確定しています。",
    sayDone: "{step}{host}に戻って「完了」と伝えると、結果がわかります。",
    placingResult:
      "ただいま注文を確定しています。お店で確定されると、{host}に結果が届きます。",
    paidUpTo: "支払い上限",
    item: "商品",
    store: "お店",
  },
  watching: {
    title: "購入手続き中",
    upTo: "上限{amount}",
    noLiveView: "購入手続き用のブラウザが開くと、ライブ画面が表示されます。",
    watchOnly: "画面は見られますが、中をクリックすることはできません。",
  },
  loading: "購入手続きを読み込み中",
  unavailable: {
    title: "購入手続きを読み込めませんでした",
    body: "接続を確認してください。",
    retry: "もう一度試す",
  },
  dashboard: "ホームに移動",
  missing: {
    title: "この購入手続きが見つかりません",
    signedInAs: "{email}でログインしています。",
    body: "リンクが古いか、別のアカウントの購入手続きの可能性があります。{switch}ことができます。",
    switch: "アカウントを切り替える",
  },
  ended: {
    seeOrder: "注文を見る",
    placed: "注文完了",
    doneNote: "これ以上の操作は必要ありません。",
  },
  expired: {
    request: "このリクエストは期限切れです",
    approval: "この承認は期限切れです",
  },
  cancelled: {
    title: "購入手続きをキャンセルしました",
    body: "請求は発生していません。",
    closeTab: "このタブを閉じて、{host}に戻ってください。",
    closeTabAny: "このタブを閉じて、アシスタントに戻ってください。",
  },
  payment: {
    needsYou: "{store}から対応のお願い",
    title: "支払いを承認してください",
    over: "上限{limit}を{over}超えています",
    within: "上限{limit}の範囲内",
    limit: "上限{limit}",
    section: "安全な支払い承認",
  },
  store: {
    needsInfo:
      "{store}での手続きを完了するために、{menta}にいくつかの情報が必要です。",
    question: "{store}からの簡単な質問",
    section: "お店への安全な入力",
    secretNote:
      "{store}に直接送られます。アシスタントが見ることも、保存することもありません。",
    secretNoteNamed:
      "{store}に直接送られます。{host}が見ることも保存することもありません。",
  },
  limit: {
    allow: "あなたが決めた条件で、{host}にカードの利用を許可します。",
    allowAny: "あなたが決めた条件で、アシスタントにカードの利用を許可します。",
    cardNote:
      "カードはCrossmintに保管されます。アシスタントがカードを見ることはありません。",
    cardNoteNamed:
      "カードはCrossmintに保管されます。{host}がカードを見ることはありません。",
    title: "利用上限を設定する",
    setUp: "利用上限を設定",
    lede: "この注文と今後の注文で、アシスタントがあなたのカードで使える金額を設定します。いつでも取り消せます。",
    amount: "金額",
    name: "用途",
    anyStore: "すべてのストア",
    worksFor: "利用先",
    storeTitle: "ストアを限定",
    website: "ウェブサイト",
    save: "保存",
    onlyAt: "{store}でのみ",
    expires: "期限",
    card: "カード",
    approved: "利用上限を承認しました",
    approvedLede: "{name}：{amount}、{date}まで。",
    paying: "この上限で{store}に支払い中です。",
    invalidAmount: "金額を入力してください（例：50）。",
    invalidName: "用途を入力してください（例：食料品）。",
    missing: "このリクエストは利用できません",
    missingLede:
      "期限切れか、別のアカウント向けに作成されたものです。アシスタントに新しいリクエストを頼んでください。",
    cancel: "キャンセル",
    cancelled: "利用上限は承認されていません",
    cancelledLede:
      "承認も支払いも行われていません。このタブは閉じて構いません。",
  },
} satisfies typeof en;
