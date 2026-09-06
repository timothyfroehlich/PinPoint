# PinPoint Context

PinPoint tracks the operating condition of physical pinball machines and supports
the people who maintain and play them. This glossary defines shared domain
language; feature requirements live in `docs/feature-specs/`, and work state
lives in Beads.

## Core language

**Machine**:
A physical pinball cabinet tracked by PinPoint.
_Avoid_: Game, title

**Issue**:
A reported operational problem associated with exactly one machine.
_Avoid_: Ticket

**Report draft**:
An unsaved description of an operational problem associated with a machine. It
becomes an issue only when submitted.
_Avoid_: Issue, ticket

**Report template**:
A reusable, player-facing description of an observable machine problem that
seeds a report draft and may provide guidance before submission.
_Avoid_: Issue type, issue category

**Issue status**:
The current stage of an issue's maintenance lifecycle.

**Issue frequency**:
How often an issue occurs. It may be not specified when the reporter cannot
establish whether the problem is intermittent, frequent, or constant.

**Machine status**:
The current operating condition of a machine, inferred from its open issues
rather than managed as a separate fact.

## People and access

**User**:
A person with a PinPoint account.

**Capability**:
A named permission to perform a product operation. Roles and ownership can
grant a capability, but product requirements describe access in capabilities.

## Organization

**Collection**:
A user-created grouping of machines, owned and managed by a user.

## Connected systems

**Integration**:
A third-party service PinPoint connects to for a defined purpose, such as
Discord notifications or Pinball Map synchronization.
