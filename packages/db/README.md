# db

One mongoose schema: `Workspace`, the list of folders to go and look in.

Skills are never stored here. They are files on disk and the agents read them
from there, so a copy in a database would only ever be a stale second
opinion. What is worth keeping is the folder list, which is the one thing the
filesystem can't tell us on its own.
