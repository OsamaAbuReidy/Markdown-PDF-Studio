# Custom Markdown to PDF

This converter gives you direct control over **type**, spacing, color, page layout, and code presentation.

> Tip: edit `config.json` for common choices, then use `custom.css` for anything more specific.

## What you can style

| Area | Examples |
|---|---|
| Page | A4/Letter, portrait/landscape, four independent margins |
| Typography | body, heading and code font stacks; size and line height |
| Theme | text, headings, links, accent, borders, surfaces and code colors |
| Code | syntax highlighting, wrapping, font size and line numbers |

## Code example

```python
def summarize(values: list[float]) -> dict[str, float]:
    """Return a tiny statistical summary."""
    return {
        "minimum": min(values),
        "maximum": max(values),
        "mean": sum(values) / len(values),
    }
```

## Page control

Add `<div class="page-break"></div>` wherever you want a forced page break. Add the class `avoid-break` to an HTML wrapper when a block should stay together.

### Lists and inline code

- GitHub-flavoured Markdown tables and task lists are supported.
- Relative images resolve from the Markdown file's own folder.
- Inline code such as `npm run demo` remains compact and readable.
