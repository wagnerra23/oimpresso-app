"""Ícone Uniafibro a partir do logo da associação: roda de 6 pessoas + laço roxo,
roxo em degradê sobre branco. Uso: python -I logo.py <saida_dir>"""
import sys, os, math
from PIL import Image, ImageDraw, ImageChops

S = 2048
C = S / 2
ROXO_CLARO = (150, 110, 205)
ROXO_ESCURO = (72, 30, 130)


def degrade_xy():
    small = Image.new("RGB", (256, 256))
    p = small.load()
    for y in range(256):
        for x in range(256):
            t = (x + y) / 510
            p[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(ROXO_CLARO, ROXO_ESCURO))
    return small.resize((S, S), Image.BICUBIC).convert("RGBA")


def bezier(p0, p1, p2, p3, n=200):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def traco(d, pts, w, fill):
    r = w / 2
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def marca():
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    # laço da fibromialgia no centro
    s = 0.92
    P = lambda x, y: (C + x * s, C + 20 + y * s)
    w = 150 * s
    s1 = bezier(P(-260, 440), P(-130, 250), P(40, 80), P(95, -40))
    s2 = bezier(P(95, -40), P(230, -310), P(125, -440), P(0, -440))
    s3 = bezier(P(0, -440), P(-125, -440), P(-230, -310), P(-95, -40))
    s4 = bezier(P(-95, -40), P(-40, 80), P(130, 250), P(260, 440))
    for seg in (s2, s3, s4):
        traco(d, seg, w, 255)
    # fita da frente: borda "vazada" para ler o cruzamento
    traco(d, s1[60:], w + 70, 0)
    traco(d, s1, w, 255)
    # pontas cortadas em V
    for (x, y), lado in ((P(-260, 440), -1), (P(260, 440), 1)):
        d.rectangle([x - 140, y - 20, x + 140, y + 160], fill=0)
    R, esp, cab = 690, 150, 128
    # anel em 6 arcos (corpos/braços), com folga perto de cada cabeça
    for k in range(6):
        a0 = -90 + k * 60 + 17
        a1 = -90 + (k + 1) * 60 - 17
        d.arc([C - R - esp / 2, C - R - esp / 2, C + R + esp / 2, C + R + esp / 2], a0, a1, fill=255, width=esp)
    # cabeças
    for k in range(6):
        a = math.radians(-90 + k * 60)
        x, y = C + (R + 40) * math.cos(a), C + (R + 40) * math.sin(a)
        d.ellipse([x - cab, y - cab, x + cab, y + cab], fill=255)

    return m


def icone(arredondado):
    base = Image.new("RGBA", (S, S), (255, 255, 255, 255))
    if arredondado:
        a = Image.new("L", (S, S), 0)
        ImageDraw.Draw(a).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.19), fill=255)
        base.putalpha(a)
    base.paste(degrade_xy(), (0, 0), marca())
    return base


def contorno(img):
    """ícone branco some em fundo claro: borda cinza bem leve no launcher"""
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, S - 5, S - 5], radius=int(S * 0.19), outline=(225, 218, 238, 255), width=10)
    return img


out = sys.argv[1]
os.makedirs(out, exist_ok=True)
launcher = contorno(icone(True))
play = icone(False)
for nome, px in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    d = os.path.join(out, f"mipmap-{nome}")
    os.makedirs(d, exist_ok=True)
    launcher.resize((px, px), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"), optimize=True)
play.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "play-icon-512.png"), optimize=True)
launcher.resize((512, 512), Image.LANCZOS).save(os.path.join(out, "preview-launcher-512.png"))
print("ok")
