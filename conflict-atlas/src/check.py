"""Smoke test for Conflict Atlas. Run after `node build.mjs`:  python3 check.py

Opens the built page in headless Chromium at phone and desktop sizes, in light and dark,
visits every conflict, checks for script errors and sideways scrolling, and saves
screenshots to dist/. Uses the local d3 copy because the sandbox may block the CDN.
"""
import asyncio, glob, os, re, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, 'dist')


def browser_path():
    for p in glob.glob('/opt/pw-browsers/*/chrome-linux/headless_shell') + glob.glob('/opt/pw-browsers/*/chrome-linux/chrome'):
        return p
    return None


async def main():
    os.makedirs(DIST, exist_ok=True)
    html = open(os.path.join(HERE, '..', 'index.html'), encoding='utf-8').read()
    html = html.replace('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js', 'd3.min.js')
    open(os.path.join(DIST, 'test.html'), 'w', encoding='utf-8').write(html)
    d3 = os.path.join(HERE, 'node_modules', 'd3', 'dist', 'd3.min.js')
    open(os.path.join(DIST, 'd3.min.js'), 'w', encoding='utf-8').write(open(d3, encoding='utf-8').read())

    ids = re.findall(r"\bid: '([a-z0-9-]+)', name:", open(os.path.join(HERE, 'conflicts.mjs'), encoding='utf-8').read())
    problems = []
    async with async_playwright() as p:
        kw = {'executable_path': browser_path()} if browser_path() else {}
        b = await p.chromium.launch(**kw)
        for name, w, h, scheme in [('phone', 390, 844, 'light'), ('phone-dark', 390, 844, 'dark'), ('desktop', 1366, 820, 'light')]:
            pg = await b.new_page(viewport={'width': w, 'height': h}, color_scheme=scheme)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text else None)
            await pg.goto('file://' + os.path.join(DIST, 'test.html'))
            await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(DIST, f'{name}-home.png'))
            if await pg.evaluate('document.documentElement.scrollWidth') > w:
                problems.append(f'{name}: page scrolls sideways')
            for cid in ids:
                await pg.evaluate(f"location.hash = '{cid}'")
                await pg.wait_for_timeout(60)
                title = await pg.evaluate("(document.querySelector('h2.ttl') || {}).textContent || ''")
                if not title:
                    problems.append(f'{name}: #{cid} did not render')
            await pg.evaluate("location.hash = 'country-ireland'")
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=os.path.join(DIST, f'{name}-ireland.png'))
            await pg.evaluate(f"location.hash = '{ids[0]}'")
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=os.path.join(DIST, f'{name}-{ids[0]}.png'))
            problems += [f'{name}: {e}' for e in errs]
            await pg.close()
        await b.close()
    print(f'checked {len(ids)} conflicts')
    if problems:
        print('PROBLEMS:\n' + '\n'.join(problems))
        sys.exit(1)
    print('OK')

asyncio.run(main())
