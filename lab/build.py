import pathlib
s=pathlib.Path(__file__).parent/'src'
t=(s/'template.html').read_text()
t=t.replace('/*__CSS__*/',(s/'style.css').read_text()).replace('/*__ENGINE__*/',(s.parent.parent/'src'/'engine.js').read_text()).replace('/*__UI__*/',(s/'ui.js').read_text())
(s.parent/'index.html').write_text(t)
print(len(t))
