#!/usr/bin/env python3
"""Resolve conflict blocks whose both sides are only single-line `import ... from '...';`
statements (or blank lines) by taking ours then theirs, de-duplicated.
Anything else is left in place and reported. Exit 1 if unresolved blocks remain."""
import re
import sys

path = sys.argv[1]
text = open(path, encoding='utf-8').read()
lines = text.split('\n')
out = []
i = 0
unresolved = 0
resolved = 0
IMPORT = re.compile(r"^import .* from '[^']+';$")
while i < len(lines):
    if lines[i].startswith('<<<<<<< '):
        j = i + 1
        ours = []
        while not lines[j].startswith('======='):
            ours.append(lines[j]); j += 1
        j += 1
        theirs = []
        while not lines[j].startswith('>>>>>>> '):
            theirs.append(lines[j]); j += 1
        both = [l for l in ours + theirs if l.strip()]
        if both and all(IMPORT.match(l) for l in both):
            seen = set()
            for l in ours + theirs:
                if l.strip() and l not in seen:
                    seen.add(l); out.append(l)
            resolved += 1
        else:
            out.extend(lines[i:j + 1])
            unresolved += 1
        i = j + 1
        continue
    out.append(lines[i]); i += 1
open(path, 'w', encoding='utf-8').write('\n'.join(out))
print(f'resolved {resolved}, unresolved {unresolved}')
sys.exit(1 if unresolved else 0)
