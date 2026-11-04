import type en from "../en/auth";

/** Signing in, letting an assistant connect (OAuth consent) and the 404 page. */
export default {
  login: {
    title: "ログイン",
    heading: "Mentaにサインイン",
    lede: "はじめての方も、サインインするとアカウントが作成されます。",
    arrivals: {
      checkout: {
        kicker: "購入手続きにあなたの対応が必要です",
        title: "ログインして続ける",
        lede: "アシスタントから、ひとつの手続きのためにこのページへ案内されました。手続きを始めたアカウントでログインすると、詳細が表示されます。",
        footer:
          "支払いの承認はMentaでのみ行ってください。チャットにカード情報を入力しないでください。",
      },
      connect: {
        kicker: "アシスタントが接続を求めています",
        title: "ログインして接続",
        lede: "ログインしてから、アシスタントにMentaでの買い物を許可するか選んでください。",
        ledeNamed:
          "ログインしてから、{name}にMentaでの買い物を許可するか選んでください。",
        footer:
          "利用上限の承認はすべてここで行います。アシスタントのチャットで承認することはありません。",
      },
    },
    googleFailed:
      "Googleでのログインが完了しませんでした。もう一度お試しください。",
    invalidEmail: "有効なメールアドレスを入力してください。",
    sendFailed: "コードを送信できませんでした。もう一度お試しください。",
    codeFailed:
      "このコードは使えませんでした。もう一度試すか、新しいコードをリクエストしてください。",
    checkEmail: "メールを確認してください",
    codeSent: "{email}に送信したコードを入力してください。",
    google: "Googleで続ける",
    continueEmail: "メールで続ける",
    or: "または",
    email: "メールアドレス",
    code: "コード",
    emailPlaceholder: "メールアドレス",
    openInbox: "{provider}を開く",
    sendCode: "コードを送信",
    signIn: "ログイン",
    differentEmail: "別のメールアドレスを使う",
    resend: "新しいコードを送信",
    resendIn: "{seconds}秒後に再送信できます",
    codeResent: "{email}に新しいコードを送信しました。",
  },
  authorize: {
    title: "アクセスを許可",
    can: [
      "あなたが決めた上限まで購入手続きを開始する",
      "ステータスと領収書を確認する",
      "あなたの依頼で購入手続きをキャンセルする",
    ],
    cannot: [
      "支払いを承認する",
      "カード番号やコードを見る",
      "カードを変更する",
    ],
    offline: "Mentaに接続できませんでした。接続を確認してください。",
    failed: "問題が発生しました。アシスタントからもう一度お試しください。",
    cantConnect: "現在接続できません",
    returning: "アシスタントに戻っています…",
    checking: "リクエストを確認しています…",
    thisAssistant: "このアシスタント",
    heading: "{name}にMentaの利用を許可しますか？",
    signedInAs: "{email}でログイン中 · ",
    notYou: "別のアカウントですか？",
    itCan: "できること",
    itCant: "できないこと",
    ungrantable:
      "このアカウントでは{scopes}を許可できないため、{name}が一部動作しない可能性があります。",
    cancel: "キャンセル",
    allow: "許可",
    returnsTo:
      "{returnsTo}に戻ります。接続は{connections}ページからいつでも解除できます。",
    connections: "接続",
  },
  notFound: {
    title: "ページが見つかりません",
    lede: "このページは存在しないか、移動しました。",
    home: "Mentaへ",
  },
  codeEmail: {
    subject: "Mentaのサインインコード",
    heading: "サインインコード",
    enter: "Mentaでこのコードを入力してサインインしてください。",
    label: "確認コード",
    expires: "有効期限は{minutes}分です。",
    share: "このコードは誰にも、アシスタントにも教えないでください。",
    ignore:
      "サインインしようとしていない場合は、このメールを無視してください。",
  },
} satisfies typeof en;
