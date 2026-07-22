# Saotie official site

This directory contains the static entry for `www.saotie.com`.

The page is intentionally framework-free. It reads published pages and public
widgets from the main Saotie API:

```text
GET https://saotie.com/api/site/official/pages/:slug
GET https://saotie.com/api/site/official/widgets
```

In 1Panel, the site root should be:

```text
/www/sites/www.saotie.com/index
```

The included `www.saotie.com.conf` is a reference OpenResty server block. It
uses `try_files` so `/about`, `/guide`, and future admin-created page paths all
load the same static entry. The HTTPS certificate path currently reuses the
main site's certificate, which includes `www.saotie.com`.

Content changes are made in `后台 -> 系统 -> 官网页面`; static files only need
to be replaced when the visual template or JavaScript changes.
