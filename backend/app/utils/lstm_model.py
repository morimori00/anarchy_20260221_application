"""
Inference-only LSTM model for gas energy consumption prediction.

Hybrid dual-branch architecture:
    temporal (B, seq_len, n_temporal) -> LSTM -> temporal_emb
    static   (B, n_static)           -> MLP  -> static_emb
    concat(temporal_emb, static_emb) -> MLP head -> prediction (B,)

Checkpoint keys:
    model_state_dict, scaler_stats, n_temporal_features, n_static_features
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Tuple

import numpy as np
import torch
import torch.nn as nn


@dataclass
class LSTMParams:
    hidden_size: int = 256
    num_layers: int = 3
    dropout_lstm: float = 0.3
    bidirectional: bool = False
    static_embedding_dim: int = 32
    static_hidden_dims: list[int] = field(default_factory=lambda: [64])
    dropout_static: float = 0.3
    head_dims: list[int] = field(default_factory=lambda: [128, 64])
    dropout_head: float = 0.3


class EnergyLSTMHybrid(nn.Module):
    """Hybrid LSTM for energy prediction from temporal + static features."""

    def __init__(self, n_temporal: int, n_static: int, params: LSTMParams):
        super().__init__()
        self.n_temporal = n_temporal
        self.n_static = n_static
        self.hidden_size = params.hidden_size
        self.num_layers = params.num_layers
        self.bidirectional = params.bidirectional

        self.lstm = nn.LSTM(
            input_size=n_temporal,
            hidden_size=params.hidden_size,
            num_layers=params.num_layers,
            batch_first=True,
            dropout=params.dropout_lstm if params.num_layers > 1 else 0.0,
            bidirectional=params.bidirectional,
        )

        lstm_out_dim = params.hidden_size * (2 if params.bidirectional else 1)

        static_layers: list[nn.Module] = []
        in_dim = n_static
        for hdim in params.static_hidden_dims:
            static_layers.append(nn.Linear(in_dim, hdim))
            static_layers.append(nn.ReLU())
            static_layers.append(nn.Dropout(params.dropout_static))
            in_dim = hdim
        static_layers.append(nn.Linear(in_dim, params.static_embedding_dim))
        static_layers.append(nn.ReLU())
        self.static_mlp = nn.Sequential(*static_layers)

        fusion_in = lstm_out_dim + params.static_embedding_dim
        head_layers: list[nn.Module] = []
        in_dim = fusion_in
        for hdim in params.head_dims:
            head_layers.append(nn.Linear(in_dim, hdim))
            head_layers.append(nn.GELU())
            head_layers.append(nn.Dropout(params.dropout_head))
            in_dim = hdim
        head_layers.append(nn.Linear(in_dim, 1))
        self.head = nn.Sequential(*head_layers)

    def forward(self, temporal: torch.Tensor, static: torch.Tensor) -> torch.Tensor:
        _, (h_n, _) = self.lstm(temporal)
        if self.bidirectional:
            temporal_emb = torch.cat([h_n[-2], h_n[-1]], dim=-1)
        else:
            temporal_emb = h_n[-1]
        static_emb = self.static_mlp(static)
        fused = torch.cat([temporal_emb, static_emb], dim=-1)
        out = self.head(fused)
        return out.squeeze(-1)


def load_lstm_model(
    path: str | Path,
    device: str = "cpu",
) -> Tuple[EnergyLSTMHybrid, dict, torch.device]:
    """Load LSTM model from checkpoint.

    Returns (model, scaler_stats, device).
    """
    device = torch.device(device)
    ckpt = torch.load(path, map_location=device, weights_only=False)

    n_temporal = ckpt["n_temporal_features"]
    n_static = ckpt["n_static_features"]
    params = LSTMParams()

    model = EnergyLSTMHybrid(n_temporal, n_static, params).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()

    return model, ckpt["scaler_stats"], device


def lstm_predict(
    model: EnergyLSTMHybrid,
    temporal: np.ndarray,
    static: np.ndarray,
    scaler_stats: dict,
    device: torch.device,
    batch_size: int = 512,
) -> np.ndarray:
    """Run LSTM inference on pre-normalized arrays.

    Args:
        temporal: (N, seq_length, n_temporal) already normalized
        static: (N, n_static) already normalized
        scaler_stats: must contain target_mean, target_std for denormalization

    Returns:
        predictions: (N,) in original (denormalized) units
    """
    model.eval()
    all_preds = []

    with torch.no_grad():
        for i in range(0, len(temporal), batch_size):
            t_batch = torch.from_numpy(temporal[i : i + batch_size]).float().to(device)
            s_batch = torch.from_numpy(static[i : i + batch_size]).float().to(device)
            preds = model(t_batch, s_batch).cpu().numpy()
            all_preds.append(preds)

    preds = np.concatenate(all_preds)

    # Denormalize
    if "target_mean" in scaler_stats:
        preds = preds * scaler_stats["target_std"] + scaler_stats["target_mean"]

    return preds
