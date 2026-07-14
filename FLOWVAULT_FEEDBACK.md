# FlowVault SDK - Verified Bug Report and Builder Feedback

> Findings from building Sanctuary, a rotating savings circle on FlowVault v2.
> This report intentionally separates reproducible SDK defects from contract
> limitations, infrastructure failures, and application integration mistakes.

## Audit scope

- Audit date: July 09, 2026
- npm package: `flowvault-sdk@0.1.2` (`latest` at audit time)
- FlowVault contract: `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2`
- SDK dependencies resolved in this project:
  - `@stacks/transactions@7.5.0`
  - `@stacks/connect@8.2.6`
- Runtime used for the offline reproductions: Node.js `24.14.1`

The audit used:

1. The published SDK runtime and declarations in
   `node_modules/flowvault-sdk/dist`.
2. The README shipped in the `flowvault-sdk@0.1.2` npm package.
3. The deployed contract ABI and source from the Hiro testnet API:
   - `https://api.testnet.hiro.so/v2/contracts/interface/STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD/flowvault-v2`
   - `https://api.testnet.hiro.so/v2/contracts/source/STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD/flowvault-v2?proof=0`
4. Small offline reproductions that call the published package directly, without
   Sanctuary wrappers or application state.

A finding is called a bug below only when it is deterministic, attributable to
the SDK or its shipped documentation, and contradicts the contract ABI, the
SDK's public types, or the SDK's documented behavior.

## Executive summary

| # | Verified defect | Severity | Affected surface |
|---|---|---|---|
| 1 | Shipped wallet example converts `PostConditionMode.Deny` to `"allow"` | High | README / wallet integration |
| 2 | Valid contract principals are rejected as split recipients and read results | High | `setRoutingRules`, `getRoutingRules`, `getVaultState` |
| 3 | Missing, malformed, and error-shaped executor results are returned as successful transactions | High | `contractCallExecutor` mode |
| 4 | Valid Clarity uint balances become unreadable above `Number.MAX_SAFE_INTEGER` | Medium | Read parsers and return types |
| 5 | Addresses from the wrong Stacks network pass constructor validation | Medium | Configuration validation |
| 6 | `senderKey` and `senderAddress` can disagree, so validation uses a different signer from the transaction | Medium | Signer configuration and preflight validation |

---

## Bug 1: The shipped wallet adapter silently downgrades deny mode to allow

**Severity:** High

### Evidence

`FlowVault.resolvePostConditionMode()` normalizes the configured value to the
numeric `@stacks/transactions` enum before invoking `contractCallExecutor`.
With the installed dependency:

Published locations:

- `node_modules/flowvault-sdk/dist/FlowVault.js:130-150`
- `node_modules/flowvault-sdk/README.md:111-114`

```text
PostConditionMode.Allow = 1
PostConditionMode.Deny  = 2
```

However, the browser-wallet example shipped in the SDK README uses:

```ts
postConditionMode:
  String(call.postConditionMode ?? "allow").toLowerCase().includes("deny")
    ? "deny"
    : "allow"
```

For a real deny-mode request, this evaluates `String(2)` and returns `"allow"`.

### Minimal reproduction

```ts
import { FlowVault } from "flowvault-sdk";

let captured: any;
const vault = new FlowVault({
  network: "testnet",
  senderAddress: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
  postConditionMode: "deny",
  contractCallExecutor: async (request) => {
    captured = request;
    return { txid: `0x${"1".repeat(64)}` };
  },
});

await vault.deposit(1);

const documentedMapping =
  String(captured.postConditionMode).toLowerCase().includes("deny")
    ? "deny"
    : "allow";

console.log(captured.postConditionMode, documentedMapping);
// 2, "allow"
```

### Impact

An integrator who explicitly selects deny mode and follows the official example
silently sends allow mode to the wallet. Allow mode permits asset movements not
covered by the supplied post-conditions, so this is a security-relevant
documentation defect rather than a cosmetic example problem.

### Recommended fix

- Fix the example by comparing against the enum:

```ts
call.postConditionMode === PostConditionMode.Deny ? "deny" : "allow"
```

- Better: pass `"allow" | "deny"` to custom executors instead of first
  normalizing to an internal numeric enum.
- Add a documentation test that executes every published wallet example.

---

## Bug 2: The SDK rejects valid contract principals

**Severity:** High

### Evidence

The deployed `set-routing-rules` ABI defines:

```clarity
(split-address (optional principal))
```

A Clarity `principal` may be a standard principal such as `ST...` or a contract
principal such as `ST....receiver`.

The SDK instead calls `validateStacksAddress()` for every `splitAddress`. That
helper accepts standard addresses only. The same incorrect validation is used
when parsing `split-address` from `getRoutingRules()` and `getVaultState()`.

