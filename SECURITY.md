# Security Policy

Tibu is a fully static web app with no backend, no accounts and no network
requests after it loads. All data stays in the browser's storage on the device.
Even so, we take problems seriously, especially anything that could affect a child.

## Supported versions

Only the latest version on the `main` branch is supported.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, use GitHub's
private reporting: go to the repository's **Security** tab and choose
**Report a vulnerability**.

Useful things to include:

- what the problem is and what someone could do with it
- steps to reproduce (a world file, a content JSON file, or a URL)
- the device and browser you used

We aim to reply within a week and will credit you in the fix unless you prefer
otherwise.

## In scope

- Anything that makes Tibu send data off the device, load remote content, or open
  a link a child can reach outside the parent area.
- A way to get past the parent gate other than its intended hold-and-sum.
- Crafted world export files or content JSON that run code or break other saved
  worlds when imported.
- Problems in the build, CI or deployment workflows.
