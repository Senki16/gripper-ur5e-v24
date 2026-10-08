"""Pasa informe_gripper_v24.tex al formato de informes EAFIT (Word) y exporta el PDF.

Uso: python tex_a_word.py <plantilla.docx> <salida.docx>
Recorre el .tex (secciones, párrafos, listas, ecuaciones, figuras y tablas) y lo
escribe en la plantilla con Word (COM), conservando portada, encabezado y pie.
"""
import os, re, sys, shutil
import win32com.client as wc

H = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(H, "figuras")
TEX = os.path.join(H, "informe_gripper_v24.tex")

# ---------------------------------------------------------------- lectura del .tex
def leer(path):
    s = open(path, encoding="utf-8").read()
    s = re.sub(r"(?<!\\)%.*", "", s)
    return re.sub(r"\\input\{([^}]+)\}", lambda m: leer(os.path.join(H, m.group(1) + ".tex")), s)


def grupo(s, i):
    """Devuelve (contenido, fin) del grupo {...} que empieza en s[i] == '{'."""
    assert s[i] == "{", s[i:i + 30]
    d = 0
    for j in range(i, len(s)):
        if s[j] == "{" and s[j - 1] != "\\":
            d += 1
        elif s[j] == "}" and s[j - 1] != "\\":
            d -= 1
            if d == 0:
                return s[i + 1:j], j + 1
    raise ValueError("llave sin cerrar")


def entorno(s, i, nombre):
    """Contenido de \\begin{nombre}...\\end{nombre} desde i (posición tras el begin)."""
    d, j = 1, i
    while d:
        a = s.find("\\begin{%s}" % nombre, j)
        b = s.find("\\end{%s}" % nombre, j)
        if a != -1 and a < b:
            d += 1; j = a + 1
        else:
            d -= 1; j = b + 1
    return s[i:j - 1], j - 1 + len("\\end{%s}" % nombre)


# ---------------------------------------------------------------- matemáticas
SIM = {"alpha": "α", "beta": "β", "theta": "θ", "tau": "τ", "mu": "μ", "omega": "ω", "Omega": "Ω",
       "eta": "η", "lambda": "λ", "phi": "φ", "pi": "π", "Delta": "Δ", "Sigma": "Σ", "partial": "∂",
       "sum": "∑", "int": "∫", "cdot": "·", "times": "×", "geq": "≥", "leq": "≤", "pm": "±",
       "rightarrow": "→", "leftrightarrow": "↔", "Rightarrow": "⇒", "circ": "°", "infty": "∞",
       "checkmark": "✓", "triangle": "△", "blacksquare": "■", "approx": "≈"}
FUN = {"sin", "cos", "tan"}
ACC = {"vec": "\u20d7", "hat": "\u0302", "dot": "\u0307", "ddot": "\u0308", "bar": "\u0305"}


def arg(s, i):
    """Argumento de un comando: grupo {..}, comando \\x o un carácter."""
    while i < len(s) and s[i] == " ":
        i += 1
    if s[i] == "{":
        return grupo(s, i)
    if s[i] == "\\":
        m = re.match(r"\\[a-zA-Z]+", s[i:])
        return m.group(0), i + len(m.group(0))
    return s[i], i + 1


