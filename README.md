# Credit Risk Predictor

Machine learning web application predicting customer credit default risk with an interactive interface and trained model.

## Live Demo

https://credit-risk-predictor-mpt9.onrender.com

This project is fully deployed online using Render. Users can test the machine learning credit risk prediction model directly through the web interface.

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688.svg)](https://fastapi.tiangolo.com/)
[![Scikit-learn](https://img.shields.io/badge/Scikit--learn-1.6.1-orange.svg)](https://scikit-learn.org/)

---

## About

This project is an end-to-end ML deployment demonstrating:

- **Credit risk prediction** — Pre-trained scikit-learn model classifying applicants as Low, Medium, or High risk
- **Production API** — FastAPI backend serving predictions via REST
- **Interactive UI** — Dark-theme web interface with tooltips, risk visualization, and explainability

---

## Features

- **Prediction form** — Financial field inputs with validation and tooltips
- **Risk visualization** — Color-coded result card (green/amber/red) with progress bar
- **Explainability** — "Why this prediction?" panel with rule-based factors
- **Prediction history** — Last 5 predictions displayed in a table
- **Responsive design** — Production-ready, mobile-friendly layout

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend   | Python, FastAPI |
| ML        | Scikit-learn, Pandas, NumPy |
| Frontend  | HTML, CSS, JavaScript |
| Deployment| Uvicorn, Render |

---

## Project Structure

```
.
├── app.py               # FastAPI application
├── best_model.pkl       # Trained ML model
├── scaler.pkl           # StandardScaler
├── feature_columns.json # Feature schema
├── templates/
│   └── index.html       # Homepage
├── static/
│   ├── style.css        # Styles
│   └── app.js           # Frontend logic
├── requirements.txt
├── runtime.txt
└── README.md
```

---

## Quick Start

### Local run

```bash
pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8010
```

Open [http://127.0.0.1:8010](http://127.0.0.1:8010)

### API

**POST /predict** — Submit applicant data as JSON.

| Field | Description |
|-------|-------------|
| `AMT_INCOME_TOTAL` | Annual income |
| `AMT_CREDIT` | Requested credit amount |
| `AMT_ANNUITY` | Yearly repayment |
| `DAYS_BIRTH` | Age in days (negative) |
| `CODE_GENDER` | M / F |
| `NAME_CONTRACT_TYPE` | Cash loans / Revolving loans |

**Response:** `prediction`, `label`, `probability`

Live API docs: **[/docs](http://127.0.0.1:8010/docs)**

---

## Deploy on Render

1. Connect this repository to [Render](https://render.com)
2. **Build command:** `pip install -r requirements.txt`
3. **Start command:** `uvicorn app:app --host 0.0.0.0 --port $PORT`

---

## Author

**Abdrakib** — [GitHub](https://github.com/Abdrakib)

## License

This project is open source and available under the [MIT License](LICENSE).
