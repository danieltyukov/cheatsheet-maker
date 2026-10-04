"""Study figures for the demo cheatsheet used in the screenshots (run with: sciviz python figures.py)."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False, "figure.dpi": 200})
INK, BLUE, RED = "#1b1d22", "#1971c2", "#c92a2a"

# Bode plot of a second-order low-pass.
w = np.logspace(-1, 2, 400)
for zeta, c in ((0.2, RED), (0.7, BLUE)):
    H = 1 / (1 - w**2 + 2j * zeta * w)
    plt.figure(1, figsize=(4.2, 3.0)) if not plt.fignum_exists(1) else plt.figure(1)
    plt.subplot(2, 1, 1); plt.semilogx(w, 20 * np.log10(abs(H)), color=c, lw=1.8, label=f"zeta = {zeta}")
    plt.subplot(2, 1, 2); plt.semilogx(w, np.degrees(np.angle(H)), color=c, lw=1.8)
plt.subplot(2, 1, 1); plt.ylabel("|H| (dB)"); plt.legend(frameon=False, fontsize=9); plt.title("Second-order low-pass", fontsize=11)
plt.subplot(2, 1, 2); plt.ylabel("phase (deg)"); plt.xlabel("omega / omega_n")
plt.tight_layout(); plt.savefig("bode.png"); plt.close()

# Pole-zero map.
plt.figure(figsize=(3.0, 3.0))
t = np.linspace(0, 2 * np.pi, 200)
plt.plot(np.cos(t), np.sin(t), color="#adb5bd", lw=1, ls="--")
plt.scatter([-0.4, -0.4], [0.7, -0.7], marker="x", s=70, color=RED, linewidths=2, label="poles")
plt.scatter([0.6], [0], marker="o", s=60, facecolors="none", edgecolors=BLUE, linewidths=2, label="zero")
plt.axhline(0, color=INK, lw=0.8); plt.axvline(0, color=INK, lw=0.8)
plt.gca().set_aspect("equal"); plt.xlim(-1.3, 1.3); plt.ylim(-1.3, 1.3)
plt.legend(frameon=False, fontsize=9, loc="upper right"); plt.title("Pole-zero map", fontsize=11)
plt.tight_layout(); plt.savefig("polezero.png"); plt.close()

# Step response.
tt = np.linspace(0, 12, 400)
plt.figure(figsize=(4.0, 2.4))
for zeta, c in ((0.2, RED), (0.7, BLUE)):
    wd = np.sqrt(1 - zeta**2)
    y = 1 - np.exp(-zeta * tt) * (np.cos(wd * tt) + zeta / wd * np.sin(wd * tt))
    plt.plot(tt, y, color=c, lw=1.8)
plt.axhline(1, color="#adb5bd", lw=1, ls="--"); plt.xlabel("t (s)"); plt.title("Step response", fontsize=11)
plt.tight_layout(); plt.savefig("step.png"); plt.close()
print("figures written")
