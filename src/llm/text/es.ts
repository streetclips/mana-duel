import { count, plural } from '../../i18n';
import type { LlmText } from './types';

export const es: LlmText = {
  systemPrompt: (keywordLines) => `Eres un jugador experto de Duelo de Maná, un juego de cartas para dos jugadores basado en las reglas básicas de Magic: The Gathering. Juegas en el asiento llamado "you"; el otro asiento es "opponent", el rival. Ganas cuando las vidas del rival llegan a 0 o cuando tiene que robar de una biblioteca vacía.

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
${keywordLines}

Ves tu mano, los dos campos de batalla, los dos cementerios, la pila, los sucesos recientes y las razones que diste en tus últimas decisiones. La mano del rival y las dos bibliotecas están ocultas: solo sabes cuántas cartas tienen. Las listas de los dos mazos son públicas.

Cada mensaje termina con la única decisión que espera la partida, con sus opciones legales. Responde solo con el objeto JSON que describe el esquema: primero un "reason" breve (una o dos frases, en español) y después tu decisión. Elige solo entre las opciones de la lista.

Para jugar bien: juega una tierra cada turno y gasta tu maná; ataca cuando el intercambio te favorezca o el rival no pueda bloquear bien; guarda suficientes bloqueadoras cuando el rival amenace con daño letal; apunta la eliminación a la mayor amenaza; no pierdas criaturas en malos bloqueos salvo que el daño fuera a matarte; guarda los instantáneos para el momento en que más importen; mantén el plan de tus pensamientos recientes mientras siga encajando con la partida.`,
  sections: {
    cards: 'Cartas de esta partida',
    decks: 'Mazos',
    yourDeck: 'Tu mazo',
    opponentDeck: 'Mazo del rival',
    events: 'Sucesos recientes, del más antiguo al más reciente',
    thoughts: 'Tus pensamientos recientes, del más antiguo al más reciente',
    state: 'Estado de la partida desde tu asiento',
    decision: (kind) => `Decisión: ${kind}`,
    options: 'Opciones:',
  },
  decision: {
    reason: 'Tu razonamiento, en español y en una o dos frases cortas.',
    you: 'ti',
    and: ' y ',
    targeting: (targets) => ` sobre ${targets}`,
    passResolves: 'Pasar la prioridad: no respondes; lo que está en lo alto de la pila se resuelve cuando los dos jugadores pasan',
    passEndStep: 'Pasar la prioridad: no haces nada más este turno',
    passMovesOn: (step) => `Pasar la prioridad: no haces nada ahora; cuando los dos jugadores pasen, la partida avanza a: ${step}`,
    keep: (handSize, bottom) =>
      `Quedarte con esta mano de ${handSize} cartas${bottom > 0 ? ` y luego poner ${count(bottom, 'carta', 'cartas')} de ella en el fondo` : ''}`,
    mulligan: (bottom) => `Mulligan: barajar esta mano, robar una mano nueva de 7 y poner ${count(bottom, 'carta', 'cartas')} en el fondo`,
    playLand: (name, id) => `Jugar la tierra ${name} (${id})`,
    cast: (name, id, cost, targets) => `Lanzar ${name} (${id}) por ${cost}${targets}`,
    activate: (source, text, targets) => `Activar ${source}: "${text}"${targets}`,
    chooseTargets: (targets) => `Objetivo: ${targets}`,
    noAttack: 'No atacar con nada',
    attack: (cards) => `Atacar con ${cards}`,
    noBlock: 'No bloquear',
    block: (blocks) => `Bloquear: ${blocks}`,
    blocks: (blocker, blockerId, attacker, attackerId) => `${blocker} (${blockerId}) bloquea a ${attacker} (${attackerId})`,
    bottom: (cards) => `Poner ${cards} en el fondo`,
    discard: (cards) => `Descartar ${cards}`,
    concede: 'Rendirte',
    yourTurn: 'tu turno',
    opponentTurn: 'el turno del rival',
    yourCard: (name) => `tu ${name}`,
    opponentCard: (name) => `${name} del rival`,
    priorityWithStack: (whose, step, top) =>
      `Tienes la prioridad en ${whose}, paso: ${step}. En lo alto de la pila está ${top}: puedes responder o dejar que se resuelva.`,
    priority: (whose, step) => `Tienes la prioridad en ${whose}, paso: ${step}, con la pila vacía.`,
    anyTrigger: 'Elige los objetivos de una habilidad disparada.',
    trigger: (name, id, text) => `Se ha disparado tu ${name} (${id}): "${text}" Elige sus objetivos.`,
    choiceId: 'El id de la opción que eliges.',
    choiceAnswer: 'Responde con "choice": el id de exactamente una opción.',
    notAnOption: (choice) => `"${choice}" no es una de las opciones de la lista`,
    attackShape: 'Para cada criatura que puede atacar: true para atacar con ella, false para dejarla atrás.',
    attackQuestion: (untapped, blockers) =>
      `Declara las atacantes. El rival tiene ${count(untapped, 'criatura enderezada', 'criaturas enderezadas')} que ${plural(untapped, 'podría', 'podrían')} bloquear${blockers ? `: ${blockers}` : ''}.`,
    attackAnswer: 'Responde con "attack": un objeto con el id de cada criatura de la lista a true (ataca) o false (se queda atrás).',
    blockerShape: (creature) => `${creature}: el id de la atacante a la que bloquea, o "none"`,
    blocksShape: 'Para cada una de tus criaturas que puede bloquear: la atacante a la que bloquea, o "none".',
    blockQuestion: (attackers) =>
      `El rival ataca con ${attackers}. Declara las bloqueadoras: cada una de tus criaturas bloquea como mucho a una atacante, y varias pueden bloquear a la misma atacante.`,
    blockOption: (id, creature, attackers) => `${id}: ${creature} — puede bloquear a ${attackers}`,
    blockAnswer: 'Responde con "blocks": un objeto que asigne a cada id de bloqueadora de la lista el id de la atacante a la que bloquea, o "none".',
    cleanupDiscard: (amount) => `Limpieza: tienes más de 7 cartas en la mano. Descarta ${count(amount, 'carta', 'cartas')}.`,
    forcedDiscard: (source, amount) => `${source} te obliga a descartar ${count(amount, 'carta', 'cartas')}: elige cuáles.`,
    yourSource: (name) => `Tu ${name}`,
    opponentSource: (name) => `${name} del rival`,
    cardsShape: (amount) => `Exactamente ${count(amount, 'id de carta', 'ids de carta')} de tu mano.`,
    bottomQuestion: (mulligans, amount) =>
      `Te has quedado la mano tras ${count(mulligans, 'mulligan', 'mulligans')}: pon ${count(amount, 'carta', 'cartas')} de tu mano en el fondo de tu biblioteca.`,
    cardsAnswer: (amount) => `Responde con "cards": exactamente ${count(amount, 'id de carta', 'ids de carta')} de la lista.`,
    wrongCardCount: (amount, chosen) => `elige exactamente ${count(amount, 'carta distinta', 'cartas distintas')} de tu mano, no ${chosen}`,
    mulliganQuestion: (mulligans) => `Mano inicial: ¿te la quedas o haces mulligan? Llevas ${count(mulligans, 'mulligan', 'mulligans')}.`,
  },
  player: {
    noEndpoint: 'OpenRouter 404: ningún proveedor de este modelo acepta el esquema JSON (o el esfuerzo de razonamiento)',
    schemaMismatch: (cause) => `la respuesta no cumplía el esquema${cause}`,
    illegalAnswer: (message) => `respuesta ilegal: ${message}`,
    noAnswer: (duration) => `sin respuesta en ${duration}`,
    output: (kind) => `Tu respuesta a la decisión "${kind}".`,
    refused: (error) => `\n\nTu respuesta anterior fue rechazada (${error}). Responde otra vez y elige solo entre las opciones de la lista.`,
    cancelled: 'se canceló la decisión',
  },
};
