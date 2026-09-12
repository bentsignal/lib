# Mobile Convex handoff

## Why this branch exists

The experiment asks whether an Expo app can offer a Convex-shaped, local-only
database while keeping a credible path toward sharing schema and function code
with hosted Convex. The answer from this spike is yes, with a substantial gap
between the working compatibility runtime and full native Convex parity.

This branch deliberately preserves two tracks:

1. A useful TypeScript runtime backed by `expo-sqlite` that the app uses today.
2. A native feasibility probe that runs Convex's upstream Rust SQLite
   persistence code in the iOS app.

Do not describe the native track as a complete embedded Convex backend yet.

## What is working

The TypeScript runtime in `src/` supports:

- Convex validators, schemas, typed query and mutation definitions
- document reads and writes
- rollback-safe serialized mutations
- reactive React queries
- index ranges and filters, currently evaluated in memory
- an Expo SQLite adapter and an in-memory test adapter

The lib catalog is migrated to functions in `apps/mobile/src/backend/`. Legacy
catalog data is imported once by a local mutation.

The native track in `native/` and `ios/`:

- pins `get-convex/convex-backend` revision
  `f6c5782907f1fde2bf4e28287b7357e34a51462c`
- compiles the upstream `sqlite` crate without source changes
- produces a universal `arm64` and `x86_64` Simulator static library
- autolinks a Swift Expo module
- initializes Convex's `documents`, `indexes`, and `persistence_globals` tables
- commits an empty transaction through the upstream `Persistence::write` API
- reports the pinned revision and transaction result back to JavaScript

In development builds, `MobileBackendProvider` runs the native probe before it
starts the TypeScript backend. A failed native open, invalid revision, or failed
transaction leaves the app on an explicit backend error screen.

The two tracks currently use separate databases. Expo SQLite owns the app's
functional data store; the Rust probe owns a disposable cache database through
Convex's `rusqlite` persistence implementation. They do not share a connection.

## Simulator evidence

Verified on August 25, 2026 with a local EAS build:

- profile: `development:client:sim`
- simulator: iPhone 17 Pro, iOS 26.0
- simulator ID: `A4798186-9546-41B0-B116-E39028AE10B4`
- bundle ID: `com.bentsignal.lib`
- Metro URL: `https://ecda84a7.mobile.lib.local`
- result: the Library UI loaded after the native transaction assertion passed
- database: `Library/Caches/mobile-convex-rust-probe.sqlite`
- tables: `documents`, `indexes`, `persistence_globals`

The local artifact was written to
`/tmp/lib-mobile-convex-simulator-transaction.tar.gz`. That path is temporary and
is evidence from the original machine, not a release artifact.

Repository validation passed in the required order:

1. `pnpm run lint`
2. `pnpm run typecheck`
3. `pnpm run test` — 57 tests
4. `pnpm run format:fix`

`cargo fmt --check` and the universal archive architecture check also passed.

## Reproducing the native build

Install the pinned compiler and targets:

```sh
rustup toolchain install nightly-2026-06-28
rustup component add rustfmt --toolchain nightly-2026-06-28
rustup target add aarch64-apple-ios-sim --toolchain nightly-2026-06-28
rustup target add x86_64-apple-ios --toolchain nightly-2026-06-28
```

Build the native archive before asking EAS to package the app:

```sh
cd packages/mobile-convex
./native/scripts/build-ios-simulator.sh
lipo -info ios/lib/libmobile_convex_engine.a
```

Then follow the repository's `lib-expo-build` workflow and use a local EAS
`development:client:sim` build. Do not use a generated Xcode project as the
primary build path.

The generated `ios/lib/libmobile_convex_engine.a` is about 169 MB and exceeds
GitHub's normal per-file limit. It is intentionally omitted from the PR. Build
it locally with the script above before an EAS build. A production package
should publish a versioned XCFramework or another managed binary artifact
instead of committing this archive to the repository.

## Where full parity stops

This is not currently a drop-in `ConvexReactClient`, nor does it run query and
mutation JavaScript in the native backend. The application imports hooks from
`@lib/mobile-convex/react`, not `convex/react`.

The unchanged upstream `isolate` crate does not compile for iOS because its
required dependency graph reaches server-only search, vector-search, and
RocksDB crates. RocksDB's binding generation rejects the Simulator target before
the function runner builds.

`rusty_v8` has no published iOS archive. A JITless/lite iOS source build was
configured and progressed through compilation during the spike, which is enough
to establish feasibility, but no complete V8 archive was produced or retained.

The recommended target is call-site compatibility, not tunneling the hosted
WebSocket protocol through localhost. A local provider should accept normal
Convex `FunctionReference` objects so `useQuery(api.books.list, args)` and
`useMutation(api.books.insert)` remain unchanged while the provider selects
local native or hosted execution.

## Recommended next steps

1. Ask Convex for permission or partnership before investing further.
2. Fork the upstream workspace and add a `mobile` feature boundary that removes
   actions, HTTP, scheduling, auth providers, storage, search, vector search,
   RocksDB, Postgres, and server transports.
3. Expose document and index transactions over a narrow C ABI.
4. Build and package V8 in JITless mode for Simulator and device architectures.
5. Bundle schema and function modules at app build time and execute one query in
   the native runtime.
6. Add native subscriptions and a `FunctionReference`-compatible provider.
7. Run the same schema/function compatibility suite against native and hosted
   Convex.
8. Replace the raw static archive workflow with a versioned XCFramework.

## Legal and platform constraints

The upstream repository is currently licensed under
[FSL-1.1-Apache-2.0](https://github.com/get-convex/convex-backend/blob/main/LICENSE.md),
not immediately under Apache 2.0. Its competing-use restriction may apply to a
redistributed mobile Convex runtime. Obtain Convex's permission and legal review
before shipping or publishing the native package.

Apple's [App Review Guideline 2.5.2](https://developer.apple.com/app-store/review/guidelines/)
restricts downloading and executing code that changes app functionality. Bundle
function modules and the UDF snapshot with the app instead of implementing
cloud-style dynamic function deployment on device.

## File map

- `src/`: working TypeScript-compatible local runtime
- `native/src/lib.rs`: upstream Convex persistence owner and C ABI
- `native/Cargo.toml`: pinned upstream dependencies
- `native/scripts/build-ios-simulator.sh`: reproducible universal archive build
- `ios/MobileConvexModule.swift`: Swift-to-Rust Expo bridge
- `ios/MobileConvex.podspec`: CocoaPods link configuration
- `NATIVE_RUNTIME.md`: concise native architecture findings
- `apps/mobile/src/backend/`: lib's local schema, functions, API, and provider
