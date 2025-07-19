import NextAuth from "next-auth";
import { cache } from "react";

import { createAuthConfig } from "./config";

import { getGlobalDatabaseProvider } from "~/server/db/provider";

const dbProvider = getGlobalDatabaseProvider();
const authConfig = createAuthConfig(dbProvider.getClient());

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
