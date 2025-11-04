#!/usr/bin/env bash
set -euo pipefail

# Cheatsheet Maker installer/updater for Ubuntu (user-level, no root required)
# - Installs or updates the application
# - Installs build deps (needs sudo) on first install
# - Builds the app
# - Installs binary to ~/.local/bin
# - Installs icon to ~/.local/share/icons/hicolor/scalable/apps
# - Creates desktop launcher in ~/.local/share/applications and ~/Desktop
#
# Usage:
#   ./scripts/install-or-update-ubuntu.sh                # install or update
#   ./scripts/install-or-update-ubuntu.sh --no-deps      # skip apt install (for updates)
#   ./scripts/install-or-update-ubuntu.sh --force-deps   # force dependency check even if already installed
#   ICON=assets/logo.png ./scripts/install-or-update-ubuntu.sh   # use a custom PNG icon if present
#
# Notes:
# - If you want to use your own icon, place it at assets/logo.png or pass ICON=/path/to.png
# - For system-wide install, copy the binary to /usr/local/bin and .desktop to /usr/share/applications
# - When updating, dependencies are skipped by default unless --force-deps is used

APP_NAME="cheatsheet-maker"
APP_ID="com.example.cheatsheet"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$HOME/.local/bin"
APP_BIN="$BIN_DIR/$APP_NAME"
ICON_SRC_PNG="${ICON:-}"               # optional, user-specified
ICON_SRC_SVG="$ROOT_DIR/assets/icon.svg"
ICON_NAME="$APP_NAME"                   # icon name without extension
ICON_DST_DIR="$HOME/.local/share/icons/hicolor"
ICON_DST_SVG="$ICON_DST_DIR/scalable/apps/$ICON_NAME.svg"
ICON_DST_PNG="$ICON_DST_DIR/256x256/apps/$ICON_NAME.png"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/$APP_NAME.desktop"
USER_DESKTOP="$HOME/Desktop/$APP_NAME.desktop"

SKIP_DEPS=0
FORCE_DEPS=0
IS_UPDATE=0

# Check if this is an update (binary already exists)
if [[ -f "$APP_BIN" ]]; then
  IS_UPDATE=1
  SKIP_DEPS=1  # Skip deps by default for updates
fi

for arg in "$@"; do
  case "$arg" in
    --no-deps)
      SKIP_DEPS=1
      shift
      ;;
    --force-deps)
      FORCE_DEPS=1
      SKIP_DEPS=0
      shift
      ;;
    -h|--help)
      cat <<EOF
Cheatsheet Maker installer/updater

Usage:
  ./scripts/install-or-update-ubuntu.sh           # install or update
  ./scripts/install-or-update-ubuntu.sh --no-deps # skip dependency installation
  ./scripts/install-or-update-ubuntu.sh --force-deps  # force dependency check

Options:
  --no-deps      Skip installing build dependencies with apt
  --force-deps   Force dependency installation even on updates

Environment:
  ICON=/path/to/icon.png  Use a custom PNG icon

This script performs a per-user install under ~/.local.
On first install, it will install system dependencies.
On updates, dependencies are skipped unless --force-deps is used.

Note: When prompted by sudo, the password input is not echoed (no stars) — just type and press Enter.
EOF
      exit 0
      ;;
  esac
done

need_sudo_install_deps() {
  command -v sudo >/dev/null 2>&1 || {
    echo "This script installs packages via apt and needs sudo to do so." >&2
    echo "Install dependencies manually if needed, then re-run without sudo." >&2
    return 1
  }
}

install_deps() {
  echo "==> Installing Ubuntu build dependencies (needs sudo)"
  need_sudo_install_deps || return 0
  echo "If prompted for a password, note that sudo does NOT show characters as you type."
  echo "Just type your password and press Enter."
  LOG="/tmp/${APP_NAME}-apt-$(date +%s).log"
  echo "   - Updating apt package lists (quiet)..."
  if ! sudo apt-get -y -qq update >"$LOG" 2>&1; then
    echo "Apt update failed. See $LOG for details." >&2
    tail -n 50 "$LOG" >&2 || true
    exit 1
  fi
  echo "   - Installing packages (quiet): build-essential, make, pkg-config, libgtk-3-dev, libcairo2-dev, libgdk-pixbuf2.0-dev, libjson-glib-dev"
  if ! sudo apt-get -y -qq install build-essential make pkg-config \
    libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev libjson-glib-dev >>"$LOG" 2>&1; then
    echo "Apt install failed. See $LOG for details." >&2
    tail -n 50 "$LOG" >&2 || true
    exit 1
  fi
}

