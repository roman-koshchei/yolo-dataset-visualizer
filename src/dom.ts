export function one<K extends keyof HTMLElementTagNameMap>(
  selectors: K,
  parentNode: ParentNode = document
): HTMLElementTagNameMap[K] {
  return parentNode.querySelector(selectors)!;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  attributes?: Partial<
    Pick<
      HTMLElementTagNameMap[K],
      {
        [P in keyof HTMLElementTagNameMap[K]]: HTMLElementTagNameMap[K][P] extends Function
          ? never
          : P;
      }[keyof HTMLElementTagNameMap[K]]
    >
  >
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName);
  el.className = className;

  if (attributes) {
    Object.assign(el, attributes);
  }

  return el;
}