def uni(s):
    """LaTeX de una ecuación de bloque -> UnicodeMath para Word (BuildUp)."""
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "\\":
            m = re.match(r"\\([a-zA-Z]+|.)", s[i:])
            k = m.group(1); i += len(m.group(0))
            if k in SIM:
                out.append(SIM[k])
            elif k in FUN:
                if s.startswith("\\frac", i):
                    a, i = arg(s, i + 5); b, i = arg(s, i)
                    out.append(k + "\u2061\u3016(%s)/(%s)\u3017 " % (uni(a), uni(b)))
                else:
                    out.append(k + "\u2061")
            elif k == "frac":
                a, i = arg(s, i); b, i = arg(s, i)
                out.append("\u3016(%s)/(%s)\u3017 " % (uni(a), uni(b)))
            elif k in ACC:
                a, i = arg(s, i)
                a = uni(a)
                out.append(a + ACC[k] if len(a) == 1 else "(%s)%s" % (a, ACC[k]))
            elif k == "overrightarrow":
                a, i = arg(s, i)
                out.append(re.sub(r"[  ]+", "→", uni(a).strip(), count=1))
            elif k in ("mathbf", "boldsymbol", "bm", "mathrm"):
                a, i = arg(s, i); out.append(uni(a))
            elif k == "text":
                a, i = arg(s, i); out.append('"%s"' % a)
            elif k in ("left", "right"):
                pass
            elif k == "qquad":
                out.append("\u2003\u2003\u2003")
            elif k == "quad":
                out.append("\u2003")
            elif k in (",", ";", ":", " "):
                out.append("\u2009")
            elif k == "begin":
                env, i = arg(s, i)
                body, i = entorno(s, i, env)
                filas = [r.strip() for r in body.split("\\\\") if r.strip()]
                out.append("[■(%s)]" % "@".join(uni(f) for f in filas))
            else:
                out.append(k)
        elif c in "_^":
            a, i = arg(s, i + 1)
            a = uni(a) if a.startswith("\\") or len(a) > 1 else a
            if a == "°" and c == "^":
                out.append("°")
            else:
                out.append(c + ("(%s)" % a if len(a) > 1 else a) + " ")
        elif c == "{":
            a, i = grupo(s, i); out.append(uni(a))
        elif c == "~":
            out.append(" "); i += 1
        else:
            out.append(c); i += 1
    return "".join(out)


def math_runs(s, base=None):
    """LaTeX en línea -> runs [(texto, fmt)] con subíndices, superíndices y cursiva."""
    base = dict(base or {})
    runs, i = [], 0

    def add(t, **f):
        runs.append((t, {**base, **f}))

    while i < len(s):
        c = s[i]
        if c == "\\":
            m = re.match(r"\\([a-zA-Z]+|.)", s[i:])
            k = m.group(1); i += len(m.group(0))
            if k in SIM:
                add(SIM[k])
            elif k in FUN:
                add(k + " ")
            elif k == "frac":
                a, i = arg(s, i); b, i = arg(s, i)
                runs += math_runs(a, base); add("/"); runs += math_runs(b, base)
            elif k in ACC:
                a, i = arg(s, i)
                sub = math_runs(a, base)
                if sub:
                    t, f = sub[-1]; sub[-1] = (t + ACC[k], f)
                runs += sub
            elif k in ("mathbf", "boldsymbol", "bm", "mathrm", "text"):
                a, i = arg(s, i)
                runs += math_runs(a, {**base, "i": False}) if k in ("text", "mathrm") else math_runs(a, base)
            elif k in ("left", "right"):
                pass
            elif k in (",", ";", ":", " ", "quad", "qquad"):
                add(" ")
            elif k == "%":
                add("%")
            else:
                add(k)
        elif c in "_^":
            a, i = arg(s, i + 1)
            if c == "^" and a in ("\\circ", "°"):
                add("°"); continue
            runs += math_runs(a, {**base, "sub" if c == "_" else "sup": True})
        elif c == "{":
            a, i = grupo(s, i); runs += math_runs(a, base)
        elif c.isalpha():
            add(c, i=True if base.get("i", True) else False); i += 1
        else:
            add("−" if c == "-" else c); i += 1
    return runs


# ---------------------------------------------------------------- texto en línea
COL = {"ok": (20, 120, 60), "warn": (190, 110, 0), "bad": (185, 30, 30)}


