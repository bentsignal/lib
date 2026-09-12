import { createMobileConvexServer } from "@lib/mobile-convex/server";

import { schema } from "./schema";

export const { mutation, query } = createMobileConvexServer(schema);
