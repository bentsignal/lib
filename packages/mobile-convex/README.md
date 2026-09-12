# mobile-convex

An experimental, in-process Convex runtime for Expo apps. It executes real
Convex query and mutation definitions against a document store backed by
`expo-sqlite`, without a server, WebSocket, account, or network connection.

The first compatibility slice includes:

- Convex schemas and validators
- typed `query` and `mutation` function definitions
- document reads and writes
- serializable, rollback-safe mutations
- reactive React queries
- index-range and filter semantics (currently evaluated in memory)

Actions, auth, scheduling, pagination, search, storage, and the Convex network
protocol are not implemented. This is a small compatible runtime, not a build
of the Rust Convex backend.

## Native Convex experiment

`native/` is the next compatibility track: a Rust static library linked through
an Expo module. Its first checkpoint embeds Convex's real `sqlite` persistence
crate at a pinned upstream revision and opens the database in-process on iOS.
Build the current Apple Silicon Simulator artifact with:

```sh
./native/scripts/build-ios-simulator.sh
```

The checked-in TypeScript runtime remains the app's functional backend while
the native track grows. The native crate does not yet include Convex's function
runner, so it is deliberately exposed as a probe rather than as the production
client implementation.

See [NATIVE_RUNTIME.md](./NATIVE_RUNTIME.md) for the verified upstream boundary
and extraction milestones. See [HANDOFF.md](./HANDOFF.md) for the complete
continuation guide, validation evidence, and artifact-packaging notes.
