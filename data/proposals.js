/* Fixes and jobs written by Claude for Connor to review in the hub.
   Claude adds to this file and pushes it to GitHub. Pull in GitHub Desktop to see new ones.
   Nothing here touches the website until Connor approves it in the Fix queue.

   Fix types:
     meta_title        SEO title for a page or post
     meta_description  SEO meta description for a page or post
     content_replace   swap one exact piece of a page's content for new text
     new_draft         create a new page or post, saved as a draft only
   Size: "small" pushes after one approval. "big" asks for a second confirmation.
   Rows with example: true are demos and can't be pushed. */

window.WPT_PROPOSALS = [
  {
    id: "example-1", example: true, created: "2026-10-15", batch: "Example",
    type: "meta_description", size: "small",
    postType: "pages", pageId: 0, pageTitle: "Example: 8x8 partner page", link: "https://westpiertech.com/",
    issue: "No meta description",
    current: "",
    proposed: "Brighton-based 8x8 partner. We set up, port and support 8x8 phones and contact centre for UK businesses and public sector teams. Talk to us on 01273 391200.",
    why: "Google writes its own snippet when this is missing, usually from the cookie banner or nav. A clear description with the phone number lifts clicks."
  },
  {
    id: "example-2", example: true, created: "2026-10-15", batch: "Example",
    type: "content_replace", size: "big",
    postType: "pages", pageId: 0, pageTitle: "Example: Home page", link: "https://westpiertech.com/",
    issue: "Opening line doesn't say what WPT does or where",
    current: "<p>Welcome to West Pier Technologies.</p>",
    proposed: "<p>West Pier Technologies sets up and supports business phone systems, contact centres and connectivity for UK organisations. We're based in Brighton and partner with 8x8, Gamma, 3CX and Zoom Phone.</p>",
    why: "AI answers and Google both lean on the first lines of a page to decide what a business is. This one says nothing."
  }
];

/* Jobs only Connor can do (images, quotes, sign-offs). They appear in Your jobs. */
window.WPT_JOBS = [
  {
    id: "example-job-1", example: true,
    job: "Example: hero image for the 8x8 page",
    page: "/8x8/",
    details: "An engineer at a desk with a headset, or a contact centre floor. Real photo over stock if possible.",
    size: "1600 x 900 px, under 250 KB, WebP or JPG",
    alt: "WPT engineer configuring an 8x8 contact centre"
  }
];
