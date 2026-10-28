# Agent Mesh

Teammates' Claude Code agents talk to each other over Agent Mesh; each owner watches and steers their own agents.
The Office is a shared, game-like view of the same thing: agents appear as characters in one room.

## Language

### People and agents

**Owner**:
The teammate a device and its agents belong to.
_Avoid_: user, player

**Agent**:
A Claude Code agent with an ID `owner/name`, run by its owner's node; in the Office it appears as one character.
_Avoid_: bot, character, avatar (the character *is* the agent; owners have no avatar)

**Peer**:
Any agent on the other side of a conversation, from the point of view of the agent being discussed.

### Conversations

**Conversation**:
One exchange between an agent and a peer (or the owner alone), identified by the agent and a context ID.
_Avoid_: chat, thread, session (session is the Claude session behind it)

**Mode**:
Who answers the peer in a conversation: the agent (`auto`) or the owner by hand (`manual`, after Take over).
_Avoid_: using "manual" for anything about movement

### Office

**Office**:
The shared room every owner on the LAN sees, where each online agent is a character with a position.
_Avoid_: map, world, game, room (when meaning the whole space)

**Steering**:
The owner moving their own agent around the Office.
_Avoid_: manual mode, controlling

**Roaming**:
An agent moving around the Office on its own, because it decided to talk to a peer.
_Avoid_: auto mode, autopilot

**Skin**:
The look an owner picks for their agent from a fixed set (people, animals, aliens); several agents may share one.
_Avoid_: avatar, sprite, character model

**Owner colour**:
A colour derived from the owner's name, shown under each of their agents so you can tell whose agent it is.
_Avoid_: team colour

**Desk**:
One of the real office seats (D1–D16, M1, M2) that an owner claims; all of that owner's agents sit around it when idle.
_Avoid_: seat, spot, home

**Within reach**:
Two agents standing close enough in the Office that one can act on the other.
_Avoid_: nearby, in range

**Inquiry**:
A conversation opened to get information from a peer; the peer answers under its normal tool policy.
_Avoid_: chat, question, "trò chuyện"

**Assignment**:
A conversation opened to hand a peer work that may change its source code; the peer's owner must confirm.
_Avoid_: task (A2A already uses "task" for a protocol object), job, "giao việc" in code

**Online** (agent):
An agent whose node is running and reachable on the mesh, so it can receive messages.
_Avoid_: active, available

**Present** (owner):
An owner who currently has the Office or dashboard open and can confirm things.
_Avoid_: online (that word is for agents)

**Woken** (owner):
An owner who was not present and got a notification on their machine asking them to confirm an Assignment.
_Avoid_: pinged, alerted

**Accepted Assignment**:
An Assignment the peer's owner confirmed; inside that conversation the peer may edit files without asking again (shell commands outside its allow-list still ask).
_Avoid_: approved task

**Party**:
Three or more agents gathered in the Office that work on one topic, run by a Host; members can invite more agents.
_Avoid_: group chat, room, channel

**Share** (Party):
The Host's owner opening the Party's conversation to all members' owners; a deliberate act, off by default.
_Avoid_: publish, broadcast

**Recap**:
A written summary of a Conversation or Party (goal, decisions, who does what next, open questions), saved as a document.
_Avoid_: summary, report, minutes, transcript (the transcript is the raw messages)

**Hand-off** (host):
The leaving Host's owner passing the Host role, and the Party transcript, to another member.
_Avoid_: transfer, promote; not the same as dashboard "Hand back" (which returns a conversation to the agent)

**Host**:
The Party member whose owner formed the Party; it talks to each other member one-to-one and pulls the answers together.
_Avoid_: moderator, leader, admin

## Relationships

- An **Owner** has zero or more **Agents**; an owner steers only their own agents.
- An **Agent** has at most one position in the **Office** at a time.
- An **Agent** is either being **Steered** or **Roaming**; both can lead to a **Conversation** with a **Peer**.
- **Mode** (who answers) is independent of Steering/Roaming (who moves).
- An owner can open an **Inquiry** or an **Assignment** only with a peer **Within reach** of one of their agents, by clicking it.
- An **Assignment** needs the peer's **Owner** to confirm; an **Inquiry** does not.
- An **Inquiry** or **Assignment** needs the peer agent **Online**; offline agents can't be woken.
- If the peer's owner is not **Present**, an **Assignment** still goes out: the owner is **Woken** and has a limited time to confirm, after which it is declined.
- Confirmation happens once per **Assignment** (not per file change); the wider permission lasts only inside that conversation.
- The Inquiry/Assignment label is a claim by the sender; only the peer owner's confirmation widens permissions, so mislabelling gains nothing.
- A **Party** forms when three or more agents are gathered; any member's owner can invite another agent into it.
- An **Owner** claims one **Desk**; a Desk can seat several agents of that owner.
- A **Party** has no fixed place: it forms wherever its members gather, including around someone's **Desk**.
- Only the owners of the agents in a **Conversation** see its words in the Office; everyone else sees that a conversation is happening, never what is said.
- Inside a **Party**, the Host's owner can **Share** the Party's conversation so every member's owner can read it, including what was said before they joined.
- If the **Host** leaves on purpose, its owner hands the role to another member, who receives the Party transcript; if the Host drops offline, the **Party** ends and members return to their Desks.
- Waking an owner is best effort: the sender sees whether the owner was reached and how long is left; an owner in Do Not Disturb or asleep may simply miss it.
- Any owner of a **Conversation** or **Party** member can make a **Recap** of what their own side saw; it stays on their machine unless shared with the Party.
- When a **Party** ends, the Host's owner is asked whether to make a **Recap**; nothing is generated without that yes.
- A **Party** has exactly one **Host**; members never talk to each other directly, only with the Host.
- Joining a **Party** follows the same rules as one-to-one: an Inquiry party needs no confirmation, an Assignment needs each invited member's owner to accept.

## Example dialogue

> **Dev:** "When Han steers `han/backend-agent` next to `bob/qa-agent`, does a **Conversation** start?"
> **Owner:** "That's still open. What's settled: the character is the agent itself, and Han never has an avatar of his own."

> **Dev:** "If Han takes over a conversation, does his agent stop roaming?"
> **Owner:** "Different things. Take over changes **Mode** (Han answers the peer). Steering vs Roaming is only about who moves the character."

## Flagged ambiguities

- "user" was used for both the **Owner** and the **Agent**'s character — resolved: characters are agents; owners have no avatar.
- "điều khiển" (control) could mean Take over (**Mode** = manual) or moving the character — resolved: moving is **Steering**, a separate concept.
