# Household Tags, not a closed topic list

Videos are labeled with household-wide Tags, not the mockup’s closed topic enum. A Tag is its own row with a case-insensitive unique name; Videos attach via a join. The first time someone types a new name on a Video, that Tag is created. Color is derived from the name; there is no icon picker in this cut. Storing free strings on the Video would be simpler and would fork `Recipe` / `recipe` / `recipes` into separate Home rows. A closed list in code would have kept Upload, Home, and Search identical; this house wanted People to invent labels.
