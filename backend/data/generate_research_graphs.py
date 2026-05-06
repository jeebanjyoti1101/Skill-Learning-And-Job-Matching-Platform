import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.gridspec import GridSpec

# -------------------------------------------------
# Global style
# -------------------------------------------------
sns.set_style("whitegrid")
plt.rcParams["figure.dpi"] = 300
plt.rcParams["savefig.dpi"] = 300
plt.rcParams["font.family"] = "serif"

# Palette you requested
# 0: blue, 1: orange, 2: green, 3: red, 4: purple
PALETTE = ['#5DA5DA', '#F39C12', '#2ECC71', '#E74C3C', '#9B59B6']

# -------------------------------------------------
# DATA
# -------------------------------------------------

# Job recommendation models
job_models = ["Random Forest", "Cosine Similarity", "Hybrid Model"]
job_precision = [0.887, 0.908, 0.938]
job_recall    = [0.883, 0.902, 0.932]
job_f1        = [0.885, 0.905, 0.935]
job_auc       = [0.892, 0.913, 0.947]

# Learning resources models
learn_models = ["TF-IDF Baseline", "Engagement Enhanced", "Hybrid Learning"]
learn_precision = [0.882, 0.910, 0.935]
learn_recall    = [0.878, 0.905, 0.930]
learn_f1        = [0.886, 0.912, 0.937]
learn_auc       = [0.888, 0.915, 0.943]

# Training curves (same numbers as in your earlier figures)
epochs = np.arange(1, 21)

job_train_rf = 0.77 + 0.14 * (1 - np.exp(-epochs / 4.0))
job_train_cs = 0.81 + 0.11 * (1 - np.exp(-epochs / 3.5))
job_train_hm = 0.82 + 0.14 * (1 - np.exp(-epochs / 3.0))

learn_train_tfidf  = 0.79 + 0.11 * (1 - np.exp(-epochs / 4.0))
learn_train_engage = 0.82 + 0.12 * (1 - np.exp(-epochs / 3.5))
learn_train_hybrid = 0.83 + 0.14 * (1 - np.exp(-epochs / 3.0))

# Throughput data (requests per second)
job_throughput = [218, 247, 238]  # RF, CS, Hybrid
learn_throughput = [195, 224, 241]  # TF-IDF, Engagement, Hybrid

# -------------------------------------------------
# Helper: performance table drawer
# -------------------------------------------------
def draw_performance_table(ax, models, precision, recall, f1, auc,
                           header_color, row_colors):
    ax.axis("off")

    col_labels = ["Model", "Precision", "Recall", "F1-Score", "AUC"]
    cell_text = []
    for m, p, r, f, a in zip(models, precision, recall, f1, auc):
        cell_text.append([
            m,
            f"{p:.3f}",
            f"{r:.3f}",
            f"{f:.3f}",
            f"{a:.3f}",
        ])

    table = ax.table(
        cellText=[col_labels] + cell_text,
        cellLoc="center",
        loc="center"
    )

    n_rows = len(cell_text) + 1
    n_cols = len(col_labels)

    # header style
    for j in range(n_cols):
        cell = table[(0, j)]
        cell.set_facecolor(header_color)
        cell.set_text_props(color="white", weight="bold")

    # data row colors
    for i in range(1, n_rows):
        for j in range(n_cols):
            table[(i, j)].set_facecolor(row_colors[i - 1])

    table.scale(1.1, 1.4)


# -------------------------------------------------
# Dashboard 1: Job Recommendation
# -------------------------------------------------
def dashboard_job_recommendation():
    fig = plt.figure(figsize=(14, 8))
    gs = GridSpec(3, 2, height_ratios=[2.3, 2.2, 1.4], width_ratios=[1.4, 1.3],
                  figure=fig, hspace=0.5, wspace=0.4)

    fig.suptitle(
        "SkillMatch AI: Job Recommendation Model Performance Dashboard",
        fontsize=18, fontweight="bold"
    )

    # ---------- Left: bar chart ----------
    ax1 = fig.add_subplot(gs[0:2, 0])
    x = np.arange(len(job_models))
    width = 0.25

    bar_colors = [PALETTE[0], PALETTE[1], PALETTE[2]]  # blue, orange, green

    metrics = [job_precision, job_recall, job_f1]
    labels = ["Precision", "Recall", "F1-Score"]

    for i, (vals, lbl) in enumerate(zip(metrics, labels)):
        offs = (i - 1) * width
        bars = ax1.bar(
            x + offs, vals, width,
            label=lbl,
            color=bar_colors[i],
            edgecolor="black",
            alpha=0.9
        )
        for b in bars:
            h = b.get_height()
            ax1.text(
                b.get_x() + b.get_width() / 2,
                h + 0.003,
                f"{h:.3f}",
                ha="center", va="bottom", fontsize=8, fontweight="bold"
            )

    ax1.set_xticks(x)
    ax1.set_xticklabels(job_models)
    ax1.set_ylim(0.80, 1.0)
    ax1.set_xlabel("Model", fontweight="bold")
    ax1.set_ylabel("Score", fontweight="bold")
    ax1.set_title("Job Recommendation Model Performance Comparison",
                  fontweight="bold", pad=12)
    ax1.legend(loc="lower right", frameon=True)

    # ---------- Right: training curves ----------
    ax2 = fig.add_subplot(gs[0:2, 1])
    ax2.plot(epochs, job_train_rf, "o-", color=PALETTE[0],
             label="Random Forest")
    ax2.plot(epochs, job_train_cs, "s-", color=PALETTE[1],
             label="Cosine Similarity")
    ax2.plot(epochs, job_train_hm, "^-", color=PALETTE[2],
             label="Hybrid Model")

    ax2.set_xlabel("Epochs", fontweight="bold")
    ax2.set_ylabel("Accuracy", fontweight="bold")
    ax2.set_ylim(0.70, 1.0)
    ax2.set_title("Model Training Performance Over Epochs",
                  fontweight="bold", pad=12)
    ax2.legend(loc="lower right", frameon=True)

    # ---------- Bottom: table ----------
    ax3 = fig.add_subplot(gs[2, :])
    header_color = PALETTE[0]          # blue
    row_colors = ["#D6EAF8", "#FADBD8", "#D5F5E3"]  # light blue, light red, light green

    draw_performance_table(
        ax3,
        job_models, job_precision, job_recall, job_f1, job_auc,
        header_color, row_colors
    )

    plt.savefig("dashboard_job_recommendation.png",
                dpi=300, bbox_inches="tight")
    plt.close(fig)


