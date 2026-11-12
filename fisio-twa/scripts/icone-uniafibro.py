"""Ícone do app Uniafibro, redesenhado a partir do logo da associação:
roda de 6 pessoas de mãos dadas, mapa de SC com "SC" e o laço roxo da fibromialgia,
roxo em degradê (lilás em cima à esquerda, roxo escuro embaixo à direita) sobre branco.

Uso: python -I icone-uniafibro.py <saida_dir>
Gera mipmap-*/ic_launcher.png (cantos arredondados) e play-icon-512.png (quadrado cheio).
"""
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

S = 2048
C = S / 2
K = 5.0  # escala: 1 unidade do logo original (640 px) = K px aqui
LILAS = (178, 140, 226)
ROXO = (70, 22, 122)
FONTES = ["C:/Windows/Fonts/georgia.ttf", "C:/Windows/Fonts/times.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"]


def L(x, y):
    """coordenada do logo original (centro da roda em 320,205) -> canvas"""
    return (C + (x - 320) * K, C + (y - 210) * K)


def degrade():
    pequeno = Image.new("RGB", (256, 256))
    p = pequeno.load()
    for y in range(256):
        for x in range(256):
            t = min(1.0, max(0.0, (x * 0.8 + y * 1.0) / 459))
            t = t ** 1.15
            p[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(LILAS, ROXO))
    return pequeno.resize((S, S), Image.BICUBIC).convert("RGBA")


def mascara():
    return Image.new("L", (S, S), 0)


# ---------- roda de pessoas ----------
R_CAB = 160    # raio (unid. logo) onde ficam as cabeças
CAB = 25       # raio da cabeça
R_ARCO = 127   # raio médio dos corpos/braços
GROSSO = 30    # espessura máxima do corpo
FINO = 7       # espessura nas mãos
FOLGA = 8      # espaço branco entre cabeça e corpo


def pessoa(m, ang):
    """corpo em meia-lua: grosso embaixo da cabeça, afinando até as mãos (±30°)."""
    d = ImageDraw.Draw(m)
    meia = 31
    externo, interno = [], []
    for i in range(121):
        da = -meia + 2 * meia * i / 120
        u = abs(da) / meia
        esp = FINO + (GROSSO - FINO) * (1 - u ** 1.6)
        rc = R_ARCO + 6 * (1 - u ** 2)  # ombros sobem em direção à cabeça
        a = math.radians(ang + da)
        externo.append(L(320 + (rc + esp / 2) * math.cos(a), 210 + (rc + esp / 2) * math.sin(a)))
        interno.append(L(320 + (rc - esp / 2) * math.cos(a), 210 + (rc - esp / 2) * math.sin(a)))
    d.polygon(externo + interno[::-1], fill=255)
    # cabeça, com folga branca até o corpo
    a = math.radians(ang)
    cx, cy = L(320 + R_CAB * math.cos(a), 210 + R_CAB * math.sin(a))
    r = (CAB + FOLGA) * K
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=0)
    r = CAB * K
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)


def roda():
    m = mascara()
    for k in range(6):
        pessoa(m, -90 + 60 * k)
    # recorta de novo as folgas das cabeças (o corpo vizinho pode ter passado por cima)
    d = ImageDraw.Draw(m)
    for k in range(6):
        a = math.radians(-90 + 60 * k)
        cx, cy = L(320 + R_CAB * math.cos(a), 210 + R_CAB * math.sin(a))
        r = (CAB + FOLGA) * K
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=0)
        r = CAB * K
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    return m


# ---------- mapa de Santa Catarina (silhueta simplificada) ----------
SC = [  # contorno aproximado: oeste à esquerda, litoral à direita, sul embaixo
    (220, 176), (228, 168), (241, 165), (254, 166), (266, 162), (279, 158), (292, 159),
    (303, 156), (315, 158), (328, 155), (342, 152), (356, 151), (370, 149), (383, 146),
    (396, 143), (407, 146), (412, 154), (406, 162), (410, 171), (404, 180), (408, 190),
    (402, 199), (405, 209), (398, 216), (399, 226), (391, 236), (385, 248), (377, 260),
    (368, 271), (358, 283), (347, 293), (338, 300), (333, 289), (327, 275), (320, 261),
    (312, 247), (304, 234), (294, 223), (282, 216), (268, 212), (254, 210), (240, 208),
    (229, 202), (222, 190)]


def mapa():
    m = mascara()
    ImageDraw.Draw(m).polygon([L(x, y) for x, y in SC], fill=255)
    # "SC" vazado em branco
    fonte = None
    for f in FONTES:
        if os.path.exists(f):
            fonte = ImageFont.truetype(f, int(36 * K))
            break
    if fonte is None:
        fonte = ImageFont.load_default()
    txt = Image.new("L", (S, S), 0)
    ImageDraw.Draw(txt).text(L(342, 205), "SC", font=fonte, fill=255, anchor="mm")
    return ImageChops.subtract(m, txt)


# ---------- laço ----------
def bezier(p0, p1, p2, p3, n=160):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append(tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * e
                         for a, b, c, e in zip(p0, p1, p2, p3)))
    return out


def traco(d, pts, w, cor):
    r = w / 2
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=cor)


def laco(m):
    """laço embaixo à esquerda do mapa, com contorno branco separando do mapa."""
    d = ImageDraw.Draw(m)
    cx, cy, s = 262, 258, 0.115
    P = lambda x, y: L(cx + x * s, cy + y * s)
    w = 9 * K
    s1 = bezier(P(-230, 400), P(-115, 225), P(35, 70), P(85, -35))
    s2 = bezier(P(85, -35), P(205, -280), P(110, -400), P(0, -400))
    s3 = bezier(P(0, -400), P(-110, -400), P(-205, -280), P(-85, -35))
    s4 = bezier(P(-85, -35), P(-35, 70), P(115, 225), P(230, 400))
    borda = w + 7 * K
    for seg in (s1, s2, s3, s4):
        traco(d, seg, borda, 0)
    for seg in (s2, s3, s4):
        traco(d, seg, w, 255)
    traco(d, s1[40:], w + 4 * K, 0)
    traco(d, s1, w, 255)
    # pontas retas
    for x, y in (P(-230, 400), P(230, 400)):
        d.rectangle([x - 7 * K, y - 1 * K, x + 7 * K, y + 7 * K], fill=0)


def marca():
    m = ImageChops.lighter(roda(), mapa())
    laco(m)
    return m


def icone(arredondado):
    base = Image.new("RGBA", (S, S), (255, 255, 255, 255))
    base.paste(degrade(), (0, 0), marca())
    if arredondado:
        a = mascara()
        ImageDraw.Draw(a).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.19), fill=255)
        base.putalpha(a)
        ImageDraw.Draw(base).rounded_rectangle([4, 4, S - 5, S - 5], radius=int(S * 0.19),
                                               outline=(225, 218, 238, 255), width=10)
    return base


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    launcher = icone(True)
    for nome, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        pasta = os.path.join(out, f"mipmap-{nome}")
        os.makedirs(pasta, exist_ok=True)
        launcher.resize((px, px), Image.LANCZOS).save(os.path.join(pasta, "ic_launcher.png"), optimize=True)
    icone(False).resize((512, 512), Image.LANCZOS).save(os.path.join(out, "play-icon-512.png"), optimize=True)
    launcher.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "preview-launcher-512.png"))
    print("ok")
