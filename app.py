"""
Customer Credit Risk Prediction - FastAPI Web Application
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import Body, FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "best_model.pkl"
SCALER_PATH = BASE_DIR / "scaler.pkl"
FEATURE_COLUMNS_PATH = BASE_DIR / "feature_columns.json"

# Categorical columns (object type in original data - from get_dummies)
CATEGORICAL_COLS = [
    "NAME_CONTRACT_TYPE", "CODE_GENDER", "FLAG_OWN_CAR", "FLAG_OWN_REALTY",
    "NAME_TYPE_SUITE", "NAME_INCOME_TYPE", "NAME_EDUCATION_TYPE", "NAME_FAMILY_STATUS",
    "NAME_HOUSING_TYPE", "OCCUPATION_TYPE", "WEEKDAY_APPR_PROCESS_START",
    "ORGANIZATION_TYPE", "FONDKAPREMONT_MODE", "HOUSETYPE_MODE",
    "WALLSMATERIAL_MODE", "EMERGENCYSTATE_MODE",
]

# App setup
app = FastAPI(
    title="Customer Credit Risk Prediction",
    description="Predict credit risk for customers using ML model",
    version="1.0.0",
)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

# Global artifacts (loaded at startup)
model = None
scaler = None
feature_columns = None


def load_artifacts():
    """Load model, scaler, and feature columns at startup."""
    global model, scaler, feature_columns

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    if not SCALER_PATH.exists():
        raise FileNotFoundError(f"Scaler not found: {SCALER_PATH}")
    if not FEATURE_COLUMNS_PATH.exists():
        raise FileNotFoundError(f"Feature columns not found: {FEATURE_COLUMNS_PATH}")

    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    with open(FEATURE_COLUMNS_PATH, "r") as f:
        feature_columns = json.load(f)


@app.on_event("startup")
async def startup_event():
    """Load artifacts on application startup."""
    load_artifacts()


def preprocess_input(data: dict) -> np.ndarray:
    """
    Preprocess input exactly like training:
    1. Create DataFrame from input
    2. Fill missing numeric with 0, categorical with "Unknown"
    3. Apply get_dummies to categorical columns
    4. Align to feature_columns (add missing=0, drop extra, reorder)
    5. Apply scaler.transform
    """
    df = pd.DataFrame([data])

    # Numeric cols = feature_columns that are NOT one-hot encoded (no "CatCol_Value" pattern)
    numeric_cols = [
        c for c in feature_columns
        if not any(c.startswith(cat + "_") for cat in CATEGORICAL_COLS)
    ]

    # Fill missing numeric with 0
    for col in numeric_cols:
        if col not in df.columns:
            df[col] = 0
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Fill missing categorical with "Unknown" (all categorical columns)
    for col in CATEGORICAL_COLS:
        if col not in df.columns:
            df[col] = "Unknown"
        else:
            val = df[col].iloc[0]
            if pd.isna(val) or (isinstance(val, (int, float)) and np.isnan(val)):
                df[col] = "Unknown"
            else:
                df[col] = str(val).strip() if str(val).strip() else "Unknown"

    # Apply get_dummies to categorical columns
    df = pd.get_dummies(df, columns=CATEGORICAL_COLS, drop_first=False, dummy_na=False)

    # Align to feature_columns: add missing=0, drop extra, reorder
    for col in feature_columns:
        if col not in df.columns:
            df[col] = 0
    df = df[feature_columns]
    df = df.fillna(0)

    X_scaled = scaler.transform(df)
    return X_scaled


@app.get("/", response_class=HTMLResponse)
async def homepage(request: Request):
    """Serve homepage with Jinja2 template."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/predict")
async def predict(data: dict = Body(...)):
    """
    Predict credit risk. Accepts JSON with raw column names.
    Returns prediction (0/1), label, and probability.
    """
    try:
        X = preprocess_input(data)
    except Exception as e:
        return {"error": str(e), "prediction": None, "label": None, "probability": None}

    pred = model.predict(X)[0]
    pred_int = int(pred)

    # Get probability if model supports predict_proba
    proba = 0.5
    if hasattr(model, "predict_proba"):
        proba_arr = model.predict_proba(X)[0]
        # Probability of class 1 (High Risk)
        proba = float(proba_arr[1]) if len(proba_arr) > 1 else float(proba_arr[0])

    label = "High Risk" if pred_int == 1 else "Low Risk"

    return {
        "prediction": pred_int,
        "label": label,
        "probability": round(proba, 4),
    }
