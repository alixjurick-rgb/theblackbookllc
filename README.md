# The Blackbook LLC

Static marketing site for The Blackbook LLC, a closet-editing business in Bethesda, Potomac, Chevy Chase, Rockville, and nearby Northwest DC.

The site is plain HTML and CSS at the repository root. Fonts are embedded in `styles.css`. The About page photo is `assets/lisa-jurick.jpg`.

Vercel serves the pages as static files from the repository root. There is no framework and no build step.

The consultation form posts to `/api/consult`. That Vercel Function emails the inquiry to hello@theblackbookllc.com through Resend, with Reply-To set to the visitor. Set `RESEND_API_KEY` in the Vercel project environment. The key is not stored in this repository. theblackbookllc.com must be verified for sending in Resend, because messages are sent from hello@theblackbookllc.com.
