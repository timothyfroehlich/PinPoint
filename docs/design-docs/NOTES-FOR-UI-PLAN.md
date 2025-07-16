Universal header - should include navigation to the core pages. Org logo takes you to your dashboard, Locations to your org page (which lets you see all your locations) page (if more than one location is configured), games page (all games in Org) and Issues. Locations entry has a hover drop down with all the locations for quick navigation. (Wait, how does that work on mobile?)

Auth Modal: Have seperate login and sign up buttons on the modal, trying to sign up with an existing email address results in a text appearing stating there's already one.

I want to re-organize the ui arch doc to be page specific, not public/private facing pages. Each page that is accessible to the public has has a set of public components and if the user is authenticated, additional components. Authenticated users should be able to see all actions that could be performed, but the ones they can't access will be disabled. (Example: New Location button on the Org's page. Not visible for unauthenticated users, visible but disabled for logged in users who lack the create location permission, visible and enabled for users with that permission.)

I thijnjk we can ditch the single-location auto-redirect if we can get a dropdown of locations working, but again, how do dropdowns work on mobile?