Published locations:

- `node_modules/flowvault-sdk/dist/FlowVault.js:260-280`
- `node_modules/flowvault-sdk/dist/utils.js:238-256`
- `node_modules/flowvault-sdk/dist/utils.js:294-333`

### Minimal reproduction

```ts
import { FlowVault, isValidAddress } from "flowvault-sdk";
import { cvToString, principalCV } from "@stacks/transactions";

const account = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
const recipient = `${account}.receiver`;

console.log(cvToString(principalCV(recipient)));
// ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG.receiver

console.log(isValidAddress(recipient));
// false

const vault = new FlowVault({
  network: "testnet",
  senderAddress: account,
  contractCallExecutor: async () => ({ txid: `0x${"1".repeat(64)}` }),
});

await vault.setRoutingRules({
  lockAmount: 0,
  lockUntilBlock: 0,
  splitAddress: recipient,
  splitAmount: 1,
});
// InvalidAddressError: Invalid Stacks address: ...receiver
```

The read parser fails too when given an on-chain optional contract principal:

```text
ParsingError: split-address is not a valid address.
```

### Impact

- SDK users cannot route funds to DAO treasuries, escrow contracts, payroll
  contracts, or any other contract principal even though the deployed
  FlowVault contract supports it.
- A routing rule created outside this SDK with a contract recipient can make
  `getRoutingRules()` and `getVaultState()` fail for that user.
- The failure happens in the SDK before broadcast, so this is not a contract
  limitation or an application error.

### Recommended fix

- Introduce principal validation that accepts both standard and contract
  principals.
- Preserve the full contract identifier when parsing read results.
- Rename address-only helpers where appropriate so `address` and `principal`
  are not treated as interchangeable types.
- Add write and read tests for both principal variants.

---

## Bug 3: Invalid executor results are reported as successful transactions

**Severity:** High

### Evidence

`ContractCallExecutor` returns `Promise<unknown>`. After it resolves, the SDK
tries to find `txid`, `txId`, or `id`. If none exists, it returns:

```ts
{ txId: "wallet-submitted", status: "success" }
```

It does not reject JSON-RPC error objects, empty results, empty txids, or
malformed strings. The public `TransactionResult` type says `txId` is the
on-chain transaction ID and `status: "success"` means the transaction was
accepted into the mempool.

Published locations:

- `node_modules/flowvault-sdk/dist/FlowVault.js:139-169`
- `node_modules/flowvault-sdk/dist/types.d.ts:81-92`

### Minimal reproduction and actual output

```ts
const cases = [
  {},
  { error: "rejected", reason: "user cancelled" },
  "not-a-transaction-id",
  { txid: "" },
  { txid: "banana" },
];

for (const response of cases) {
  const vault = new FlowVault({
    network: "testnet",
    senderAddress: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    contractCallExecutor: async () => response,
  });
  console.log(await vault.deposit(1));
}
```

```text
{ txId: "wallet-submitted", status: "success" }
{ txId: "wallet-submitted", status: "success" }
{ txId: "not-a-transaction-id", status: "success" }
{ txId: "", status: "success" }
{ txId: "banana", status: "success" }
```

A thrown wallet cancellation is also classified as a `NetworkError`:

```text
NetworkError: Wallet contract call "deposit" failed: User canceled the request
```

### Impact

Downstream code can:

- store a fake transaction reference;
- show an explorer link for a transaction that does not exist;
- advance an off-chain workflow after a rejected or cancelled wallet request;
- retry incorrectly because a user rejection is labelled as a network failure.

Sanctuary had to reject the `"wallet-submitted"` sentinel itself. That guard is
a workaround for SDK result handling, not an error caused by Sanctuary.

### Recommended fix

- Replace `Promise<unknown>` with a documented executor result contract.
- Reject resolved error envelopes.
- Require and validate a 32-byte transaction ID for broadcast results.
- If a wallet returns only a signed transaction, return a separate typed state
  such as `{ status: "signed", txRaw }`.
- Use a discriminated result:

```ts
type TransactionResult =
  | { status: "submitted"; txId: string }
  | { status: "signed"; txRaw: string }
  | { status: "cancelled" };
```

- Preserve wallet cancellation/error codes instead of converting all
  non-contract errors to `NetworkError`.

---

## Bug 4: Valid Clarity uint values become unreadable above the JS safe range

**Severity:** Medium

### Evidence

Write methods accept `bigint` and numeric strings for micro-unit amounts. The
Clarity contract stores `uint128`, so values are not limited to JavaScript's
safe integer range.

The read parsers convert every amount to `number` and throw when a value exceeds
`Number.MAX_SAFE_INTEGER`.

Published locations:

