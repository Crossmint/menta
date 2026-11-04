"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  initials,
  type Me,
  useAccount,
  useSignOut,
} from "../../lib/client/account";
import { useI18n } from "../../lib/i18n/client";
import { helpPath } from "../../lib/i18n/locales";
import { LEGAL } from "../../lib/site";
import {
  Brand,
  Bubble,
  Chevron,
  Clock,
  Doc,
  Gauge,
  Gear,
  Help,
  House,
  Lock,
  LogOut,
  Plus,
  Receipt,
  Support,
  Trash,
  Wallet,
} from "./icons";
import { Modal, ModalHeader } from "./modal";

function useInitialAccount() {
  const { initial } = useAccount();
  return initial ? use(initial) : null;
}

function ConversationsSkeleton({ sheet = false }: { sheet?: boolean }) {
  const { m } = useI18n();
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      {sheet ? null : (
        <div className="label px-3 pb-2 text-muted">{m.app.nav.recent}</div>
      )}
      {[72, 56, 64, 48, 60].map((width) => (
        <div key={width} className="flex h-9 items-center px-3">
          <span
            className="h-3 animate-pulse rounded-full bg-black/[0.06]"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * A chat row's delete control: a trash button that shows on hover, then turns
 * into a small "Delete" button to confirm. Escape, a click elsewhere or a few
 * idle seconds put it back.
 */
function DeleteChat({ onDelete }: { onDelete: () => void }) {
  const { m } = useI18n();
  const [armed, setArmed] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!armed) {
      return;
    }
    const disarm = (event: Event) => {
      if (!button.current?.contains(event.target as Node)) {
        setArmed(false);
      }
    };
    const timer = window.setTimeout(() => setArmed(false), 4000);
    document.addEventListener("pointerdown", disarm);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", disarm);
    };
  }, [armed]);
  return (
    <button
      ref={button}
      type="button"
      aria-label={armed ? m.app.nav.confirmDelete : m.app.nav.deleteChat}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onDelete();
        } else {
          setArmed(true);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && armed) {
          event.stopPropagation();
          setArmed(false);
        }
      }}
      onBlur={() => setArmed(false)}
      className={`inline-flex h-7 items-center justify-center rounded-full transition-[opacity,color,background-color,padding,min-width] duration-150 ease-out motion-reduce:transition-none pointer-coarse:h-11 ${
        armed
          ? "min-w-0 bg-danger-soft px-3 text-[13px] font-medium text-danger opacity-100 hover:bg-[#fde2e2]"
          : "min-w-7 px-0 text-muted hover:bg-black/5 hover:text-ink pointer-coarse:min-w-11 pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
      }`}
    >
      {armed ? (
        <span className="animate-[fade-in_120ms_ease-out] motion-reduce:animate-none">
          {m.app.nav.delete}
        </span>
      ) : (
        <Trash />
      )}
    </button>
  );
}

/** How long a deleted row takes to fade and collapse (see the row's duration). */
const collapseMs = 200;

