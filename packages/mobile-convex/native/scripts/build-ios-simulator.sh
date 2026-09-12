#!/bin/sh
set -eu

NATIVE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
MOBILE_CONVEX_TARGET_DIR="${MOBILE_CONVEX_TARGET_DIR:-$NATIVE_DIR/target}"
ARTIFACT_DIR="$NATIVE_DIR/../ios/lib"

cd "$NATIVE_DIR"

IPHONEOS_DEPLOYMENT_TARGET=16.4 \
  CARGO_TARGET_DIR="$MOBILE_CONVEX_TARGET_DIR" \
  cargo build \
  --release \
  --target aarch64-apple-ios-sim

IPHONEOS_DEPLOYMENT_TARGET=16.4 \
  CARGO_TARGET_DIR="$MOBILE_CONVEX_TARGET_DIR" \
  cargo build \
  --release \
  --target x86_64-apple-ios

mkdir -p "$ARTIFACT_DIR"
lipo -create \
  "$MOBILE_CONVEX_TARGET_DIR/aarch64-apple-ios-sim/release/libmobile_convex_engine.a" \
  "$MOBILE_CONVEX_TARGET_DIR/x86_64-apple-ios/release/libmobile_convex_engine.a" \
  -output "$ARTIFACT_DIR/libmobile_convex_engine.a"