build_app() {
  if [[ "$IS_UPDATE" -eq 1 ]]; then
    echo "==> Rebuilding $APP_NAME (update mode)"
  else
    echo "==> Building $APP_NAME (first install)"
  fi
  ( cd "$ROOT_DIR" && make clean >/dev/null 2>&1 || true )
  BUILD_LOG="/tmp/${APP_NAME}-build-$(date +%s).log"
  if ! ( cd "$ROOT_DIR" && make -s -j"$(nproc || echo 2)" >"$BUILD_LOG" 2>&1 ); then
    echo "Build failed. See $BUILD_LOG for details." >&2
    tail -n 50 "$BUILD_LOG" >&2 || true
    exit 1
  fi
}

install_binary() {
  if [[ "$IS_UPDATE" -eq 1 ]]; then
    echo "==> Updating binary at $APP_BIN"
    # Kill any running instances before updating
    if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
      echo "   - Stopping running instance(s) of $APP_NAME..."
      pkill -x "$APP_NAME" || true
      sleep 1
    fi
  else
    echo "==> Installing binary to $APP_BIN"
  fi
  mkdir -p "$BIN_DIR"
  install -m 0755 "$ROOT_DIR/$APP_NAME" "$APP_BIN"
}

install_icon() {
  echo "==> Installing icon"
  mkdir -p "$ICON_DST_DIR/scalable/apps" "$ICON_DST_DIR/256x256/apps"
  # Prefer a project PNG at assets/logo.png if no ICON env var was provided
  if [[ -z "$ICON_SRC_PNG" && -f "$ROOT_DIR/assets/logo.png" ]]; then
    ICON_SRC_PNG="$ROOT_DIR/assets/logo.png"
  fi

  if [[ -n "$ICON_SRC_PNG" && -f "$ICON_SRC_PNG" ]]; then
    echo "Using custom PNG icon: $ICON_SRC_PNG"
    install -m 0644 "$ICON_SRC_PNG" "$ICON_DST_PNG"
    # also keep SVG fallback if present
    if [[ -f "$ICON_SRC_SVG" ]]; then install -m 0644 "$ICON_SRC_SVG" "$ICON_DST_SVG"; fi
  else
    echo "Using bundled SVG icon: $ICON_SRC_SVG"
    install -m 0644 "$ICON_SRC_SVG" "$ICON_DST_SVG"
  fi
}

create_desktop_entry() {
  echo "==> Creating desktop launcher"
  mkdir -p "$DESKTOP_DIR"
  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Cheatsheet Maker
Comment=Paste, arrange, crop images on A4 pages and export to PDF
Exec=$APP_BIN
Icon=$ICON_NAME
Terminal=false
Categories=Graphics;Office;Utility;
StartupNotify=false
X-GNOME-UsesNotifications=false
EOF
  chmod +x "$DESKTOP_FILE"

  # Copy to Desktop as well
  if [[ -d "$HOME/Desktop" ]]; then
    cp -f "$DESKTOP_FILE" "$USER_DESKTOP"
    chmod +x "$USER_DESKTOP"
  fi

  # Refresh desktop and icon caches (best-effort)
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
  if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f "$HOME/.local/share/icons" >/dev/null 2>&1 || true
  fi
}

post_notes() {
  echo
  if [[ "$IS_UPDATE" -eq 1 ]]; then
    echo "Update complete!"
    echo
    echo "The application has been updated to the latest version."
    echo "Run:  $APP_NAME"
    echo "      or use the launcher: Cheatsheet Maker"
  else
    echo "Installation complete!"
    echo
    echo "Run:  $APP_NAME"
    echo "      or use the launcher: Cheatsheet Maker"
    echo
    echo "If the icon doesn't appear immediately, try logging out and back in, or run:"
    echo "  update-desktop-database ~/.local/share/applications"
    echo "  gtk-update-icon-cache -f ~/.local/share/icons"
  fi
  echo
}

# Main
if [[ "$IS_UPDATE" -eq 1 ]]; then
  echo "========================================="
  echo " Updating Cheatsheet Maker"
  echo "========================================="
else
  echo "========================================="
  echo " Installing Cheatsheet Maker"
  echo "========================================="
fi

if [[ "$SKIP_DEPS" -eq 1 && "$FORCE_DEPS" -eq 0 ]]; then
  if [[ "$IS_UPDATE" -eq 1 ]]; then
    echo "==> Skipping dependency installation (update mode)."
    echo "    Use --force-deps to reinstall dependencies if needed."
  else
    echo "==> Skipping dependency installation as requested (--no-deps)."
    echo "Make sure these packages are installed, otherwise the build will fail:"
    echo "  sudo apt install -y build-essential make pkg-config \\
    libgtk-3-dev libcairo2-dev libgdk-pixbuf2.0-dev libjson-glib-dev"
  fi
else
  install_deps
fi
build_app
install_binary
install_icon
create_desktop_entry
post_notes
