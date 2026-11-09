"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { disableNotifications, syncNotificationUser } from "./notifications";

export interface Me {
  readonly id: string;
  readonly email: string | null;
  readonly name: string | null;
  /** Profile photo from Google sign-in, when there is one. */
  readonly picture?: string | null;
}
export interface ConversationSummary {
  readonly sessionId: string;
  readonly title: string | null;
  readonly createdAt: string;
}

export interface InitialAccount {
  readonly me: Me;
  readonly conversations: ConversationSummary[];
}

interface AccountState {
  readonly me: Me | null;
  /** Null until the first list arrives (from the server stream or a refresh). */
  readonly conversations: readonly ConversationSummary[] | null;
  /** Streamed from the server render; read it with `use()` inside Suspense. */
  readonly initial: Promise<InitialAccount | null> | null;
  readonly refreshConversations: () => void;
  /** Drop a deleted conversation from the list and keep it out of later refreshes. */
  readonly forgetConversation: (sessionId: string) => void;
  /** The visitor's country (ISO 3166-1 alpha-2) from their IP, where the host says; else null. */
  readonly country: string | null;
  /** Changes whenever the user asks for a fresh chat, to remount the new-chat view. */
  readonly newChatKey: number;
  readonly startNewChat: () => void;
}

const Account = createContext<AccountState>({
  me: null,
  conversations: null,
  initial: null,
  country: null,
  refreshConversations: () => {},
  forgetConversation: () => {},
  newChatKey: 0,
  startNewChat: () => {},
});

/** Signed-in user and their recent conversations; sends signed-out visitors to /login. */
export function AccountProvider({
  children,
  initial,
  country = null,
}: {
  children: ReactNode;
  initial: Promise<InitialAccount | null>;
  country?: string | null;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [conversations, setConversations] = useState<
    ConversationSummary[] | null
  >(null);
  const [newChatKey, setNewChatKey] = useState(0);
  const startNewChat = useCallback(() => setNewChatKey((key) => key + 1), []);
  const forgotten = useRef(new Set<string>());
  const kept = useCallback(
    (list: ConversationSummary[]) =>
      list.filter((item) => !forgotten.current.has(item.sessionId)),
    [],
  );
  const forgetConversation = useCallback(
    (sessionId: string) => {
      forgotten.current.add(sessionId);
      setConversations((current) => current && kept(current));
    },
    [kept],
  );
  const refreshConversations = useCallback(() => {
    void fetch("/api/conversations", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { conversations: ConversationSummary[] } | null) => {
        if (body) {
          setConversations(kept(body.conversations));
        }
      })
      .catch(() => {});
  }, [kept]);
  useEffect(() => {
    void initial.then((account) => {
      if (!account) {
        // The hash too: assistants link to anchors (#cards, #add-address).
        const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setMe(account.me);
      setConversations((current) => current ?? kept(account.conversations));
    });
  }, [initial, kept]);
  useEffect(() => {
    if (me) {
      void syncNotificationUser(me.id).catch(() => {});
    }
  }, [me]);
  return (
    <Account.Provider
      value={{
        me,
        conversations,
        initial,
        country,
        refreshConversations,
        forgetConversation,
        newChatKey,
        startNewChat,
      }}
    >
      {children}
    </Account.Provider>
  );
}

export const useAccount = () => useContext(Account);

export function initials(me: Me | null) {
  const source = me?.name ?? me?.email ?? "";
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  return (
    (words[0]?.[0] ?? "") + (me?.name ? (words[1]?.[0] ?? "") : "")
  ).toUpperCase();
}

/** Turns this browser's notifications off, ends the session and goes to sign-in. */
export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    await disableNotifications().catch(() => {});
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
    window.location.replace("/login");
  }
  return { signingOut, signOut };
}
