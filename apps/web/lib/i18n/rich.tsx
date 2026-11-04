import { Fragment, type ReactNode } from "react";

/**
 * A message with elements inside it: `rich("Open {settings} to change it.",
 * { settings: <a …>Settings</a> })`. Translators move the placeholder; the
 * markup stays in the component. Unknown placeholders stay as written.
 */
export function rich(
  template: string,
  parts: Readonly<Record<string, ReactNode>>,
): ReactNode {
  return template.split(/(\{\w+\})/).map((piece, index) => {
    const key = /^\{(\w+)\}$/.exec(piece)?.[1];
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one fixed string, in order
      <Fragment key={index}>
        {key !== undefined && key in parts ? parts[key] : piece}
      </Fragment>
    );
  });
}
