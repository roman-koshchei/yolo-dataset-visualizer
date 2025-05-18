export function one<K extends keyof HTMLElementTagNameMap>(
  selectors: K,
  parentNode: ParentNode = document
): HTMLElementTagNameMap[K] {
  return parentNode.querySelector(selectors)!;
}

export function many<K extends keyof HTMLElementTagNameMap>(
  selectors: K,
  parentNode: ParentNode = document
): HTMLElementTagNameMap[K][] {
  return Array.from(parentNode.querySelectorAll(selectors));
}

export type HtmlAttributes<K extends keyof HTMLElementTagNameMap> = Partial<
  Pick<
    HTMLElementTagNameMap[K],
    {
      [P in keyof HTMLElementTagNameMap[K]]: HTMLElementTagNameMap[K][P] extends Function
        ? never
        : P;
    }[keyof HTMLElementTagNameMap[K]]
  >
>;

export function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  attributes?: HtmlAttributes<K>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName);
  el.className = className;

  if (attributes) {
    Object.assign(el, attributes);
  }

  return el;
}

export function inputElement(
  className: string,
  attributes: HtmlAttributes<"input">
) {
  return element(
    "input",
    `${className} w-full p-3 border border-stone-700 text-white focus-visible:outline-none focus-visible:border-stone-500`,
    attributes
  );
}