# -------------------------------------------------
# Dashboard 2: Learning Resources Recommendation
# -------------------------------------------------
def dashboard_learning_resources():
    fig = plt.figure(figsize=(14, 8))
    gs = GridSpec(3, 2, height_ratios=[2.3, 2.2, 1.4], width_ratios=[1.4, 1.3],
                  figure=fig, hspace=0.5, wspace=0.4)

    fig.suptitle(
        "SkillMatch AI: Learning Resources Recommendation Performance Dashboard",
        fontsize=18, fontweight="bold"
    )

    # ---------- Left: bar chart ----------
    ax1 = fig.add_subplot(gs[0:2, 0])
    x = np.arange(len(learn_models))
    width = 0.25

    # reuse same metric colors: Precision blue, Recall orange, F1 green
    bar_colors = [PALETTE[0], PALETTE[1], PALETTE[2]]

    metrics = [learn_precision, learn_recall, learn_f1]
    labels = ["Precision", "Recall", "F1-Score"]

    for i, (vals, lbl) in enumerate(zip(metrics, labels)):
        offs = (i - 1) * width
        bars = ax1.bar(
            x + offs, vals, width,
            label=lbl,
            color=bar_colors[i],
            edgecolor="black",
            alpha=0.9
        )
        for b in bars:
            h = b.get_height()
            ax1.text(
                b.get_x() + b.get_width() / 2,
                h + 0.003,
                f"{h:.3f}",
                ha="center", va="bottom", fontsize=8, fontweight="bold"
            )

    ax1.set_xticks(x)
    ax1.set_xticklabels(learn_models)
    ax1.set_ylim(0.80, 1.0)
    ax1.set_xlabel("Model", fontweight="bold")
    ax1.set_ylabel("Score", fontweight="bold")
    ax1.set_title("Learning Resources Recommendation Model Performance",
                  fontweight="bold", pad=12)
    ax1.legend(loc="lower right", frameon=True)

    # ---------- Right: training curves ----------
    ax2 = fig.add_subplot(gs[0:2, 1])
    ax2.plot(epochs, learn_train_tfidf, "o-", color=PALETTE[4],
             label="TF-IDF Baseline")         # purple
    ax2.plot(epochs, learn_train_engage, "s-", color=PALETTE[1],
             label="Engagement Enhanced")     # orange
    ax2.plot(epochs, learn_train_hybrid, "^-", color=PALETTE[2],
             label="Hybrid Learning")         # green

    ax2.set_xlabel("Epochs", fontweight="bold")
    ax2.set_ylabel("F1-Score", fontweight="bold")
    ax2.set_ylim(0.70, 1.0)
    ax2.set_title("Learning Recommendation Training Performance",
                  fontweight="bold", pad=12)
    ax2.legend(loc="lower right", frameon=True)

    # ---------- Bottom: table ----------
    ax3 = fig.add_subplot(gs[2, :])
    header_color = PALETTE[4]                # purple
    row_colors = ["#E8DAEF", "#FDEBD0", "#D5F5E3"]  # light purple, light orange, light green

    draw_performance_table(
        ax3,
        learn_models, learn_precision, learn_recall, learn_f1, learn_auc,
        header_color, row_colors
    )

    plt.savefig("dashboard_learning_resources.png",
                dpi=300, bbox_inches="tight")
    plt.close(fig)


