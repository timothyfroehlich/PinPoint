## 2024-05-24 - Sensitive Information Exposure in Server Actions

**Vulnerability:** Server Actions were returning raw error messages from the backend/database directly to the client in the `SERVER` error code path.
**Learning:** This can expose database connection strings, schema details, or other sensitive internal information to attackers if an unhandled exception occurs.
**Prevention:** Always catch errors in Server Actions and return a generic "An unexpected error occurred" message to the client, while logging the full error details on the server for debugging.
