/**
 * Message formatting for every locale, with no library: `{name}` placeholders
 * and plural forms picked by Intl.PluralRules. Shared by server and client.
 */

/** A message that changes with a count. `other` is required; each language fills the forms it has. */
export interface Plural {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

export type Vars = Readonly<Record<string, string | number>>;

/** Fills `{name}` placeholders; an unknown placeholder stays as written. */
export function format(template: string, vars: Vars = {}) {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

const rules = new Map<string, Intl.PluralRules>();

/** The plural form for `count` in `tag` (a BCP 47 tag), with `{count}` filled in. */
export function plural(tag: string, count: number, forms: Plural, vars?: Vars) {
  let rule = rules.get(tag);
  if (!rule) {
    rule = new Intl.PluralRules(tag);
    rules.set(tag, rule);
  }
  const form = count === 0 && forms.zero ? "zero" : rule.select(count);
  return format(forms[form] ?? forms.other, {
    count: count.toLocaleString(tag),
    ...vars,
  });
}
