/**
 * Customer Credit Risk Prediction - Frontend
 * Collects form data, sends POST to /predict, displays result without reload.
 */

// Store last 5 predictions (frontend-only)
let predictionHistory = [];

/**
 * Generate up to 3 rule-based reasons for "Why this prediction?" based on submitted inputs.
 * Uses simple rule-based logic without changing the ML model.
 */
function getPredictionReasons(data, prob, riskClass) {
    const income = parseFloat(data.AMT_INCOME_TOTAL) || 0;
    const credit = parseFloat(data.AMT_CREDIT) || 0;
    const annuity = parseFloat(data.AMT_ANNUITY) || 0;
    const daysEmployed = parseFloat(data.DAYS_EMPLOYED) || 0;
    const ext1 = parseFloat(data.EXT_SOURCE_1);
    const ext2 = parseFloat(data.EXT_SOURCE_2);
    const ext3 = parseFloat(data.EXT_SOURCE_3);
    const extScores = [ext1, ext2, ext3].filter((n) => !isNaN(n));
    const avgExt = extScores.length ? extScores.reduce((a, b) => a + b, 0) / extScores.length : null;

    const creditToIncome = income > 0 ? credit / income : 0;
    const annuityToIncome = income > 0 ? annuity / income : 0;
    const employedLongTerm = daysEmployed < -365;
    const shortEmployment = daysEmployed >= -365; // Less than 1 year or unemployed
    const hasExtScores = avgExt !== null;
    const ownCar = String(data.FLAG_OWN_CAR || "").toUpperCase();
    const ownRealty = String(data.FLAG_OWN_REALTY || "").toUpperCase();
    const limitedAssets = ownCar === "N" && ownRealty === "N";

    const positive = [];
    const negative = [];

    // Positive factors
    if (hasExtScores && avgExt >= 0.5) positive.push("Strong external credit scores lowered the estimated risk.");
    if (employedLongTerm) positive.push("Stable employment history improved the applicant profile.");
    if (income > 0 && creditToIncome < 2) positive.push("Income appears healthy relative to the requested credit.");

    // Negative factors
    if (income > 0 && creditToIncome > 3) negative.push("Requested credit is high relative to annual income.");
    if (hasExtScores && avgExt < 0.3) negative.push("Low external credit scores increased the estimated risk.");
    if (shortEmployment) negative.push("Short employment history may indicate less financial stability.");
    if (income > 0 && annuityToIncome > 0.25) negative.push("Loan repayment burden appears high compared to income.");
    if (limitedAssets) negative.push("Limited asset ownership may slightly increase risk.");

    // Select most relevant 3 based on risk level
    const fallbacks = ["Assessment based on available applicant data.", "Credit profile evaluated against standard criteria.", "Multiple factors considered in the risk model."];
    let reasons = [];
    if (riskClass === "risk-low") {
        reasons = positive.length >= 3 ? positive.slice(0, 3) : [...positive, ...negative];
    } else if (riskClass === "risk-high") {
        reasons = negative.length >= 3 ? negative.slice(0, 3) : [...negative, ...positive];
    } else {
        const mixed = prob > 0.45 ? [...negative, ...positive] : [...positive, ...negative];
        reasons = mixed;
    }
    while (reasons.length < 3) reasons.push(fallbacks[reasons.length % fallbacks.length]);
    return reasons.slice(0, 3);
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("predict-form");
    const submitBtn = document.getElementById("submit-btn");
    const resultContent = document.getElementById("result-content");
    const historyBody = document.getElementById("history-body");
    const historyEmpty = document.getElementById("history-empty");
    const historyTableWrapper = document.getElementById("history-table-wrapper");

    function updateHistoryTable() {
        if (!historyBody || !historyEmpty) return;

        if (predictionHistory.length === 0) {
            historyBody.innerHTML = "";
            historyEmpty.style.display = "block";
            if (historyTableWrapper) historyTableWrapper.style.display = "none";
            return;
        }

        historyEmpty.style.display = "none";
        if (historyTableWrapper) historyTableWrapper.style.display = "block";
        historyBody.innerHTML = predictionHistory
            .map(
                (p) =>
                    `<tr>
                        <td>${Number(p.income).toLocaleString()}</td>
                        <td>${Number(p.credit).toLocaleString()}</td>
                        <td>${(p.probability * 100).toFixed(1)}%</td>
                        <td><span class="risk-badge risk-badge-${p.riskClass.replace("risk-", "")}">${p.riskLabel}</span></td>
                    </tr>`
            )
            .join("");
    }

    // Initialize: show empty message, hide table until first prediction
    updateHistoryTable();

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        submitBtn.disabled = true;
        resultContent.innerHTML = '<p class="loading">Predicting…</p>';

        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (value === "" || value === undefined) continue;
            if (key === "age") {
                const age = parseFloat(value) || 30;
                data["DAYS_BIRTH"] = Math.round(-age * 365.25);
            } else {
                const num = parseFloat(value);
                data[key] = isNaN(num) ? value : num;
            }
        }

        const defaults = {
            SK_ID_CURR: 0,
            REGION_POPULATION_RELATIVE: 0.01,
            DAYS_REGISTRATION: -2588,
            DAYS_ID_PUBLISH: -2120,
            OWN_CAR_AGE: 0,
            FLAG_MOBIL: 1,
            FLAG_EMP_PHONE: 1,
            FLAG_WORK_PHONE: 0,
            FLAG_CONT_MOBILE: 1,
            FLAG_PHONE: 0,
            FLAG_EMAIL: 0,
            REGION_RATING_CLIENT: 2,
            REGION_RATING_CLIENT_W_CITY: 2,
            HOUR_APPR_PROCESS_START: 10,
        };
        for (const [k, v] of Object.entries(defaults)) {
            if (!(k in data)) data[k] = v;
        }

        try {
            const res = await fetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const json = await res.json();

            if (json.error) {
                resultContent.innerHTML = `<div class="error-message">${json.error}</div>`;
            } else if (json.label) {
                const prob = json.probability;
                let riskClass, riskLabel, riskIcon;
                if (prob < 0.3) {
                    riskClass = "risk-low";
                    riskLabel = "Low Risk";
                    riskIcon = "✓";
                } else if (prob <= 0.6) {
                    riskClass = "risk-medium";
                    riskLabel = "Medium Risk";
                    riskIcon = "⚠";
                } else {
                    riskClass = "risk-high";
                    riskLabel = "High Risk";
                    riskIcon = "⛔";
                }

                const probPercent = (prob * 100).toFixed(1);
                const reasons = getPredictionReasons(data, prob, riskClass);
                const reasonsList = reasons.map((r) => `<li>${r}</li>`).join("");

                resultContent.innerHTML = `
                    <div class="result-card ${riskClass}">
                        <div class="result-icon" aria-hidden="true">${riskIcon}</div>
                        <div class="result-label">${riskLabel}</div>
                        <div class="result-probability">Risk probability: <span>${probPercent}%</span></div>
                        <div class="progress-bar-wrap">
                            <div class="progress-bar-track">
                                <div class="progress-bar-fill ${riskClass}" style="width: 0%" data-target="${probPercent}"></div>
                            </div>
                        </div>
                    </div>
                    <div class="why-prediction ${riskClass}">
                        <h4 class="why-prediction-title">Why this prediction?</h4>
                        <ul class="why-prediction-list">${reasonsList}</ul>
                    </div>
                `;

                // Animate progress bar
                requestAnimationFrame(() => {
                    const fill = resultContent.querySelector(".progress-bar-fill");
                    if (fill) fill.style.width = fill.dataset.target + "%";
                });

                // Add to history (keep last 5)
                const income = parseFloat(data.AMT_INCOME_TOTAL) || 0;
                const credit = parseFloat(data.AMT_CREDIT) || 0;
                predictionHistory.unshift({
                    income,
                    credit,
                    probability: prob,
                    riskLabel,
                    riskClass,
                });
                predictionHistory = predictionHistory.slice(0, 5);
                updateHistoryTable();
            } else {
                resultContent.innerHTML = '<div class="error-message">Invalid response from server.</div>';
            }
        } catch (err) {
            resultContent.innerHTML = `<div class="error-message">Request failed: ${err.message}</div>`;
        } finally {
            submitBtn.disabled = false;
        }
    });
});
