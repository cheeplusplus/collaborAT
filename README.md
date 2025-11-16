# ShareSky
Sharesky is a PDS proxy layer that allows users to log into a shared Bluesky account in a secure manner.

To accomplish this, this application pretends to be a PDS, while forwarding requests to the real one via OAuth.
Since the Bluesky app requires a username and password instead of supporting OAuth, each end user gets its own username and password specific to them.

## Safety model
* Shared account is not logged into directly by users. No need for app passwords.
* Each user with access gets their own username/password pair that logs them into this account in the app
* Actions on the shared account are allowlisted, to each user (posting, profile change, deletes, etc)
  * All server-level account actions are always prohibited (createSession, deleteAccount, listAppPassword, etc)
* Every action is audited in an audit log

## Testing
In `sharesky.config.json` set `oauth.isLocalhostDev` to `true` to configure OAuth correctly.
Access the website only from `http://127.0.0.1:3000` or you'll have problems with your session missing when you're redirected back from the OAuth flow.

To test being a user, just add an account, change your hosting provider in `bsky.app` to `127.0.0.1:3000` and log in with an ACL username/password.