# Hashed passwords; Admin can set a new one

Passwords are stored as argon2id hashes, never in the clear and never in logs. A Person may change their own password; an Admin may set a new password for someone else. There is no email recovery — the house has no mail path, and the LAN is the trust boundary. Sign-in stays display name + password.
