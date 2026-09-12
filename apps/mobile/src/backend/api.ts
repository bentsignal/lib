import { createApi } from "@lib/mobile-convex/server";

import * as books from "./books";

export const api = createApi({ books });
