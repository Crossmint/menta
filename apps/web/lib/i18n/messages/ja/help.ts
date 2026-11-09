import type en from "../en/help";

/** The public help page (/help), the documentation the assistant directories link to. */
export default {
  meta: {
    title: "ヘルプ",
    description:
      "Mentaをアシスタントに追加する方法、購入の流れ、カード・住所・注文の確認場所をご案内します。",
  },
  title: "Mentaヘルプ",
  lede: "Mentaは、ChatGPT、Claude、Grok Botなどのアシスタント向けのプラグインです。買いたいものをアシスタントに伝えると、MentaがCrossmint Agent Checkoutsを使って、世界中のオンラインストアで購入手続きを進めます。",
  install: {
    title: "Mentaをアシスタントに追加する",
    lede: "使っているアシスタントを選んでください。求められたら、Mentaにログインしてアクセスを許可します。",
    server: "サーバーURL",
    listed:
      "Mentaが{directory}に掲載されたら、そこから追加できます。それまでは、ご自身で追加してください：",
    chatgptDirectory: "ChatGPTのプラグインディレクトリ",
    claudeDirectory: "Claudeのコネクタディレクトリ",
    grokBot:
      "MentaがGrok BotのMarketplaceに掲載されたら、Marketplaceを開いてMentaを追加し、ログインします。",
    signIn: "Mentaにログインしてアクセスを許可します。",
    otherApp: "その他のアプリ",
    example: "Amazonで単3電池の4本パックを2,000円以内で買って、自宅に届けて",
    apps: {
      chatgpt: [
        "{plugins}を開き、{add}を選びます。見つからない場合は、先にSettingsでDeveloper modeをオンにしてください。",
        "名前をMentaにして、URLを貼り付け、{oauth}を選びます。",
        "{create}を選んだら、{signIn}",
      ],
      chatgptPaths: {
        plugins: "Plugins",
        add: "Add → Add custom MCP server",
        oauth: "OAuth",
        create: "I understand and want to continue → Create as a plugin",
      },
      claude: [
        "{connectors}を開き、{add}を選びます。",
        "名前をMentaにして、URLを末尾のスラッシュなしでそのまま貼り付けます。",
        "Claudeが検出したログイン方式はそのままにして{confirm}を選んだら、{signIn}",
      ],
      claudePaths: {
        connectors: "Customize → Connectors",
        add: "+ Add → Add custom connector",
        confirm: "Add",
      },
      other: [
        "アプリでMCPサーバーやコネクタを追加する場所を探します（「カスタムコネクタ」や「インテグレーション」と呼ばれることが多いです）。",
        "上のURLでリモートHTTPサーバーを追加します。ログインはOAuthなので、APIキーの欄は空のままにしてください。",
        "求められたら、{signIn}",
      ],
    },
  },
  purchase: {
    title: "購入の流れ",
    steps: [
      {
        title: "買いたいものを伝える",
        text: "欲しいものと買う場所をアシスタントに伝えます。例：「{example}」",
      },
      {
        title: "Mentaが購入手続きを進める",
        text: "Mentaがストアで購入手続きを始め、進み具合を表示します。",
      },
      {
        title: "ストアの質問に答える",
        text: "サイズや配達時間など、ストアから確認があれば、アシスタントが尋ねるので答えます。",
      },
      {
        title: "利用上限を承認する",
        text: "ストアが請求できる状態になると、あなたが承認した利用上限で足りる場合は、Mentaがその利用上限から支払います。足りない場合は、アシスタントやMentaのページに表示されるCrossmintの安全なフォームで、あなた自身が承認します。上限を超えて支払われることはありません。",
      },
    ],
    never:
      "アシスタントが利用上限を承認したり引き上げたりすることはできません。カード番号、認証コード、パスワードがチャットを通ることもありません。必要なときは、Crossmintの安全なフォームに入力します。",
  },
  saved: {
    title: "カードと住所",
    cards:
      "カードはCrossmintがあなたのMentaアカウントに保存します。{wallet}で追加・管理できます。アシスタントに見えるのは、カードのブランドと下4桁だけです。",
    addresses:
      "お届け先住所は{addresses}に保存されます。アシスタントが住所を読むのは必要なときだけです。配達先を伝えるときは既定の住所の名前と市区町村だけを使い、それ以外はあなたやストアが求めたときに使います。",
    signIn: "どちらのページもMentaへのログインが必要です。",
  },
  orders: {
    title: "注文の確認とキャンセル",
    text: "購入の状況はアシスタントに尋ねるだけで確認でき、キャンセルも頼めます。どのアシスタントから購入したものも、すべて{transactions}にあります。",
    store:
      "注文はストアであなたの名前で行われるため、注文確定後の変更や返品はストアで手続きします。",
  },
  limits: {
    title: "Mentaにできないこと",
    items: [
      "自動ブラウザをブロックするストアがあり、そうしたストアではMentaは購入できません。",
      "Mentaが扱うのは、オンラインストアでの実物の商品の購入と注文です。配達または店頭受け取りに対応します。",
      "Mentaが支払いに使うのは保存済みのカードだけで、あなたが承認した利用上限の範囲内に限られます。",
    ],
  },
  contact: {
    title: "プライバシー、利用規約、サポート",
    text: "MentaはCrossmintが提供しています。お困りのときは、{email} にメールするか、Xで {x} をメンションしてください。",
  },
  legal: {
    terms: "利用規約",
    privacy: "プライバシーポリシー",
    englishOnly: "この文書は英語でのみ提供しています。",
    agree: "続行すると、Mentaの{terms}と{privacy}に同意したことになります。",
    agreeTerms: "利用規約",
    agreePrivacy: "プライバシーポリシー",
  },
} satisfies typeof en;
