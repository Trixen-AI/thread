# MESH

**Your Identity. Your Network. Your Value.**

A social network that reads as a mainstream consumer app first and a crypto app
second. Feed, profiles, communities, messages, notifications and search behave
the way people already expect; ownership, reputation, memberships and payments
sit underneath, surfacing only where they earn their place.

```bash
npm install
npm run dev
```

That starts two processes: the API on `:8787` and the web app on `:5173`. Open
http://localhost:5173, create an account, and you are on the network.

**Two people, two machines.** The dev server binds to your LAN address, so
someone else on the same network can open `http://<your-ip>:5173`, sign up, find
you in Explore, follow you and message you. Messages arrive over a WebSocket, so
they land without a refresh.

`npm run smoke` runs an end-to-end check of the API: two accounts sign up,
discover each other, follow, post, react, and exchange a message over the
socket — including the checks that a private post stays hidden and that a third
party cannot read someone else's thread.

## What actually works

Accounts are real. Sign up with a handle and a password and you exist on the
server — other people can find you, follow you, read your posts and message you.

| Action | Result |
| --- | --- |
| Sign up / sign in | A real account with a scrypt-hashed password and a session token |
| Explore → People | The live directory of everyone registered on this server |
| Search | Queries the server, not only what the browser has cached |
| Follow | Persists, notifies the other person, and changes both feeds |
| Create post | Text, media, polls, events, location and an optional collect price — stored server-side |
| Audience | everyone / followers / only me, enforced in SQL rather than trusted to the client |
| Like, repost, bookmark, collect, comment | Real rows, counted per account, visible to everyone |
| Messages | A real DM thread over a WebSocket, with unread counts and typing indicators |
| Notifications | Generated server-side for follows, likes, comments, tips and collects |
| Profile edit | Writes through to the account |
| Connect wallet | A real browser wallet over EIP-1193, or the local demo one, chosen explicitly |
| Link address | Challenge–response: the wallet signs a server nonce and the server recovers the signer |
| Wallet balances | Read from the chain your wallet is on, native and verified ERC-20s |
| Tip / Collect | Real transfers to a recipient's verified address, with a block-explorer link |
| Launchpad | Every pons v2 launch, read from the factory's own events on Robinhood Chain |
| Create a token | A real `launchToken` / `launchAndBuy` call — supply, curve and quote asset read from the factory |
| Buy / Sell | Real trades against a launch's bonding curve, quoted with the contract's own arithmetic |
| Launch thread | A post that carries the token, published the moment the launch confirms onchain |

## Architecture

```
server/
  db.js          SQLite schema — node:sqlite, no native module to compile
  auth.js        scrypt hashing, session tokens, login throttling
  repo.js        queries, each shaped for the viewer making the request
  index.js       REST routes and the WebSocket
  rpc.js         read-only relay to Robinhood Chain, used as a CORS fallback
  seed.js        fictional personas for a fresh instance
  smoke.mjs      end-to-end API check
  smoke-wallet.mjs  wallet challenge–response check
  smoke-launch.mjs  launch-thread attachment check

src/
  services/
    api/          HTTP client + the live socket
    blockchain/   ChainProvider seam, demo + EVM providers, chain/token
                  registry, wallet discovery, and the services on top
    pons/         pons v2 — verified ABIs, launch, trade, and chain reads
  components/     ui primitives, layout shell, shared social pieces
  features/       feed, stories, create-post, payments, communities, wallet, search
  pages/          one file per route
  store/          app state, selectors, actions
  data/           local demo data + generated artwork
  types/          the domain model
  lib/            store primitive, formatting helpers
```

**What lives where.** The social network is real and shared between everyone on
the server:

> accounts · sessions · profiles · the people directory · follows · posts ·
> likes · reposts · bookmarks · collects · comments · direct messages ·
> notifications · presence