- `node_modules/flowvault-sdk/dist/utils.js:209-234`
- `node_modules/flowvault-sdk/dist/utils.js:294-333`
- `node_modules/flowvault-sdk/dist/types.d.ts:72-101`

### Minimal reproduction

```ts
import { parseMicroAmount, parseVaultState } from "flowvault-sdk";
import { responseOkCV, tupleCV, uintCV, noneCV } from "@stacks/transactions";

const amount = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

console.log(parseMicroAmount(amount));
// 9007199254740992n - accepted as a write amount

const rules = tupleCV({
  "lock-amount": uintCV(amount),
  "lock-until-block": uintCV(0),
  "split-address": noneCV(),
  "split-amount": uintCV(0),
});

const response = responseOkCV(tupleCV({
  "total-balance": uintCV(amount),
  "locked-balance": uintCV(0),
  "unlocked-balance": uintCV(amount),
  "lock-until-block": uintCV(0),
  "current-block": uintCV(1),
  "routing-rules": rules,
}));

parseVaultState(response);
// ParsingError: total-balance exceeds safe integer range.
```

### Impact

- The SDK can submit a value that its own read API cannot later represent.
- `getVaultState()` and `getRoutingRules()` can fail on valid contract state.
- The public API is asymmetric: `MicroAmount` supports `bigint`, while returned
  micro amounts are forced to `number`.

`Number.MAX_SAFE_INTEGER` micro-USDCx is about 9.0 billion USDCx. That is a high
per-vault threshold, so this is not the most likely production failure, but it
is still a real correctness defect for a `uint128` financial API.

### Recommended fix

- Return all on-chain token amounts as `bigint` or decimal strings.
- Keep block heights as safe numbers if desired, but do not use the same parser
  for token amounts and block heights.
- If changing the existing return type is too disruptive, add a lossless read
  API before the next stable release.

---

## Bug 5: Wrong-network addresses pass SDK configuration validation

**Severity:** Medium

### Evidence

The constructor validates address checksums but does not verify the address
version against `config.network`.

Published locations:

- `node_modules/flowvault-sdk/dist/FlowVault.js:58-94`
- `node_modules/flowvault-sdk/dist/utils.js:31-49`

### Minimal reproduction

```ts
const mainnetAddress = "SP000000000000000000002Q6VF78";
const testnetAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";

new FlowVault({
  network: "testnet",
  contractAddress: mainnetAddress,
  tokenContractAddress: mainnetAddress,
  senderAddress: mainnetAddress,
  contractCallExecutor: async () => ({ txid: "x" }),
});
// Accepted, although address version 22 is mainnet.

new FlowVault({
  network: "mainnet",
  contractAddress: testnetAddress,
  tokenContractAddress: testnetAddress,
  senderAddress: testnetAddress,
  contractCallExecutor: async () => ({ txid: "x" }),
});
// Accepted, although address version 26 is testnet.
```

### Impact

A simple environment-variable mix-up is accepted at initialization and fails
later during transaction construction, wallet signing, broadcast, or contract
lookup. The late failure is harder to diagnose and contradicts the SDK's goal
of deterministic validation before network calls.

### Recommended fix

- Decode each configured standard address and compare its version with the
  selected network.
- For contract principals, validate the address portion in the same way.
- Throw `InvalidConfigurationError` with the field name and expected network.

---

## Bug 6: Signer fields can disagree and preflight validates the wrong sender

**Severity:** Medium

### Evidence

The SDK permits both `senderKey` and `senderAddress` without checking that they
identify the same principal.

Internally:

- self-split validation prefers `senderAddress`;
- sender-key mode signs the transaction with `senderKey`.

Therefore the SDK can validate routing rules against one principal and submit
them as another.

Published locations:

- `node_modules/flowvault-sdk/dist/FlowVault.js:82-94`
- `node_modules/flowvault-sdk/dist/FlowVault.js:99-115`
- `node_modules/flowvault-sdk/dist/FlowVault.js:260-265`

### Minimal reproduction

```ts
import { FlowVault } from "flowvault-sdk";
import { getAddressFromPrivateKey } from "@stacks/transactions";

const senderKey = `${"1".repeat(64)}01`;
const actualSigner = getAddressFromPrivateKey(senderKey, "testnet");
const configuredSender = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";

console.log(actualSigner);
// ST3Y74M5227FDVHREWPH773F5Y1W1ED8WXXVB0G1S

const vault = new FlowVault({
  network: "testnet",
  senderKey,
  senderAddress: configuredSender,
});

// This passes SDK self-split validation because actualSigner !==
// configuredSender, but the transaction is signed by actualSigner and the
// contract rejects it as ERR-SPLIT-TO-SELF.
await vault.setRoutingRules({
  lockAmount: 0,
  lockUntilBlock: 0,
  splitAddress: actualSigner,
  splitAmount: 1,
});
```

