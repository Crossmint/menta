import type { Host } from "@oca/client/secure-page";
import { AgentIcon } from "./agent-icon";

/** The assistant that sent the user, as its app icon and name, to sit in a line of text. */
export function HostName({ host }: { host: Host }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 font-medium text-ink">
      <AgentIcon
        name={host.name}
        className="size-[18px] self-center rounded-[5px] text-[7px]"
      />
      {host.name}
    </span>
  );
}
