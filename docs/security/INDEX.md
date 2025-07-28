# Index of docs/security

This directory contains documentation outlining the security guidelines and best practices for the PinPoint application's API layer. It emphasizes a robust approach to authentication, authorization, and data protection, ensuring the integrity and confidentiality of user and organizational data.

- **[api-security.md](./api-security.md)**: Comprehensive guidelines for securing PinPoint's API, covering both tRPC procedures and limited HTTP API routes. Details core security principles, tRPC security levels (public, protected, organization procedures), input validation, error handling, permission system conventions, multi-tenancy security, and public endpoint security patterns. Includes comprehensive checklist for new procedures and features.
- **[environment-specific-auth.md](./environment-specific-auth.md)**: **✅ MOVED FROM AUTHENTICATION** - Environment-aware authentication strategy with different providers and user seeding based on deployment environment. Covers development test accounts, OAuth validation, database seeding strategies, and security considerations across development, preview, and production environments.
