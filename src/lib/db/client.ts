import { createClient } from "@libsql/client/web"
import { drizzle } from "drizzle-orm/libsql"

const url = import.meta.env.VITE_TURSO_DATABASE_URL
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN

export const db = url
  ? drizzle(
      createClient({
        url,
        authToken,
      }),
    )
  : null

export const isDatabaseAvailable = Boolean(db)
