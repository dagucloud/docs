---
description: Invite your team to a Dagu Console workspace, choose its owners, and manage invitations, alert emails, and who stays in it.
---

# Dagu Console Members

A [Dagu Console](https://console.dagu.sh) workspace can hold a team. Each person signs in with their own account, sees the workspace's servers, runs, and alerts, and switches between the workspaces they belong to from the workspace menu at the top of the sidebar.

## Who Can Invite

- A workspace on Team, Pro, or a custom plan holds up to 10 people, owners and pending invitations included.
- A trial or free monitoring holds only its owner. Choose a plan on **Billing** to invite people.
- If a workspace leaves its paid plan, the people already in it stay, but no one new joins until it is on a paid plan again.

## Roles

| | Member | Owner |
| --- | --- | --- |
| See servers, runs, alerts, and insights | ✓ | ✓ |
| Acknowledge, resolve, and snooze alerts | ✓ | ✓ |
| Retry, stop, approve, or reject runs, as their role on the server allows | ✓ | ✓ |
| Turn on [two-factor authentication](/overview/console-account) for their own account | ✓ | ✓ |
| Invite and remove people, and change their roles | - | ✓ |
| Change settings, billing, licenses, and servers | - | ✓ |

A workspace always keeps at least one owner. Changing someone's role also sets their access through Dagu Cloud MCP back to the default for the new role.

## Invite People

1. In Dagu Console, open **Members**.
2. Enter one or more email addresses, separated by commas or new lines.
3. Leave **Also send them alert emails** on if they should get the workspace's alert emails once they join.
4. Select **Send invitations**.

Each invitation is emailed to its address. Its link works once, for seven days, and only for the address it was sent to. Under **Pending invitations**, **Resend** sends a new link, and the earlier one stops working; **Revoke** withdraws the invitation.

Everyone joins as a member. Make someone an owner once they have joined.

## Join a Workspace

Open the link in the invitation email:

1. Without a Dagu Console account, select **Create account** and sign up with the invited address. You also get a workspace of your own.
2. With an account, select **Sign in** and use the invited address. Signing in with Google opens on that address.
3. Select **Join**. Dagu Console opens the workspace you joined.

Signing in later opens the workspace you last used.

## Change Who Is in the Workspace

On **Members**, owners can:

- Change a person's role with the **Role** list.
- Turn a member's alert emails on or off. Owners get alert emails as set under **Settings**, in **Alert emails**.
- Select **Remove** to take someone out. They lose access right away; any workspace of their own is not affected.

Anyone can select **Leave** next to their own name. The only owner cannot leave or be removed, so make someone else an owner first.

## Related Pages

- [Dagu Console Account](/overview/console-account)
- [Monitoring](/overview/console-monitoring)
- [Plans and Licenses](/overview/self-host-license)
