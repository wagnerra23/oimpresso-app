"""Ícone do app Uniafibro, redesenhado a partir do logo da associação:
roda de 6 pessoas de mãos dadas com o laço roxo da fibromialgia no centro,
roxo em degradê (lilás em cima à esquerda, roxo escuro embaixo à direita) sobre branco.

Uso: python -I icone-uniafibro.py <saida_dir>
Gera mipmap-*/ic_launcher.png (cantos arredondados) e play-icon-512.png (quadrado cheio).
"""
import math
import os
import sys

from PIL import Image, ImageDraw

S = 2048
C = S / 2
K = 5.0  # escala: 1 unidade do logo original (640 px) = K px aqui
LILAS = (178, 140, 226)
ROXO = (70, 22, 122)


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
    """laço da fibromialgia no centro da roda."""
    d = ImageDraw.Draw(m)
    cx, cy, s = 320, 214, 0.2
    P = lambda x, y: L(cx + x * s, cy + y * s)
    w = 17 * K
    s1 = bezier(P(-230, 400), P(-115, 225), P(35, 70), P(85, -35))
    s2 = bezier(P(85, -35), P(205, -280), P(110, -400), P(0, -400))
    s3 = bezier(P(0, -400), P(-110, -400), P(-205, -280), P(-85, -35))
    s4 = bezier(P(-85, -35), P(-35, 70), P(115, 225), P(230, 400))
    for seg in (s2, s3, s4):
        traco(d, seg, w, 255)
    traco(d, s1[40:], w + 8 * K, 0)
    traco(d, s1, w, 255)
    # pontas retas
    for x, y in (P(-230, 400), P(230, 400)):
        d.rectangle([x - 12 * K, y - 1 * K, x + 12 * K, y + 12 * K], fill=0)


def marca():
    m = roda()
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
