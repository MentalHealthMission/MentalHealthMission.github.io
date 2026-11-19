"""Render the deployed browser assets (not the upstream generator's test fixture)."""
import argparse
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
import threading


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.words = []
        self.heading = False
        self.titles = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs).get("href"))
        if tag == "h1":
            self.heading = True

    def handle_endtag(self, tag):
        if tag == "h1":
            self.heading = False

    def handle_data(self, data):
        self.words.append(data.strip())
        if self.heading:
            self.titles.append(data.strip())


def check(browser, url):
    with tempfile.TemporaryDirectory() as profile:
        run = subprocess.run([browser, "--headless", "--disable-gpu", "--disable-extensions",
                              "--no-first-run", "--disable-background-networking",
                              "--user-data-dir=" + profile, "--virtual-time-budget=15000",
                              "--dump-dom", url], capture_output=True, timeout=60, check=True)
    page = Page()
    page.feed(run.stdout.decode())
    if "Unable to load" in page.words:
        raise SystemExit("Browser rendered its Unable to load page")
    if "Introduction" not in page.titles or "./odim-mh-protege.zip" not in page.links:
        raise SystemExit("Missing rendered Introduction heading or ontology download")
    print("Introduction rendered with the ontology download")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", required=True, help="Chrome or Chromium executable")
    parser.add_argument("--url", help="Verify live site instead of the local release tree")
    args = parser.parse_args()
    if args.url:
        check(args.browser, args.url)
    else:
        handler = partial(SimpleHTTPRequestHandler, directory=Path(__file__).resolve().parents[1])
        with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                check(args.browser, f"http://127.0.0.1:{server.server_port}/ontology-explorer/")
            finally:
                server.shutdown()
