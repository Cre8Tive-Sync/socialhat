#!/usr/bin/env bash
#
# Puts a prepared build live on SiteGround, or takes it back off.
#
#   release.sh status   <site-dir>    what is live, what is waiting, what can be restored
#   release.sh go-live  <site-dir>    swap release-next/ in as public_html/
#   release.sh rollback <site-dir>    put the previous public_html/ back
#
# <site-dir> is relative to $HOME, e.g. www/socialhat.com.au. It is run over SSH
# by .github/workflows/deploy-production.yml, which first uploads the build to
# <site-dir>/release-next/ — never straight into public_html.
#
# Going live is two renames, not a copy over the top. The site being replaced is
# moved aside whole, so nothing is ever half old and half new, and putting it
# back is the same two renames in reverse. The first time, what is moved aside
# is the WordPress site: it is kept as public_html.wordpress and never deleted
# by this script, and since its database is not touched, a rollback restores it
# exactly. After that, one previous release is kept as public_html.previous.

set -euo pipefail

ACTION=${1:-}
SITE=${2:-}
[ -n "$ACTION" ] && [ -n "$SITE" ] || { echo "usage: release.sh <status|go-live|rollback> <site-dir>" >&2; exit 2; }

cd "$HOME/$SITE" || { echo "No such site directory: $HOME/$SITE" >&2; exit 1; }

LIVE=public_html
NEXT=release-next
PREVIOUS=public_html.previous
WORDPRESS=public_html.wordpress

die() { echo "REFUSED: $*" >&2; exit 1; }

describe() {
  if [ ! -d "$1" ]; then echo "absent"
  elif [ -f "$1/wp-config.php" ]; then echo "WordPress"
  elif [ -f "$1/api/chat.php" ]; then echo "new site (built $(date -r "$1/index.html" '+%Y-%m-%d %H:%M %Z'))"
  else echo "present, unrecognised"
  fi
}

status() {
  echo "site:                 $HOME/$SITE"
  echo "public_html (live):   $(describe $LIVE)"
  echo "release-next:         $(describe $NEXT)"
  echo "public_html.previous: $(describe $PREVIOUS)"
  echo "public_html.wordpress: $(describe $WORDPRESS)"
  echo "private/secrets.php:  $([ -f private/secrets.php ] && echo present || echo MISSING)"
}

case "$ACTION" in
  status)
    status
    ;;

  go-live)
    [ -f "$NEXT/index.html" ] && [ -f "$NEXT/api/chat.php" ] && [ -f "$NEXT/.htaccess" ] \
      || die "$NEXT/ is not a complete build. Run the 'prepare' action first."
    [ -f "$NEXT/wp-config.php" ] && die "$NEXT/ contains WordPress; that is not a build of this site."
    # Without it the site still loads, but HatBot has no keys and enquiries go
    # to the default inbox — a quiet failure, so it is a loud one here instead.
    [ -f private/secrets.php ] || die "private/secrets.php is missing beside public_html."

    # What has to survive the swap. SSL validation and the Microsoft 365 domain
    # verification file are looked for at fixed URLs by other people's systems.
    [ -d "$LIVE/.well-known" ] && [ ! -e "$NEXT/.well-known" ] && cp -a "$LIVE/.well-known" "$NEXT/.well-known"
    for f in "$LIVE"/ms[0-9]*.txt; do
      [ -f "$f" ] && [ ! -e "$NEXT/$(basename "$f")" ] && cp -a "$f" "$NEXT/"
    done
    # The old site's media. Email signatures, Google listings and other sites
    # link straight to /wp-content/uploads/..., and those links should not die
    # with WordPress. Hard links: the files are shared, not duplicated, so this
    # takes no disk space and is instant. .htaccess serves them as plain files
    # only — nothing in there is executed.
    if [ -d "$LIVE/wp-content/uploads" ] && [ ! -e "$NEXT/wp-content/uploads" ]; then
      mkdir -p "$NEXT/wp-content"
      cp -al "$LIVE/wp-content/uploads" "$NEXT/wp-content/uploads"
    fi

    if [ -f "$LIVE/wp-config.php" ]; then
      [ -e "$WORDPRESS" ] && die "$WORDPRESS already exists. Move it aside by hand before going live over WordPress again."
      ASIDE=$WORDPRESS
    else
      rm -rf "$PREVIOUS"
      ASIDE=$PREVIOUS
    fi

    mv "$LIVE" "$ASIDE"
    # If the second rename fails, the site would be down; put the first one back.
    mv "$NEXT" "$LIVE" || { mv "$ASIDE" "$LIVE"; die "Could not move $NEXT into place. The previous site has been restored."; }

    echo "LIVE. The site that was live is kept at $SITE/$ASIDE."
    status
    ;;

  rollback)
    if [ -d "$PREVIOUS" ]; then BACK=$PREVIOUS
    elif [ -d "$WORDPRESS" ]; then BACK=$WORDPRESS
    else die "Nothing to roll back to: neither $PREVIOUS nor $WORDPRESS exists."
    fi

    # What is live now is kept, not deleted — it becomes the next 'go-live'.
    [ -e "$NEXT" ] && rm -rf "$NEXT"
    mv "$LIVE" "$NEXT"
    mv "$BACK" "$LIVE" || { mv "$NEXT" "$LIVE"; die "Could not restore $BACK. The current site has been left in place."; }

    echo "ROLLED BACK to $BACK. The site that was live is kept at $SITE/$NEXT; 'go-live' puts it back."
    status
    ;;

  *)
    echo "Unknown action: $ACTION" >&2
    exit 2
    ;;
esac
