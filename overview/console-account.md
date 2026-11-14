---
description: Protect your Dagu Console account with two-factor authentication from an authenticator app, and recover access if you lose the device.
---

# Dagu Console Account

[Dagu Console](https://console.dagu.sh) is where you connect Dagu servers to a workspace, manage the workspace's plan, and see the servers' [monitoring](/overview/console-monitoring). This page covers how to protect the account you sign in with.

Signing in to Dagu Console is separate from signing in to a Dagu server. A server's own sign-in is configured on the server; see [Authentication](/server-admin/authentication/).

## Two-Factor Authentication

Two-factor authentication asks for a code from an authenticator app when you sign in to Dagu Console. It is off by default, and each person turns it on for their own account, whatever their role in a workspace. Workspace owners cannot turn it on for members, or require it.

### Turn it on

1. In Dagu Console, select your email address at the bottom of the sidebar to open **Your account**.
2. Under **Two-factor authentication**, select **Turn on**.
3. Dagu Console signs you out of every browser, so no session opened with your password alone stays signed in. Sign in again.
4. Scan the QR code with an authenticator app, such as 1Password, Google Authenticator, or Microsoft Authenticator, and enter the six-digit code it shows.
5. Copy the recovery code shown next and keep it somewhere safe, such as a password manager. It is the only way to sign in without the app.

From then on, signing in asks for a code from the app. **Your account** shows **On** under **Two-factor authentication**.

### Remembered browsers

When you enter a code, you can choose to have the browser remembered. That browser then signs in without a code for 30 days, even after you sign out. A new browser or device always asks for a code.

### Lose access to the app

If you lose the device or the app:

1. At the code prompt, choose to use a recovery code instead, and enter the one you saved. You are then shown a new recovery code; save it, as the old one no longer works.
2. In **Your account**, select **Turn off** under **Two-factor authentication**, then **Turn on** again, and set up the app on your new device at the next sign-in.

If you have neither the app nor the recovery code, [contact the Dagu team](https://dagu.sh/contact) from the email address of the account.

### Turn it off

In **Your account**, select **Turn off** under **Two-factor authentication**. Sign-in stops asking for a code, and your registered authenticator apps are removed, so turning it on again sets up a new one.

## Related Pages

- [Dagu Console Members](/overview/console-members)
- [Monitoring](/overview/console-monitoring)
- [Plans and Licenses](/overview/self-host-license)
