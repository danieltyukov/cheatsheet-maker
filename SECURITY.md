# Security

## Reporting a vulnerability

Please report security problems privately through GitHub's advisory form at
<https://github.com/danieltyukov/cheatsheet-maker/security/advisories/new>
rather than in a public issue. You can expect a reply within a week. Once a fix
is released, the advisory is published with credit to you unless you prefer
otherwise.

## Scope

Cheatsheet Maker has no server and no account, so the interesting surface is
what it reads and what the native apps may do:

- A `.cheatsheet` file, an old `autosave.json`, an image or a PDF that makes the
  app run code, reach the network, or read or write a file other than the one
  you picked.
- The Tauri capabilities in `app/src-tauri/capabilities/`, which should allow
  nothing beyond the open and save dialogs and writing the file you chose.
- The release workflow and the artifacts it publishes.

Known and documented, so not vulnerabilities: the Windows installer is not
code-signed, the macOS build is not notarised, and an APK built by a fork
without the signing secrets is unsigned. Check downloads against `SHA256SUMS`
on the release page.
