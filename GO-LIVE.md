# Going live on socialhat.com.au

How to replace the WordPress site with the new one, check it, and put the old
one back if anything is wrong. Everything is done from GitHub and SiteGround's
Site Tools; nothing needs a terminal.

The switch is a rename on the server, not an upload over the top. The WordPress
site is moved aside whole and kept, so going back takes about a minute and
loses nothing.

## Before the day

Do not go live until all of these are true.

- [ ] The client has approved the preview at https://new.socialhat.com.au,
      including the privacy policy wording.
- [ ] Tam has confirmed `info@socialhat.com.au` exists in Microsoft 365.
- [ ] The DNS clean-up is done (one zone, SPF covering Microsoft and SiteGround).
- [ ] SiteGround routes `@socialhat.com.au` mail to Microsoft, and a test
      enquiry from staging has arrived in the Microsoft inbox, not junk.
- [ ] A time is agreed with the client and Tam. Pick a quiet hour.

An Instagram token is not needed. The feed section is off the page; the footer
links to the account. If the feed is wanted later, put `<Feed />` back in
`src/ui/Site.jsx`, add the token to `private/secrets.php`, and add Instagram to
the privacy policy.

## On the day

### 1. Take a backup in SiteGround

Site Tools → Security → Backups → Create Backup. The go-live keeps the old site
anyway; this is a second copy that also includes the database.

### 2. Prepare the build

GitHub → Actions → **Production (socialhat.com.au)** → Run workflow →
action **prepare**.

This builds the site and uploads it beside the live one. The live site is not
touched. When it finishes, the run's summary should read:

```
public_html (live):   WordPress
release-next:         new site (built ...)
private/secrets.php:  present
```

### 3. Go live

Run workflow again → action **go-live** → type `socialhat.com.au` in the
confirm box.

The summary should now read `public_html (live): new site` and
`public_html.wordpress: WordPress`.

### 4. Clear SiteGround's cache

Site Tools → Speed → Caching → Flush Cache. Without this, some visitors keep
being served the old pages for a while.

### 5. Check it, in a private browser window

- [ ] https://socialhat.com.au loads the new site, on a phone as well.
- [ ] https://socialhat.com.au/contact-us/ lands on the enquiry form.
- [ ] HatBot answers a question.
- [ ] An enquiry sent through the form arrives in `info@`. Ask Tam to look in
      quarantine if it does not.
- [ ] https://socialhat.com.au/privacy-policy/ opens.
- [ ] Google Analytics → Realtime shows your visit.
- [ ] An old image link still works. Any address under
      `/wp-content/uploads/` from the old site will do.

### 6. Tell Google

Search Console → Sitemaps → submit `https://socialhat.com.au/sitemap.xml`.

## If something is wrong

Run workflow → action **rollback** → type `socialhat.com.au`. Then flush the
cache again (step 4). WordPress is back exactly as it was, because its database
was never touched. The new site is kept beside it, and **go-live** puts it back
once the problem is fixed.

## Afterwards

- **Updates to the live site** are the same two buttons: **prepare**, then
  **go-live**. Merging to `main` only updates the preview site. The live site
  changes when someone presses go-live, and each go-live keeps the previous
  version for one-step rollback.
- **The old WordPress site** stays on the server as `public_html.wordpress`,
  off the web. Delete it, in Site Tools → File Manager, once everyone is sure
  nothing more is needed from it. A month is reasonable. Its media library
  stays reachable at the old addresses either way.
- **SiteGround's WordPress tools** (staging copies, auto-updates) will report
  that they cannot find the WordPress install for socialhat.com.au. That is
  expected.
- **To see what is live at any time:** Run workflow → action **status**. It
  changes nothing.