def inline(s, base=None, refs=None):
    base = dict(base or {})
    s = s.replace("\\par", " ").replace("\\noindent", " ").replace("\\small", "").replace("\\centering", "")
    s = s.replace("---", "—").replace("--", "–").replace("``", "“").replace("''", "”")
    runs, i, buf = [], 0, []

    def flush():
        if buf:
            runs.append(("".join(buf), dict(base))); buf.clear()

    while i < len(s):
        c = s[i]
        if c == "$":
            j = s.index("$", i + 1)
            flush(); runs += math_runs(s[i + 1:j], {**base}); i = j + 1
        elif c == "\\":
            m = re.match(r"\\([a-zA-Z]+|.)", s[i:])
            k = m.group(1); i += len(m.group(0))
            if k in ("textbf", "emph", "textit"):
                a, i = grupo(s, i)
                flush(); runs += inline(a, {**base, ("b" if k == "textbf" else "it"): True}, refs)
            elif k == "textcolor":
                col, i = grupo(s, i); a, i = grupo(s, i)
                flush(); runs += inline(a, {**base, "col": COL.get(col)}, refs)
            elif k in ("ref", "pageref"):
                a, i = grupo(s, i); buf.append(str(refs.get(a, "?")))
            elif k in ("label", "rowcolor"):
                _, i = grupo(s, i)
            elif k in SIM:
                buf.append(SIM[k])
            elif k == "%":
                buf.append("%")
            elif k == "&":
                buf.append("&")
            elif k in (",", " "):
                buf.append("\u2009" if k == "," else " ")
            elif k == "ensuremath":
                a, i = grupo(s, i); flush(); runs += math_runs(a, base)
            else:
                pass
        elif c == "~":
            buf.append("\u00a0"); i += 1
        elif c in "{}":
            i += 1
        elif c == "\n":
            buf.append(" "); i += 1
        else:
            buf.append(c); i += 1
    flush()
    # unir espacios repetidos
    out = []
    for t, f in runs:
        t = re.sub(r"[ \t]+", " ", t)
        if out and out[-1][1] == f:
            out[-1] = (out[-1][0] + t, f)
        elif t:
            out.append((t, f))
    if out:
        out[0] = (out[0][0].lstrip(), out[0][1])
        out[-1] = (out[-1][0].rstrip(), out[-1][1])
    return [r for r in out if r[0]]


# ---------------------------------------------------------------- bloques
def bloques(s):
    s = s[s.index("\\section{Introducción}"):s.index("\\end{document}")]
    B, i, par = [], 0, []

    def cierra():
        t = "".join(par).strip()
        if t:
            B.append(("p", t))
        par.clear()

    while i < len(s):
        if s.startswith("\n\n", i) or s.startswith("\n \n", i):
            cierra(); i += 2; continue
        m = re.match(r"\\(section|subsection|subsubsection)\*?\{", s[i:])
        if m:
            cierra()
            t, i = grupo(s, i + len(m.group(0)) - 1)
            B.append(("h", {"section": 1, "subsection": 2, "subsubsection": 3}[m.group(1)], t)); continue
        if s.startswith("\\eq{", i):
            cierra(); t, i = grupo(s, i + 3); B.append(("eq", t)); continue
        m = re.match(r"\\begin\{(figure|table|itemize)\}(\[[^\]]*\])?", s[i:])
        if m:
            cierra()
            body, i = entorno(s, i + len(m.group(0)), m.group(1))
            B.append((m.group(1), body)); continue
        if s.startswith("\\appendix", i):
            i += len("\\appendix"); continue
        par.append(s[i]); i += 1
    cierra()
    return B


def caption_label(body):
    cap = lab = None
    k = body.find("\\caption{")
    if k != -1:
        cap, _ = grupo(body, k + 8)
    m = re.search(r"\\label\{([^}]+)\}", body)
    if m:
        lab = m.group(1)
    return cap, lab


def numerar(B):
    refs, nf, nt = {}, 0, 0
    for b in B:
        if b[0] == "figure":
            nf += 1
            _, lab = caption_label(b[1])
            if lab: refs[lab] = nf
        elif b[0] == "table":
            nt += 1
            _, lab = caption_label(b[1])
            if lab: refs[lab] = nt
    return refs


