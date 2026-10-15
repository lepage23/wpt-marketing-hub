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

## If the test fails

- **"Check the username and application password"**: retype the username exactly as it appears in WordPress, and paste a fresh application password.
- **"Couldn't reach the site"** or **403 errors**: a security plugin (Wordfence, iThemes, etc.) or the host is blocking API logins. Matt can allow application passwords in the security plugin's settings.

## Turning it off

- In the hub: **Remove password from this browser** on the Website & SEO page.
- In WordPress: **Users > Profile > Application Passwords > Revoke**. This cuts the hub off straight away.
