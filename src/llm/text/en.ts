import { count } from '../../i18n';
import type { LlmText } from './types';

export const en: LlmText = {
  systemPrompt: (keywordLines) => `You are an expert player of Mana Duel, a two-player card game based on the basic rules of Magic: The Gathering. You play the seat called "you"; the other seat is "opponent". You win when the opponent's life reaches 0 or when they have to draw from an empty library.

Rules:
- Both players start with 20 life, a 40-card deck and a hand of 7. You can play one land per turn, in your main phase, while the stack is empty; "extraLandsThisTurn" counts the additional lands an effect lets you play this turn. A land that "enters tapped" gives no mana until your next turn.
- Lands and some creatures tap for mana. Payment is automatic: the game taps your untapped sources for you. "availableMana" lists the untapped sources, one mana each ("R/G" means either of those colors).
- Creatures, lands and sorceries: only in your own main phases and with an empty stack. Instants, creatures with flash and activated abilities: whenever you have priority, even in response to a spell.
- A turn goes in this order: untap, upkeep, draw, main phase, combat (declare attackers, declare blockers, damage), second main phase, end step and cleanup. In cleanup you discard down to 7 cards, and damage and "until end of turn" effects wear off. +1/+1 counters ("plusOneCounters") stay on a creature until it leaves the battlefield.
- A creature can't attack or pay {T} costs until its controller has controlled it continuously since the start of their turn ("summoningSick"), unless it has haste; it can still block. Attacking taps the creature, unless it has vigilance. Tapped creatures can't block.
- Each blocker blocks one attacker; several creatures can block the same attacker. Combat damage is dealt at the same time; an attacker's damage is divided among its blockers automatically. Unblocked attackers deal damage to the defending player.
- A creature dies when the damage marked on it reaches its toughness.
- Spells and abilities go on the stack and resolve last in, first out when both players pass priority in a row. A spell whose targets are all gone does nothing.
- Tokens ("token": true) are creatures that effects create. A token that leaves the battlefield ceases to exist.
- Relics ("relics") stay with their player for the whole game, off the battlefield: nobody can target or remove them, and their abilities trigger like a permanent's. "At the beginning of your upkeep" triggers once in each of its player's turns, before the draw.
- "damagedThisTurn": true marks a player who was dealt damage this turn, which some cards check. Losing life is not being dealt damage. It clears when the next turn begins.
- When an effect makes a player discard, that player chooses the cards. An ability that sacrifices its creature as a cost puts it into the graveyard at once, like a death.
- Keywords:
${keywordLines}

You see your hand, both battlefields, both graveyards, the stack, the recent events and the reasons you gave for your last decisions. The opponent's hand and both libraries are hidden: you only know how many cards they hold. Both decklists are public.

Every message ends with the one decision the game is waiting for, with its legal options. Answer only with the JSON object the schema describes: first a short "reason" (one or two sentences, in English) and then your decision. Choose only among the listed options.

To play well: play a land every turn and spend your mana; attack when the trade favors you or the opponent can't block well; keep enough blockers back when the opponent threatens lethal damage; aim removal at the biggest threat; don't lose creatures in bad blocks unless the damage would kill you; save instants for the moment they matter most; keep to the plan of your recent thoughts while it still fits the game.`,
  sections: {
    cards: 'Cards in this game',
    decks: 'Decks',
    yourDeck: 'Your deck',
    opponentDeck: "The opponent's deck",
    events: 'Recent events, oldest first',
    thoughts: 'Your recent thoughts, oldest first',
    state: 'Game state from your seat',
    decision: (kind) => `Decision: ${kind}`,
    options: 'Options:',
  },
  decision: {
    reason: 'Your reasoning, in English, in one or two short sentences.',
    you: 'you',
    and: ' and ',
    targeting: (targets) => ` targeting ${targets}`,
    passResolves: "Pass priority: you don't respond; the top of the stack resolves when both players pass",
    passEndStep: 'Pass priority: you do nothing else this turn',
    passMovesOn: (step) => `Pass priority: you do nothing now; when both players pass, the game moves on to: ${step}`,
    keep: (handSize, bottom) => `Keep this hand of ${handSize} cards${bottom > 0 ? ` and then put ${count(bottom, 'card', 'cards')} from it on the bottom` : ''}`,
    mulligan: (bottom) => `Mulligan: shuffle this hand away, draw a new hand of 7 and put ${count(bottom, 'card', 'cards')} on the bottom`,
    playLand: (name, id) => `Play the land ${name} (${id})`,
    cast: (name, id, cost, targets) => `Cast ${name} (${id}) for ${cost}${targets}`,
    activate: (source, text, targets) => `Activate ${source}: "${text}"${targets}`,
    chooseTargets: (targets) => `Target: ${targets}`,
    noAttack: 'Attack with nothing',
    attack: (cards) => `Attack with ${cards}`,
    noBlock: "Don't block",
    block: (blocks) => `Block: ${blocks}`,
    blocks: (blocker, blockerId, attacker, attackerId) => `${blocker} (${blockerId}) blocks ${attacker} (${attackerId})`,
    bottom: (cards) => `Put ${cards} on the bottom`,
    discard: (cards) => `Discard ${cards}`,
    concede: 'Concede',
    yourTurn: 'your turn',
    opponentTurn: "the opponent's turn",
    yourCard: (name) => `your ${name}`,
    opponentCard: (name) => `the opponent's ${name}`,
    priorityWithStack: (whose, step, top) =>
      `You have priority during ${whose}, step: ${step}. On top of the stack is ${top}: you can respond or let it resolve.`,
    priority: (whose, step) => `You have priority during ${whose}, step: ${step}, with an empty stack.`,
    anyTrigger: 'Choose the targets of a triggered ability.',
    trigger: (name, id, text) => `Your ${name} (${id}) has triggered: "${text}" Choose its targets.`,
    choiceId: 'The id of the option you choose.',
    choiceAnswer: 'Answer with "choice": the id of exactly one option.',
    notAnOption: (choice) => `"${choice}" is not one of the listed options`,
    attackShape: 'For each creature that can attack: true to attack with it, false to hold it back.',
    attackQuestion: (untapped, blockers) =>
      `Declare attackers. The opponent has ${count(untapped, 'untapped creature', 'untapped creatures')} that could block${blockers ? `: ${blockers}` : ''}.`,
    attackAnswer: 'Answer with "attack": an object that sets the id of each listed creature to true (attacks) or false (stays back).',
    blockerShape: (creature) => `${creature}: the id of the attacker it blocks, or "none"`,
    blocksShape: 'For each of your creatures that can block: the attacker it blocks, or "none".',
    blockQuestion: (attackers) =>
      `The opponent attacks with ${attackers}. Declare blockers: each of your creatures blocks at most one attacker, and several can block the same attacker.`,
    blockOption: (id, creature, attackers) => `${id}: ${creature} — can block ${attackers}`,
    blockAnswer: 'Answer with "blocks": an object that maps each listed blocker id to the id of the attacker it blocks, or "none".',
    cleanupDiscard: (amount) => `Cleanup: you have more than 7 cards in hand. Discard ${count(amount, 'card', 'cards')}.`,
    forcedDiscard: (source, amount) => `${source} makes you discard ${count(amount, 'card', 'cards')}: choose which.`,
    yourSource: (name) => `Your ${name}`,
    opponentSource: (name) => `The opponent's ${name}`,
    cardsShape: (amount) => `Exactly ${count(amount, 'card id', 'card ids')} from your hand.`,
    bottomQuestion: (mulligans, amount) =>
      `You kept your hand after ${count(mulligans, 'mulligan', 'mulligans')}: put ${count(amount, 'card', 'cards')} from your hand on the bottom of your library.`,
    cardsAnswer: (amount) => `Answer with "cards": exactly ${count(amount, 'card id', 'card ids')} from the list.`,
    wrongCardCount: (amount, chosen) => `choose exactly ${count(amount, 'different card', 'different cards')} from your hand, not ${chosen}`,
    mulliganQuestion: (mulligans) => `Opening hand: keep it or mulligan? You have taken ${count(mulligans, 'mulligan', 'mulligans')}.`,
  },
  player: {
    noEndpoint: 'OpenRouter 404: no provider of this model accepts the JSON schema (or the reasoning effort)',
    schemaMismatch: (cause) => `the answer didn't match the schema${cause}`,
    illegalAnswer: (message) => `illegal answer: ${message}`,
    noAnswer: (duration) => `no answer in ${duration}`,
    output: (kind) => `Your answer to the "${kind}" decision.`,
    refused: (error) => `\n\nYour previous answer was refused (${error}). Answer again and choose only among the listed options.`,
    cancelled: 'the decision was cancelled',
  },
};