def filas_tabla(body):
    k = body.index("\\begin{tabular}")
    _, j = grupo(body, k + len("\\begin{tabular}"))
    tab, _ = entorno(body, j, "tabular")
    filas = []
    for r in re.split(r"\\\\", tab):
        r = r.replace("\\hline", "").strip()
        if not r:
            continue
        celdas, cur, d, q = [], [], 0, 0
        for ch_i, ch in enumerate(r):
            if ch == "{": d += 1
            if ch == "}": d -= 1
            if ch == "$": q ^= 1
            if ch == "&" and d == 0 and not q and (ch_i == 0 or r[ch_i - 1] != "\\"):
                celdas.append("".join(cur)); cur = []
            else:
                cur.append(ch)
        celdas.append("".join(cur))
        fila = []
        for c in celdas:
            c = c.strip()
            m = re.match(r"\\multicolumn\{(\d+)\}\{[^}]*\}", c)
            if m:
                cont, _ = grupo(c, m.end())
                fila.append((cont, int(m.group(1))))
            else:
                fila.append((c, 1))
        filas.append(fila)
    return filas


# ---------------------------------------------------------------- escritura en Word
class Doc:
    def __init__(self, plantilla, salida):
        shutil.copy(plantilla, salida)
        self.w = wc.gencache.EnsureDispatch("Word.Application")
        self.w.Visible = False
        self.w.DisplayAlerts = 0
        self.d = self.w.Documents.Open(os.path.abspath(salida))
        self.salida = os.path.abspath(salida)
        d = self.d
        ps = d.PageSetup
        self.ancho = ps.PageWidth - ps.LeftMargin - ps.RightMargin
        self.h1, self.h2, self.h3 = d.Styles(-2), d.Styles(-3), d.Styles(-4)
        lt = self.h1.ListTemplate
        self.h3.LinkToListTemplate(lt, 3)
        for st in (self.h3,):
            st.Font.Name = "Arial"; st.Font.Size = 11; st.Font.Bold = True; st.Font.Italic = False
            st.Font.Color = 0; st.ParagraphFormat.SpaceBefore = 0; st.ParagraphFormat.SpaceAfter = 0
        self.cap = d.Styles(-35)

    def portada(self, reemplazos):
        for a, b in reemplazos:
            f = self.d.Content.Find
            f.ClearFormatting(); f.Replacement.ClearFormatting()
            f.Execute(a, True, False, False, False, False, True, 0, False, b, 1)

    def limpiar_cuerpo(self, primer_titulo):
        d = self.d
        for p in d.Paragraphs:
            if p.Style.NameLocal == self.h1.NameLocal and primer_titulo.lower() in p.Range.Text.lower():
                d.Range(p.Range.Start, d.Content.End).Delete()
                return
        raise RuntimeError("no se encontró el primer título de la plantilla")

    def _nuevo(self, estilo=None):
        d = self.d
        r = d.Content
        r.InsertParagraphAfter()
        p = d.Paragraphs.Last
        p.Range.Style = estilo if estilo is not None else d.Styles(-1)
        p.Range.ParagraphFormat.Alignment = 3
        return p

    def runs(self, runs, estilo=None, align=None, after=6, before=0, sangria=None):
        p = self._nuevo(estilo)
        texto = "".join(t for t, _ in runs)
        r = p.Range
        r.InsertBefore(texto)
        start = p.Range.Start
        pos = 0
        for t, f in runs:
            n = len(t.encode("utf-16-le")) // 2
            if any(f.get(k) for k in ("b", "it", "i", "sub", "sup", "col")):
                rr = self.d.Range(start + pos, start + pos + n)
                if f.get("b"): rr.Font.Bold = True
                if f.get("it") or f.get("i"): rr.Font.Italic = True
                if f.get("sub"): rr.Font.Subscript = True
                if f.get("sup"): rr.Font.Superscript = True
                if f.get("col"):
                    R, G, B = f["col"]; rr.Font.Color = R + 256 * G + 65536 * B
            pos += n
        pf = p.Range.ParagraphFormat
        if align is not None: pf.Alignment = align
        pf.SpaceAfter = after; pf.SpaceBefore = before
        if sangria: pf.LeftIndent = sangria
        return p

    def titulo(self, nivel, runs):
        p = self.runs(runs, {1: self.h1, 2: self.h2, 3: self.h3}[nivel], align=0, after=6, before=12 if nivel == 1 else 8)
        if nivel == 1:
            p.Range.ParagraphFormat.PageBreakBefore = True
        for k in ("i", "it"):
            p.Range.Font.Italic = False
        return p

    def vineta(self, runs):
        p = self.runs(runs, after=3)
        p.Range.ListFormat.ApplyListTemplate(self.w.ListGalleries(1).ListTemplates(1), False, 1)
        p.Range.ParagraphFormat.LeftIndent = 18; p.Range.ParagraphFormat.FirstLineIndent = -18
        return p

    def ecuacion(self, lin):
        p = self._nuevo()
        p.Range.InsertBefore(lin)
        r = self.d.Range(p.Range.Start, p.Range.End - 1)
        r.OMaths.Add(r)
        om = r.OMaths(1)
        om.BuildUp()
        om.Justification = 1  # centrada
        p.Range.ParagraphFormat.SpaceAfter = 6
        p.Range.ParagraphFormat.SpaceBefore = 3

    def figura(self, archivo, frac, cap_runs):
        p = self._nuevo()
        p.Range.ParagraphFormat.Alignment = 1
        p.Range.ParagraphFormat.KeepWithNext = True
        sh = p.Range.InlineShapes.AddPicture(archivo, False, True)
        w = self.ancho * min(frac, 1.0)
        if sh.Width > 0:
            sh.LockAspectRatio = True
            k = w / sh.Width
            sh.Width = w; sh.Height = sh.Height  # aspecto bloqueado
        p.Range.ParagraphFormat.SpaceAfter = 2
        self.runs(cap_runs, self.cap, align=1, after=10)

    def tabla(self, filas, cap_runs, refs):
        self.runs(cap_runs, self.cap, align=0, after=3).Range.ParagraphFormat.KeepWithNext = True
        ncol = max(sum(n for _, n in f) for f in filas)
        p = self._nuevo()
        t = self.d.Tables.Add(p.Range, len(filas), ncol)
        t.Style = self.d.Styles(-155)
        t.Range.ParagraphFormat.Alignment = 1
        t.Range.ParagraphFormat.SpaceAfter = 0
        tam = 10 if ncol <= 4 else 9 if ncol <= 7 else 7.5
        t.Range.Font.Size = tam
        merges = []
        for ri, fila in enumerate(filas):
            ci = 1
            for cont, n in fila:
                runs = inline(cont, refs=refs)
                cell = t.Cell(ri + 1, ci).Range
                texto = "".join(x for x, _ in runs)
                cell.Text = texto
                s0 = cell.Start; pos = 0
                for x, f in runs:
                    m = len(x.encode("utf-16-le")) // 2
                    if any(f.get(k) for k in ("b", "it", "i", "sub", "sup", "col")):
                        rr = self.d.Range(s0 + pos, s0 + pos + m)
                        if f.get("b") or ri == 0: rr.Font.Bold = True
                        if f.get("it") or f.get("i"): rr.Font.Italic = True
                        if f.get("sub"): rr.Font.Subscript = True
                        if f.get("sup"): rr.Font.Superscript = True
                        if f.get("col"):
                            R, G, B = f["col"]; rr.Font.Color = R + 256 * G + 65536 * B
                    pos += m
                if ri == 0:
                    cell.Font.Bold = True
                    t.Cell(ri + 1, ci).Shading.BackgroundPatternColor = 0xF2F2F2
                if n > 1:
                    merges.append((ri + 1, ci, ci + n - 1))
                ci += n
        for r_, a, b in reversed(merges):
            t.Cell(r_, a).Merge(t.Cell(r_, b))
        t.Rows(1).HeadingFormat = True
        t.AutoFitBehavior(1)  # contenido
        t.AutoFitBehavior(2)  # ventana
        t.Rows.AllowBreakAcrossPages = False
        self.d.Content.InsertParagraphAfter()
        q = self.d.Paragraphs.Last
        q.Range.Style = self.d.Styles(-1)
        q.Range.ParagraphFormat.SpaceAfter = 6

    def cerrar(self, pdf):
        d = self.d
        # quitar un párrafo vacío final si sobra
        for toc in d.TablesOfContents:
            toc.Update()
        d.Save()
        d.ExportAsFixedFormat(os.path.abspath(pdf), 17, False, 0, 0, 1, 1, 0, True, True, 1)
        d.Close(False)
        self.w.Quit()


