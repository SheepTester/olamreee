# `override` demo

You can override properties of certain elements or add new predicted elements using a base64-encoded (with `+` as `-` and `=` as `_` to be URL-friendly) JSON of an array containing element data; the elements are identified by their atomic symbol, and if the element exists, it will override the properties of that element. If it doesn't exist, it adds a new element with the given data. OlamREEE will show the changed properties and new elements, but if you don't want that you can add `"replace"` to the beginning of the array.

---

For example, let's set puzzlite's atomic mass to 10, and add a new element wigglium (Wg) with the following properties:

- atomic mass of 60
- liquid at room temperature
- 2&deg;C melting point
- a nonmetal
- IE of 1001 kJ

Start with the JSON. You can see the key names [here](./olam.json).

```json
[
  {"symbol": "Pu", "mass": 10},
  {"name": "Wigglium", "symbol": "Wg", "mass": 60, "state": "liquid", "melting": 2, "type": "nonmetal", "ie": 1001}
]
```

Then we encode it in base64; I use JavaScript's built-in `btoa` function.

```js
> btoa(`[
  {"symbol": "Pu", "mass": 10},
  {"name": "Wigglium", "symbol": "Wg", "mass": 60, "state": "liquid", "melting": 2, "type": "nonmetal", "ie": 1001}
]`)
"WwogIHsic3ltYm9sIjogIlB1IiwgIm1hc3MiOiAxMH0sCiAgeyJuYW1lIjogIldpZ2dsaXVtIiwgInN5bWJvbCI6ICJXZyIsICJtYXNzIjogNjAsICJzdGF0ZSI6ICJsaXF1aWQiLCAibWVsdGluZyI6IDIsICJ0eXBlIjogIm5vbm1ldGFsIiwgImllIjogMTAwMX0KXQ=="
```

`"WwogIHsic3l[...]TAwMX0KXQ=="` is not URL safe; it contains an `=` sign. `+` characters must be replaced with `-` and `=` with `_`.

With the resulting string we can insert it in our URL: `https://sheeptester.github.io/olamreee/?override=OVERRIDE_CODE_HERE`

Notice how it adds asterisks to the new mass and makes the new element translucent. You can disable this by adding `"replace"` to the beginning of the array.

```json
[
  "replace",
  {"symbol": "Pu", "mass": 10},
  {"name": "Wigglium", "symbol": "Wg", "mass": 60, "state": "liquid", "melting": 2, "type": "nonmetal", "ie": 1001}
]
```

If you use an old savecode, a different mass might offset the elements; unfortunately, this means that you'll have to rearrange your periodic table with these new overrides.

Try these yourself: [without replace](./?key=test&override=WwogIHsic3ltYm9sIjogIlB1IiwgIm1hc3MiOiAxMH0sCiAgeyJuYW1lIjogIldpZ2dsaXVtIiwgInN5bWJvbCI6ICJXZyIsICJtYXNzIjogNjAsICJzdGF0ZSI6ICJsaXF1aWQiLCAibWVsdGluZyI6IDIsICJ0eXBlIjogIm5vbm1ldGFsIiwgImllIjogMTAwMX0KXQ__) &middot; [with replace](./http://localhost:8080/?key=test&override=WwogICJyZXBsYWNlIiwKICB7InN5bWJvbCI6ICJQdSIsICJtYXNzIjogMTB9LAogIHsibmFtZSI6ICJXaWdnbGl1bSIsICJzeW1ib2wiOiAiV2ciLCAibWFzcyI6IDYwLCAic3RhdGUiOiAibGlxdWlkIiwgIm1lbHRpbmciOiAyLCAidHlwZSI6ICJub25tZXRhbCIsICJpZSI6IDEwMDF9Cl0_)
