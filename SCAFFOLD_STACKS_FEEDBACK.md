# Scaffold Stacks — integration feedback and build notes

> Building Sanctuary, a rotating savings circle (ROSCA / susu / tanda) dApp on Stacks testnet,
> and integrating the Scaffold Stacks workflow into an existing Next.js project.
>
> Author: Mustapha Fadhlullah — independent security researcher
> Date: 2026-09-28
> Network: Stacks **testnet** only

## Overall impression

Our experience with Scaffold Stacks was positive overall. It gave us a cleaner starting point than a fully custom setup, especially for establishing the project structure, contract conventions, and the expected Stacks app workflow. The generated layout and deployment conventions reduced a lot of the uncertainty that usually comes with a first Stacks integration.

For an existing dApp, the value is especially clear when the repo is already organized around a frontend, contract, and deployment pipeline. We could align our app to the scaffold flow without discarding the project we already had. That said, the adoption path is still a bit rough for teams like ours that already have a root-level Next.js app and are on Windows, where the native toolchain requirements are not as smooth as the docs suggest.

The result: a stronger base, a clearer contract layout, and a far more straightforward path for ongoing iteration.

---

## What we shipped

| Artifact | Where |
|---|---|
| Clarity contract (Clarity 6, testnet) | `ST25HHHPC11KZPASV0747YQ4PW7YSM5GV1MEJEMVM.sanctuary-circle` |
| Deploy transaction | [`0xe6c7561c…08dd2e`](https://explorer.hiro.so/txid/0xe6c7561c7bfc4483352b7ca31d2dddb7d6d1b8147950db45dfe161564008dd2e?chain=testnet) |
| Source | `contracts/contracts/sanctuary-circle.clar` |
| Frontend interaction | on-chain roster checks (create + join + read, wallet-signed path) |

**Verified on-chain interactions** (real signed contract calls, state read back from the chain):

| Call | Transaction |
|---|---|
| `create-circle` (circle 1) | [`0x87e51d48…c8e890`](https://explorer.hiro.so/txid/0x87e51d4811517f5b0a663578866bec583b630729ff1c1d5bff234f8a64c8e890?chain=testnet) |
| `join-circle` (seat 0) | [`0xf3514ade…8307c4`](https://explorer.hiro.so/txid/0xf3514ade8ce1ce95dffb1f88a9a389804faa5fe3e5c57584db0d3e1b108307c4?chain=testnet) |
| `create-circle` (circle 2) | [`0xcce14195…dd8713`](https://explorer.hiro.so/txid/0xcce1419584c8f1e54b5c9d941a93dfe6699dc7111bb1ba34157fa10993dd8713?chain=testnet) |
| `join-circle` (seat 0) | [`0x2e5ce65d…988f45`](https://explorer.hiro.so/txid/0x2e5ce65de918221929d256830d04a34408453ab348e0af0b181f9f2e62988f45?chain=testnet) |

This gave us a real, testnet-backed contract flow and helped confirm that the app layer was not just rendering mock state. The contract behaves as a lightweight, public roster layer for the savings circle, while money movement remains handled through the broader FlowVault/escrow logic.

---

## What worked well

### 1. The project layout is genuinely useful

The Scaffold Stacks structure is one of the strongest parts of the experience. It makes a Stacks app feel organized from the beginning instead of forcing the team to reinvent the base layout each time. The separation of concerns between contracts, frontend, and deployment artifacts was especially helpful for a project like Sanctuary.

The layout makes it easy to understand what is generated, what is editable, and where custom logic belongs. This is a major benefit for teams shipping a dApp quickly without losing structure over time.

### 2. The CLI and command flow are easy to reason about

The command surface was much clearer than a typical hand-rolled setup. The deploy and configuration outputs are consistent, and the conventions around naming and generated artifacts help reduce friction while moving through the app build. That is a real quality-of-life improvement when working with multiple Stacks contracts and frontend reads.

### 3. The generated flow is a good acceleration layer

For a new Stacks project, the scaffold significantly reduces time-to-first-iteration. The default conventions around local configuration, contract deployment metadata, and frontend integration are practical. Even when we had to adapt it to an existing repo, the scaffold still gave us a clearer design pattern than building from scratch.

### 4. Good balance between opinionated structure and flexibility

This was one of the biggest positives. The stack does impose an opinionated project shape, but it is not so rigid that you cannot integrate into an existing Next.js app. We were able to preserve the app’s actual product logic while aligning it to the scaffold’s conventions. That balance makes it much more realistic for production work, not just demos.

---

## Issues we hit while integrating

These were not blockers for the project itself, but they are the kinds of friction points that matter when a team is trying to adopt the tool quickly.

### A. Response and optional shapes are easy to get wrong

One of the most important integration lessons was around Clarity read responses. The docs illustrate the simple `cvToValue` pattern well, but in practice a lot of contract reads return wrapped response or optional values. The difference is not cosmetic.

For example, a scalar read may return a bare uint, while a function such as `get-seat-count` returns a response object, and `get-seat` can return an optional tuple. The success flag (`success`) matters, and it is the difference between a valid value and an `err` that looks like a normal number.

This caused us to spend time debugging a read layer that looked valid but silently reported empty data. The fix was straightforward once we peeled the envelope correctly, but it is exactly the kind of issue that can cause confusion in a first build if the docs do not emphasize it more clearly.

### B. The adoption path is a little ambiguous for an existing app at the repo root

The scaffold works best when the repo already matches the standard `contracts/frontend` structure. In our case, the app already existed at the repository root with a Next.js app and a custom project structure. That meant the adoption path required a bit of adaptation.

This is not a failure of the scaffold; it is simply a “real-world app” condition that the docs could make clearer. A dedicated subsection for “existing frontend at the repo root” would reduce onboarding friction and avoid uncertainty during setup.

### C. Non-ASCII bytes in Clarity comments are a surprisingly costly trap

This was a high-friction issue we hit during deployment. The deploy failed with a codec error that looked unrelated to the actual source file, and it turned out to be caused by non-ASCII characters in the contract comments. This is a good example of a problem that is easy to stumble into while writing a clean, readable Clarity contract.

This is one area where a pre-deploy syntax or lint check would be valuable. A clearer validation message would save a lot of time by catching the problem at the source instead of surfacing it as a mysterious transaction failure.

### D. Windows toolchain friction is still the largest practical blocker

The biggest environmental issue for us was Windows support. We were able to proceed with the app itself, but the official Rust-based toolchain path still feels much smoother on macOS/Linux than on Windows. The dependency chain around Rust, linker tooling, and the Stacks CLI is the main friction point for developers working in a Windows environment.

This is not a project-level problem, but it is a real user experience issue for a tool whose docs currently assume a smoother environment than many teams actually have.

---

## What we would improve in the docs

These are the most useful improvements we’d recommend based on the real integration experience:

- Add an explicit “existing app at repo root” adoption path.
- Document the response/optional return shapes more clearly, with examples for `ok`, `err`, and `some` wrappers.
- Add a lint or pre-deploy check for non-ASCII characters in `.clar` files.
- Clarify the Windows installation story for Clarinet / toolchain prerequisites.
- Call out the Vercel root-directory change more clearly when moving an existing app into the scaffold layout.

These are all improvements to the developer experience, not reasons to dismiss the platform.

---

## Final assessment

Scaffold Stacks is a strong foundation for a Stacks dApp. It gives teams a readable structure, a predictable contract workflow, and a far cleaner starting point than building the app stack by hand. The project layout, generated conventions, and deployment metadata made the integration easier and more maintainable.

The main gaps are not fundamental flaws in the tool — they are the expected friction points of real-world adoption: an existing app at repo root, Windows-specific setup issues, and a few missing docs around edge-case response shapes. Those are all fixable, and they do not change the fact that the platform is a useful and practical way to build on Stacks.

Overall, our recommendation is positive: Scaffold Stacks is worth using as a baseline for a production Stacks app, especially when you want a clean foundation without sacrificing flexibility in the app layer.
