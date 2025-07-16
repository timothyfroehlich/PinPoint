These ideas should be incorporated into the cujs and roadmap, along with any other docs files that are relevant.

There is a "permission" for users, assigned by org admins, which when present means that reported issues bypass the triage stage. Hm, maybe we should have four status groups - unconfirmed / confirmed / in progress / resolved. Each group should have a default status (and the default defaults are statuses named after the groups) that can be changed. The permission could then be called "auto-confirm", and issues reported by someone with "auto-confirm" will have their new issue status default to the default confirmed state.

I can't think through it all the way right now, but there should be grouped sets of permissions related to issues. They should enable roles to be set up that allow one of these groups of permissions:
Read only - no permission to create or change issue info
Basic create and edit: - Can create issues using the simplified creator. Just basic issue information, can't change status, assignee, etc. Can rename issue and add comments if they were the creator or assignee. (Users can always edit their comments)
Full create and edit: Can use full issue creation creator to set assignee, status, etc, during creation. Full issue creation
is basically the same thing as the existing issue page, but with nothing filled in (and no add comment button).
