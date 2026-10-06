const SPANISH_LETTERS = /[áéíóúñ¿¡«»]/i;

const SPANISH_WORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'del',
  'al',
  'un',
  'una',
  'unos',
  'unas',
  'que',
  'de',
  'en',
  'con',
  'por',
  'para',
  'tu',
  'tus',
  'su',
  'sus',
  'es',
  'y',
  'se',
  'lo',
  'le',
  'te',
  'sin',
  'hasta',
  'cada',
  'carta',
  'cartas',
  'mazo',
  'mazos',
  'partida',
  'turno',
  'vida',
  'vidas',
  'tierra',
  'tierras',
  'criatura',
  'criaturas',
  'hechizo',
  'hechizos',
  'reliquia',
  'reliquias',
  'mano',
  'biblioteca',
  'cementerio',
  'jugar',
  'elige',
  'roba',
  'ver',
  'atacar',
  'bloquear',
  'pasar',
  'ganas',
  'pierdes',
  'contra',
  'sobre',
  'aleatorio',
]);

export function spanishIn(text: string): string[] {
  const found = new Set<string>();
  for (const word of text.split(/[^\p{L}]+/u)) {
    if (!word) continue;
    if (SPANISH_LETTERS.test(word) || SPANISH_WORDS.has(word.toLowerCase())) found.add(word);
  }
  return [...found];
}

const TEXT_NODE = 3;
const LABELS = ['aria-label', 'title', 'placeholder', 'alt'];

export function shownText(root: Element): string {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      parts.push(node.textContent ?? '');
      return;
    }
    if (!('getAttribute' in node)) return;
    const element = node as Element;
    if (element !== root && element.hasAttribute('lang')) return;
    for (const name of LABELS) {
      const value = element.getAttribute(name);
      if (value) parts.push(value);
    }
    element.childNodes.forEach(walk);
  };
  walk(root);
  return parts.join('\n');
}