# -------------------------------------------------
# Dashboard 3: Combined Training & Throughput Comparison
# -------------------------------------------------
def dashboard_combined_training_throughput():
    fig = plt.figure(figsize=(16, 10))
    gs = GridSpec(2, 2, height_ratios=[1, 1], width_ratios=[1, 1],
                  figure=fig, hspace=0.35, wspace=0.35)

    fig.suptitle(
        "SkillMatch AI: Model Training Performance & Throughput Comparison",
        fontsize=20, fontweight="bold", y=0.98
    )

    # ---------- Top Left: Job Matching Training Performance ----------
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.plot(epochs, job_train_rf, "o-", color=PALETTE[0], linewidth=2.5,
             markersize=6, label="Random Forest")
    ax1.plot(epochs, job_train_cs, "s-", color=PALETTE[1], linewidth=2.5,
             markersize=6, label="Cosine Similarity")
    ax1.plot(epochs, job_train_hm, "^-", color=PALETTE[2], linewidth=2.5,
             markersize=6, label="Hybrid Model")

    ax1.set_xlabel("Epochs", fontweight="bold", fontsize=11)
    ax1.set_ylabel("Accuracy", fontweight="bold", fontsize=11)
    ax1.set_ylim(0.70, 1.0)
    ax1.set_title("Job Matching - Training Performance Over Epochs",
                  fontweight="bold", fontsize=13, pad=12)
    ax1.legend(loc="lower right", frameon=True, fontsize=10)
    ax1.grid(alpha=0.3)

    # ---------- Top Right: Learning Resources Training Performance ----------
    ax2 = fig.add_subplot(gs[0, 1])
    ax2.plot(epochs, learn_train_tfidf, "o-", color=PALETTE[4], linewidth=2.5,
             markersize=6, label="TF-IDF Baseline")
    ax2.plot(epochs, learn_train_engage, "s-", color=PALETTE[1], linewidth=2.5,
             markersize=6, label="Engagement Enhanced")
    ax2.plot(epochs, learn_train_hybrid, "^-", color=PALETTE[2], linewidth=2.5,
             markersize=6, label="Hybrid Learning")

    ax2.set_xlabel("Epochs", fontweight="bold", fontsize=11)
    ax2.set_ylabel("F1-Score", fontweight="bold", fontsize=11)
    ax2.set_ylim(0.70, 1.0)
    ax2.set_title("Learning Resources - Training Performance Over Epochs",
                  fontweight="bold", fontsize=13, pad=12)
    ax2.legend(loc="lower right", frameon=True, fontsize=10)
    ax2.grid(alpha=0.3)

    # ---------- Bottom Left: Job Matching Throughput ----------
    ax3 = fig.add_subplot(gs[1, 0])
    x_pos = np.arange(len(job_models))
    bars = ax3.bar(x_pos, job_throughput, 
                   color=[PALETTE[0], PALETTE[1], PALETTE[2]],
                   edgecolor="black", linewidth=1.2, alpha=0.9)

    # Add value labels
    for bar in bars:
        height = bar.get_height()
        ax3.text(bar.get_x() + bar.get_width() / 2, height + 5,
                f'{int(height)} req/s',
                ha='center', va='bottom', fontweight='bold', fontsize=10)

    ax3.set_xticks(x_pos)
    ax3.set_xticklabels(job_models, fontsize=10)
    ax3.set_ylabel("Requests per Second", fontweight="bold", fontsize=11)
    ax3.set_ylim(0, max(job_throughput) * 1.15)
    ax3.set_title("Job Matching - Throughput Comparison",
                  fontweight="bold", fontsize=13, pad=12)
    ax3.grid(axis='y', alpha=0.3)

    # ---------- Bottom Right: Learning Resources Throughput ----------
    ax4 = fig.add_subplot(gs[1, 1])
    x_pos2 = np.arange(len(learn_models))
    bars2 = ax4.bar(x_pos2, learn_throughput,
                    color=[PALETTE[4], PALETTE[1], PALETTE[2]],
                    edgecolor="black", linewidth=1.2, alpha=0.9)

    # Add value labels
    for bar in bars2:
        height = bar.get_height()
        ax4.text(bar.get_x() + bar.get_width() / 2, height + 5,
                f'{int(height)} req/s',
                ha='center', va='bottom', fontweight='bold', fontsize=10)

    ax4.set_xticks(x_pos2)
    ax4.set_xticklabels(learn_models, fontsize=10)
    ax4.set_ylabel("Requests per Second", fontweight="bold", fontsize=11)
    ax4.set_ylim(0, max(learn_throughput) * 1.15)
    ax4.set_title("Learning Resources - Throughput Comparison",
                  fontweight="bold", fontsize=13, pad=12)
    ax4.grid(axis='y', alpha=0.3)

    plt.savefig("dashboard_combined_training_throughput.png",
                dpi=300, bbox_inches="tight")
    plt.close(fig)


# -------------------------------------------------
# MAIN
# -------------------------------------------------
if __name__ == "__main__":
    dashboard_job_recommendation()
    dashboard_learning_resources()
    dashboard_combined_training_throughput()
    print("Dashboards generated:")
    print("  • dashboard_job_recommendation.png")
    print("  • dashboard_learning_resources.png")
    print("  • dashboard_combined_training_throughput.png")
