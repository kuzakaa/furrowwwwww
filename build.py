import pathlib
s=pathlib.Path('src')
t=(s/'template.html').read_text()
t=t.replace('/*__CSS__*/',(s/'style.css').read_text()).replace('/*__ENGINE__*/',(s/'engine.js').read_text()).replace('/*__UI__*/',(s/'ui.js').read_text())
pathlib.Path('index.html').write_text(t)
print(len(t))