The wallet layer is real when a browser wallet is connected — see
[Connecting a real wallet](#connecting-a-real-wallet) — and falls back to the
local demo provider otherwise.

These remain local demo features, labelled as such in the UI:

> communities and their token gates · the marketplace · seeded collectibles ·
> the reputation score

Communities are seeded identically for everyone, but membership is per-browser.
Posting *into* a community does reach the server — the community id is stored on
the post.

Components read state through the store and call actions; actions call services;
services call the API or the chain provider. No component builds a request or a
chain call itself.

State management is a ~30-line observable store (`lib/store.ts`) on top of
React's `useSyncExternalStore`, rather than a dependency.

### Security

Passwords are hashed with scrypt and a per-user salt, compared in constant time,
and never returned by any endpoint. Sessions are random 256-bit tokens; the
database stores only their SHA-256 digest. Sign-in attempts are throttled per
handle and IP, and the failure message is identical for a wrong password and an
unknown handle. Post visibility and conversation membership are checked in SQL,
not in the client.

**This is a dev server without TLS.** On a LAN, passwords travel in the clear —
use a password you do not use anywhere else, and do not expose it to the
internet as-is.

## The chain seam

`services/blockchain/provider.ts` defines `ChainProvider` — the single seam
between MESH and a chain. Two implementations ship:

- `demoProvider` — local, in-memory, no chain
- `evmProvider` — a real browser wallet over EIP-1193

Choosing one swaps it underneath every service:

```ts
useRealWallet(wallet)  // a browser wallet the user picked
useDemoWallet()        // back to the local stand-in
```

Nothing else changes. Features import `WalletService`, `PaymentService`,
`IdentityService` and friends; no component builds a chain call. Adding
WalletConnect or an embedded signer means writing one more `ChainProvider`.

## Connecting a real wallet

MESH talks to a real EVM chain through the user's own browser wallet over
EIP-1193 — MetaMask, Rabby, Coinbase Wallet, anything that announces itself via
EIP-6963. There are no RPC keys to configure: the wallet is the transport, so
MESH never holds credentials and never sees a private key.

Connect from the wallet screen, pick your wallet, and MESH reads the account,
the chain and the balances straight from it.

Ships with parameters for **Ethereum, Robinhood Chain, Base, Arbitrum, Optimism
and Polygon**, plus Sepolia and Base Sepolia, which are marked as testnets.
Mainnet is the normal case; the badge exists so the difference is never a matter
of remembering which chain you were on.

If your wallet does not know a network yet, MESH offers to add it via
`wallet_addEthereumChain` and then switches.

### Robinhood Chain

Chain ID **4663** — an Arbitrum Orbit L2 settling to Ethereum, ETH native.
Parameters cross-checked against the `ethereum-lists/chains` registry entry
`eip155-4663.json`, the source behind chainlist.org.

The registry lists several RPCs and explorers for it. MESH uses the two that
cannot be domain-squatted: the RPC on Robinhood's own domain
(`rpc.mainnet.chain.robinhood.com`) and Blockscout's hosted explorer. There is a
known ecosystem of lookalike RPCs and fake explorers around this chain — **after
switching, confirm your wallet reports chain 4663 before sending anything.**

No token list ships for it, because no token contract addresses have been
verified on that chain. Native ETH works; add tokens once you can confirm their
addresses.

### Any other network

The list is open. MESH works on whatever chain your wallet is already on, even
one it has never heard of — it reads the native balance and simply has no token
list for it. To give that chain a name, an explorer link and a token list, add
it from **Wallet → network → Add a network** with the chain ID, currency symbol
and RPC URL. If your wallet does not know the network either, MESH offers it via
`wallet_addEthereumChain` using exactly the values you supplied.

**MESH ships parameters only for chains it can state with confidence, and will
not guess the rest.** A chain ID or RPC that someone assumed is how funds end up
somewhere they cannot be recovered from — so for a newer network, paste the
values that network itself publishes. RPC URLs must be https.

**Linking an address is a challenge–response, not a claim.** The server issues a
single-use nonce, your wallet signs a message containing it, and the server
recovers the signer. An address is stored only when the recovered signer matches
— so nobody can attach someone else's wallet to their profile by typing it in,
a nonce cannot be replayed, and one address belongs to one account. Tips and
collects go to that verified address; an account that has not linked one simply
cannot be tipped, and the button says so rather than guessing a destination.

`npm run smoke` covers this path with a throwaway key: a valid signature links,
a signature from a different key is rejected, a replayed nonce is rejected, and
an address already claimed elsewhere is refused.

### What it will not pretend to know

- **Prices.** No feed is configured, so balances show in their own units and the
  wallet says "No price feed configured". It never renders an invented dollar
  total — least of all `$0.00` for a wallet holding real funds.
- **Token contracts.** Every address in the registry is checked against the
  chain by reading the contract's own `symbol()` and `decimals()`, and the
  symbol must match exactly. A mismatch drops the token instead of showing a
  balance for — or offering to send to — an address that is not what the
  registry claims.
- **Network parameters.** Chains MESH does not ship are added by the user from
  the values that chain publishes, never inferred.
- **NFTs and full history.** Both need an indexer, which is not configured, so
  they come back empty. Transfers made through MESH in the session are listed.
- **The marketplace.** Part of the local demo layer; it has no contract to buy
  from, and says so on a real chain rather than taking money for nothing.

A transfer returns `{ kind: 'onchain', hash, chainId, explorerUrl }` only after
the transaction is mined and did not revert, and the receipt links to the block
explorer. Confirmation happens in your wallet, not in MESH.

## The launchpad — pons v2

MESH launches and trades tokens on **pons v2**, a launch protocol on Robinhood
Chain. A creator deploys a token, the public buys it from a bonding curve, and
once the curve is bought out the launch graduates into a Uniswap v4 pool whose
liquidity is locked permanently. Every transaction is signed by the user's own
wallet; pons never takes custody, and neither does MESH.

Three screens:

- **`/launchpad`** — every launch, read from the factory's `TokenLaunched`
  events. No pons service sits in between.
- **`/launchpad/create`** — the create form. Every field maps to something the
  contract takes: the `TokenParams` struct, the launch config, the quote asset,
  the snipe-tax exemptions, and an optional opening buy through the
  launch-and-buy router.
- **`/t/:address`** — one token: its curve, a place to trade it, and its thread.

Reading needs no wallet. Browsing launches, watching a curve fill and checking a
creator's terms all work signed out, because a launchpad that demands a wallet
before it will tell you anything is asking you to trust it first.

### Everything is read from the chain, not assumed

The form does not render until the factory has answered: what it charges, which
configs are open, and which assets it will accept. There are no hard-coded
economics — supply, trade fee, opening price, graduation threshold and the
curve/pool split are all computed from the config the factory returns.

Quote assets get the same treatment MESH already applies to its token registry:
the shipped list in `services/pons/pairTokens.ts` is a starting point, never a
source of truth. Each candidate is checked three ways before it is offered —
the factory still approves it, the factory has economics recorded for it, and
the token itself reports the symbol and decimals the registry claims. Anything
that disagrees is dropped rather than shown, because an asset that would revert
at launch should never appear in a picker.

### What the chain says that the documentation does not

The v2 documentation was the starting point; every signature in
`services/pons/abi.ts` was then confirmed against the deployed bytecode, and
each read was called against a live launch. Three things came back different:

- **Public launching is open.** The docs say launching is restricted to
  whitelisted addresses. On chain, `launchEnabled()` is true and
  `canLaunch(address)` returns true for addresses that are not on any list. The
  UI still asks the contract per address rather than trusting either source,
  because the gate can close again.
- **Selling requires an ERC-20 approval.** The docs mention approval only for
  the buy leg of a custom-pair launch. In fact the curve pulls the launch token
  with `transferFrom`, so a holder must approve the curve before selling —
  including on a native-ETH launch, where nothing else in the trade involves an
  ERC-20. Simulated against live curves, every holder with a zero allowance
  reverted with `ERC20InsufficientAllowance` and every holder with an allowance
  settled. Without that step a holder's first sell always fails, so
  `sell()` approves first.
- **The approved quote assets are not published anywhere.** They were
  discovered by reading the factory's own events: 53 assets, mostly tokenised
  equities (NVDA, TSLA, SPY, AAPL…) plus USDG and cbBTC. Native ETH is still
  the most-used pairing by a wide margin.

### Quotes match the contract to the wei

The curve exposes no quote function — pricing is deterministic, so a quote is
reproduced from the reserves and the two fee rates. `computeBuy` and
`computeSell` in `services/pons/trade.ts` follow the contract's own integer
order, including the parts that are easy to get wrong:

- fees come off a **buy** on the way in, and off a **sell** on the way out, so
  quoting a sell as a mirrored buy overstates the proceeds
- the snipe tax applies to buys only, is keyed to the **recipient** rather than
  the sender, and is capped so a buyer always nets at least 1% of spend
- a buy that would cross the reserved allocation fills to the edge and reprices
  from the token side, refunding the difference

Both were checked against live curves at a pinned block, simulating the real
`buy` and `sell` and comparing outputs. They agree exactly. Pinning the block
matters: this chain mints roughly ten blocks a second, so an unpinned comparison
measures how fast the curve moved, not whether the arithmetic is right.

Reads go through Multicall3 rather than JSON-RPC batching — verifying the quote
assets alone is over two hundred `eth_call`s, and a batch that size is rejected
by the gateway in front of the RPC. The transport also carries a fallback: the
chain's RPC intermittently answers with two `Access-Control-Allow-Origin`
headers, which browsers reject outright, so `server/rpc.js` relays the same
read-only calls from the server when that happens. It forwards a fixed list of
read methods to a fixed upstream and can never relay a signed transaction.

### The thread

A launch is an event worth talking about, so the create form carries the post
that announces it. The text is drafted from the form and stays in sync until the
creator edits it, after which it is theirs.

The order matters: the launch goes first, and the thread is published only after
a mined, non-reverted transaction. A thread for a token that never launched
would be a post about nothing. If the launch succeeds and the post fails, the
outcome says so plainly rather than implying the token did not exist.

A post carrying a token renders as a card in the feed that opens the curve. The
card is a pointer — name, symbol and a way in. Price and progress live on the
token page and are read live, rather than being frozen into the post at the
moment it was written. Anyone can add to a token's thread from its page, and
`npm run smoke` covers the attachment end to end, including that a malformed one
is dropped rather than stored.

## The demo boundary

With no wallet connected — or when the demo wallet is chosen explicitly — MESH
runs `demoProvider`, a local, in-memory stand-in. It is deliberately limited so
nothing can be mistaken for a chain:

- **It never produces a transaction hash.** Receipts settle as
  `{ kind: 'demo', reference }`. Only a provider that actually broadcast a
  transaction returns `{ kind: 'onchain', hash, chainId }`.
- **It cannot sign**, so `proveOwnership` returns `verified: false` and the
  wallet screen says why instead of showing a green check.
- **Balances live in memory** and reset on reload.
- **Swap is disabled** rather than simulated — no liquidity provider exists.
- **Buy credits the demo wallet** and says so; no payment provider is involved.
- Reputation is labelled a demo score, and its factors are itemised — a number
  you cannot explain to the person it describes isn't reputation.

Every screen where value moves carries this labelling. `wallet.isDemo` comes
from the active provider and is never hard-coded — which is exactly why
switching to a real wallet changes what the UI claims, with no other edits.

## Data

A fresh instance seeds ten fictional personas and a dozen posts, so the first
person to sign up does not land in an empty room. They are invented — nothing
they "say" should be read as a statement by a real person or company — and the
distinction is enforced rather than assumed:

- they carry no password, so nobody can sign in as one
- they are flagged `is_demo` in the database and wear a **Demo** badge in the
  directory and on their profile
- they never reply to messages
- real accounts sort above them everywhere people are listed

`data/seed.ts` now holds only the local demo layer: communities, the
marketplace, trending topics and the stand-in wallet balances.

`data/visuals.ts` generates every avatar, cover and piece of post media as an
SVG from a seed, so the app ships no bitmap assets and hot-links nothing. Real
uploads (which the composer already supports) replace these at the data layer.

The stories rail is derived from real posts that carry artwork — opening one
opens the actual post. A rail of invented stories for people who never posted
any would be decoration pretending to be content.

## The mark

A single ribbon folded into an M: one zigzag drawn as four round-capped
strokes, where the two inner strokes run behind the outer legs and darker. That
ordering is what reads as a fold rather than as four separate bars.

It lives in `src/components/brand/Logo.tsx` as vector strokes on a 100×100
grid — crisp at 14px and at 300px, and the `mono` treatment is one attribute
rather than a second asset. Three forms:

- `LogoMark` — the artwork on its own, colour or mono
- `LogoTile` — the mark on a light squircle, for dark or busy backgrounds
- `Logo` — mark plus wordmark

The favicon in `index.html` is the same geometry inlined as a data URI; the
vertex table at the top of `Logo.tsx` is the source of truth for both.

## Design — the material system

Modelled on iOS. The rule that keeps it from turning to mush: **glass is a
material for chrome, not for content.** Navigation bars, the tab bar, sheets,
menus, toasts and floating controls are translucent; cards and body text sit on
near-opaque surfaces where they stay crisp. That is both the correct design
call and the cheap one — each blurred surface costs a compositor layer.

Three things make it read as glass rather than as a transparent div:

1. **Something behind it.** A fixed, low-saturation ambient wash sits under the
   whole app, so translucent surfaces pick up colour as content scrolls beneath
   them. Glass over flat grey is just a grey box.
2. **Blur paired with saturation.** `blur(28px) saturate(180%)` — the
   saturation boost is what stops the material going chalky.
3. **A lit edge.** An inset top highlight plus a hairline ring, so the material
   has a defined boundary instead of dissolving into the page.

Materials are graded like iOS's own: `.glass-thin` → `.glass` → `.glass-thick`,
differing in opacity and blur radius, plus `.glass-dark` for overlays on media.
Separators are true 0.5px hairlines (`.hairline`), not 1px borders, which read
as heavy at this scale. Tokens and materials live in `src/index.css`.

Type follows the SF scale — SF Pro where it exists, Inter as the
metric-compatible stand-in — with negative tracking that tightens as size
grows. Motion uses iOS springs: `--ease-sheet` for sheets and sliding
indicators, `--ease-tap` for the press-scale on every control.

Responsive by structure, not by shrinking: desktop is three columns
(nav · feed · rail), tablet drops the rail, mobile is a single column with a
stories rail, a full-bleed feed and a floating tab bar that content scrolls
under.

Accessibility: keyboard focus rings, labelled icon buttons, `aria-live` toasts,
dialogs that trap Escape and lock background scroll, and full support for
`prefers-reduced-motion` **and `prefers-reduced-transparency`** — the latter
turns every material solid rather than leaving text over a live blur. The same
solid fallback applies where `backdrop-filter` is unsupported.
