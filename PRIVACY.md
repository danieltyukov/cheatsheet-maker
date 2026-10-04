# Privacy

Cheatsheet Maker has no server and no account. Nothing you make is sent
anywhere by the app.

## What is stored, and where

- **Your cheatsheets and their images** are stored on your device: in your
  browser's IndexedDB for the web app, and in the app's own storage for the
  desktop and Android apps.
- **Preferences** (tool colours, export resolution, theme) are stored in the
  same place.
- **Files you export** are written where you choose in the save dialog, or to
  your downloads folder.

## What the apps can reach

- Files you pick in an open dialog, and the place you pick in a save dialog.
  Nothing else on disk.
- On Linux, the desktop app reads one more file,
  `~/.config/cheatsheet-maker/autosave.json`, if it exists, to offer importing
  work from the old version. It is only read, never changed.
- The camera, only when you choose Insert, Camera on a phone, through your
  system's camera screen.

## What is never collected

No analytics, no crash reporting, no tracking, no cookies and no third-party
requests. Fonts and formula rendering are bundled with the app. The website is a
static page whose only scripts switch the theme and name your platform on the
download button.

## Removing your data

Delete cheatsheets from the library screen. Clearing the site's data in your
browser settings, or uninstalling the app, removes everything.
