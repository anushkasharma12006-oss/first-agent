// =========================
// SPENDING FORM
// =========================

const spendingForm = document.getElementById("spendingForm");

if (spendingForm) {
    spendingForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("spendingName").value.trim();
        const amount = document.getElementById("spendingAmount").value;
        const category = document.getElementById("spendingCategory").value;
        const userId = localStorage.getItem("userId");

        if (!userId) {
            alert("Please login first.");
            window.location.href = "login.html";
            return;
        }

        try {
            const response = await fetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, name, amount, category })
            });

            const data = await response.json();
            if (!response.ok) {
                alert(data.message || "Could not add spending.");
                return;
            }

            alert("Spending added successfully!");
            spendingForm.reset();
            await loadExpenses();
        } catch (error) {
            console.error("Error:", error);
            alert("Could not connect to the server.");
        }
    });
}

async function loadExpenses() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
        const empty = document.getElementById("emptySpending");
        if (empty) empty.style.display = "block";
        return;
    }

    try {
        const response = await fetch(`/api/expenses?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();
        if (!response.ok) {
            console.error(data.message);
            return;
        }
        displayExpenses(data);
    } catch (error) {
        console.error("Error loading expenses:", error);
    }
}

function displayExpenses(expenses) {
    const spendingList = document.getElementById("spendingList");
    const emptySpending = document.getElementById("emptySpending");
    const totalSpending = document.getElementById("totalSpending");
    if (!spendingList) return;

    if (!expenses.length) {
        spendingList.innerHTML = "";
        if (emptySpending) emptySpending.style.display = "block";
        if (totalSpending) totalSpending.textContent = "₹0.00";
        return;
    }

    if (emptySpending) emptySpending.style.display = "none";
    spendingList.innerHTML = "";
    let total = 0;

    expenses.forEach((expense) => {
        const amount = Number(expense.amount) || 0;
        total += amount;
        const item = document.createElement("div");
        item.className = "spending-item";

        const left = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = expense.name || "Expense";
        const category = document.createElement("p");
        category.textContent = expense.category || "Other";
        left.append(title, category);

        const right = document.createElement("div");
        const amountEl = document.createElement("strong");
        amountEl.textContent = `₹${amount.toFixed(2)}`;
        right.appendChild(amountEl);
        item.append(left, right);
        spendingList.appendChild(item);
    });

    if (totalSpending) totalSpending.textContent = `₹${total.toFixed(2)}`;
}

loadExpenses();