def main(plantilla, salida, pdf):
    s = leer(TEX)
    B = bloques(s)
    refs = numerar(B)
    D = Doc(plantilla, salida)
    try:
        D.portada([
            ("EQUIPOS PARA INTERFACES ENTRE PROCESOS", "DISEÑO DE DETALLE – GRIPPER ROBÓTICO"),
            ("TALLER 1", "INFORME DE CÁLCULOS MECÁNICOS^lGRIPPER DE TRES DEDOS UR5e V2.4"),
            ("ESTUDIANTE 1", "DAVID ZULUAGA HENAO"),
            ("XX DE MES DE 202X", "7 DE OCTUBRE DE 2026"),
            ("202X", "2026"),
        ])
        for k in range(2, 6):
            f = D.d.Content.Find
            f.Execute("ESTUDIANTE %d^p" % k, True, False, False, False, False, True, 0, False, "", 1)
        D.limpiar_cuerpo("EJERCICIO 1")
        nf = nt = 0
        for b in B:
            k = b[0]
            if k == "h":
                D.titulo(b[1], inline(b[2], refs=refs))
            elif k == "p":
                t = b[1]
                if not inline(t, refs=refs):
                    continue
                D.runs(inline(t, refs=refs))
            elif k == "eq":
                for e in re.split(r"\\qquad", b[1]):
                    D.ecuacion(uni(e.strip()))
            elif k == "itemize":
                items = [x for x in re.split(r"\\item\b", b[1]) if x.strip()]
                for it in items:
                    partes = re.split(r"(\\eq\{)", it)
                    txt = partes[0]
                    D.vineta(inline(txt, refs=refs))
                    resto = it[len(txt):]
                    while resto.startswith("\\eq{"):
                        e, j = grupo(resto, 3); resto = resto[j:].strip()
                        for e2 in re.split(r"\\qquad", e):
                            D.ecuacion(uni(e2.strip()))
                        if resto:
                            D.runs(inline(resto, refs=refs), sangria=18); resto = ""
            elif k == "figure":
                nf += 1
                cap, _ = caption_label(b[1])
                m = re.search(r"\\includegraphics\[width=([\d.]*)\\textwidth\]\{([^}]+)\}", b[1])
                frac = float(m.group(1) or 1)
                D.figura(os.path.join(FIG, m.group(2)), frac,
                         [("Figura %d. " % nf, {"b": True})] + inline(cap, refs=refs))
            elif k == "table":
                nt += 1
                cap, _ = caption_label(b[1])
                D.tabla(filas_tabla(b[1]), [("Tabla %d. " % nt, {"b": True})] + inline(cap, refs=refs), refs)
            print(k, end=" ", flush=True)
        D.cerrar(pdf)
    except Exception:
        D.d.Save(); D.d.Close(False); D.w.Quit()
        raise
    print("\nfiguras", nf, "tablas", nt)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
