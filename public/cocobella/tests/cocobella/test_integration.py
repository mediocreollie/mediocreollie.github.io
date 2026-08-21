from __future__ import annotations

import unittest
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[2]


class AstroIntegrationTests(unittest.TestCase):
    def test_frontend_uses_cocobella_relative_paths(self):
        page = (PACKAGE_ROOT / "public" / "cocobella" / "index.html").read_text(encoding="utf-8")
        app = (PACKAGE_ROOT / "public" / "cocobella" / "app.js").read_text(encoding="utf-8")
        self.assertIn('href="styles.css"', page)
        self.assertIn('src="app.js"', page)
        self.assertIn('fetch("data/current.json"', app)
        self.assertIn('fetch("data/history.json"', app)

    def test_workflow_updates_data_without_deploying_pages(self):
        workflow = (
            PACKAGE_ROOT / ".github" / "workflows" / "update-cocobella-prices.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn('cron: "35 21 * * *"', workflow)
        self.assertIn("public/cocobella/data/current.json", workflow)
        self.assertIn("public/cocobella/data/history.json", workflow)
        self.assertIn("COCOBELLA_PUSH_TOKEN", workflow)
        self.assertNotIn("actions/deploy-pages", workflow)
        self.assertNotIn("actions/upload-pages-artifact", workflow)
        self.assertNotIn("actions/configure-pages", workflow)

    def test_package_does_not_replace_protected_site_files(self):
        protected = {
            "package.json",
            "package-lock.json",
            "pnpm-lock.yaml",
            "astro.config.mjs",
            "CNAME",
            ".github/workflows/deploy.yml",
            ".github/workflows/deploy-home-time-realtime.yml",
        }
        present = {
            path.relative_to(PACKAGE_ROOT).as_posix()
            for path in PACKAGE_ROOT.rglob("*")
            if path.is_file()
        }
        self.assertTrue(protected.isdisjoint(present))


if __name__ == "__main__":
    unittest.main()
