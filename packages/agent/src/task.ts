const link = /\b(?:https?:\/\/|www\.)\S+/gi;
const trailing = /[)\].,;:!?'"]+$/;

/**
 * A checkout's task as people read it: every link becomes its bare domain
 * (no www) and whitespace collapses. For display only; Crossmint keeps the
 * full task.
 */
export function shortTask(task: string) {
  return task
    .replace(link, (match) => {
      const tail = trailing.exec(match)?.[0] ?? "";
      const url = match.slice(0, match.length - tail.length);
      try {
        const host = new URL(
          /^www\./i.test(url) ? `https://${url}` : url,
        ).hostname.replace(/^www\./, "");
        return host ? `${host}${tail}` : match;
      } catch {
        return match;
      }
    })
    .replace(/\s+/g, " ")
    .trim();
}