function Conversations({
  pathname,
  onNavigate,
  sheet = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  /** In phones' history sheet: its own title, and a line when there are none. */
  sheet?: boolean;
}) {
  const { m } = useI18n();
  const first = useInitialAccount();
  const {
    conversations: refreshed,
    forgetConversation,
    startNewChat,
  } = useAccount();
  const router = useRouter();
  const conversations = refreshed ?? first?.conversations ?? [];
  const [deleting, setDeleting] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!failed) {
      return;
    }
    const timer = window.setTimeout(() => setFailed(null), 5000);
    return () => window.clearTimeout(timer);
  }, [failed]);
  // Optimistic: the row collapses at once and comes back if the delete fails.
  async function remove(sessionId: string) {
    setFailed(null);
    setDeleting((current) => new Set(current).add(sessionId));
    const [response] = await Promise.all([
      fetch(`/api/conversations/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      }).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, collapseMs)),
    ]);
    // 404: it's already gone (or never was this user's).
    if (response?.ok || response?.status === 404) {
      forgetConversation(sessionId);
      if (pathname === `/c/${sessionId}`) {
        startNewChat();
        router.push("/chat");
      }
    } else {
      setFailed(sessionId);
    }
    setDeleting((current) => {
      const next = new Set(current);
      next.delete(sessionId);
      return next;
    });
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversations.length > 0 && !sheet ? (
        <div className="label px-3 pb-2 text-muted">{m.app.nav.recent}</div>
      ) : null}
      {conversations.length === 0 && sheet ? (
        <p className="m-0 px-3 py-2 text-[14px] text-quiet">
          {m.app.nav.noChats}
        </p>
      ) : null}
      <div
        className={
          sheet
            ? "flex min-h-0 flex-1 flex-col divide-y divide-black/[0.04] overflow-x-hidden overflow-y-auto rounded-[20px] bg-stage empty:hidden"
            : "-mx-1 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-1"
        }
      >
        {conversations.map((conversation) => {
          const href = `/c/${conversation.sessionId}`;
          const active = pathname === href;
          const collapsing = deleting.has(conversation.sessionId);
          return (
            <div
              key={conversation.sessionId}
              inert={collapsing}
              className={`grid flex-none grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${collapsing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
            >
              <div className={`min-h-0 ${collapsing ? "overflow-hidden" : ""}`}>
                <div className="group pb-0.5">
                  <div className="relative">
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={
                        sheet
                          ? // The settings rows' grey group, in phones' history sheet.
                            `block truncate py-3.5 pr-12 pl-4.5 text-[15px] transition-colors ${active ? "bg-black/[0.04] text-ink" : "text-soft hover:bg-black/[0.04] hover:text-ink"}`
                          : `block truncate rounded-full py-2 pr-10 pl-3 transition-colors max-md:py-3 max-md:pr-12 pointer-coarse:py-3 pointer-coarse:pr-12 ${active ? "bg-white text-ink shadow-[0_0_0_1px_rgb(0_0_0/6%),0_1px_3px_rgb(0_0_0/4%)]" : "text-soft hover:bg-black/[0.04]"}`
                      }
                    >
                      {conversation.title ?? m.app.nav.untitled}
                    </Link>
                    <div
                      className={`absolute inset-y-0 right-1 flex items-center max-md:right-0 pointer-coarse:right-0 ${active ? "" : "pointer-coarse:hidden"}`}
                    >
                      <DeleteChat
                        onDelete={() => void remove(conversation.sessionId)}
                      />
                    </div>
                  </div>
                  {failed === conversation.sessionId ? (
                    <p
                      role="alert"
                      className="animate-[fade-in_150ms_ease-out] px-3 pt-1 pb-1.5 text-[12px] text-danger motion-reduce:animate-none"
                    >
                      {m.app.nav.deleteFailed}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <>
      <span className="size-8 flex-none animate-pulse rounded-full bg-chip" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="h-3.5 w-24 animate-pulse rounded-full bg-chip" />
        <span className="h-3 w-32 animate-pulse rounded-full bg-chip" />
      </span>
    </>
  );
}

/** The user's Google photo when there is one, else their initials. */
export function Avatar({
  me,
  className = "size-8 text-xs",
}: {
  me: Me | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const picture = !broken && me?.picture ? me.picture : null;
  return (
    <span
      className={`inline-flex flex-none ${className} items-center justify-center overflow-hidden rounded-full bg-ink font-medium text-white`}
    >
      {picture ? (
        // biome-ignore lint/performance/noImgElement: a remote avatar; next/image would need Google's hosts configured
        <img
          src={picture}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        initials(me)
      )}
    </span>
  );
}

function AccountSummary() {
  const { m } = useI18n();
  const first = useInitialAccount();
  const { me: refreshed } = useAccount();
  const me = refreshed ?? first?.me ?? null;
  return (
    <>
      <Avatar me={me} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {me?.name ?? me?.email ?? m.app.nav.account}
        </span>
        {me?.name && me.email ? (
          <span className="truncate text-xs text-muted">{me.email}</span>
        ) : null}
      </span>
    </>
  );
}

const menuItem =
  "flex h-10 w-full items-center gap-3 rounded-[11px] px-3 text-left font-medium text-ink transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline-none disabled:opacity-50";

/**
 * The signed-in user at the foot of the sidebar: a click opens a menu with
 * Settings, Support (its help center and legal pages, to the side) and Log
 * out. Escape or a click elsewhere closes it.
 */
function ProfileMenu() {
  const { m, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [support, setSupport] = useState(false);
  const { signingOut, signOut } = useSignOut();
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) {
      setSupport(false);
      return;
    }
    function away(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
          root.current
            ?.querySelector<HTMLButtonElement>("[data-profile]")
            ?.focus();
        }
      } else if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", away);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", away);
    };
  }, [open]);
  const icon = { width: 18, height: 18 };
  const card =
    "rounded-[16px] bg-white p-1.5 shadow-[0_0_0_1px_rgb(0_0_0/6%),0_12px_32px_-8px_rgb(0_0_0/22%)]";
  return (
    <div ref={root} className="relative mt-auto flex-none">
      {open ? (
        <div
          id="profile-menu"
          role="menu"
          aria-label={m.app.nav.account}
          className={`absolute inset-x-0 bottom-full mb-1.5 animate-[fade-in_120ms_ease-out] motion-reduce:animate-none ${card}`}
        >
          <Link href="/settings" role="menuitem" className={menuItem}>
            <Gear {...icon} className="text-soft" />
            {m.app.nav.settings}
          </Link>
          <div
            className="relative"
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") {
                setSupport(true);
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") {
                setSupport(false);
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={support}
              onClick={() => setSupport((value) => !value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  setSupport(true);
                }
              }}
              className={`${menuItem} ${support ? "bg-black/[0.04]" : ""}`}
            >
              <Support {...icon} className="text-soft" />
              {m.app.nav.support}
              <Chevron width={14} height={14} className="ml-auto text-muted" />
            </button>
            {support ? (
              // The pointer crosses the gap inside the padding, so the menu stays open.
              <div className="absolute bottom-0 left-full z-10 pl-2">
                <div
                  role="menu"
                  aria-label={m.app.nav.support}
                  className={`w-[220px] animate-[fade-in_120ms_ease-out] motion-reduce:animate-none ${card}`}
                >
                  <a
                    href={helpPath(locale)}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className={menuItem}
                  >
                    <Help {...icon} className="text-soft" />
                    {m.app.nav.supportCenter}
                  </a>
                  <a
                    href={LEGAL.terms}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className={menuItem}
                  >
                    <Doc {...icon} className="text-soft" />
                    {m.app.nav.terms}
                  </a>
                  <a
                    href={LEGAL.privacy}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className={menuItem}
                  >
                    <Lock {...icon} className="text-soft" />
                    {m.app.nav.privacy}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={signingOut}
            className={menuItem}
          >
            <LogOut {...icon} className="text-soft" />
            {signingOut ? m.app.nav.signingOut : m.app.nav.signOut}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        data-profile
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "profile-menu" : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-2.5 rounded-full p-2 text-left transition-colors hover:bg-black/[0.04] ${open ? "bg-black/[0.04]" : ""}`}
      >
        <Suspense fallback={<AccountSkeleton />}>
          <AccountSummary />
        </Suspense>
      </button>
    </div>
  );
}

/** One row of the main navigation, marked current on its page and the pages under it. */
function NavItem({
  href,
  icon,
  current,
  onNavigate,
  children,
}: {
  href: string;
  icon: ReactNode;
  current: boolean;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`flex h-10 flex-none items-center gap-3 rounded-full px-3 transition-colors max-md:h-12 ${current ? "bg-white text-ink shadow-[0_0_0_1px_rgb(0_0_0/6%),0_1px_3px_rgb(0_0_0/4%)]" : "text-soft hover:bg-black/[0.04] hover:text-ink"}`}
    >
      <span
        className={`flex-none ${current ? "text-ink" : "text-muted"}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}

function under(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * The app's navigation, from `md` up (phones go through Home). What Menta is
 * for comes first (home, what it bought, the wallet); the web chat is a place
 * to try it, so it sits below, and its recent conversations show only while
 * you're in it. Settings and support are in the profile menu at the foot.
 */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { m } = useI18n();
  const pathname = usePathname();
  const chatting = under(pathname, "/chat") || pathname.startsWith("/c/");
  const { startNewChat } = useAccount();
  const icon = { width: 18, height: 18 };
  return (
    <div data-sidebar className="flex h-full flex-col gap-5 px-3 py-[18px]">
      <div className="px-2 py-1">
        <Brand href="/home" />
      </div>
      <div className="flex flex-col gap-0.5">
        <NavItem
          href="/home"
          icon={<House {...icon} />}
          current={under(pathname, "/home")}
          onNavigate={onNavigate}
        >
          {m.app.nav.home}
        </NavItem>
        <NavItem
          href="/activity"
          icon={<Receipt {...icon} />}
          current={under(pathname, "/activity")}
          onNavigate={onNavigate}
        >
          {m.app.nav.transactions}
        </NavItem>
        <NavItem
          href="/wallet"
          icon={<Wallet {...icon} />}
          current={under(pathname, "/wallet")}
          onNavigate={onNavigate}
        >
          {m.app.nav.wallet}
        </NavItem>
        <NavItem
          href="/spending-limits"
          icon={<Gauge {...icon} />}
          current={under(pathname, "/spending-limits")}
          onNavigate={onNavigate}
        >
          {m.app.nav.limits}
        </NavItem>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5">
        <div className="label px-3 pb-1.5 text-muted">{m.app.nav.tryIt}</div>
        <div className="group/chat relative">
          <NavItem
            href="/chat"
            icon={<Bubble {...icon} />}
            current={pathname === "/chat"}
            onNavigate={onNavigate}
          >
            {m.app.nav.chat}
          </NavItem>
          {chatting ? (
            <Link
              href="/chat"
              data-new-chat
              aria-label={m.app.nav.newChat}
              title={m.app.nav.newChat}
              onClick={() => {
                startNewChat();
                onNavigate?.();
              }}
              className="tap absolute inset-y-0 right-1 my-auto inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-ink"
            >
              <Plus width={15} height={15} />
            </Link>
          ) : null}
        </div>
        {chatting ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <Suspense fallback={<ConversationsSkeleton />}>
              <Conversations pathname={pathname} onNavigate={onNavigate} />
            </Suspense>
          </div>
        ) : null}
      </div>
      <ProfileMenu />
    </div>
  );
}

/**
 * Fixed rather than sticky: on macOS the page rubber-bands past its ends and a
 * sticky sidebar bounces with it. The empty column keeps its place in the row.
 */
export function Sidebar() {
  const { m } = useI18n();
  return (
    <div className="hidden w-[256px] flex-none md:block">
      <nav
        aria-label={m.app.nav.label}
        className="fixed inset-y-0 left-0 w-[256px] border-r border-black/[0.06] bg-stage"
      >
        <SidebarContent />
      </nav>
    </div>
  );
}

/**
 * Phones' way to earlier chats (the sidebar lists them from `md` up): a clock
 * at the chat header's right opens a sheet with New chat and each one.
 */
export function ChatHistory() {
  const { m } = useI18n();
  const { startNewChat } = useAccount();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={m.app.nav.history}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="tap relative inline-flex size-12 items-center justify-center rounded-full text-ink transition-colors hover:bg-black/[0.04]"
      >
        <Clock width={22} height={22} strokeWidth={2} />
      </button>
      {open
        ? // On the body, not in the header: the header hides from `md` up, and a
          // hidden modal would leave the page inert (a phone turned sideways).
          createPortal(
            <Modal
              labelledBy="chat-history-title"
              onClose={() => setOpen(false)}
            >
              {(close) => (
                <div className="flex max-h-[80dvh] flex-col gap-3 p-5">
                  <ModalHeader
                    id="chat-history-title"
                    title={m.app.nav.history}
                    close={close}
                  />
                  <Link
                    href="/chat"
                    onClick={() => {
                      startNewChat();
                      close();
                    }}
                    className="flex min-h-[52px] flex-none items-center gap-3.5 rounded-[20px] bg-stage px-4.5 text-[15px] text-soft transition-colors hover:bg-black/[0.06] hover:text-ink"
                  >
                    <Plus width={20} height={20} className="text-muted" />
                    {m.app.nav.newChat}
                  </Link>
                  <Suspense fallback={<ConversationsSkeleton sheet />}>
                    <Conversations
                      pathname={pathname}
                      onNavigate={close}
                      sheet
                    />
                  </Suspense>
                </div>
              )}
            </Modal>,
            document.body,
          )
        : null}
    </>
  );
}
