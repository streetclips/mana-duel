# Rules

Mana Duel plays by the core rules of Magic: The Gathering, trimmed to what its three decks need. This page is the
contract of `src/engine`: what is implemented, and where it deliberately differs from Magic.

## Game

- Two players, 20 life each, seven-card opening hands. Each player brings one of three 40-card decks, chosen
  before the game: Emberwild (red/green), Dawntide (white/blue) or Duskmire (black). Both may bring the same deck.
  No nonland card appears in two decks; basic lands may.
- The starting player comes from a seeded coin flip (or `startingPlayer`). They skip their first draw.
- London mulligan: shuffle the hand away, draw seven, and once you keep, put one card on the bottom per mulligan.
  The starting player decides first. At most six mulligans.
- You lose at 0 life or less, when you draw from an empty library, or when you concede. If both players lose at
  once the game is a draw. A game past turn 200 is a draw (safety net; decking ends games long before).

## Turn

`untap → upkeep → draw → main 1 → beginning of combat → declare attackers → declare blockers → first-strike damage
→ combat damage → end of combat → main 2 → end → cleanup`

- Untap: the active player's permanents untap, their creatures stop being summoning sick, the land drop resets.
- Draw: the active player draws one card (except the starting player on turn 1).
- One land per turn, in your main phase, with an empty stack.
- Combat is skipped past "declare attackers" when nobody attacks. The first-strike step only exists when a combatant
  has first strike or double strike.
- Cleanup: the active player discards down to seven cards, then all damage is removed and "until end of turn"
  effects end.

## Priority and the stack

- Players receive priority in both main phases, after attackers are declared, after blockers are declared, in the
  end step, and in any other step while something is on the stack.
- The active player receives priority first. Casting or activating keeps priority with you. When both players pass
  in succession, the top of the stack resolves and the active player receives priority again; with an empty stack
  the step ends instead.
- Lands, creatures and sorceries need your main phase and an empty stack. Instants and activated abilities work
  whenever you have priority.
- A spell or ability whose targets are all illegal on resolution fizzles. A fight does nothing if either creature is
  gone. One spell cannot pick the same target twice.
- A counterspell targets a spell on the stack, never an ability. The countered spell leaves the stack for its
  owner's graveyard without resolving: a countered creature never enters, so its "enters" triggers never happen.
  Counterspells can counter counterspells.

## Mana

- Lands and Grove Tender tap for one mana of their color. A summoning-sick creature cannot tap for mana.
- Paying is automatic: the engine taps lands before creatures and keeps untapped the colors your other cards need.
  There is no mana pool: mana appears exactly when a cost is paid.

## Combat

- Attackers: your untapped creatures that have been under your control since your turn began (or have haste) and
  lack defender. Attacking taps them unless they have vigilance. Every attacker attacks the opponent.
- Blockers: untapped creatures. A blocker blocks one attacker; an attacker can take several blockers. Flying can
  only be blocked by flying or reach; menace needs two or more blockers.
- Damage is simultaneous. Each attacker splits its damage automatically: lethal damage to each blocker in the order
  that destroys the most (least remaining toughness first), the rest to the last blocker, or to the player with
  trample. Deathtouch makes one damage lethal, trample assignment included. Lifelink gains that much life.
- An attacker stays blocked when its blockers leave combat: it deals no damage unless it has trample.
- State-based actions destroy creatures with damage at least equal to their toughness, or with any damage from a
  deathtouch source.

## Abilities

- Triggers: "when this creature enters", "when this creature dies", "whenever this creature attacks". They go on the
  stack the next time a player would receive priority, the active player's first; targets are chosen then. A trigger
  with no legal target is skipped.
- Activated abilities use the stack and can be activated as often as you can pay (Crag Dragon: `{R}: +1/+0`,
  Duskmire Shade: `{B}: +1/+1`).
- Damage from a creature's ability or a fight uses that creature's deathtouch and lifelink. Death triggers work
  from the graveyard: Crypt Ghoul and Nightveil Wraith deal their damage after they die.

## Effects

- **Damage** to a creature is marked on it until cleanup; to a player it costs that much life.
- **Pump** (`+N/+N` or `-N/-N`) lasts until end of turn. A creature whose toughness drops to 0 or below dies, and
  damage already marked counts against the lowered toughness.
- **Destroy** puts a creature into its owner's graveyard, which triggers "when this creature dies".
- **Return to hand** puts a creature back in its owner's hand: it leaves combat and loses its damage, pumps and
  tapped state. Cast again, it is a new creature with summoning sickness.
- **Counter** removes a spell from the stack (see above).
- **Draw**, **gain life** and **lose life** affect the controller of the spell or ability. Losing life is not
  damage: lifelink and deathtouch don't apply, and it can make you lose the game.
- "Target tapped creature" (Dawn's Verdict) only accepts a creature that is tapped when the spell is cast and still
  tapped when it resolves; attacking taps a creature unless it has vigilance.

## Automatic passing (UI only)

The engine always asks. The app answers "pass" for you when:

- you have nothing you could do;
- your own spell or ability is on top of the stack;
- it is the opponent's main phase or end step, your end step, or you just declared your attackers.

It stops for you when the opponent casts something you could answer, when the opponent attacks (before blocks),
after blockers are declared, and in your main phases — each time only if you have something to play. **End turn**
passes until your turn is over and skips your attack; it still stops if the opponent casts a spell.

## Differences from Magic

| Magic | Mana Duel |
| --- | --- |
| Priority in untap, upkeep, draw, beginning of combat and damage steps | Only while something is on the stack |
| The attacking player orders and splits damage among blockers | Automatic split that destroys the most blockers |
| Mana pool and manual tapping | Automatic payment |
| The same object may be targeted by two "target" words | Targets are always distinct |
| Counterspells can counter abilities or specific kinds of spell | Only "counter target spell", any spell |
| Tokens, counters, exile, auras, equipment, replacement effects, layers | Not in the engine yet |
