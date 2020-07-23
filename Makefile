.PHONY: default deps cards test clean

default: cards

deps:
	yarn install
	# Debian-based only
	-command -v dpkg && ( dpkg -l | grep -q optipng || sudo apt install -y --no-install-recommends optipng )

cards:
	node cards.js

test:
	npx ava

clean:
	-@rm -f docs/*.png docs/*/*.png
	-@rmdir docs/*/ 2>/dev/null || true
