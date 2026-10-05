import { KEYWORDS, KEYWORD_NAMES, KEYWORD_REMINDERS, opponent, type DeckSpec, type GameState, type PlayerId } from '../engine';
import type { Decision } from './decision';
import { cardGlossary, deckCardDefs, deckLine, playerView, visibleCardDefs } from './view';

export interface PromptContext {
  decks?: readonly [DeckSpec, DeckSpec] | null;
  recentEvents?: readonly string[];
  recentThoughts?: readonly string[];
}

export interface Prompt {
  system: string;
  prompt: string;
}

export const MAX_RECENT_EVENTS = 30;
export const MAX_RECENT_THOUGHTS = 10;

const KEYWORD_LINES = KEYWORDS.map((keyword) => `  - ${KEYWORD_NAMES[keyword]}: ${KEYWORD_REMINDERS[keyword]}`).join('\n');

export const SYSTEM_PROMPT = `Eres un jugador experto de Duelo de Maná, un juego de cartas para dos jugadores basado en las reglas básicas de Magic: The Gathering. Juegas en el asiento llamado "you"; el otro asiento es "opponent", el rival. Ganas cuando las vidas del rival llegan a 0 o cuando tiene que robar de una biblioteca vacía.

Reglas:
- Los dos jugadores empiezan con 20 vidas, un mazo de 40 cartas y una mano de 7. Puedes jugar una tierra por turno, en tu fase principal, mientras la pila esté vacía; "extraLandsThisTurn" cuenta las tierras adicionales que un efecto te deja jugar este turno. Una tierra que "entra girada" no da maná hasta tu siguiente turno.
- Las tierras y algunas criaturas se giran para producir maná. El pago es automático: la partida gira por ti tus fuentes enderezadas. "availableMana" lista las fuentes enderezadas, un maná cada una ("R/G" significa cualquiera de esos colores).
- Criaturas, tierras y conjuros: solo en tus propias fases principales y con la pila vacía. Instantáneos, criaturas con destello y habilidades activadas: siempre que tengas la prioridad, incluso en respuesta a un hechizo.
- Un turno sigue este orden: enderezar, mantenimiento, robar, fase principal, combate (declarar atacantes, declarar bloqueadoras, daño), segunda fase principal, paso final y limpieza. En la limpieza descartas hasta quedarte con 7 cartas, y el daño y los efectos "hasta el final del turno" desaparecen. Los contadores +1/+1 ("plusOneCounters") se quedan sobre una criatura hasta que sale del campo de batalla.
- Una criatura no puede atacar ni pagar costes de {T} hasta que su controlador la haya controlado desde el comienzo de su turno ("summoningSick"), salvo que tenga la habilidad de prisa; aun así, puede bloquear. Atacar gira a la criatura, salvo que tenga la habilidad de vigilancia. Las criaturas giradas no pueden bloquear.
- Cada bloqueadora bloquea a una atacante; varias criaturas pueden bloquear a la misma atacante. El daño de combate se hace a la vez; el daño de una atacante se reparte automáticamente entre sus bloqueadoras. Las atacantes no bloqueadas hacen daño al jugador defensor.
- Una criatura muere cuando el daño marcado sobre ella alcanza su resistencia.
- Los hechizos y las habilidades van a la pila y se resuelven del último al primero cuando los dos jugadores pasan la prioridad seguidos. Un hechizo cuyos objetivos han desaparecido todos no hace nada.
- Las fichas ("token": true) son criaturas que crean los efectos. Una ficha que sale del campo de batalla deja de existir.
- Las reliquias ("relics") acompañan a su jugador toda la partida, fuera del campo de batalla: nadie puede hacerlas objetivo ni quitarlas, y sus habilidades se disparan como las de un permanente. "Al comienzo de tu mantenimiento" se dispara una vez en cada turno de su jugador, antes de robar.
- "damagedThisTurn": true marca a un jugador que recibió daño este turno, algo que comprueban algunas cartas. Perder vidas no es recibir daño. Se borra cuando empieza el turno siguiente.
- Cuando un efecto obliga a un jugador a descartar, ese jugador elige las cartas. Una habilidad que sacrifica su criatura como coste la pone en el cementerio en el acto, como una muerte.
- Palabras clave:
${KEYWORD_LINES}

Ves tu mano, los dos campos de batalla, los dos cementerios, la pila, los sucesos recientes y las razones que diste en tus últimas decisiones. La mano del rival y las dos bibliotecas están ocultas: solo sabes cuántas cartas tienen. Las listas de los dos mazos son públicas.

Cada mensaje termina con la única decisión que espera la partida, con sus opciones legales. Responde solo con el objeto JSON que describe el esquema: primero un "reason" breve (una o dos frases, en español) y después tu decisión. Elige solo entre las opciones de la lista.

Para jugar bien: juega una tierra cada turno y gasta tu maná; ataca cuando el intercambio te favorezca o el rival no pueda bloquear bien; guarda suficientes bloqueadoras cuando el rival amenace con daño letal; apunta la eliminación a la mayor amenaza; no pierdas criaturas en malos bloqueos salvo que el daño fuera a matarte; guarda los instantáneos para el momento en que más importen; mantén el plan de tus pensamientos recientes mientras siga encajando con la partida.`;

const INLINE_WIDTH = 100;

export function compactJson(value: unknown, indent = ''): string {
  const inline = JSON.stringify(value) ?? 'null';
  if (typeof value !== 'object' || value === null || indent.length + inline.length <= INLINE_WIDTH) return inline;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map((item) => `${inner}${compactJson(item, inner)}`).join(',\n')}\n${indent}]`;
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${compactJson(item, inner)}`).join(',\n')}\n${indent}}`;
}

function section(title: string, body: string): string {
  return `## ${title}\n${body}`;
}

export function buildPrompt(s: GameState, player: PlayerId, decision: Decision, context: PromptContext = {}): Prompt {
  const decks = context.decks ?? null;
  const defs = [...(decks ? decks.flatMap((deck) => deckCardDefs(deck)) : []), ...visibleCardDefs(s, player)];
  const sections = [section('Cartas de esta partida', cardGlossary(defs).map((line) => `- ${line}`).join('\n'))];
  if (decks) {
    const yours = deckLine(decks[player]);
    const theirs = deckLine(decks[opponent(player)]);
    if (yours && theirs) sections.push(section('Mazos', `Tu mazo: ${yours}\nMazo del rival: ${theirs}`));
  }
  const events = (context.recentEvents ?? []).slice(-MAX_RECENT_EVENTS);
  if (events.length > 0) sections.push(section('Sucesos recientes, del más antiguo al más reciente', events.map((line) => `- ${line}`).join('\n')));
  const thoughts = (context.recentThoughts ?? []).slice(-MAX_RECENT_THOUGHTS);
  if (thoughts.length > 0) sections.push(section('Tus pensamientos recientes, del más antiguo al más reciente', thoughts.map((line) => `- ${line}`).join('\n')));
  sections.push(section('Estado de la partida desde tu asiento', `\`\`\`json\n${compactJson(playerView(s, player))}\n\`\`\``));
  sections.push(
    section(`Decisión: ${decision.kind}`, [decision.question, '', 'Opciones:', ...decision.options.map((line) => `- ${line}`), '', decision.answer].join('\n')),
  );
  return { system: SYSTEM_PROMPT, prompt: sections.join('\n\n') };
}
