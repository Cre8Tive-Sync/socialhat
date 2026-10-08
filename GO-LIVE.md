# Going live on socialhat.com.au

How the WordPress site was replaced with the new one, how to check a release,
and how to put the previous one back if anything is wrong. The first go-live
was on 8 October 2026; the steps are kept for the record and for doing it again. Everything is done from GitHub and SiteGround's
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

### 4. Confirm the cache was cleared

SiteGround keeps its own copy of pages and goes on serving it after the files
change. Left alone, visitors are handed the old home page with its styling
broken while everything looks fine to anyone who bypasses the cache. This
happened on the first go-live.

**go-live** and **rollback** now clear it for you. Check the run summary says
`Cache purged.` If it says `CACHE NOT PURGED` or `CACHE PURGE FAILED`, clear
it by hand: Site Tools → Speed → Caching → Flush Cache.

If a stale page turns up later, the **purge** action does the same thing on its
own.

### 5. Check it, in a private browser window

- [ ] https://socialhat.com.au loads the new site, on a phone as well. Use a
      private window: your own browser may still be holding the old page.
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

Run workflow → action **rollback** → type `socialhat.com.au`. It clears the cache
as well; check the summary says so (step 4). WordPress is back exactly as it was, because its database
was never touched. The new site is kept beside it, and **go-live** puts it back
once the problem is fixed.

## Afterwards

- **Updates to the live site are automatic.** Every merge to `main` is tested,
  built and published to socialhat.com.au within a few minutes, the same as
  the Vercel copy and the preview site. If the tests or the build fail, nothing
  is published and the live site stays as it was. Each publish keeps the
  previous version, so **rollback** always has something to go back to.
- **Because a merge is a publish, only merge what is ready for the public.**
  Half-finished work belongs on a branch; its pull request still gets a Vercel
  preview link to look at.
- **After a rollback, fix or revert the change before merging anything else.**
  The next merge publishes whatever is on `main`, including the change that
  was just rolled back.
- **The old WordPress site** stays on the server as `public_html.wordpress`,
  off the web. Delete it, in Site Tools → File Manager, once everyone is sure
  nothing more is needed from it. A month is reasonable. Its media library
  stays reachable at the old addresses either way.
- **SiteGround's WordPress tools** (staging copies, auto-updates) will report
  that they cannot find the WordPress install for socialhat.com.au. That is
  expected.
- **To see what is live at any time:** Run workflow → action **status**. It
  changes nothing.
