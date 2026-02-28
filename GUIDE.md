# ZapTracker User Guide

Welcome to ZapTracker! This guide will help you unlock the full potential of your all-in-one Bitcoin Lightning and Nostr dashboard.

> **New to the codebase?** Check out [STRUCTURE.md](STRUCTURE.md) for the technical organization of the project.

---

## Table of Contents

1. [First Steps](#first-steps)
2. [Understanding Your Dashboard](#understanding-your-dashboard)
3. [Wallet Operations](#wallet-operations)
4. [Content Creation](#content-creation)
5. [Growing Your Audience](#growing-your-audience)
6. [Running Campaigns](#running-campaigns)
7. [Analytics Deep Dive](#analytics-deep-dive)
8. [Tips & Best Practices](#tips--best-practices)
9. [Troubleshooting](#troubleshooting)

---

## First Steps

### What You Need

Before diving in, make sure you have:

1. **A Nostr Identity** - Your cryptographic identity on the Nostr network
2. **A NIP-07 Browser Extension** - Such as [Alby](https://getalby.com/), [nos2x](https://github.com/fiatjaf/nos2x), or [Flamingo](https://www.getflamingo.org/)
3. **A NWC-Compatible Wallet** - For Lightning payments (Alby, Coinos, LNBits, etc.)

### Connecting Your Accounts

**Step 1: Connect Your Nostr Identity**

1. Navigate to **Settings** from the sidebar
2. Click **Connect Nostr**
3. Your browser extension will prompt you to approve the connection
4. Once approved, ZapTracker loads your profile and begins syncing your zap history

**Step 2: Connect Your Wallet (NWC)**

1. Open your NWC-compatible wallet
2. Navigate to Settings → Connect Apps
3. Copy your **Nostr Wallet Connect URL** (starts with `nostr+walletconnect://`)
4. In ZapTracker, go to **Settings** → **Wallet Connection**
5. Paste your NWC URL

Your wallet balance will now appear in real-time on your dashboard.

> **Privacy Note**: All data stays in your browser's local storage. ZapTracker never stores your information on external servers.

---

## Understanding Your Dashboard

The Dashboard is your command center. Here's what each metric tells you:

| Metric | What It Means |
|--------|--------------|
| **Total Zaps** | Number of zaps you've received |
| **Total Sats** | Cumulative satoshis from all zaps |
| **Average Zap** | Mean amount per zap - shows engagement quality |
| **Unique Supporters** | Individual people who've zapped you |
| **Wallet Balance** | Current Lightning wallet balance (if NWC connected) |

### The Activity Chart

The 30-day activity chart reveals patterns:
- **Spikes** often correlate with viral content or campaign activity
- **Consistent levels** indicate steady community engagement
- **Drops** might signal time for fresh content or outreach

---

## Wallet Operations

### Checking Your Balance

With NWC connected, your balance updates in real-time. The wallet view shows:
- Current balance in sats
- Recent transactions
- Send/receive options

### Sending Payments

1. Go to **Wallet** in the sidebar
2. Click **Send**
3. Enter a Lightning invoice or LNURL
4. Confirm the amount and send

### Receiving Payments

1. Go to **Wallet**
2. Click **Receive**
3. Generate an invoice for a specific amount (or leave open for any amount)
4. Share the QR code or invoice string

### Transaction History

All your wallet transactions appear in the wallet view, showing:
- Amount (in/out)
- Timestamp
- Payment description (if available)

---

## Content Creation

ZapTracker supports multiple content types for Nostr publishing.

### Short Notes

Quick thoughts, updates, or announcements:

1. Go to **Content** or **Notes**
2. Write your message
3. Add mentions using `@username`
4. Click **Publish**

Your note broadcasts to connected relays immediately.

### Long-Form Articles (NIP-23)

For in-depth content like tutorials, essays, or newsletters:

1. Go to **Content** → **New Article**
2. Use the rich text editor for formatting
3. Add a title and summary
4. Include images or media embeds
5. Publish when ready

Long-form content is ideal for building authority and earning meaningful zaps.

### Content Performance

After publishing, track how your content performs:
- **Zaps received** per piece
- **Total sats earned** from each
- **Engagement patterns** over time

See [use_cases.md](use_cases.md) for real-world content strategies.

---

## Growing Your Audience

### The Audience Dashboard

Navigate to **Audience** to see:
- Your follower count
- Recent followers
- Audience growth over time
- Engagement statistics

### Follow Lists (Follow Packs)

Follow Lists help you curate and share groups of Nostr users:

**Creating a Follow List:**
1. Go to **Audience** → **Follow Lists**
2. Click **Create New List**
3. Add users by searching their npub or username
4. Name and describe your list
5. Save and optionally publish to share with others

**Use Cases for Follow Lists:**
- Curate "Best Bitcoin Developers" lists
- Create community starter packs for newcomers
- Build topical lists (photographers, musicians, educators)
- Share your recommended follows with your audience

See [use_cases.md](use_cases.md) for more Follow List strategies.

---

## Running Campaigns

ZapGoals let you run Kickstarter-style funding campaigns with Bitcoin zaps.

### Creating a Campaign

1. Navigate to **Campaigns**
2. Click **Create Campaign**
3. Fill in:
   - **Title** - Clear, compelling name
   - **Goal Amount** - Target in sats
   - **Description** - What you're funding and why
   - **Duration** - When the campaign ends
4. Publish your campaign

### Sharing Your Campaign

Once live, share your campaign:
- Direct link to the campaign page
- Embed in your Nostr notes
- Share on other platforms

### Tracking Progress

The campaign dashboard shows:
- Current amount raised
- Percentage of goal
- Number of contributors
- Time remaining
- Recent zaps to the campaign

---

## Analytics Deep Dive

The Analytics section provides detailed insights into your zap activity.

### Engagement Metrics

Understand your audience:
- **Top Supporters** - Your most generous zappers
- **Zap Distribution** - Size breakdown of incoming zaps
- **Peak Times** - When your audience is most active

### Using Analytics to Improve

1. **Identify top content** - What topics earn the most?
2. **Find optimal posting times** - When does your audience engage?
3. **Recognize loyal supporters** - Who consistently supports you?

---

## Tips & Best Practices

### Maximizing Engagement

1. **Consistency matters** - Regular content keeps supporters engaged
2. **Respond to zappers** - Thank your supporters publicly
3. **Use campaigns strategically** - Tie campaigns to specific deliverables
4. **Cross-promote** - Share ZapTracker stats in your notes

### Wallet Security

1. **Use a dedicated NWC wallet** - Don't use your main savings
2. **Set spending limits** - Configure limits in your wallet app
3. **Regular withdrawals** - Move earned sats to cold storage periodically

### Content Strategy

1. **Mix formats** - Short notes for engagement, long-form for depth
2. **Include calls-to-action** - Let people know they can zap you
3. **Track what works** - Use analytics to refine your approach

---

## Troubleshooting

### Wallet Not Connecting

**Symptoms:** NWC URL not recognized, balance not showing

**Solutions:**
1. Verify the URL starts with `nostr+walletconnect://`
2. Check that your wallet app is online and NWC is enabled
3. Try regenerating the NWC connection in your wallet
4. Clear browser cache and reconnect

### Zaps Not Appearing

**Symptoms:** Sent/received zaps don't show up

**Solutions:**
1. Wait a few moments - relay syncing can take time
2. Check your relay connections in Settings
3. Verify your npub is correctly connected
4. Refresh the page

### Profile Not Loading

**Symptoms:** Default avatar, missing profile data

**Solutions:**
1. Ensure your NIP-07 extension is unlocked
2. Check that you've published a profile to relays
3. Verify relay connectivity in Settings
4. Try reconnecting your Nostr identity

### Browser Extension Issues

**Symptoms:** Connection prompts not appearing, signing fails

**Solutions:**
1. Check that only one NIP-07 extension is active
2. Verify the extension has permissions for this site
3. Try reloading the extension
4. Check extension-specific settings

For technical details on NIP-07 integration, see [nip07.md](nip07.md).

---

## Next Steps

- **Explore use cases**: See [use_cases.md](use_cases.md) for real-world scenarios
- **Understand the code**: Check [STRUCTURE.md](STRUCTURE.md) for the technical architecture
- **Get help**: Visit [GitHub Discussions](https://github.com/pratik227/zap_dashboard/discussions)
- **Report issues**: [GitHub Issues](https://github.com/pratik227/zap_dashboard/issues)

---

*This guide is part of the ZapTracker documentation. For installation instructions, see [README.md](README.md).*