Malformed non-empty private keys are also not validated at construction. The
error classification then depends on the method:

```text
deposit(1)
-> NetworkError: Contract call "deposit" failed: Invalid byte sequence

setRoutingRules(...) when sender derivation is needed
-> raw Error: Invalid byte sequence
```

### Impact

- Local validation can approve a transaction that the contract will reject.
- Valid transactions can be blocked if the configured address equals the split
  recipient but the real key belongs to a different account.
- Invalid local key material is sometimes reported as a network problem and
  sometimes escapes the documented FlowVault error hierarchy entirely.

### Recommended fix

- Validate `senderKey` in the constructor.
- When both fields are supplied, derive the key's address and require an exact
  match with `senderAddress`.
- Throw `InvalidConfigurationError` consistently for malformed or mismatched
  signer configuration.

---

## Meaningful SDK feedback (not bug claims)

### 1. Ship a first-party `@stacks/connect` executor

The generic executor is useful, but every browser integrator currently has to
map network values, post-condition modes, Clarity values, wallet cancellation,
account selection, and transaction results. Bug 1 is evidence that even the
official example can get this bridge wrong.

A small `createStacksConnectExecutor(request, options)` adapter would remove
duplicated security-sensitive integration code and give FlowVault one tested
wallet path.

### 2. Expose network client, fee, and nonce controls

`TransactionOptions` exposes only post-conditions and post-condition mode.
Sender-key calls therefore always let `makeContractCall()` fetch a fee and
nonce through the default public endpoint.

For server automation and transaction sequences, expose:

- a custom Stacks network client or RPC endpoint;
- API-key/header support;
- optional `fee` and `nonce`;
- retry hooks limited to pre-broadcast operations.

This would let integrators handle public API rate limits and nonce coordination
without wrapping every SDK call. Hiro `429` responses are infrastructure
failures, not FlowVault correctness bugs, but the current SDK leaves no clean
configuration point for handling them.

### 3. Add transaction confirmation helpers

`status: "success"` currently means broadcast/mempool submission, not successful
contract execution. Integrators still need to poll for:

- `pending`;
- `success`;
- `abort_by_response`;
- `abort_by_post_condition`;
- timeout/not-found states.

A `waitForTransaction(txId)` helper, or clearer `"submitted"` terminology,
would prevent applications from treating broadcast acceptance as settlement.
Sanctuary currently implements this polling itself in `lib/explorer.ts`.

### 4. Provide method-specific post-condition builders

Post-conditions are optional and the default mode is allow. For a financial SDK,
helpers such as `depositPostConditions(sender, token, amount)` and
`withdrawPostConditions(...)` would make the protected path the easy path while
still allowing advanced callers to override it.

### 5. Publish source and issue-tracker metadata with the npm package

`npm view flowvault-sdk repository homepage bugs --json` returns no repository,
homepage, or issue tracker metadata. Adding these fields would make it easier
for builders to inspect source, link exact lines, report defects, and discover
whether a finding is already fixed.

The hosted documentation also identified itself as SDK `0.1.1` while npm
`latest` was `0.1.2` during this audit. Versioned docs or a visible package
version would reduce stale-integration reports.

---

## Protocol and product requests (explicitly not SDK bugs)

These are valid requests from the Sanctuary integration, but they should not be
presented as defects in `flowvault-sdk@0.1.2`:

1. An atomic `set-routing-rules + deposit` entry point would remove the
   confirmation barrier between strategy creation and the deposit that consumes
   it.
2. Multi-recipient split rules would reduce transaction count and partial-round
   states for payroll, circles, and treasury distributions.
3. Multiple lock tranches per principal would support overlapping schedules
   without separate wallets.
4. Delegated or contract-controlled escrow would support conditional release
   without an application-controlled key.

These require contract/API extensions. The current two-step strategy model,
single split target, single lock bucket, and self-lock semantics are observable
limitations, but they are not evidence that the published SDK is malfunctioning.

---


## What worked well

- Amount parsing for write inputs is strict and lossless when callers use
  strings or `bigint`.
- `tokenToMicro()` and `microToToken()` avoid floating-point conversion for the
  recommended string path.
- The error classes and contract error-code map provide a useful foundation,
  even though executor and signer errors need more precise classification.
- Supporting both sender-key and custom-executor modes is the right architecture
  for backend automation and browser wallets.
- The read model exposes the balances and block information an auditable UI
  needs.

## Verification performed

Project checks after the audit:

```text
npm test
Test Files  4 passed (4)
Tests       19 passed (19)

npm run typecheck
tsc --noEmit completed successfully
```

Package/version check:

```text
npm view flowvault-sdk version dist-tags --json
{
  "version": "0.1.2",
  "dist-tags": { "latest": "0.1.2" }
}
```


