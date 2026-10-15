# Connecting the hub to WordPress

About 10 minutes. You only do this once.

## 1. Decide which account the hub uses

In WordPress go to **Users > Profile** and check your role.

- **Editor:** use your own account. Go to step 2.
- **Administrator:** it's safer to create a separate account. Go to **Users > Add New**, username `wpt-hub`, role **Editor**, then log in as that user for step 2. If that password ever leaked, the damage would stop at content.

## 2. Create the application password

1. **Users > Profile** (logged in as the account from step 1).
2. Scroll to **Application Passwords**.
3. Type `Marketing Hub` and click **Add New Application Password**.
4. Copy the password it shows. WordPress only shows it once.

Don't paste it into chat, email or Teams. If you do by accident, revoke it and make a new one.

## 3. Put it in the hub

1. Open the hub and go to **Website & SEO**.
2. In **Connect WordPress**, enter the username and paste the application password.
3. Click **Save and test**.

The test shows who you're signed in as, the account's role, and which SEO plugin the site uses.

## 4. Add the SEO snippet (only if the test asks for it)

Needed so the hub can change SEO titles and meta descriptions. Content fixes work without it.

1. **Plugins > Add New**, search **Code Snippets**, install and activate.
2. **Snippets > Add New**. Name it `WPT Hub SEO fields`.
3. Paste the code from `docs/wordpress-snippet.php` (everything after the opening comment).
4. Choose **Run everywhere**, then **Save Changes and Activate**.
5. Back in the hub, click **Save and test** again. The SEO line should go green.

This needs an administrator. If that isn't you, send Matt this file.

## 5. Add or update the page checker (second snippet)

Lets the audit see what visitors actually get: which old addresses redirect, and the real title, description and word count on pages built with Elementor or set up outside the normal page list.

1. **Already added it?** Go to **Snippets > All Snippets**, click **WPT Hub page checker**, delete everything in the code box and paste the new version. Otherwise **Snippets > Add New**, name it `WPT Hub page checker`, type **PHP**.
2. Paste the code from `docs/wordpress-page-checker.php` (everything after the opening comment).
3. **Run everywhere**, then **Save and Activate**.
4. In the hub, click **Save and test**. The Live line should say **Page checker ready**.
5. Run the audit again.

It only reads pages on your own site and changes nothing.

## 6. Connect Rank Math to Google (for Search performance)

Lets the hub show clicks, searches and positions from Google Search Console, and Google Analytics page views where Rank Math provides them.

1. WordPress: **Rank Math > General Settings > Analytics**.
2. Click **Connect Google** and sign in with the Google account that owns Search Console for westpiertech.com.
3. Pick the **Search Console** property for westpiertech.com and your **GA4** property under Analytics. Save.
4. Rank Math imports the last 90 days. Give it an hour or two.
5. In the hub, **Website & SEO > Search performance > Refresh**.

This needs the latest page checker snippet (step 5).

## 7. Connect Google Analytics 4 (direct)

Follow the numbered steps in the hub: **Website & SEO > Website traffic and leads**. In short:

1. Google Cloud: create a project, enable the **Google Analytics Data API**, create a service account and download its **JSON key**.
2. GA4: add the service account's email as a **Viewer** under Property access management, and copy the **Property ID**.
3. WordPress: add `docs/wordpress-ga4.php` as a third snippet (**WPT Hub GA4**, PHP, Run everywhere).
4. Hub: enter the Property ID, choose the key file, click **Connect**. Then delete the key file from your computer.

The key is stored in WordPress (admins only) and never sent back out. Disconnect in the hub removes it. Also delete the key in Google Cloud if you stop using it.

## If the test fails

- **"Check the username and application password"**: retype the username exactly as it appears in WordPress, and paste a fresh application password.
- **"Couldn't reach the site"** or **403 errors**: a security plugin (Wordfence, iThemes, etc.) or the host is blocking API logins. Matt can allow application passwords in the security plugin's settings.

## Turning it off

- In the hub: **Remove password from this browser** on the Website & SEO page.
- In WordPress: **Users > Profile > Application Passwords > Revoke**. This cuts the hub off straight away.
